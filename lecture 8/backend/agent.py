"""PydanticAI agent for the Yale SOM course explorer.

Model: gpt-5.6-luna via Portkey (OpenAI-compatible endpoint). Exactly two
tools: search_courses (SQL over the courses table) and web_search.
Every run appends one entry to output/audit_trail.json.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from openai import AsyncOpenAI
from pydantic_ai import Agent
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from tools import search_courses, web_search

HERE = Path(__file__).resolve().parent
PROMPT_PATH = HERE / "prompts" / "prompt.md"
AUDIT_PATH = HERE.parent / "output" / "audit_trail.json"
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"
_audit_lock = threading.Lock()  # chats run in parallel threads


@lru_cache(maxsize=1)
def get_agent() -> Agent:
    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is not set.")
    client = AsyncOpenAI(
        api_key=key,
        base_url=os.getenv("PORTKEY_BASE_URL", PORTKEY_BASE_URL),
        default_headers={"x-portkey-api-key": key},
    )
    model = OpenAIChatModel(
        os.getenv("PORTKEY_MODEL", "gpt-5.6-luna"),
        provider=OpenAIProvider(openai_client=client),
    )
    return Agent(
        model,
        instructions=PROMPT_PATH.read_text(encoding="utf-8"),
        tools=[search_courses, web_search],
    )


def history_to_messages(history: list[dict]) -> list[ModelMessage]:
    """Saved chat rows ({role, text}) -> PydanticAI message history."""
    messages: list[ModelMessage] = []
    for row in history:
        if row["role"] == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=row["text"])]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=row["text"])]))
    return messages


def _short(value, limit: int = 300) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _audit(message: str, user_id: int | None, new_messages: list[ModelMessage], stop: str) -> None:
    thoughts, calls = [], []
    for msg in new_messages:
        for part in msg.parts:
            if isinstance(part, ToolCallPart):
                calls.append({"id": part.tool_call_id, "tool": part.tool_name, "args": part.args_as_dict()})
            elif isinstance(part, ToolReturnPart):
                for call in calls:
                    if call["id"] == part.tool_call_id:
                        call["result"] = _short(part.content)
            elif isinstance(part, TextPart) and isinstance(msg, ModelResponse):
                has_calls = any(isinstance(p, ToolCallPart) for p in msg.parts)
                if has_calls and part.content.strip():
                    thoughts.append(part.content.strip())
    for call in calls:
        call.pop("id", None)
    entry = {
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "user_id": user_id,
        "user_message": message,
        "thoughts": thoughts,
        "tool_calls": calls,
        "stop_reason": stop,
    }
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _audit_lock:
        try:
            rows = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            rows = []
        rows.append(entry)
        AUDIT_PATH.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")


def run_agent(message: str, history: list[dict] | None = None, user_id: int | None = None) -> dict:
    """Answer one chat message. Returns {reply, tools_used}."""
    try:
        result = get_agent().run_sync(message, message_history=history_to_messages(history or []))
    except Exception as exc:
        _audit(message, user_id, [], f"error: {type(exc).__name__}: {exc}")
        raise
    new = result.new_messages()
    tools_used: list[str] = []
    for msg in new:
        for part in msg.parts:
            if isinstance(part, ToolCallPart) and part.tool_name not in tools_used:
                tools_used.append(part.tool_name)
    last = next((m for m in reversed(new) if isinstance(m, ModelResponse)), None)
    stop = f"final answer ({getattr(last, 'finish_reason', None) or 'stop'})"
    _audit(message, user_id, new, stop)
    return {"reply": str(result.output), "tools_used": tools_used}
