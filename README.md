# MGT 409 — AI Foundations for Managers

Coursework for MGT 409 at Yale SOM (Fall 2026). Each lecture and homework
lives in its own folder with its own virtual environment and dependencies.

## Contents

| Folder | What's in it |
| --- | --- |
| `lecture 7/` | **Yale SOM Course Explorer** — full-stack app: React + Vite + TypeScript front end, FastAPI + PydanticAI back end, over a JSON pack of 234 fall courses. |
| `lecture 8/` – `lecture 13/` | Later lectures. |
| `homework 4/` – `homework 10/` | Assignments. |

Empty folders are placeholders for work not yet started, and won't appear
here until they contain files.

## Lecture 7 — running the Course Explorer

The app is two processes in two terminals.

**Back end** — from `lecture 7/backend/`:

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
```

```bash
./.venv/bin/uvicorn main:app --port 8000
```

**Front end** — from `lecture 7/frontend/`:

```bash
npm install && npm run dev
```

| Service | URL |
| --- | --- |
| UI | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8000 |
| API docs | http://127.0.0.1:8000/docs |

Don't pass `--reload` to uvicorn — one edit shouldn't spawn multiple
processes. CORS is already open in `main.py` so Vite can reach port 8000.

### Environment

The agent uses **gpt-5.6-luna via Portkey**, which needs a `PORTKEY_API_KEY`.
Copy the example file and fill in your own key:

```bash
cp "lecture 7/.env.example" "lecture 7/.env"
```

`main.py` loads both `lecture 7/.env` and the parent folder's `.env`, so
either location works. Real `.env` files are gitignored — only
`.env.example` is committed.

### Architecture notes

- `agent.py` exposes `run_agent(message: str) -> {reply, tools_used}`.
- The agent has exactly two tools: `search_courses` (for anything the
  course JSON can answer) and `web_search` (only when the JSON falls short).
- Every agent run appends one entry to `output/audit_trail.json` — time,
  user message, thoughts, each tool call, and why it stopped.

## Course data

`lecture 7/data/yale_som_classes.json` is the course-provided dataset of
234 Yale SOM fall courses, distributed with the lecture 7 materials.
