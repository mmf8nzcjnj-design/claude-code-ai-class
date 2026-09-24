# Lecture 7 — Web Applications (Yale SOM Course Explorer)

Full-stack app: React + Vite + TypeScript front end, FastAPI + PydanticAI
back end, over a JSON pack of Yale SOM fall courses.

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
- Model: **gpt-5.6-luna via Portkey**. `PORTKEY_API_KEY` comes from a
  `.env`. `main.py` loads both `lecture 7/.env` and the parent course
  folder's `.env`, so either location works.
- Ship `.env.example` only. Never commit a real key.

## Layout

```
lecture 7/
  .env.example
  data/
    yale_som_classes.json     # 234 courses, from the course data.zip
  backend/
    requirements.txt
    main.py                   # API routes — do not rewrite unless asked
    agent.py                  # run_agent(message) -> {reply, tools_used}
    tools.py                  # search_courses, web_search
    models.py                 # Course, AgentResult
    prompts/
      prompt.md               # agent system prompt
  frontend/
    src/
      App.tsx
      main.tsx
      api.ts
      components/             # CourseCard, ChatPanel, ...
  output/
    audit_trail.json          # append one entry per agent run; never wipe
```

## Contracts

- `main.py` is the given shell from the lecture. Do not rewrite or
  replace it unless asked.
- `agent.py` must expose `run_agent(message: str) -> dict` with keys
  `reply: str` and `tools_used: list[str]`.
- The agent gets **exactly two tools**: `search_courses` and
  `web_search`. Do not add `filter_courses`, `count_courses`, or others
  unless asked.
- Agent behavior: use `search_courses` for anything the course JSON can
  answer; `web_search` only when the JSON falls short; never invent
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
