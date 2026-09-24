"""Accounts and sign-in tokens.

Passwords are hashed with bcrypt, which generates a salt and stores it
inside the hash string, so the users table needs no salt column.

A sign-in token is `<user_id>.<expires>.<signature>`, signed with
SECRET_KEY (HMAC-SHA256). The server keeps no session table: it checks the
signature and expiry on each request. The front end keeps the token in
localStorage and sends it as `Authorization: Bearer <token>`. Signing out
just drops the token on the client.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import time

import bcrypt
from fastapi import Header, HTTPException

import db

TOKEN_TTL_SECONDS = 7 * 24 * 3600
_dev_secret = secrets.token_hex(32)


def _secret() -> bytes:
    # Without SECRET_KEY a random one is used, so tokens only last until restart.
    return (os.getenv("SECRET_KEY") or _dev_secret).encode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, stored: str) -> bool:
    return bcrypt.checkpw(password.encode(), stored.encode())


def _sign(payload: str) -> str:
    return hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()


def issue_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + TOKEN_TTL_SECONDS}"
    return f"{payload}.{_sign(payload)}"


def _user_id_from_token(token: str) -> int | None:
    user_id, _, rest = token.partition(".")
    expires, _, signature = rest.partition(".")
    if not hmac.compare_digest(_sign(f"{user_id}.{expires}"), signature):
        return None
    if not expires.isdigit() or int(expires) < time.time():
        return None
    return int(user_id) if user_id.isdigit() else None


def public_user(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "email": row["email"], "name": row["name"]}


def create_user(email: str, name: str, password: str) -> dict:
    with db.connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
                (email, name, hash_password(password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "An account with that email already exists.")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return public_user(row)


def authenticate(email: str, password: str) -> dict:
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        raise HTTPException(401, "Wrong email or password.")
    return public_user(row)


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency: the signed-in user, or 401."""
    scheme, _, token = (authorization or "").partition(" ")
    user_id = _user_id_from_token(token) if scheme.lower() == "bearer" else None
    if user_id is None:
        raise HTTPException(401, "Sign in first.")
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(401, "Your account no longer exists. Create it again.")
    return public_user(row)
