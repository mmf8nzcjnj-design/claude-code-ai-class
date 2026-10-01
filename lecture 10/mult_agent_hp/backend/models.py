"""Shared API / agent result models.

- BOOK_CATALOG — roster metadata for books 1–7 (title, specialty, accent, …)
- ChatRequest, ChatResponse, Delegation — shapes used by FastAPI + the front end
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

BOOK_CATALOG: list[dict[str, Any]] = [
    {
        "book_number": 1,
        "title": "Harry Potter and the Sorcerer's Stone",
        "short": "Sorcerer's Stone",
        "specialty": "Harry's first year, the Philosopher's Stone, Fluffy, the Mirror of Erised",
        "accent": "#c9a227",
        "house_hint": "Gryffindor",
    },
    {
        "book_number": 2,
        "title": "Harry Potter and the Chamber of Secrets",
        "short": "Chamber of Secrets",
        "specialty": "The Chamber, the basilisk, Tom Riddle's diary, Dobby, Lockhart",
        "accent": "#2e8b57",
        "house_hint": "Slytherin",
    },
    {
        "book_number": 3,
        "title": "Harry Potter and the Prisoner of Azkaban",
        "short": "Prisoner of Azkaban",
        "specialty": "Sirius Black, Lupin, dementors, the Marauder's Map, the Time-Turner",
        "accent": "#4a6fa5",
        "house_hint": "Ravenclaw",
    },
    {
        "book_number": 4,
        "title": "Harry Potter and the Goblet of Fire",
        "short": "Goblet of Fire",
        "specialty": "Triwizard Tournament, Quidditch World Cup, Voldemort's return",
        "accent": "#d2691e",
        "house_hint": "Hufflepuff",
    },
    {
        "book_number": 5,
        "title": "Harry Potter and the Order of the Phoenix",
        "short": "Order of the Phoenix",
        "specialty": "Umbridge, Dumbledore's Army, the prophecy, the Department of Mysteries",
        "accent": "#b22222",
        "house_hint": "Gryffindor",
    },
    {
        "book_number": 6,
        "title": "Harry Potter and the Half-Blood Prince",
        "short": "Half-Blood Prince",
        "specialty": "Riddle's past in the Pensieve, Horcruxes revealed, the Potions book",
        "accent": "#6b4c9a",
        "house_hint": "Slytherin",
    },
    {
        "book_number": 7,
        "title": "Harry Potter and the Deathly Hallows",
        "short": "Deathly Hallows",
        "specialty": "The Horcrux hunt, the Deathly Hallows, the Battle of Hogwarts",
        "accent": "#708090",
        "house_hint": "Ravenclaw",
    },
]

CATALOG_BY_NUMBER: dict[int, dict[str, Any]] = {b["book_number"]: b for b in BOOK_CATALOG}

DelegationStatus = Literal["pending", "running", "done", "error"]


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


class Delegation(BaseModel):
    agent: str
    book_number: int
    book_title: str
    question: str
    reply: str = ""
    status: DelegationStatus = "pending"
    passages_used: int = 0


class ChatResponse(BaseModel):
    answer: str
    delegations: list[Delegation] = Field(default_factory=list)
    trace: list[dict[str, Any]] = Field(default_factory=list)
    usage: dict[str, Any] = Field(default_factory=dict)
    boss_name: str
