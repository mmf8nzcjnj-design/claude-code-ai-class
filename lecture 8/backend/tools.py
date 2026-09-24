"""The agent's two tools: search_courses (SQL over the courses table) and
web_search (DuckDuckGo, for questions the catalog can't answer).
"""

from __future__ import annotations

import re

from ddgs import DDGS

import db

# Columns a free-text query is matched against.
SEARCH_COLUMNS = [
    "course_number", "course_title", "course_category", "course_type",
    "course_description", "faculty_1", "daytimes", "room",
]

# Returned to the model. Descriptions and bios are trimmed so a broad
# search doesn't flood the context window.
RESULT_COLUMNS = [
    "course_number", "course_title", "section", "faculty_1", "faculty_1_email",
    "daytimes", "room", "units", "course_session", "course_category",
    "course_type", "course_description", "faculty_bio", "syllabus",
]

# `daytimes` looks like "M  W 10:05 AM-11:25 AM" or "T  Th 1:00 PM-2:20 PM".
# (timings_day is blank for most rows, so it isn't used.)
DAY_CODES = {
    "monday": "M", "tuesday": "T", "wednesday": "W", "thursday": "Th",
    "friday": "F", "saturday": "Sa", "sunday": "Su",
}


def _meets_on(daytimes: str | None, code: str) -> bool:
    """SQL function: does this daytimes string include the day code?"""
    days = re.split(r"\s+", re.split(r"\d", daytimes or "", maxsplit=1)[0].strip())
    return code in days


def _trim(text: str | None, limit: int) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def search_courses(
    query: str = "",
    faculty: str | None = None,
    day: str | None = None,
    limit: int = 15,
) -> dict:
    """Search the Yale SOM fall courses table.

    Args:
        query: Words to match against course number, title, category, type,
            description, faculty, meeting time, and room. Every word must
            match somewhere (e.g. "negotiation", "MGT 403", "finance").
            Leave empty to list everything that fits the other filters.
        faculty: Instructor name or part of it, e.g. "Simonsohn".
        day: A weekday, e.g. "Monday" or "Thursday".
        limit: Max rows to return (1-50). `total_matches` is always the full count.
    """
    where, params = [], []
    for word in query.split():
        where.append("(" + " OR ".join(f"{c} LIKE ?" for c in SEARCH_COLUMNS) + ")")
        params.extend([f"%{word}%"] * len(SEARCH_COLUMNS))
    if faculty:
        where.append("faculty_1 LIKE ?")
        params.append(f"%{faculty}%")
    if day:
        code = DAY_CODES.get(day.strip().lower(), day.strip())
        where.append("meets_on(daytimes, ?)")
        params.append(code)
    sql = "FROM courses" + (" WHERE " + " AND ".join(where) if where else "")
    limit = max(1, min(int(limit), 50))

    with db.connect() as conn:
        conn.create_function("meets_on", 2, _meets_on, deterministic=True)
        total = conn.execute(f"SELECT COUNT(*) {sql}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT {', '.join(RESULT_COLUMNS)} {sql} ORDER BY course_number, section LIMIT ?",
            [*params, limit],
        ).fetchall()

    courses = []
    for r in rows:
        row = dict(r)
        row["course_description"] = _trim(row["course_description"], 400)
        row["faculty_bio"] = _trim(row["faculty_bio"], 250)
        courses.append({k: v for k, v in row.items() if v})
    return {"total_matches": total, "returned": len(courses), "courses": courses}


def web_search(query: str) -> list[dict]:
    """Search the public web. Only use this when search_courses can't answer.

    Args:
        query: What to look up, e.g. "Uri Simonsohn research".
    """
    try:
        results = DDGS().text(query, max_results=5)
    except Exception as exc:  # network errors, rate limits
        return [{"error": f"web search failed: {exc}"}]
    return [
        {"title": r.get("title", ""), "url": r.get("href", ""), "snippet": _trim(r.get("body"), 300)}
        for r in results
    ]
