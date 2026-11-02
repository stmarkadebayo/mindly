"""Accounts and sessions. Only identity and profile live on the server; journals stay on the device."""

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from pathlib import Path

SESSION_DAYS = 30
TRIAL_DAYS = 30  # everyone starts with this much Pro, no card needed

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    password   TEXT,             -- scrypt hash; NULL for Google-only accounts
    google_sub TEXT UNIQUE,
    profile    TEXT NOT NULL DEFAULT '{}',
    created    REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,  -- we store only a hash of the cookie value
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires    REAL NOT NULL
);
-- Counts only, never content: how many times the app was opened and entries written each (UTC) day.
CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     TEXT NOT NULL,
    opens   INTEGER NOT NULL DEFAULT 0,
    entries INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);
-- The daily nudge: when to send it (the person's local time) and where. It carries no journal content.
CREATE TABLE IF NOT EXISTS push (
    user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subscription TEXT NOT NULL,
    minutes      INTEGER NOT NULL,   -- local time of day, minutes after midnight
    tz_offset    INTEGER NOT NULL,   -- minutes east of UTC
    last_sent    TEXT                -- the local day it last went out
);
CREATE TABLE IF NOT EXISTS first_entry (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    at      REAL NOT NULL
);
"""

# Columns added after the first release; existing databases get them on start.
MIGRATIONS = {
    "users": {"trial_ends": "REAL", "paid_until": "REAL", "pay_customer": "TEXT", "pay_subscription": "TEXT"},
    "usage": {"seconds": "INTEGER NOT NULL DEFAULT 0"},  # speech transcribed that day
}

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(ValueError):
    pass


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    _, salt, digest = stored.split("$")
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt)).split("$")[2], digest)


def _trial_end() -> float:
    return time.time() + TRIAL_DAYS * 86400


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class Accounts:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA)
        self.lock = threading.Lock()
        self._migrate()

    def _migrate(self):
        if "stripe_customer" in {r["name"] for r in self.db.execute("PRAGMA table_info(users)")}:  # the column's first name
            self.db.execute("ALTER TABLE users RENAME COLUMN stripe_customer TO pay_customer")
        for table, columns in MIGRATIONS.items():
            have = {r["name"] for r in self.db.execute(f"PRAGMA table_info({table})")}
            for name, kind in columns.items():
                if name not in have:
                    self.db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")
        # Accounts made before plans existed get the same trial as a new sign-up, counted from now.
        self.db.execute("UPDATE users SET trial_ends = ? WHERE trial_ends IS NULL", (time.time() + TRIAL_DAYS * 86400,))
        self.db.commit()

    def _public(self, row) -> dict | None:
        if not row:
            return None
        now = time.time()
        paid, trial = (row["paid_until"] or 0) > now, (row["trial_ends"] or 0) > now
        return {"id": row["id"], "email": row["email"], "name": row["name"],
                "profile": json.loads(row["profile"]), "has_password": row["password"] is not None,
                "google": row["google_sub"] is not None,
                "plan": "pro" if paid or trial else "free", "paid": paid, "on_trial": trial and not paid,
                "trial_ends": row["trial_ends"], "paid_until": row["paid_until"]}

    def user(self, user_id: str) -> dict | None:
        return self._public(self.db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())

    def sign_up(self, email: str, password: str, name: str = "") -> dict:
        email = email.strip().lower()
        if not EMAIL.match(email):
            raise AuthError("Enter a valid email address.")
        if len(password) < 8:
            raise AuthError("Use at least 8 characters for your password.")
        with self.lock:
            if self.db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
                raise AuthError("An account with this email already exists. Sign in instead.")
            user_id = secrets.token_hex(8)
            self.db.execute("INSERT INTO users (id, email, name, password, created, trial_ends) VALUES (?, ?, ?, ?, ?, ?)",
                            (user_id, email, name.strip()[:80], hash_password(password), time.time(), _trial_end()))
            self.db.commit()
        return self.user(user_id)

    def sign_in(self, email: str, password: str) -> dict:
        row = self.db.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        if not row or not check_password(password, row["password"]):
            raise AuthError("That email and password don't match.")
        return self._public(row)

    def google(self, sub: str, email: str, name: str) -> dict:
        """Find or create the account for a verified Google identity."""
        email = email.strip().lower()
        with self.lock:
            row = self.db.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
            if not row:
                row = self.db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                if row:  # Google has verified this email, so link it to the existing account
                    self.db.execute("UPDATE users SET google_sub = ? WHERE id = ?", (sub, row["id"]))
                    user_id = row["id"]
                else:
                    user_id = secrets.token_hex(8)
                    self.db.execute("INSERT INTO users (id, email, name, google_sub, created, trial_ends) VALUES (?, ?, ?, ?, ?, ?)",
                                    (user_id, email, name[:80], sub, time.time(), _trial_end()))
                self.db.commit()
            else:
                user_id = row["id"]
        return self.user(user_id)

    def update(self, user_id: str, name: str | None = None, profile: dict | None = None) -> dict:
        with self.lock:
            if name is not None:
                self.db.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip()[:80], user_id))
            if profile is not None:
                self.db.execute("UPDATE users SET profile = ? WHERE id = ?", (json.dumps(profile)[:5000], user_id))
            self.db.commit()
        return self.user(user_id)

    def delete(self, user_id: str):
        with self.lock:
            self.db.execute("DELETE FROM users WHERE id = ?", (user_id,))
            self.db.commit()

    # --- usage counts ---------------------------------------------------------

    def record(self, user_id: str, kind: str):
        """Count one app open or one written entry for today. `kind` is "open" or "entry"."""
        column = {"open": "opens", "entry": "entries"}[kind]
        day = time.strftime("%Y-%m-%d", time.gmtime())
        with self.lock:
            self.db.execute(f"INSERT INTO usage (user_id, day, {column}) VALUES (?, ?, 1) "
                            f"ON CONFLICT(user_id, day) DO UPDATE SET {column} = {column} + 1", (user_id, day))
            if kind == "entry":
                self.db.execute("INSERT OR IGNORE INTO first_entry VALUES (?, ?)", (user_id, time.time()))
            self.db.commit()

    # --- plan and speech allowance ---------------------------------------------

    def add_seconds(self, user_id: str, seconds: int):
        day = time.strftime("%Y-%m-%d", time.gmtime())
        with self.lock:
            self.db.execute("INSERT INTO usage (user_id, day, seconds) VALUES (?, ?, ?) "
                            "ON CONFLICT(user_id, day) DO UPDATE SET seconds = seconds + ?", (user_id, day, seconds, seconds))
            self.db.commit()

    def seconds_today(self, user_id: str) -> int:
        row = self.db.execute("SELECT seconds FROM usage WHERE user_id = ? AND day = ?",
                              (user_id, time.strftime("%Y-%m-%d", time.gmtime()))).fetchone()
        return row["seconds"] if row else 0

    def set_paid_until(self, user_id: str, until: float, customer: str | None = None):
        with self.lock:
            self.db.execute("UPDATE users SET paid_until = ?, pay_customer = COALESCE(?, pay_customer) WHERE id = ?",
                            (until, customer, user_id))
            self.db.commit()

    def link_payment(self, user_id: str, customer: str | None, subscription: str):
        with self.lock:
            self.db.execute("UPDATE users SET pay_customer = COALESCE(?, pay_customer), pay_subscription = ? WHERE id = ?",
                            (customer, subscription, user_id))
            self.db.commit()

    def by_customer(self, customer: str) -> dict | None:
        return self._public(self.db.execute("SELECT * FROM users WHERE pay_customer = ?", (customer,)).fetchone()) if customer else None

    def by_email(self, email: str) -> dict | None:
        return self._public(self.db.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()) if email else None

    def subscription(self, user_id: str) -> str | None:
        row = self.db.execute("SELECT pay_subscription FROM users WHERE id = ?", (user_id,)).fetchone()
        return row["pay_subscription"] if row else None

    # --- daily reminder ---------------------------------------------------------

    def set_reminder(self, user_id: str, subscription: dict, minutes: int, tz_offset: int):
        with self.lock:
            self.db.execute("INSERT INTO push (user_id, subscription, minutes, tz_offset) VALUES (?, ?, ?, ?) "
                            "ON CONFLICT(user_id) DO UPDATE SET subscription = excluded.subscription, minutes = excluded.minutes, "
                            "tz_offset = excluded.tz_offset", (user_id, json.dumps(subscription), minutes, tz_offset))
            self.db.commit()

    def clear_reminder(self, user_id: str):
        with self.lock:
            self.db.execute("DELETE FROM push WHERE user_id = ?", (user_id,))
            self.db.commit()

    def reminders(self) -> list[sqlite3.Row]:
        return self.db.execute("SELECT * FROM push").fetchall()

    def claim_reminder(self, user_id: str, local_day: str) -> bool:
        """True for exactly one caller per person per day, so two server instances never both send."""
        with self.lock:
            cur = self.db.execute("UPDATE push SET last_sent = ? WHERE user_id = ? AND (last_sent IS NULL OR last_sent != ?)",
                                  (local_day, user_id, local_day))
            self.db.commit()
            return cur.rowcount == 1

    def entries_today(self, user_id: str) -> int:
        row = self.db.execute("SELECT entries FROM usage WHERE user_id = ? AND day = ?",
                              (user_id, time.strftime("%Y-%m-%d", time.gmtime()))).fetchone()
        return row["entries"] if row else 0

    # --- sessions -----------------------------------------------------------

    def new_session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with self.lock:
            self.db.execute("INSERT INTO sessions VALUES (?, ?, ?)",
                            (_token_hash(token), user_id, time.time() + SESSION_DAYS * 86400))
            self.db.commit()
        return token

    def session_user(self, token: str | None) -> dict | None:
        if not token:
            return None
        row = self.db.execute("SELECT user_id, expires FROM sessions WHERE token_hash = ?",
                              (_token_hash(token),)).fetchone()
        if not row or row["expires"] < time.time():
            return None
        return self.user(row["user_id"])

    def end_session(self, token: str | None):
        if token:
            with self.lock:
                self.db.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
                self.db.commit()
