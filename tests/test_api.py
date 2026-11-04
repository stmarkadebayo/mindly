"""Accounts, sessions and the AI endpoints over HTTP, with speech and model stubbed out."""

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def main(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    from mindly import config
    importlib.reload(config)
    from mindly import main
    importlib.reload(main)
    return main


def signed_in(main, email="ada@example.com"):
    c = TestClient(main.app)
    r = c.post("/api/auth/signup", json={"email": email, "password": "correct horse", "name": "Ada"})
    assert r.status_code == 200, r.text
    return c


def test_signup_login_logout(main):
    c = signed_in(main)
    assert c.get("/api/me").json()["email"] == "ada@example.com"
    c.post("/api/auth/logout")
    assert c.get("/api/me").status_code == 401
    assert c.post("/api/auth/login", json={"email": "ADA@example.com", "password": "wrong pass"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "ADA@example.com", "password": "correct horse"}).status_code == 200


def test_signup_validation(main):
    c = TestClient(main.app)
    assert c.post("/api/auth/signup", json={"email": "nope", "password": "longenough"}).status_code == 400
    assert c.post("/api/auth/signup", json={"email": "a@b.co", "password": "short"}).status_code == 400
    signed_in(main, "dup@example.com")
    assert c.post("/api/auth/signup", json={"email": "dup@example.com", "password": "longenough"}).status_code == 400


def test_profile_and_delete_account(main):
    c = signed_in(main)
    me = c.put("/api/me", json={"name": "Ada L", "profile": {"goals": ["mood"], "onboarded": True}}).json()
    assert me["name"] == "Ada L" and me["profile"]["onboarded"]
    c.delete("/api/me")
    assert c.get("/api/me").status_code == 401


def test_google_sign_in_verifies_audience(main, monkeypatch):
    claims = {"aud": "client-123", "iss": "accounts.google.com", "email_verified": "true",
              "exp": "9999999999", "sub": "g-1", "email": "ada@example.com", "name": "Ada"}

    class Resp:
        status_code = 200
        def json(self): return claims

    monkeypatch.setattr(main.httpx, "get", lambda *a, **k: Resp())
    c = TestClient(main.app)
    assert c.post("/api/auth/google", json={"credential": "tok"}).json()["google"] is True
    claims["aud"] = "someone-else"
    assert TestClient(main.app).post("/api/auth/google", json={"credential": "tok"}).status_code == 401


def test_ai_endpoints_require_sign_in(main):
    c = TestClient(main.app)
    assert c.post("/api/write", json={"transcript": "hi there"}).status_code == 401
    assert c.post("/api/companion", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


def test_transcribe_and_write(main, monkeypatch):
    import mindly.asr
    hints = []
    monkeypatch.setattr(mindly.asr, "transcribe",
                        lambda path, lang, room=False: hints.append(lang) or {"text": "um I finally finished it", "language": "en"})
    monkeypatch.setattr(main, "write_page", lambda t, p, c, now=None, open_tasks=None: {"title": "Done", "body": "I finally finished it."})
    c = signed_in(main)
    r = c.post("/api/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}, data={"language": "ha"}).json()
    assert r["text"] and r["no_speech"] is False
    assert hints == [None]  # only English and Yoruba are passed as hints; anything else auto-detects
    w = c.post("/api/write", json={"transcript": r["text"]}).json()
    assert w["body"] == "I finally finished it." and w["support"] is False


def test_silence_is_reported_as_no_speech(main, monkeypatch):
    import mindly.asr
    monkeypatch.setattr(mindly.asr, "transcribe", lambda path, lang, room=False: {"text": "", "language": "en"})
    c = signed_in(main)
    assert c.post("/api/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).json()["no_speech"] is True


def test_rejects_unsupported_audio(main):
    c = signed_in(main)
    assert c.post("/api/transcribe", files={"audio": ("a.exe", b"x", "application/x")}).status_code == 415


def test_daily_ai_limit(main, monkeypatch):
    monkeypatch.setattr(main.config, "DAILY_AI_LIMIT", 2)
    monkeypatch.setattr(main, "write_page", lambda t, p, c, now=None, open_tasks=None: {"title": "T", "body": "B"})
    c = signed_in(main)
    codes = [c.post("/api/write", json={"transcript": "hello world"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# --- security, speech errors, streaming ---------------------------------------

def test_security_headers_and_no_store_on_api(main):
    r = TestClient(main.app).get("/api/config")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert "microphone=(self)" in r.headers["permissions-policy"]
    assert r.headers["cache-control"] == "no-store"


def test_cross_site_writes_are_refused(main):
    c = TestClient(main.app)
    body = {"email": "ada@example.com", "password": "correct horse"}
    assert c.post("/api/auth/signup", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert c.post("/api/auth/signup", json=body, headers={"Origin": "http://testserver"}).status_code == 200


def test_api_docs_are_not_public(main):
    c = TestClient(main.app)
    assert c.get("/docs").status_code != 200 and c.get("/openapi.json").status_code != 200


def test_speech_service_outage_is_a_502_not_a_400(main, monkeypatch):
    import mindly.asr
    def down(path, lang, room=False): raise mindly.asr.ASRError("Couldn't reach the speech service.")
    monkeypatch.setattr(mindly.asr, "transcribe", down)
    c = signed_in(main)
    r = c.post("/api/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")})
    assert r.status_code == 502 and "speech service" in r.json()["detail"]


def test_companion_stream_is_ndjson_and_requires_sign_in(main, monkeypatch):
    import json as j
    payload = {"entries": [], "messages": [{"role": "user", "content": "hello"}]}
    assert TestClient(main.app).post("/api/companion/stream", json=payload).status_code == 401

    def events(entries, messages, anchor_id, name):
        yield {"t": "delta", "v": "Hi"}
        yield {"t": "final", "reply": "Hi", "sources": [], "support": False}

    monkeypatch.setattr(main, "companion_events", events)
    c = signed_in(main)
    r = c.post("/api/companion/stream", json=payload)
    assert r.headers["content-type"].startswith("application/x-ndjson")
    lines = [j.loads(l) for l in r.text.splitlines()]
    assert [l["t"] for l in lines] == ["delta", "final"]


def test_companion_rejects_oversized_journal_context(main):
    c = signed_in(main)
    entries = [{"id": str(i), "created": "2026-10-01T09:00:00", "body": "x" * 19_000} for i in range(30)]
    r = c.post("/api/companion", json={"entries": entries, "messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 413


def test_cache_headers_for_api_and_app(main, tmp_path, monkeypatch):
    c = TestClient(main.app)
    assert c.get("/api/config").headers["cache-control"] == "no-store"
    # the static app is only mounted when a build exists; check the rule directly on a fake build
    out = main.config.ROOT / "frontend" / "out"
    if out.exists():
        assert c.get("/").headers.get("cache-control") == "no-cache"


def test_usage_counts_are_recorded_and_removed_with_the_account(main):
    c = signed_in(main)
    assert c.post("/api/metric", json={"kind": "open"}).status_code == 200
    assert c.post("/api/metric", json={"kind": "entry"}).status_code == 200
    assert c.post("/api/metric", json={"kind": "bogus"}).status_code == 422
    row = main.accounts.db.execute("SELECT opens, entries FROM usage").fetchone()
    assert (row["opens"], row["entries"]) == (1, 1)
    assert main.accounts.db.execute("SELECT COUNT(*) FROM first_entry").fetchone()[0] == 1
    assert c.delete("/api/me").status_code == 200
    assert main.accounts.db.execute("SELECT COUNT(*) FROM usage").fetchone()[0] == 0


def test_reminder_needs_keys_and_a_real_push_service(main, monkeypatch):
    from mindly import config
    c = signed_in(main)
    good = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "x", "auth": "y"}}
    body = {"subscription": good, "minutes": 1260, "tz_offset": 60}
    monkeypatch.setattr(config, "VAPID_PUBLIC_KEY", "")
    assert c.put("/api/reminder", json=body).status_code == 503
    monkeypatch.setattr(config, "VAPID_PUBLIC_KEY", "pub")
    assert c.put("/api/reminder", json=body).status_code == 200
    evil = {**body, "subscription": {"endpoint": "https://169.254.169.254/x", "keys": {"p256dh": "x", "auth": "y"}}}
    assert c.put("/api/reminder", json=evil).status_code == 400  # the server must not be pointed at arbitrary addresses
    assert c.delete("/api/reminder").status_code == 200



def test_transcriptions_run_side_by_side(main, monkeypatch):
    """A slow speech call must not hold up the rest of the server: two at once take about as long as one."""
    import asyncio
    import time

    import httpx
    import mindly.asr

    monkeypatch.setattr(mindly.asr, "transcribe", lambda path, lang, room=False: time.sleep(1) or {"text": "hello there friend", "language": "en"})
    cookie = "; ".join(f"{k}={v}" for k, v in signed_in(main).cookies.items())

    async def both():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://testserver", headers={"cookie": cookie}) as c:
            send = lambda: c.post("/api/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")})
            start = time.perf_counter()
            results = await asyncio.gather(send(), send(), c.get("/api/health"))
            return time.perf_counter() - start, results

    took, results = asyncio.run(both())
    assert all(r.status_code == 200 for r in results), [(r.status_code, r.text[:120]) for r in results]
    assert took < 1.6, f"transcriptions ran one after the other ({took:.2f}s)"  # one after the other takes 2s or more


def test_limiter_forgets_idle_keys(main, monkeypatch):
    lim = main.Limiter()
    for i in range(10_001):
        lim.hits[f"old{i}"] = [0.0]  # last seen in 1970
    assert lim.allow("fresh", 5, 60)
    assert set(lim.hits) == {"fresh"}
