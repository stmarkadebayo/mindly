"""The daily nudge: who gets it, when, and only once."""

import json
import time

from mindly import reminders
from mindly.accounts import Accounts

SUB = {"endpoint": "https://fcm.googleapis.com/x", "keys": {"p256dh": "a", "auth": "b"}}
NOON_UTC = time.mktime((2026, 11, 2, 12, 0, 0, 0, 0, 0)) - time.timezone  # 12:00 UTC on a Monday


def setup(minutes=21 * 60, tz=60):
    a = Accounts(":memory:")
    u = a.sign_up("ada@example.com", "correct horse")["id"]
    a.set_reminder(u, SUB, minutes, tz)
    return a, u


def test_sends_once_after_the_chosen_local_time():
    a, u = setup()  # 21:00 local, one hour ahead of UTC
    sent = []
    assert reminders.send_due(a, NOON_UTC, sent.append) == 0                      # 13:00 local: too early
    assert reminders.send_due(a, NOON_UTC + 8.5 * 3600, sent.append) == 1         # 21:30 local
    assert reminders.send_due(a, NOON_UTC + 9 * 3600, sent.append) == 0           # already sent today
    assert sent == [SUB]


def test_skips_someone_who_already_journaled_today(monkeypatch):
    a, u = setup()
    monkeypatch.setattr(a, "entries_today", lambda _u: 1)
    assert reminders.send_due(a, NOON_UTC + 9 * 3600, lambda s: 1 / 0) == 0


def test_a_gone_subscription_is_dropped():
    a, u = setup()

    class Gone(Exception):
        response = type("R", (), {"status_code": 410})()

    def boom(_):
        raise Gone()

    assert reminders.send_due(a, NOON_UTC + 9 * 3600, boom) == 0
    assert a.reminders() == []


def test_only_real_push_services_are_accepted():
    assert reminders.valid_subscription(SUB)
    assert not reminders.valid_subscription({**SUB, "endpoint": "http://fcm.googleapis.com/x"})
    assert not reminders.valid_subscription({**SUB, "endpoint": "https://evil.example/x"})
    assert not reminders.valid_subscription({"endpoint": SUB["endpoint"], "keys": {}})
