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
"""

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

    def _public(self, row) -> dict | None:
        if not row:
            return None
        return {"id": row["id"], "email": row["email"], "name": row["name"],
                "profile": json.loads(row["profile"]), "has_password": row["password"] is not None,
                "google": row["google_sub"] is not None}

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
            self.db.execute("INSERT INTO users (id, email, name, password, created) VALUES (?, ?, ?, ?, ?)",
                            (user_id, email, name.strip()[:80], hash_password(password), time.time()))
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
                    self.db.execute("INSERT INTO users (id, email, name, google_sub, created) VALUES (?, ?, ?, ?, ?)",
                                    (user_id, email, name[:80], sub, time.time()))
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
