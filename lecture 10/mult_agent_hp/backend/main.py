"""Harry Potter multi-agent API — routes only.

Run from this directory:
  uvicorn main:app --reload --host 127.0.0.1 --port 8000

Frontend (Vite): http://127.0.0.1:5173
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
import secrets

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from agents.boss import run_boss_chat, run_boss_chat_stream
from agents.config import BOSS_NAME, MODEL_NAME
from models import BOOK_CATALOG, ChatRequest, ChatResponse
from retrieval import list_books

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent / ".env")

BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
# Optional shared passcode so a public deploy doesn't spend your Portkey tokens for strangers.
APP_PASSCODE = os.getenv("APP_PASSCODE", "").strip()
FRONTEND_DIST = ROOT / "frontend" / "dist"


def check_passcode(passcode: str | None) -> None:
    if APP_PASSCODE and not secrets.compare_digest(passcode or "", APP_PASSCODE):
        raise HTTPException(status_code=401, detail="Wrong or missing passcode.")

app = FastAPI(title="Harry Potter Multi-Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    db = ROOT / "harrypotter.db"
    key_set = bool(os.getenv("PORTKEY_API_KEY", "").strip())
    books = []
    try:
        books = list_books()
    except Exception as exc:
        return {
            "ok": False,
            "error": str(exc),
            "boss": BOSS_NAME,
            "model": MODEL_NAME,
            "portkey_key_set": key_set,
        }
    return {
        "ok": True,
        "boss": BOSS_NAME,
        "model": MODEL_NAME,
        "db": db.name,
        "books": len(books),
        "portkey_key_set": key_set,
        "passcode_required": bool(APP_PASSCODE),
    }


@app.get("/api/roster")
def roster():
    """Boss + specialist roster for the frontend."""
    db_books = {b["book_number"]: b for b in list_books()}
    specialists = []
    for b in BOOK_CATALOG:
        meta = db_books.get(b["book_number"], {})
        specialists.append(
            {
                **b,
                "page_count": meta.get("page_count"),
                "token_count": meta.get("token_count"),
            }
        )
    return {"boss": BOSS_NAME, "specialists": specialists}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, x_app_passcode: str | None = Header(None)):
    check_passcode(x_app_passcode)
    result = await run_boss_chat(body.message)
    return ChatResponse(**result)


@app.post("/api/chat/stream")
async def chat_stream(body: ChatRequest, x_app_passcode: str | None = Header(None)):
    """SSE stream of progress events + final payload."""
    check_passcode(x_app_passcode)

    async def gen():
        async for event in run_boss_chat_stream(body.message):
            payload = json.dumps(event, ensure_ascii=False)
            yield f"event: {event['type']}\ndata: {payload}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# In production the built React app (frontend/dist) is served from this same server.
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and FRONTEND_DIST.resolve() in file.parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=BACKEND_PORT, reload=False)
