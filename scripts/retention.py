"""Retention report from the usage counts in accounts.db (counts only; no journal content is on the server).

    python scripts/retention.py [path/to/accounts.db]

Day-N retention is the share of users who opened the app exactly N days after signing up. It only counts users
old enough to have reached day N. Days are UTC.
"""

import sqlite3
import statistics
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

db = sqlite3.connect(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "accounts.db")
today = datetime.now(timezone.utc).date()
users = {r[0]: datetime.fromtimestamp(r[1], timezone.utc).date() for r in db.execute("SELECT id, created FROM users")}
if not db.execute("SELECT 1 FROM sqlite_master WHERE name = 'usage'").fetchone():
    sys.exit("No usage data yet: start the app once (it creates the tables), then let people use it.")
opens: dict[str, set[date]] = {}
for uid, day, n in db.execute("SELECT user_id, day, opens FROM usage"):
    if n:
        opens.setdefault(uid, set()).add(date.fromisoformat(day))

print(f"Users: {len(users)}")
for n in (1, 7, 30):
    eligible = [u for u, d in users.items() if d + timedelta(days=n) <= today]
    back = [u for u in eligible if users[u] + timedelta(days=n) in opens.get(u, set())]
    print(f"Day {n:>2} retention: {len(back)}/{len(eligible)}" + (f" = {len(back) / len(eligible):.0%}" if eligible else " (no users old enough yet)"))

week_ago = (today - timedelta(days=6)).isoformat()
weekly = [r[0] for r in db.execute("SELECT SUM(entries) FROM usage WHERE day >= ? GROUP BY user_id", (week_ago,))]
print(f"Entries per active user, last 7 days: {statistics.mean(weekly):.1f} (over {len(weekly)} users)" if weekly else "No entries in the last 7 days.")

gaps = [(first - created) / 60 for created, first in db.execute(
    "SELECT u.created, f.at FROM first_entry f JOIN users u ON u.id = f.user_id")]
print(f"Median minutes from sign-up to first entry: {statistics.median(gaps):.1f} (over {len(gaps)} users)" if gaps else "No first entries yet.")
