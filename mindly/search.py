"""Throwaway full-text index over the entries a device sends with one reflection request.

Journals live on the device, so the server never keeps an index. Each request builds an
in-memory SQLite FTS5 table from the entries it was given and discards it afterwards. Porter stemming lets
"exams" find "exam" and "sleeping" find "slept"-style variants of the same word.
"""

import re
import sqlite3

# Common words that make poor search terms.
STOPWORDS = set("""a about after again all also am an and any are as at be because been before being
but by can could did do does doing don't down for from had has have having he her here him his how i i'm
if in into is it it's its just know like me more my myself no not now of off on once only or other our
out over really said same say she should so some still such than that the their them then there these
they thing things think this those through to today too up very was we well were what when where which
while who why will with would yeah you your um uh okay ok go went get got going one feel feeling""".split())


def search_terms(text: str, limit: int = 12) -> list[str]:
    """Pick distinctive words from text to use as a full-text query."""
    seen, terms = set(), []
    for w in re.findall(r"[^\W\d_]{3,}", text.lower()):
        if w not in STOPWORDS and w not in seen:
            seen.add(w)
            terms.append(w)
    return sorted(terms, key=len, reverse=True)[:limit]  # longer words tend to be more distinctive


class EntryIndex:
    def __init__(self, entries: list[dict]):
        self.entries = {e["id"]: e for e in entries}
        self.db = sqlite3.connect(":memory:")
        self.db.execute("CREATE VIRTUAL TABLE fts USING fts5(id UNINDEXED, title, body,"
                        " tokenize = 'porter unicode61 remove_diacritics 2')")
        self.db.executemany("INSERT INTO fts VALUES (?, ?, ?)",
                            [(e["id"], e.get("title") or "", e.get("body") or "") for e in entries])

    def search(self, text: str, exclude: str | None = None, limit: int = 6) -> list[dict]:
        terms = search_terms(text)
        if not terms:
            return []
        rows = self.db.execute(
            "SELECT id, snippet(fts, 2, '', '', ' … ', 24) FROM fts WHERE fts MATCH ? AND id != ?"
            " ORDER BY bm25(fts, 2.0, 1.0) LIMIT ?",
            (" OR ".join(f'"{t}"' for t in terms), exclude or "", limit),
        ).fetchall()
        return [{**self.brief(self.entries[i]), "excerpt": snip} for i, snip in rows]

    def recent(self, exclude: str | None = None, limit: int = 3) -> list[dict]:
        others = [e for e in self.entries.values() if e["id"] != exclude]
        others.sort(key=lambda e: e["created"], reverse=True)
        return [{**self.brief(e), "excerpt": (e.get("body") or "")[:200]} for e in others[:limit]]

    def get(self, entry_id: str) -> dict | None:
        return self.entries.get(entry_id)

    @staticmethod
    def brief(e: dict) -> dict:
        return {"id": e["id"], "created": e["created"], "title": e.get("title") or "Untitled"}
