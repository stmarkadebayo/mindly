"""The daily "time to journal" nudge, sent by web push.

The message is the same for everyone and carries nothing from the journal (which never reaches the server). Anyone who has
already written an entry today is skipped.
"""

import json
import logging
import threading
import time
from urllib.parse import urlparse

from . import config

log = logging.getLogger("mindly.reminders")
MESSAGE = {"title": "Mindly", "body": "Got a minute? Say what's on your mind."}
# The server makes a request to the address a browser registers, so only the real push services are accepted.
PUSH_HOSTS = (".googleapis.com", ".mozilla.com", ".windows.com", ".apple.com")


def valid_subscription(sub: dict) -> bool:
    host = urlparse(str(sub.get("endpoint", ""))).hostname or ""
    keys = sub.get("keys") or {}
    return str(sub.get("endpoint", "")).startswith("https://") and host.endswith(PUSH_HOSTS) and bool(keys.get("p256dh")) and bool(keys.get("auth"))


def send(subscription: dict):
    from pywebpush import webpush

    webpush(subscription_info=subscription, data=json.dumps(MESSAGE), vapid_private_key=config.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": config.VAPID_SUBJECT}, ttl=6 * 3600)


def send_due(accounts, now: float | None = None, sender=send) -> int:
    """Send to everyone whose chosen time has passed today and who hasn't journaled. Returns how many were sent."""
    now = time.time() if now is None else now
    sent = 0
    for row in accounts.reminders():
        local = time.gmtime(now + row["tz_offset"] * 60)
        day, minutes = time.strftime("%Y-%m-%d", local), local.tm_hour * 60 + local.tm_min
        if minutes < row["minutes"] or row["last_sent"] == day:
            continue
        if not accounts.claim_reminder(row["user_id"], day) or accounts.entries_today(row["user_id"]):
            continue
        try:
            sender(json.loads(row["subscription"]))
            sent += 1
        except Exception as exc:  # a gone subscription (404/410) is dropped; anything else is tried again tomorrow
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                accounts.clear_reminder(row["user_id"])
            log.warning("reminder failed (%s): %s", status, exc)
    return sent


def start(accounts):
    """Check once a minute, on a background thread."""
    def loop():
        while True:
            try:
                send_due(accounts)
            except Exception:
                log.exception("reminder loop")
            time.sleep(60)
    threading.Thread(target=loop, daemon=True, name="reminders").start()
