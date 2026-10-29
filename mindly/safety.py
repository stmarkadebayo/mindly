"""Spot language that suggests someone may be in danger, so the app can surface real help.

This is a deliberately simple, high-recall keyword check. It never blocks or alters anything the
person writes; it only decides whether to show the support card alongside the normal response.
"""

import re

PATTERNS = [
    r"\bkill(ing)? myself\b", r"\bend(ing)? (my|it all|my life)\b", r"\bsuicid", r"\bwant(ed)? to die\b",
    r"\bwish i (was|were) dead\b", r"\bbetter off (dead|without me)\b", r"\b(hurt|harm|cut)(ing)? myself\b",
    r"\bself[- ]harm", r"\bno reason to live\b", r"\bcan'?t go on\b", r"\btake my (own )?life\b",
    r"\boverdose\b",
    r"\bi wan(t)? die\b", r"\bmake i (just )?die\b",  # Nigerian Pidgin
]
_RISK = re.compile("|".join(PATTERNS), re.IGNORECASE)


def needs_support(*texts: str | None) -> bool:
    return any(t and _RISK.search(t) for t in texts)
