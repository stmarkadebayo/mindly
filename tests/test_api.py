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
                        lambda path, lang: hints.append(lang) or {"text": "um I finally finished it", "language": "en"})
    monkeypatch.setattr(main, "write_entry", lambda t, p, c: {"title": "Done", "body": "I finally finished it."})
    c = signed_in(main)
    r = c.post("/api/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}, data={"language": "ha"}).json()
    assert r["text"] and r["no_speech"] is False
    assert hints == [None]  # only English and Yoruba are passed as hints; anything else auto-detects
    w = c.post("/api/write", json={"transcript": r["text"]}).json()
    assert w["body"] == "I finally finished it." and w["support"] is False


def test_silence_is_reported_as_no_speech(main, monkeypatch):
    import mindly.asr
    monkeypatch.setattr(mindly.asr, "transcribe", lambda path, lang: {"text": "", "language": "en"})
    c = signed_in(main)
    assert c.post("/api/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).json()["no_speech"] is True


def test_rejects_unsupported_audio(main):
    c = signed_in(main)
    assert c.post("/api/transcribe", files={"audio": ("a.exe", b"x", "application/x")}).status_code == 415


def test_daily_ai_limit(main, monkeypatch):
    monkeypatch.setattr(main.config, "DAILY_AI_LIMIT", 2)
    monkeypatch.setattr(main, "write_entry", lambda t, p, c: {"title": "T", "body": "B"})
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
    def down(path, lang): raise mindly.asr.ASRError("Couldn't reach the speech service.")
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
