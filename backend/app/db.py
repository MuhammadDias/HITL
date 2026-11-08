# backend/app/db.py
"""SQLite storage for schools, admin accounts, classes, students and answers."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DB_PATH = Path(os.getenv("MOMO_DB_PATH", Path(__file__).resolve().parents[1] / "data" / "momo.sqlite"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS schools (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    address     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name           TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN ('superadmin', 'admin')),
    school_id      INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id      INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    student_count  INTEGER NOT NULL CHECK (student_count BETWEEN 1 AND 60),
    join_token     TEXT NOT NULL UNIQUE,
    created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    number      INTEGER NOT NULL,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (class_id, number)
);

CREATE TABLE IF NOT EXISTS submissions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id         INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    level_id         TEXT NOT NULL,
    strokes_json     TEXT NOT NULL,
    candidates_json  TEXT NOT NULL,
    decision_type    TEXT NOT NULL CHECK (decision_type IN ('accept', 'correct', 'override')),
    source_rank      INTEGER,
    final_label      TEXT NOT NULL,
    top1_label       TEXT NOT NULL,
    top1_confidence  REAL NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_class ON submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
"""


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    # FastAPI may open a request's connection in one worker thread and use or close it in
    # another; each connection still serves a single request at a time, so this is safe.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request."""
    with connect() as conn:
        yield conn
