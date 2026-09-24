"""Yale SOM course explorer API desk.

Run from backend/:  uvicorn main:app --port 8000
Open API docs:      http://127.0.0.1:8000/docs
Frontend (Vite):    http://127.0.0.1:5173
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")

import auth  # noqa: E402  (after load_dotenv so SECRET_KEY is visible)
import db  # noqa: E402
from agent import run_agent  # noqa: E402

# How many earlier messages the agent sees, so follow-ups make sense.
HISTORY_FOR_AGENT = 12


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Yale SOM Courses", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # Comma-separated front end origins in production; open locally.
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str] = Field(default_factory=list)


class ChatMessageOut(BaseModel):
    id: int
    role: str
    text: str
    tools_used: list[str]
    error: bool
    created_at: str


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or v.startswith("@") or v.endswith("@"):
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v.encode()) > 72:  # bcrypt only reads the first 72 bytes
            raise ValueError("Password must be at most 72 bytes.")
        return v


class SignupRequest(Credentials):
    name: str = Field(min_length=1, max_length=100)


class AuthResponse(BaseModel):
    token: str
    user: dict


@app.get("/api/health")
def health():
    return {"ok": True, "database": db.db_path().name}


@app.get("/api/courses")
def list_courses(q: str | None = Query(default=None)):
    """Return courses for the React catalog (optional text filter)."""
    courses = db.all_courses()
    if not q:
        return {"count": len(courses), "courses": courses}
    needle = q.lower().strip()
    matched = [
        c
        for c in courses
        if needle in json.dumps(c, ensure_ascii=False).lower()
    ]
    return {"count": len(matched), "courses": matched}


@app.post("/api/auth/signup", response_model=AuthResponse)
def signup(body: SignupRequest):
    user = auth.create_user(body.email, body.name.strip(), body.password)
    return AuthResponse(token=auth.issue_token(user["id"]), user=user)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(body: Credentials):
    user = auth.authenticate(body.email, body.password)
    return AuthResponse(token=auth.issue_token(user["id"]), user=user)


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.current_user)):
    return user


def _message_out(row) -> ChatMessageOut:
    return ChatMessageOut(
        id=row["id"],
        role=row["role"],
        text=row["text"],
        tools_used=json.loads(row["tools_used"]),
        error=bool(row["error"]),
        created_at=row["created_at"],
    )


@app.get("/api/chats", response_model=list[ChatMessageOut])
def chat_history(user: dict = Depends(auth.current_user)):
    """Every saved message for the signed-in user, oldest first."""
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM chats WHERE user_id = ? ORDER BY id", (user["id"],)
        ).fetchall()
    return [_message_out(r) for r in rows]


@app.delete("/api/chats", status_code=204)
def clear_chats(user: dict = Depends(auth.current_user)):
    with db.connect() as conn:
        conn.execute("DELETE FROM chats WHERE user_id = ?", (user["id"],))


@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user: dict = Depends(auth.current_user)):
    with db.connect() as conn:
        recent = conn.execute(
            "SELECT role, text FROM chats WHERE user_id = ? AND error = 0 "
            "ORDER BY id DESC LIMIT ?",
            (user["id"], HISTORY_FOR_AGENT),
        ).fetchall()
        conn.execute(
            "INSERT INTO chats (user_id, role, text) VALUES (?, 'user', ?)",
            (user["id"], body.message),
        )
    history = [dict(r) for r in reversed(recent)]

    try:
        result = run_agent(body.message, history=history, user_id=user["id"])
    except Exception as exc:
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO chats (user_id, role, text, error) VALUES (?, 'assistant', ?, 1)",
                (user["id"], "Sorry — the assistant couldn't answer just now. Try again."),
            )
        raise HTTPException(502, f"Agent failed: {type(exc).__name__}") from exc

    reply = result.get("reply", "")
    tools_used = list(result.get("tools_used") or [])
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO chats (user_id, role, text, tools_used) VALUES (?, 'assistant', ?, ?)",
            (user["id"], reply, json.dumps(tools_used)),
        )
    return ChatResponse(reply=reply, tools_used=tools_used)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
