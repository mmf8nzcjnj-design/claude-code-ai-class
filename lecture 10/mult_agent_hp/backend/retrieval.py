"""Helpers to pull text chunks from harrypotter.db.

- list_books(), get_book_meta(book_number)
- retrieve_chunks(book_number, question) — keyword-scored (BM25) chunks; evidence capped at ~12k chars
- format_evidence(chunks) — join chunks for the specialist prompt

Never load an entire novel into a model prompt.
"""

from __future__ import annotations

import math
import re
import sqlite3
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent / "harrypotter.db"

CHUNK_CHARS = 1200
CHUNK_OVERLAP = 200
DEFAULT_TOP_K = 10
MAX_EVIDENCE_CHARS = 12000

_WORD = re.compile(r"[a-z0-9']+")
_STOPWORDS = frozenset(
    """a about above after again against all am an and any are as at be because been
    before being below between both but by can could did do does doing down during each
    few for from further had has have having he her here hers herself him himself his how
    i if in into is it its itself just me more most my myself no nor not now of off on
    once only or other our ours out over own same she should so some such than that the
    their theirs them themselves then there these they this those through to too under
    until up very was we were what when where which while who whom why will with would
    you your yours book books happen happens happened tell explain describe does did
    harry potter""".split()
)


@dataclass(frozen=True)
class Chunk:
    book_number: int
    index: int
    text: str
    score: float = 0.0


def _connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DB_PATH}")
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def list_books() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT book_number, title, page_count, char_count, token_count "
            "FROM books ORDER BY book_number"
        ).fetchall()
    return [dict(r) for r in rows]


def get_book_meta(book_number: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT book_number, title, page_count, char_count, token_count "
            "FROM books WHERE book_number = ?",
            (book_number,),
        ).fetchone()
    return dict(row) if row else None


def _tokens(text: str) -> list[str]:
    text = text.lower().replace("’", "'").replace("‘", "'")
    return [_stem(t.strip("'")) for t in _WORD.findall(text) if t.strip("'")]


def _stem(word: str) -> str:
    """Very light stemming so 'horcruxes' matches 'horcrux', 'wands' matches 'wand'."""
    if word.endswith("'s"):
        word = word[:-2]
    if len(word) > 4 and word.endswith("es") and word[-3] in "sxz":
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


@lru_cache(maxsize=7)
def _book_index(book_number: int) -> tuple[list[str], list[Counter], dict[str, int], float]:
    """Split one book into overlapping chunks and build a tiny BM25 index (cached)."""
    with _connect() as conn:
        row = conn.execute("SELECT text FROM books WHERE book_number = ?", (book_number,)).fetchone()
    if not row:
        raise ValueError(f"No book {book_number} in database")

    # PDF extraction leaves stray line breaks mid-sentence; flatten whitespace.
    text = re.sub(r"\s+", " ", row["text"]).strip()

    chunks: list[str] = []
    start = 0
    step = CHUNK_CHARS - CHUNK_OVERLAP
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))
        if end < len(text):  # finish on a word boundary
            space = text.rfind(" ", start + step, end)
            end = space if space > 0 else end
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        next_start = end - CHUNK_OVERLAP
        space = text.find(" ", next_start)
        start = space + 1 if space != -1 and space < end else next_start

    counts = [Counter(_tokens(c)) for c in chunks]
    df: Counter = Counter()
    for c in counts:
        df.update(c.keys())
    avg_len = sum(sum(c.values()) for c in counts) / max(len(counts), 1)
    return chunks, counts, dict(df), avg_len


def _query_terms(question: str) -> list[str]:
    seen: list[str] = []
    for t in _tokens(question):
        if t not in _STOPWORDS and len(t) > 1 and t not in seen:
            seen.append(t)
    return seen


def retrieve_chunks(
    book_number: int,
    question: str,
    top_k: int = DEFAULT_TOP_K,
    max_chars: int = MAX_EVIDENCE_CHARS,
    exclude: set[int] | None = None,
) -> list[Chunk]:
    """Return the best-matching chunks of one book for a question, capped at max_chars."""
    chunks, counts, df, avg_len = _book_index(book_number)
    terms = _query_terms(question)
    if not terms:
        return []

    n = len(chunks)
    k1, b = 1.5, 0.75
    idf = {t: math.log(1 + (n - df.get(t, 0) + 0.5) / (df.get(t, 0) + 0.5)) for t in terms}

    scored: list[tuple[float, int]] = []
    for i, c in enumerate(counts):
        if exclude and i in exclude:
            continue
        length = sum(c.values())
        score = 0.0
        matched = 0
        for t in terms:
            tf = c.get(t, 0)
            if tf:
                matched += 1
                score += idf[t] * tf * (k1 + 1) / (tf + k1 * (1 - b + b * length / avg_len))
        if score > 0:
            # Reward chunks that cover more distinct query terms.
            score *= 1 + 0.25 * (matched - 1)
            scored.append((score, i))

    scored.sort(reverse=True)
    picked: list[Chunk] = []
    used = 0
    for score, i in scored[:top_k]:
        text = chunks[i]
        if used + len(text) > max_chars:
            break
        picked.append(Chunk(book_number, i, text, round(score, 2)))
        used += len(text)
    # Present in story order so the specialist reads events chronologically.
    return sorted(picked, key=lambda ch: ch.index)


def format_evidence(chunks: list[Chunk]) -> str:
    if not chunks:
        return "(no matching passages found)"
    return "\n\n".join(
        f"[Passage {n} | book {ch.book_number}, chunk {ch.index}]\n{ch.text}"
        for n, ch in enumerate(chunks, start=1)
    )
