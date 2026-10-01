"""Run tracker — one asyncio.Queue shared by the boss and every specialist.

Every step of every agent loop (model request, model response, tool call,
tool result, agent done) is pushed onto the queue as a "step" event with the
input/output tokens it spent plus running totals, so the SSE route can stream
it to the front end the moment it happens.
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.messages import (
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.usage import UsageLimits

PREVIEW_CHARS = 240


def _preview(value: Any, limit: int = PREVIEW_CHARS) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


@dataclass
class RunTracker:
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    trace: list[dict[str, Any]] = field(default_factory=list)
    started: float = field(default_factory=time.monotonic)
    input_tokens: int = 0
    output_tokens: int = 0
    requests: int = 0
    per_agent: dict[str, dict[str, int]] = field(default_factory=dict)

    def emit(self, type_: str, data: dict[str, Any]) -> None:
        """Queue an event for the stream (and keep a copy in the trace)."""
        # The final payload carries the trace itself; don't nest it inside the trace.
        self.trace.append({"t": self.elapsed(), "type": type_, **{k: v for k, v in data.items() if k != "trace"}})
        self.queue.put_nowait({"type": type_, "data": data})

    def elapsed(self) -> float:
        return round(time.monotonic() - self.started, 2)

    def totals(self) -> dict[str, Any]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.input_tokens + self.output_tokens,
            "requests": self.requests,
            "per_agent": self.per_agent,
        }

    def step(
        self,
        agent: str,
        kind: str,
        summary: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> None:
        if kind == "model_response":
            self.requests += 1
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        mine = self.per_agent.setdefault(agent, {"input_tokens": 0, "output_tokens": 0, "requests": 0})
        mine["input_tokens"] += input_tokens
        mine["output_tokens"] += output_tokens
        mine["requests"] += kind == "model_response"
        self.emit(
            "step",
            {
                "seq": len(self.trace),
                "t": self.elapsed(),
                "agent": agent,
                "kind": kind,
                "summary": summary,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "totals": {k: v for k, v in self.totals().items() if k != "per_agent"},
            },
        )


async def run_traced(
    agent: Agent,
    agent_name: str,
    prompt: str,
    deps: Any,
    tracker: RunTracker | None,
    usage_limits: UsageLimits | None = None,
) -> Any:
    """Run a PydanticAI agent node by node, reporting each loop step to the tracker."""
    if tracker is None:
        return (await agent.run(prompt, deps=deps, usage_limits=usage_limits)).output

    async with agent.iter(prompt, deps=deps, usage_limits=usage_limits) as run:
        async for node in run:
            if Agent.is_model_request_node(node):
                # Tool results from the previous step travel back to the model here.
                for part in node.request.parts:
                    if isinstance(part, ToolReturnPart):
                        tracker.step(agent_name, "tool_result", f"{part.tool_name} → {_preview(part.content)}")
                    elif isinstance(part, RetryPromptPart):
                        tracker.step(agent_name, "retry", _preview(part.content))
                tracker.step(agent_name, "model_request", "Thinking…")
            elif Agent.is_call_tools_node(node):
                resp = node.model_response
                calls = [p for p in resp.parts if isinstance(p, ToolCallPart)]
                text = "".join(p.content for p in resp.parts if isinstance(p, TextPart))
                if calls:
                    summary = f"Decided to call {len(calls)} tool{'s' if len(calls) != 1 else ''}"
                elif text:
                    summary = f"Wrote answer: {_preview(text, 120)}"
                else:
                    summary = "Responded"
                tracker.step(
                    agent_name,
                    "model_response",
                    summary,
                    input_tokens=resp.usage.input_tokens,
                    output_tokens=resp.usage.output_tokens,
                )
                for call in calls:
                    tracker.step(agent_name, "tool_call", f"{call.tool_name}({_preview(call.args_as_dict())})")
            elif Agent.is_end_node(node):
                usage = run.usage
                tracker.step(
                    agent_name,
                    "agent_done",
                    f"Finished in {usage.requests} model call{'s' if usage.requests != 1 else ''} · "
                    f"{usage.input_tokens:,} in / {usage.output_tokens:,} out tokens",
                )
        assert run.result is not None
        return run.result.output
