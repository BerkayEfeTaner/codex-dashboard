# Release Checklist

Use this checklist before treating a local build as an MVP release candidate.

## Required Checks

- Backend syntax check passes: `npm.cmd run check` in `backend`.
- Backend API contract tests pass: `npm.cmd test` in `backend`.
- Backend API smoke check passes: `npm.cmd run smoke` in `backend`.
- Frontend unit/component tests pass: `npm.cmd test` in `frontend`.
- Frontend lint passes: `npm.cmd run lint` in `frontend`.
- Frontend production build passes: `npm.cmd run build` in `frontend`.
- Bundle analysis is reviewed when dependencies or charts change: `npm.cmd run analyze` in `frontend`.
- Chart vendor chunks are intentionally lazy-loaded and tracked separately; investigate if any minified chunk grows beyond 550 kB.

## Smoke Coverage

The backend smoke check validates the shape and availability of:

- `GET /api/health`
- `GET /api/summary`
- `GET /api/agents`
- `GET /api/agents/:id` when agent records exist
- `GET /api/capabilities`
- `GET /api/profiles`
- `POST /api/config/preview`
- `GET /api/diagnostics/report`
- `GET /api/analytics/trends`
- `GET /api/workspaces`
- `GET /api/sessions`
- `GET /api/sessions/:id` when session records exist
- `GET /api/activity`
- `GET /api/system`
- `GET /api/release/health`

## Dashboard Release View

- Open the Release page and confirm configured checks, smoke endpoint count, configured test runners, and discovered test files are visible.
- Treat `/api/release/health` as inventory only; it does not prove that checks were executed during that request.

## Release Risks

- The app reads local files from `CODEX_HOME`; empty or missing sources must degrade to empty states instead of crashes.
- SQLite-backed session and activity endpoints need limits or pagination before UI exposure.
- Frontend charts and Bootstrap dependencies affect bundle size; review `dist/bundle-report.html` after dependency-heavy changes.
- The MVP is read-only; write actions require a separate preview, validation, audit, and rollback design.

## Rollback

- Stop the local backend and frontend processes.
- Restore the previous Git commit or branch state.
- Restart backend and frontend using the README run commands.
