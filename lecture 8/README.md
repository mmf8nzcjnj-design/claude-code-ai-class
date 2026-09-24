# Lecture 8 — Course Explorer with accounts and a database

The Lecture 7 Course Explorer (React + Vite + TypeScript, FastAPI,
PydanticAI), now backed by SQLite, with these additions:

- **Database** — `data/yale_som.db` holds three tables: `courses` (234 rows,
  the catalog), `users`, and `chats`. The catalog grid and the agent's
  `search_courses` tool both read `courses`.
- **Sign-in** — a sign-in / create-account screen sits in front of the app.
  Passwords are stored as bcrypt hashes (the salt is inside the hash).
- **Saved chats** — every message a signed-in student sends to Sol, and
  every reply, goes into `chats`. They reload on the next visit. "Clear"
  deletes them.

## Run locally

Two processes in two terminals. Back end, from `lecture 8/backend/`:

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
```

```bash
./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

Front end, from `lecture 8/frontend/`:

```bash
npm install && npm run dev
```

UI at http://127.0.0.1:5173, API docs at http://127.0.0.1:8000/docs.

Copy `.env.example` to `.env` and fill in `PORTKEY_API_KEY` and `SECRET_KEY`.

### How the database file works

`data/yale_som.db` is the committed seed. The app never writes to it. On
first start the back end copies it to `data/app.db` (gitignored), and every
new account and chat goes into that copy. Test accounts on your laptop
therefore never end up in the public repo. Delete `data/app.db` to start
over.

## API

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| GET | `/api/courses` | — | All courses, from the `courses` table |
| POST | `/api/auth/signup` | — | `{name, email, password}` → `{token, user}` |
| POST | `/api/auth/login` | — | `{email, password}` → `{token, user}` |
| GET | `/api/auth/me` | ✓ | The signed-in user |
| GET | `/api/chats` | ✓ | This user's saved messages, oldest first |
| DELETE | `/api/chats` | ✓ | Delete this user's saved messages |
| POST | `/api/chat` | ✓ | `{message}` → `{reply, tools_used}`; saves both |

"Auth" means an `Authorization: Bearer <token>` header. Tokens are signed
with `SECRET_KEY` and last 7 days.

## Deploy on Render

Two services from the same GitHub repo: a **Web Service** for the back end,
and a **Static Site** for the front end. Deploy the back end first, because
the front end needs its URL.

> **Heads-up: accounts and chats reset.** Render's free disk is wiped on
> every deploy and restart, and a free service restarts after ~15 minutes
> idle. Each time, the app starts again from the committed `yale_som.db`:
> the courses are always there, but accounts and saved chats are gone. The
> fix is a paid persistent disk (set `DB_PATH` to a file on it) or a hosted
> database.

### 1. Back end → Web Service

Render dashboard → **New → Web Service** → pick the
`claude-code-ai-class` repo.

| Setting | Value |
| --- | --- |
| Name | `som-explorer-api` (any name) |
| Branch | `main` |
| Root Directory | `lecture 8/backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |

Environment variables:

| Key | Value |
| --- | --- |
| `PORTKEY_API_KEY` | your Portkey key |
| `SECRET_KEY` | click **Generate** |

Create it and wait for **Live**. Copy the URL (e.g.
`https://som-explorer-api.onrender.com`) and open `/api/health` on it. It
should return `{"ok": true, ...}`.

### 2. Front end → Static Site

**New → Static Site** → the same repo.

| Setting | Value |
| --- | --- |
| Name | `som-explorer` (any name) |
| Branch | `main` |
| Root Directory | `lecture 8/frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

Environment variable: `VITE_API_BASE` = the back end URL from step 1, with
no trailing slash.

### 3. Lock CORS to the site (optional)

Back on the Web Service → **Environment**, add `CORS_ORIGINS` = the Static
Site URL (e.g. `https://som-explorer.onrender.com`). Saving it redeploys.
