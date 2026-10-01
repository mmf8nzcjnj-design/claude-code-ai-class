# mult_agent_hp — Harry Potter multi-agent class starter

Chat app with a **boss agent** and **book specialist workers** (one per Harry Potter novel). The React front end and FastAPI routes are already here. In class you build the PydanticAI backend (models, retrieval helpers, agents, prompts).

`harrypotter.db` is included at the project root (SQLite `books` table with per-novel text). Use chunk retrieval — do not dump whole novels into prompts.

## Quick start

### 1. Env

Copy `.env.example` → `.env`:

```
PORTKEY_API_KEY=your_key
MODEL_NAME=gpt-6-astra
```

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Vite proxies `/api` to port 8000.

## What you build

`backend/main.py` and `backend/requirements.txt` are provided. Fill in:

- `models.py`
- `retrieval.py` (chunk helpers for `harrypotter.db`)
- `agents/` (`config.py`, `boss.py`, `specialists.py`)
- `prompts/` (`boss.md`, `specialist.md`)

Use the course vibe coding prompt for details.

## Layout

```
mult_agent_hp/
  .env.example
  README.md
  harrypotter.db
  backend/
    main.py
    requirements.txt
    models.py
    retrieval.py
    agents/
    prompts/
  frontend/
```

## Deploy on Render (one Web Service)

The FastAPI server also serves the built React app, so one service is enough.

Render dashboard → **New → Web Service** → repo `claude-code-ai-class`, branch `lecture-10-multi-agent-hp`.

| Setting | Value |
|---|---|
| Root Directory | `lecture 10/mult_agent_hp` |
| Runtime | Python 3 |
| Build Command | `cd frontend && npm ci && npm run build && cd ../backend && pip install -r requirements.txt` |
| Start Command | `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

Environment variables:

| Key | Value |
|---|---|
| `PORTKEY_API_KEY` | your Portkey key |
| `MODEL_NAME` | `gpt-6-luna` |
| `APP_PASSCODE` | a passcode you share with classmates (chat is blocked without it) |
| `PYTHON_VERSION` | `3.13.1` |

Free services sleep after ~15 minutes idle; the first request after that takes ~1 minute to wake.
