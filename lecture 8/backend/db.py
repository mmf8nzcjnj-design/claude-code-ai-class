"""SQLite storage: the courses, users, and chats tables.

data/yale_som.db is the committed seed: all 234 courses plus empty users
and chats tables. The app never writes to it. On first start it is copied
to DB_PATH (default data/app.db, gitignored), and every write goes to that
copy. This keeps test accounts and chats out of git.

On Render the disk resets on every deploy or restart, so the copy is
recreated from the seed and accounts and chats start over.
"""

from __future__ import annotations

import os
import shutil
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "data" / "yale_som.db"


def db_path() -> Path:
    return Path(os.getenv("DB_PATH") or ROOT / "data" / "app.db")


# Maps courses-table columns to the raw JSON keys the React front end reads,
# so the catalog code is unchanged from lecture 7.
COURSE_COLUMNS: dict[str, str] = {
    "course_id": "Course ID",
    "course_number": "Course Number",
    "course_title": "Course Title",
    "course_category": "Course Category",
    "course_type": "Course Type",
    "course_session": "Course Session",
    "course_description": "Course Description",
    "faculty_1": "Faculty 1",
    "faculty_1_email": "Faculty 1 Email",
    "faculty_bio": "faculty_bio",
    "daytimes": "Daytimes",
    "timings_day": "Timings Day",
    "timings_start": "Timings StartTime",
    "timings_end": "Timings EndTime",
    "room": "Room",
    "section": "Section",
    "units": "Units",
    "term_code": "TermCode",
    "syllabus": "Syllabus",
    "old_syllabus": "Old Syllabus",
}

# Also applied to the committed seed, so yale_som.db on GitHub carries the
# full schema (courses + empty users and chats).
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,          -- bcrypt; the salt is inside the hash
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    tools_used TEXT NOT NULL DEFAULT '[]', -- JSON list of tool names
    error INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id, id);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Copy the seed on first run, then add the account and chat tables."""
    path = db_path()
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SEED_PATH, path)
    with connect() as conn:
        conn.executescript(SCHEMA)


def course_as_raw(row: sqlite3.Row) -> dict:
    """One courses-table row, keyed like the original JSON."""
    return {key: row[col] or "" for col, key in COURSE_COLUMNS.items()}


def all_courses() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM courses ORDER BY id").fetchall()
    return [course_as_raw(r) for r in rows]
