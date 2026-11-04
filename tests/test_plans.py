"""Plans: the free trial, the free speech allowance, and Paystack's webhook."""

import hashlib
import hmac
import importlib
import json
import sqlite3
import time

import pytest
from fastapi.testclient import TestClient

from mindly import billing
from mindly.accounts import TRIAL_DAYS, Accounts


@pytest.fixture
def main(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test")
    monkeypatch.setenv("PAYSTACK_PLAN_NGN", "PLN_1")
    monkeypatch.setenv("PAYSTACK_PLAN_USD", "PLN_2")
    monkeypatch.setenv("FREE_DAILY_SECONDS", "60")
    from mindly import config
    importlib.reload(config)
    from mindly import main
    importlib.reload(main)
    return main


def signed_in(main, email="ada@example.com"):
    c = TestClient(main.app)
    assert c.post("/api/auth/signup", json={"email": email, "password": "correct horse"}).status_code == 200
    return c


def end_trial(main, email="ada@example.com"):
    main.accounts.db.execute("UPDATE users SET trial_ends = ? WHERE email = ?", (time.time() - 1, email))
    main.accounts.db.commit()


def speak(c, seconds, **form):
    return c.post("/api/transcribe", files={"audio": ("a.webm", b"x" * 4000, "audio/webm")}, data=form)


def test_new_accounts_start_on_a_pro_trial(main):
    me = signed_in(main).get("/api/me").json()
    assert me["plan"] == "pro" and me["on_trial"] and not me["paid"]
    assert abs(me["trial_ends"] - (time.time() + TRIAL_DAYS * 86400)) < 60


def test_existing_accounts_get_a_trial_when_the_database_is_upgraded(tmp_path):
    path = tmp_path / "old.db"
    old = sqlite3.connect(path)
    old.executescript("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT DEFAULT '', password TEXT, google_sub TEXT, "
                      "profile TEXT DEFAULT '{}', created REAL); CREATE TABLE usage (user_id TEXT, day TEXT, opens INTEGER DEFAULT 0, "
                      "entries INTEGER DEFAULT 0, PRIMARY KEY (user_id, day)); INSERT INTO users (id, email, created) VALUES ('u1', 'a@b.co', 1);")
    old.commit(); old.close()
    user = Accounts(path).user("u1")
    assert user["plan"] == "pro" and user["on_trial"]


def test_free_speech_allowance_and_pro_only_features(main, monkeypatch):
    monkeypatch.setattr("mindly.asr.transcribe", lambda *a, **k: {"text": "hello there friend", "language": "en", "duration": 40})
    c = signed_in(main)
    end_trial(main)
    assert c.get("/api/me").json()["plan"] == "free"
    assert speak(c, 40, room="1").status_code == 402       # room mode is Pro
    assert speak(c, 40).status_code == 200                 # 40 of 60 seconds
    assert speak(c, 40).status_code == 200                 # allowed to finish a note that starts under the limit
    assert speak(c, 40).status_code == 402                 # 80 used: out for today
    assert "free minutes" in speak(c, 40).json()["detail"]


def test_pro_has_no_speech_limit(main, monkeypatch):
    monkeypatch.setattr("mindly.asr.transcribe", lambda *a, **k: {"text": "hello there friend", "language": "en", "duration": 500})
    c = signed_in(main)
    assert all(speak(c, 500).status_code == 200 for _ in range(3))


def sign(body: bytes, secret="sk_test"):
    return hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()


def hook(c, event, **kw):
    body = json.dumps(event).encode()
    return c.post("/api/billing/webhook", content=body, headers={"x-paystack-signature": sign(body, **kw)})


def test_webhook_rejects_bad_signatures(main):
    c = TestClient(main.app)
    body = b"{}"
    assert c.post("/api/billing/webhook", content=body, headers={"x-paystack-signature": sign(body, secret="other")}).status_code == 400
    assert c.post("/api/billing/webhook", content=body).status_code == 400
    assert c.post("/api/billing/webhook", content=body, headers={"x-paystack-signature": sign(body)}).status_code == 200


def charge(uid=None, plan="PLN_1", status="success", **extra):
    data = {"status": status, "customer": {"customer_code": "CUS_1", "email": "ada@example.com"}, "plan": {"plan_code": plan}, **extra}
    if uid:
        data["metadata"] = {"user_id": uid}
    return {"event": "charge.success", "data": data}


def test_payment_makes_pro_and_later_charges_find_the_account(main):
    c = signed_in(main)
    end_trial(main)
    me = c.get("/api/me").json()
    assert me["plan"] == "free"
    hook(c, charge(me["id"]))
    me = c.get("/api/me").json()
    assert me["plan"] == "pro" and me["paid"] and not me["on_trial"]
    # A renewal carries no metadata, only the customer Paystack remembered from the first charge.
    end_trial(main)
    main.accounts.set_paid_until(me["id"], 0)
    hook(c, charge())
    assert c.get("/api/me").json()["paid"]


def test_other_charges_and_failed_charges_do_not_upgrade(main):
    c = signed_in(main)
    end_trial(main)
    uid = c.get("/api/me").json()["id"]
    hook(c, charge(uid, status="failed"))
    hook(c, charge(plan="PLN_OTHER", customer={"customer_code": "CUS_X", "email": "ada@example.com"}))
    assert c.get("/api/me").json()["plan"] == "free"


def test_checkout_and_manage_talk_to_paystack(main, monkeypatch):
    seen = {}
    def fake(method, path, **kw):
        seen[path] = kw
        return {"authorization_url": "https://paystack.test/pay"} if path == "transaction/initialize" else {"link": "https://paystack.test/manage"}
    monkeypatch.setattr(billing, "_call", fake)
    c = signed_in(main)
    assert c.post("/api/billing/checkout").json() == {"url": "https://paystack.test/pay"}
    sent = seen["transaction/initialize"]["json"]
    assert sent["plan"] == "PLN_1" and sent["currency"] == "NGN" and sent["amount"] == 500000 and sent["metadata"]["user_id"] and sent["email"]
    c.post("/api/billing/checkout", json={"currency": "usd"})
    assert seen["transaction/initialize"]["json"]["plan"] == "PLN_2" and seen["transaction/initialize"]["json"]["amount"] == 500
    assert TestClient(main.app).post("/api/billing/checkout").status_code == 401
    assert c.post("/api/billing/portal").status_code == 404  # nothing to manage yet
    uid = c.get("/api/me").json()["id"]
    hook(c, {"event": "subscription.create", "data": {"subscription_code": "SUB_1", "customer": {"customer_code": "CUS_1", "email": "ada@example.com"}, "metadata": {"user_id": uid}}})
    assert c.post("/api/billing/portal").json() == {"url": "https://paystack.test/manage"}
    assert "subscription/SUB_1/manage/link" in seen


def test_prices_and_region(main, monkeypatch):
    from mindly import region
    c = signed_in(main)
    assert c.get("/api/config").json()["prices"] == {"NGN": "₦5,000/month", "USD": "$5/month"}
    # One plan only: that currency is the fallback for everyone.
    monkeypatch.setattr(main.config, "PAYSTACK_PLAN_USD", "")
    assert c.get("/api/config").json()["prices"] == {"NGN": "₦5,000/month"}
    seen = {}
    monkeypatch.setattr(billing, "_call", lambda m, path, **kw: seen.update(kw) or {"authorization_url": "https://paystack.test/pay"})
    c.post("/api/billing/checkout", json={"currency": "USD"})
    assert seen["json"]["currency"] == "NGN"
    # Region: a proxy header wins, private addresses are unknown, and a lookup is cached.
    assert region.country({"cf-ipcountry": "ng"}, "1.2.3.4") == "NG"
    assert region.country({}, "127.0.0.1") is None and region.country({}, "10.0.0.5") is None
    calls = []
    class Resp:
        status_code, text = 200, "ng\n"
    monkeypatch.setattr(region.httpx, "get", lambda *a, **k: calls.append(a) or Resp())
    region._cache.clear()
    assert region.country({"x-forwarded-for": "102.89.1.1, 10.0.0.1"}, "10.0.0.1") == "NG"
    assert region.country({"x-forwarded-for": "102.89.1.1"}, None) == "NG" and len(calls) == 1
    assert c.get("/api/region").json() == {"country": None}  # the test client is a private address


def test_accounts_are_safe_to_use_from_many_threads_at_once(tmp_path):
    """The server answers requests on several threads that share one database connection."""
    from concurrent.futures import ThreadPoolExecutor
    accounts = Accounts(tmp_path / "a.db")
    uid = accounts.sign_up("ada@example.com", "correct horse")["id"]
    token = accounts.new_session(uid)

    def busy(_):
        for _ in range(200):
            accounts.add_seconds(uid, 1)
            assert accounts.session_user(token)["id"] == uid
            accounts.seconds_today(uid)

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(busy, range(8)))
    assert accounts.seconds_today(uid) == 8 * 200
