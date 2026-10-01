"""Boss agent — owns the chat and delegates to book specialists.

- PydanticAI Agent with async tool ask_book_specialist(book_number, question)
- BossDeps with a shared RunTracker (asyncio.Queue) + emit() for live SSE events
- run_boss_chat_stream(message) and run_boss_chat(message)
- Event types: boss_thinking, step, specialist_started, specialist_done, final, error
  ("step" = one step of any agent's loop, with input/output tokens + running totals)
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.usage import UsageLimits

from models import CATALOG_BY_NUMBER

from .config import BOSS_NAME, build_model, load_prompt
from .specialists import run_specialist, specialist_name
from .tracker import RunTracker, run_traced

_DONE = object()  # queue sentinel


@dataclass
class BossDeps:
    tracker: RunTracker = field(default_factory=RunTracker)
    delegations: list[dict[str, Any]] = field(default_factory=list)

    def emit(self, event_type: str, **data: Any) -> None:
        self.tracker.emit(event_type, data)


@lru_cache(maxsize=1)
def get_boss_agent() -> Agent[BossDeps, str]:
    agent: Agent[BossDeps, str] = Agent(
        build_model(),
        deps_type=BossDeps,
        instructions=load_prompt("boss.md"),
        name="boss",
    )

    @agent.tool
    async def ask_book_specialist(ctx: RunContext[BossDeps], book_number: int, question: str) -> str:
        """Ask the specialist for one Harry Potter book (1-7) a focused question.

        The specialist searches only that book's text and answers from the passages it finds.
        Call this once per relevant book; several calls in the same turn run in parallel.

        Args:
            book_number: 1 Sorcerer's Stone, 2 Chamber of Secrets, 3 Prisoner of Azkaban,
                4 Goblet of Fire, 5 Order of the Phoenix, 6 Half-Blood Prince, 7 Deathly Hallows.
            question: A self-contained question about that book, using specific names and objects.
        """
        deps = ctx.deps
        meta = CATALOG_BY_NUMBER.get(book_number)
        index = len(deps.delegations)
        delegation = {
            "agent": specialist_name(book_number),
            "book_number": book_number,
            "book_title": meta["title"] if meta else f"Book {book_number}",
            "question": question,
            "reply": "",
            "status": "running",
            "passages_used": 0,
        }
        deps.delegations.append(delegation)
        deps.emit("specialist_started", **delegation, index=index)

        result = await run_specialist(book_number, question, tracker=deps.tracker)
        delegation.update(
            reply=result["reply"], status=result["status"], passages_used=result["passages_used"]
        )
        deps.emit("specialist_done", **delegation, index=index)
        return f"[{result['agent']} — {result['book_title']}] ({result['status']})\n{result['reply']}"

    return agent


def _final_payload(answer: str, deps: BossDeps) -> dict[str, Any]:
    return {
        "answer": answer,
        "delegations": deps.delegations,
        "trace": list(deps.tracker.trace),
        "usage": deps.tracker.totals(),
        "boss_name": BOSS_NAME,
    }


async def run_boss_chat_stream(message: str) -> AsyncIterator[dict[str, Any]]:
    deps = BossDeps()
    deps.emit("boss_thinking", boss_name=BOSS_NAME, message=message)

    async def worker() -> None:
        try:
            answer = await run_traced(
                get_boss_agent(),
                BOSS_NAME,
                message,
                deps,
                deps.tracker,
                usage_limits=UsageLimits(request_limit=12),
            )
            deps.emit("final", **_final_payload(answer, deps))
        except Exception as exc:
            deps.tracker.step(BOSS_NAME, "error", str(exc))
            payload = _final_payload(f"Alas, the castle's magic faltered: {exc}", deps)
            deps.emit("error", **payload, error=str(exc))
        finally:
            deps.tracker.queue.put_nowait(_DONE)

    task = asyncio.create_task(worker())
    try:
        while True:
            event = await deps.tracker.queue.get()
            if event is _DONE:
                break
            yield event
    finally:
        if not task.done():  # client disconnected mid-stream
            task.cancel()


async def run_boss_chat(message: str) -> dict[str, Any]:
    final: dict[str, Any] | None = None
    async for event in run_boss_chat_stream(message):
        if event["type"] in ("final", "error"):
            final = event["data"]
    assert final is not None
    return {k: final[k] for k in ("answer", "delegations", "trace", "usage", "boss_name")}
