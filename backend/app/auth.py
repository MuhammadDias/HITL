# backend/app/auth.py
"""Bearer-token sessions and role checks for admin/superadmin accounts."""
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Query, Request

from .db import get_db
from .passwords import hash_password, verify_password  # noqa: F401  (re-exported)

SESSION_TTL = timedelta(days=7)


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + SESSION_TTL).isoformat()
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
    return token


def _token_from_request(request: Request, token_param: Optional[str]) -> Optional[str]:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    # <img src> and download links cannot send headers, so allow ?token= too.
    return token_param


def current_user(
    request: Request,
    token: Optional[str] = Query(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    raw = _token_from_request(request, token)
    if not raw:
        raise HTTPException(status_code=401, detail="Belum login.")
    row = conn.execute(
        """
        SELECT u.id, u.email, u.name, u.role, u.school_id, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (raw,),
    ).fetchone()
    if row is None or datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesi tidak valid atau sudah habis. Silakan login lagi.")
    return row


def require_superadmin(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
    if user["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Hanya superadmin yang boleh mengakses ini.")
    return user


def ensure_school_access(user: sqlite3.Row, school_id: int) -> None:
    """Admins only see their own school; superadmin sees every school."""
    if user["role"] != "superadmin" and user["school_id"] != school_id:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan.")
