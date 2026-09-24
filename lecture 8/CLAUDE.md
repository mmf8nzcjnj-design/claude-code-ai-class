# Lecture 8 — Course Explorer with accounts + SQLite

Lecture 7's full-stack app (React + Vite + TypeScript front end, FastAPI +
PydanticAI back end), now on SQLite (`data/yale_som.db`: tables `courses`,
`users`, `chats`), with sign-in and saved chats. Deployed on Render as a Web
Service (backend) + Static Site (frontend); see README.md.

## Run workflow — two processes, two terminals

Back end (from `backend/`, venv activated):

```
uvicorn main:app --port 8000
```

Front end (from `frontend/`):

```
npm run dev
```

- API: http://127.0.0.1:8000 — auto docs at http://127.0.0.1:8000/docs
- UI: http://127.0.0.1:5173
- Do not pass `--reload` to uvicorn. One edit must not spawn multiple
  processes. When stopping a server, kill the whole process tree.
- CORS is already open in `main.py`, so Vite can call port 8000.

## Environment

- Each lecture/homework/project gets its own venv. This one lives at
  `backend/.venv` — it is the only venv in this folder.
- Python deps: `backend/requirements.txt`. Install with
  `pip install -r requirements.txt` inside `backend/.venv`.
- Model: **gpt-5.6-luna via Portkey**. `PORTKEY_API_KEY` and `SECRET_KEY`
  come from a `.env`. `main.py` loads both `lecture 8/.env` and the parent course
  folder's `.env`, so either location works.
- Ship `.env.example` only. Never commit a real key.

## Layout

```
lecture 8/
  .env.example
  data/
    yale_som.db               # committed seed: courses + empty users, chats
    app.db                    # runtime copy (gitignored) — all writes go here
  backend/
    requirements.txt
    main.py                   # API routes (auth, courses, chats)
    db.py                     # schema, seed copy, course row -> JSON keys
    auth.py                   # bcrypt passwords, signed bearer tokens
    agent.py                  # run_agent(message, history, user_id)
    tools.py                  # search_courses (SQL), web_search
    models.py
    prompts/prompt.md
  frontend/src/
    main.tsx                  # sign-in gate
    App.tsx, api.ts
    components/               # AuthScreen, ChatPanel, ReplyText, CourseCard, ...
  output/
    audit_trail.json          # gitignored (contains chat text); never wipe
```

## Contracts

- Never write to `data/yale_som.db` at runtime or commit `app.db` — test
  accounts would land in the public repo.
- Passwords: bcrypt only. Tables: `courses`, `users`, `chats` — no others
  unless asked.
- `agent.py` must expose `run_agent(message, history=None, user_id=None)
  -> dict` with keys `reply: str` and `tools_used: list[str]`.
- The agent gets **exactly two tools**: `search_courses` and
  `web_search`. Do not add `filter_courses`, `count_courses`, or others
  unless asked.
- Agent behavior: use `search_courses` for anything the courses table can
  answer; `web_search` only when the database falls short; never invent
  course times or faculty; say so when unsure.
- `output/audit_trail.json` gets one appended entry per agent loop:
  time, user message, thoughts, each tool name + args + short result,
  and why it stopped. Never wipe earlier rows.

## UI

Course catalog feel — cards or a clean list showing number, title,
faculty, day, time, plus a search box that filters. Chat panel on the
page (bottom-right drawer or side column) with a spinner while the agent
thinks and the `tools_used` list under each reply. Polished Yale blue /
clean type — not the default Vite starter. Build visuals as HTML/CSS/SVG
rather than generated images.
