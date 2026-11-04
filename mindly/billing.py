"""Paystack subscriptions for the Pro plan, over plain HTTPS (no SDK). Paystack tells us about payments by webhook;
the plan itself is just a `paid_until` date on the account."""

import hashlib
import hmac
import time

import httpx

from . import config

API = "https://api.paystack.co"
PERIOD = 31 * 86400  # one monthly charge covers this long
GRACE = 2 * 86400    # a late renewal shouldn't lock someone out for a weekend


SYMBOLS = {"NGN": "₦", "USD": "$"}


def plans() -> dict[str, dict]:
    """The plans that are set up, by currency."""
    found = {"NGN": (config.PAYSTACK_PLAN_NGN, config.PAYSTACK_AMOUNT_NGN), "USD": (config.PAYSTACK_PLAN_USD, config.PAYSTACK_AMOUNT_USD)}
    return {cur: {"code": code, "amount": amount} for cur, (code, amount) in found.items() if code}


def enabled() -> bool:
    return bool(config.PAYSTACK_SECRET_KEY and plans())


def prices() -> dict[str, str]:
    """What to show for each currency, for example {"NGN": "₦5,000/month", "USD": "$5/month"}."""
    return {cur: f"{SYMBOLS[cur]}{p['amount'] // 100:,}/month" for cur, p in plans().items()} if enabled() else {}


def _call(method: str, path: str, **kw) -> dict:
    try:
        resp = httpx.request(method, f"{API}/{path}", headers={"Authorization": f"Bearer {config.PAYSTACK_SECRET_KEY}"}, timeout=15, **kw)
    except httpx.HTTPError as exc:
        raise RuntimeError("Couldn't reach Paystack") from exc
    body = resp.json() if resp.content else {}
    if resp.status_code != 200 or not body.get("status"):
        raise RuntimeError(f"Paystack returned {resp.status_code}")
    return body["data"]


def checkout_url(user: dict, base: str, currency: str = "NGN") -> str:
    """A hosted payment page that also creates the monthly subscription. The user id rides along as metadata.
    A currency that has no plan set up falls back to one that does."""
    available = plans()
    currency = currency if currency in available else next(iter(available))
    data = {"email": user["email"], "plan": available[currency]["code"], "amount": available[currency]["amount"], "currency": currency,
            "callback_url": f"{base}/settings/?upgraded=1", "metadata": {"user_id": user["id"]}}
    return _call("POST", "transaction/initialize", json=data)["authorization_url"]


def manage_url(subscription: str) -> str:
    """Paystack's own page to update the card or cancel."""
    return _call("GET", f"subscription/{subscription}/manage/link")["link"]


def verify(payload: bytes, signature: str, secret: str) -> bool:
    """Paystack signs the raw body with HMAC-SHA512 using the secret key, in `x-paystack-signature`."""
    expected = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def _owner(data: dict, accounts) -> dict | None:
    customer = data.get("customer") or {}
    uid = (data.get("metadata") or {}).get("user_id") if isinstance(data.get("metadata"), dict) else None
    return (accounts.user(uid) if uid else None) or accounts.by_customer(customer.get("customer_code", "")) \
        or accounts.by_email(customer.get("email", ""))


def apply(event: dict, accounts) -> None:
    """Update the account an event is about. Unknown event types are ignored.
    Cancelling needs no event: the paid-until date simply isn't extended again."""
    data, kind = event.get("data") or {}, event.get("event")
    user = _owner(data, accounts)
    if not user:
        return
    customer = (data.get("customer") or {}).get("customer_code")
    if kind == "charge.success" and data.get("status") == "success":
        ours = isinstance(data.get("metadata"), dict) and data["metadata"].get("user_id") or \
            (data.get("plan") or {}).get("plan_code") in {p["code"] for p in plans().values()}  # the account may sell other things too
        if ours:
            accounts.set_paid_until(user["id"], time.time() + PERIOD + GRACE, customer)
    elif kind == "subscription.create" and data.get("subscription_code"):
        accounts.link_payment(user["id"], customer, data["subscription_code"])
