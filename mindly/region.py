"""Which country a request seems to come from, used only to pick a default price (naira or dollars).
The person can always switch, so a wrong guess costs nothing. Results are cached so each address is looked up once."""

import ipaddress

import httpx

_cache: dict[str, str | None] = {}
MAX_CACHE = 5000


def client_ip(headers, fallback: str | None) -> str | None:
    forwarded = (headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return forwarded or fallback


def country(headers, fallback: str | None) -> str | None:
    """A two-letter country code, or None when unknown (a private address, or the lookup failed)."""
    given = (headers.get("cf-ipcountry") or "").upper()  # set for free when the site sits behind Cloudflare
    if len(given) == 2 and given.isalpha():
        return given
    ip = client_ip(headers, fallback)
    try:
        if not ip or not ipaddress.ip_address(ip).is_global:
            return None
    except ValueError:
        return None
    if ip not in _cache:
        if len(_cache) >= MAX_CACHE:
            _cache.clear()
        try:
            resp = httpx.get(f"https://ipapi.co/{ip}/country/", timeout=2)
            code = resp.text.strip().upper()
            _cache[ip] = code if resp.status_code == 200 and len(code) == 2 and code.isalpha() else None
        except httpx.HTTPError:
            return None  # not cached, so a later request can try again
    return _cache[ip]
