"""PydanticAI agent for the Yale SOM course explorer.

Stub for now so main.py imports cleanly. Next step: wire a real
pydantic-ai agent with the two tools from tools.py (search_courses,
web_search), the system prompt in prompts/prompt.md, and model
gpt-5.6-luna via Portkey.
"""

from __future__ import annotations


def run_agent(message: str) -> dict:
    return {
        "reply": "Agent not wired yet. Build agent.py + tools.py.",
        "tools_used": [],
    }
