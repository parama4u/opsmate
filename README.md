# OrgChai

Internal Q&A agent for company knowledge. Employees ask questions about policies and IT. Answers are grounded in indexed documents (RAG) with optional Slack.

## Structure

```
orgchai/
├── api/                 # FastAPI + Prisma migrations + pgvector
├── web/                 # Next.js + shadcn + Firebase + i18n
└── docker-compose.yml   # postgres (pgvector) + api + web
```

## Features

### API (FastAPI)
- Document ingest for TXT, Markdown, HTML, DOCX, and PDF, with idempotent indexing
- Source status, ownership, review dates, expiration, canonical links, previews, and access allowlists
- Persistent chats scoped to the signed-in user
- Conversation context, abstention, answer modes, feedback, review queue, analytics, audit records, and retention controls
- Firebase ID token auth + `X-API-Key`
- Slack: `@mention`, DMs, `/orgchai`, Socket Mode or HTTP events
- Prisma owns schema and migrations; FastAPI uses psycopg2 at runtime

### Web
- Marketing landing + authenticated dashboard
- Chat UI with source previews, markdown, answer modes, document list, and answer feedback
- i18n (`next-intl`): English + Japanese
- Firebase auth, React Query, `/api/proxy` injects `APP_API_KEY`

## Quick start

Requires **Node.js ≥ 20.9** (pins **26.3** in `.nvmrc`), **npm ≥ 11**, **Python 3.11+**, and PostgreSQL with pgvector.

```bash
# Database
# Option A: docker compose up postgres
# Option B: local Postgres with the pgvector extension

# Prisma migrations (from api/)
cd api && cp .env.example .env && npm install && npx prisma migrate dev

# API
cd api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn orgchai.main:app --reload --host 0.0.0.0 --port 5000

# Web
cd web && cp .env.example .env.local && npm install && npm run dev
```

Set `APP_API_KEY` in web `.env.local` to the same value as api. The `/api/proxy` route injects it server-side; it is never exposed to the browser.

Document ingest and delete require an admin account. Put your email in `ADMIN_EMAILS` on the API.

OrgChai keeps the `opsmate` Python module path as a compatibility boundary for existing local deployments. The public product name, environment defaults, API metadata, Slack command, and web copy use OrgChai. Rename the module only as a coordinated migration with a rollback path for existing deployments.

## Env

- `api/.env.example`: database, Firebase Admin, LLM (`AIAND_*`, `MODEL_NAME`), Slack, `ADMIN_EMAILS`
- `web/.env.example`: `API_BASE`, `APP_API_KEY`, Firebase client config (served via `/api/firebase-config`)
