"""Book specialist workers — one focused answer path per novel (1–7).

- run_specialist(book_number, question)
- Chunks + retrieves evidence via retrieval.py, answers only from that evidence
- Returns agent name, book title, reply, status, passages_used
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.usage import UsageLimits

from models import CATALOG_BY_NUMBER
from retrieval import format_evidence, retrieve_chunks

from .config import build_model, load_prompt
from .tracker import RunTracker, run_traced

MAX_EXTRA_SEARCHES = 3
EXTRA_SEARCH_CHARS = 4000


@dataclass
class SpecialistDeps:
    book_number: int
    seen_chunks: set[int] = field(default_factory=set)
    searches: int = 0


def specialist_name(book_number: int) -> str:
    return f"Book {book_number} Labubu"


@lru_cache(maxsize=1)
def get_specialist_agent() -> Agent[SpecialistDeps, str]:
    agent: Agent[SpecialistDeps, str] = Agent(
        build_model(),
        deps_type=SpecialistDeps,
        instructions=load_prompt("specialist.md"),
        name="book_specialist",
    )

    @agent.instructions
    def assigned_book(ctx: RunContext[SpecialistDeps]) -> str:
        title = CATALOG_BY_NUMBER[ctx.deps.book_number]["title"]
        return f"Your assigned book is Book {ctx.deps.book_number}: {title}."

    @agent.tool
    def search_book(ctx: RunContext[SpecialistDeps], keywords: str) -> str:
        """Search your assigned book again with different keywords (names, places, objects).

        Returns new passages you have not seen yet. Use this when the evidence you
        were given does not answer the question.
        """
        if ctx.deps.searches >= MAX_EXTRA_SEARCHES:
            return "Search limit reached. Answer from the evidence you already have."
        ctx.deps.searches += 1
        chunks = retrieve_chunks(
            ctx.deps.book_number,
            keywords,
            top_k=4,
            max_chars=EXTRA_SEARCH_CHARS,
            exclude=ctx.deps.seen_chunks,
        )
        ctx.deps.seen_chunks.update(c.index for c in chunks)
        return format_evidence(chunks)

    return agent


async def run_specialist(
    book_number: int, question: str, tracker: RunTracker | None = None
) -> dict[str, Any]:
    meta = CATALOG_BY_NUMBER.get(book_number)
    name = specialist_name(book_number)
    if meta is None:
        return {
            "agent": name,
            "book_number": book_number,
            "book_title": f"Book {book_number}",
            "reply": "There are only seven books (1–7).",
            "status": "error",
            "passages_used": 0,
        }

    try:
        chunks = retrieve_chunks(book_number, question)
        if tracker:
            tracker.step(
                name,
                "retrieval",
                f"Chunked the book and picked {len(chunks)} passages "
                f"({sum(len(c.text) for c in chunks):,} chars) for: {question}",
            )
        deps = SpecialistDeps(book_number=book_number, seen_chunks={c.index for c in chunks})
        prompt = (
            f"QUESTION from the Headmaster:\n{question}\n\n"
            f"EVIDENCE from {meta['title']}:\n{format_evidence(chunks)}"
        )
        output = await run_traced(
            get_specialist_agent(),
            name,
            prompt,
            deps,
            tracker,
            usage_limits=UsageLimits(request_limit=6),
        )
        return {
            "agent": name,
            "book_number": book_number,
            "book_title": meta["title"],
            "reply": output.strip(),
            "status": "done",
            "passages_used": len(deps.seen_chunks),
        }
    except Exception as exc:  # report failure to the boss instead of crashing the chat
        if tracker:
            tracker.step(name, "error", str(exc))
        return {
            "agent": name,
            "book_number": book_number,
            "book_title": meta["title"],
            "reply": f"Specialist error: {exc}",
            "status": "error",
            "passages_used": 0,
        }
