# Codex Dashboard

Codex Dashboard is a local, read-only dashboard for inspecting Codex activity, sessions, agents, profiles, and local SQLite state.

## Stack

- Backend: Node.js, Express, CORS, better-sqlite3
- Frontend: Vite, React, React Router, Tailwind CSS, Reactstrap, Bootstrap, lucide-react, Recharts
- API port: `3132`
- Frontend port: `5174`
- Vite proxy: `/api` -> `http://localhost:3132`

## Run

Terminal 1:

```powershell
cd C:\Users\sezer\WebstormProjects\codex-dashboard\backend
npm.cmd run dev
```

Terminal 2:

```powershell
cd C:\Users\sezer\WebstormProjects\codex-dashboard\frontend
npm.cmd run dev
```

Open:

```text
http://localhost:5174
```

## Validation

Backend:

```powershell
cd C:\Users\sezer\WebstormProjects\codex-dashboard\backend
npm.cmd test
npm.cmd run check
npm.cmd run smoke
```

Use a different backend URL when needed:

```powershell
$env:BASE_URL='http://127.0.0.1:3133'
npm.cmd run smoke
```

Frontend:

```powershell
cd C:\Users\sezer\WebstormProjects\codex-dashboard\frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run analyze
```

`npm.cmd run analyze` writes `frontend/dist/bundle-report.html`.

## Data Sources

The backend reads Codex data from `CODEX_HOME` or `C:\Users\<user>\.codex`.

Overview Usage Limits are read from local `sessions/**/*.jsonl` `token_count.rate_limits` events when Codex writes them. The primary limit is the 5-hour window (`windowMinutes: 300`); the secondary limit is the weekly window (`windowMinutes: 10080`).

Local usage windows are still read from `state_5.sqlite` and `logs_2.sqlite`. Remaining token counts for those local rolling windows are shown only when dashboard limits are configured:

```powershell
$env:CODEX_DAILY_TOKEN_LIMIT='1000000'
$env:CODEX_WEEKLY_TOKEN_LIMIT='5000000'
```

Or create `C:\Users\<user>\.codex\dashboard-limits.json`:

```json
{
  "dailyTokenLimit": 1000000,
  "weeklyTokenLimit": 5000000
}
```

Current sources:

- `dashboard-agents.json`
- `dashboard-config.json`
- `dashboard-agent-sessions.json`
- `dashboard-review-history.json`
- `history.jsonl`
- `session_index.jsonl`
- `version.json`
- `dashboard-limits.json` when present
- `logs_2.sqlite`
- `state_5.sqlite`
- Backend and frontend `package.json`
- `backend/scripts/smoke-check.mjs`
- `docs/RELEASE_CHECKLIST.md`

## Scope

The current MVP is intentionally read-only. Mutation endpoints should wait until preview, validation, audit logging, and rollback flows exist.

## Project Plan

The product roadmap, MVP scope, sprint plan, acceptance criteria, and validation checklist are tracked in:

- `docs/PROJECT_PLAN.md`
- `docs/DATA_SOURCES.md`
- `docs/API_CONTRACTS.md`
- `docs/FRONTEND_DATA_HOOKS.md`
- `docs/TECHNICAL_BACKLOG.md`
- `docs/RELEASE_CHECKLIST.md`
