# Technical Backlog

This backlog turns the product plan into implementation work. It is ordered by dependency and long-term maintainability, not by quick visual wins.

## API Split Strategy

Current frontend pages mostly consume `/api/summary`. This is acceptable for the first working version, but it will not scale if sessions and activity logs grow.

### Keep On `/api/summary`

| Page | Reason |
| --- | --- |
| Overview | Needs compact aggregate data for first load |
| Shell/Header | Needs global refresh, error, and Codex home metadata |

### Move To Dedicated Endpoints First

| Priority | Page | Endpoint Direction | Reason |
| --- | --- | --- | --- |
| P1 | Sessions | `GET /api/sessions`, `GET /api/sessions/:id` | Thread lists and details will grow and need filtering/detail views |
| P1 | Activity | `GET /api/activity?level=&target=&threadId=&query=&limit=` | Logs can grow fast and need backend-side filtering |
| P2 | Profiles | `GET /api/profiles` | Profile data is small now but deserves a stable contract |
| P2 | Agents | `GET /api/agents`, `GET /api/agents/:id` | Agent details and skills can grow later |
| P2 | System | `GET /api/system` | Already exists; frontend can switch from summary when System expands |

## Sprint 0 Remaining Work

### TB-001: Define Shared API Helpers

Goal: Stop page components from depending directly on raw `fetch` details.

Tasks:

- Add a frontend API helper module. Done in `frontend/src/api/client.js`.
- Keep `fetchSummary` behavior unchanged. Done.
- Add typed-by-convention functions for existing endpoints. Done.
- Centralize HTTP error formatting. Done.

Acceptance criteria:

- `useSummary` imports summary fetching from the shared API helper. Done.
- No behavior change in current UI.
- Future page-level hooks can reuse the helper. Done.

### TB-002: Define Dedicated Data Hooks

Status: Done

Goal: Prepare pages to leave `/api/summary` gradually.

Tasks:

- Add hook pattern for endpoint-backed pages. Done in `frontend/src/hooks/useEndpoint.js`.
- Start with `useSummary` only if implementation should stay minimal. Done; `useSummary` now wraps the shared hook without changing its public return shape.
- Document naming convention: `useActivity`, `useSessions`, `useProfiles`. Done in `docs/FRONTEND_DATA_HOOKS.md`.

Acceptance criteria:

- There is a clear convention before adding new page data flows. Done.
- Existing pages keep working.

### TB-003: Standard Empty/Error State Components

Status: Done

Goal: Avoid each page inventing its own empty and error UI.

Tasks:

- Add reusable empty state component.
- Add reusable inline error state component.
- Use Reactstrap-compatible structure.

Acceptance criteria:

- New page sections can show empty/error states consistently.
- Existing loading/error behavior remains intact.

## Sprint 1 Candidate Work

### TB-101: Strengthen Health Endpoint

Status: Done

Goal: `/api/health` should verify runtime and source availability, not just return `ok: true`.

Tasks:

- Include backend status. Done.
- Include Codex home existence. Done.
- Include readable source counts. Done.
- Include source availability summary. Done.

Acceptance criteria:

- Health response identifies missing Codex home or source files. Done.
- Overview/System can display actionable health state.

### TB-102: Improve Overview Information Architecture

Status: Done

Goal: Overview should answer system status quickly.

Tasks:

- Add health card. Done.
- Add recent activity preview. Done.
- Add source file status preview. Done.
- Keep detailed lists out of Overview. Done.

Acceptance criteria:

- User can understand health, activity, sessions, and source state without opening raw files. Done.
- Overview remains readable on desktop and mobile. Done.

### TB-103: Standard Page Header

Status: Done

Goal: Make all pages visually and structurally consistent.

Tasks:

- Add a reusable page header component. Done.
- Include title, subtitle, optional action, optional status pill. Done.
- Replace one-off headers gradually. Done for Overview, Agents, Activity, and Sessions.

Acceptance criteria:

- At least Overview, Agents, Activity, and Sessions use the same page header pattern. Done.

## Sprint 2 Candidate Work

### TB-201: Add Sessions Endpoint

Status: Done

Goal: Move Sessions page away from summary payload.

Tasks:

- Add `GET /api/sessions`. Done.
- Support `limit`. Done.
- Return thread list and thread stats. Done.
- Keep response compatible with current UI fields. Done.

Acceptance criteria:

- Sessions page can render without reading `summary.threads`. Done.
- `/api/summary` can later reduce thread payload size. Done.

### TB-202: Add Activity Filters

Goal: Move activity filtering to the backend.

Status: Done

Tasks:

- Done: Add query params: `level`, `target`, `threadId`, `query`, `limit`.
- Done: Validate and cap `limit`.
- Done: Preserve current default response.

Acceptance criteria:

- Done: Activity page can filter large logs without loading all rows.
- Done: Bad query params do not crash the backend.

## Sprint 3 Candidate Work

### TB-301: Add Profiles Endpoint

Goal: Give Profiles a stable independent data source.

Status: Done

Tasks:

- Done: Add `GET /api/profiles`.
- Done: Return active profile and profile list.
- Done: Include config source status.

Acceptance criteria:

- Done: Profiles page can render without summary.
- Done: Missing config gives a visible fallback.

### TB-302: Add Agent Detail Contract

Goal: Prepare Agents page for real detail view.

Status: Done

Tasks:

- Done: Define stable agent id behavior.
- Done: Add `GET /api/agents/:id`.
- Done: Include skills, model, team, source path, and last known usage when available.

Acceptance criteria:

- Done: Agent detail can be built without changing list response later.

## Sprint 4 Candidate Work

## Sprint 5 Candidate Work

### TB-501: Add Session Detail Contract

Status: Done

Goal: Keep the Sessions list compact while allowing a selected thread to show metadata and related activity.

Tasks:

- Done: Add `GET /api/sessions/:id`.
- Done: Return one normalized thread row plus capped related activity.
- Done: Add `useSessionDetail`.
- Done: Update Sessions page with selectable thread rows and a detail panel.

Acceptance criteria:

- Done: Session detail can grow without changing the list endpoint.
- Done: Unknown thread ids return a clear `404`.

### TB-502: Add Activity Pagination

Status: Done

Goal: Activity should stay usable when logs grow beyond the first capped result set.

Tasks:

- Done: Add `offset` support to `/api/activity`.
- Done: Return filtered pagination metadata.
- Done: Add level and target controls to the Activity page.
- Done: Add previous/next controls.

Acceptance criteria:

- Done: Activity filtering and pagination happen backend-side.
- Done: Existing `/api/activity` consumers remain compatible.

## Sprint 6 Candidate Work

### TB-601: Add API Smoke Checks

Status: Done

Goal: Catch broken endpoint contracts before UI work depends on them.

Tasks:

- Done: Add `backend/scripts/smoke-check.mjs`.
- Done: Add `npm.cmd run smoke` for backend contract checks.
- Done: Keep optional record checks resilient when local Codex data is empty.

Acceptance criteria:

- Done: Core read-only endpoints are checked from one command.
- Done: Missing optional records skip detail checks instead of failing the whole release check.

### TB-602: Add MVP Release Runbook

Status: Done

Goal: Make local startup, validation, and release checks repeatable.

Tasks:

- Done: Update README with stack, ports, validation commands, and MVP scope.
- Done: Add `docs/RELEASE_CHECKLIST.md`.
- Done: Document bundle analysis expectations.

Acceptance criteria:

- Done: A developer can run the app and verify backend/frontend health from documented commands.
- Done: Release risks and rollback path are documented.

## Sprint 7 Candidate Work

### TB-701: Advanced Activity Search

Status: Done

Goal: Make the activity page usable as log volume grows.

Tasks:

- Done: Add backend-side `from` and `to` time filters to `/api/activity`.
- Done: Add thread id and date range controls to the Activity page.
- Done: Add a single reset action for all activity filters.
- Done: Add smoke coverage for date filter contract echoing.

Acceptance criteria:

- Done: Search, level, target, thread, date range, limit, and offset are applied backend-side.
- Done: Existing `/api/activity` consumers remain compatible.
- Done: Activity filters remain responsive on desktop and mobile layouts.

### TB-702: Session-To-File Relationship Graph

Status: Done

Goal: Show which files or modules are connected to a selected Codex thread.

Tasks:

- Done: Derive capped file/module relationships from `logs_2.sqlite`.
- Done: Add additive `fileGraph` data to `/api/sessions/:id`.
- Done: Render file relationship counts in the Sessions detail panel.
- Done: Add smoke coverage for the `fileGraph` contract.

Acceptance criteria:

- Done: Session list payload remains compact.
- Done: Missing file relationship data degrades to an empty state.
- Done: The relationship panel is responsive and does not require a heavy graph dependency.

### TB-703: Agent Orchestration View

Status: Done

Goal: Show how configured agents relate to detected agent sessions and recent Codex threads without adding mutation controls.

Tasks:

- Done: Add `GET /api/orchestration`.
- Done: Derive capped lanes, links, unmapped threads, and source metadata from local Codex files.
- Done: Add Orchestration page, route, navigation item, and data hook.
- Done: Add smoke coverage for the orchestration contract.

Acceptance criteria:

- Done: The page is read-only and future mutation flows remain out of MVP scope.
- Done: Missing relationships degrade to explicit empty states.
- Done: The view remains responsive and does not require a heavy graph dependency.

### TB-704: Skill/Plugin Management View

Status: Done

Goal: Expose local Codex skills and cached plugin manifests as a read-only capability inventory.

Tasks:

- Done: Add `GET /api/capabilities`.
- Done: Derive skill records from local `SKILL.md` files.
- Done: Derive plugin records from cached plugin manifests and marketplace metadata.
- Done: Add Capabilities page, route, navigation item, and data hook.
- Done: Add smoke coverage for the capabilities contract.

Acceptance criteria:

- Done: The page is read-only and does not install, update, delete, or enable capabilities.
- Done: Missing skill/plugin sources degrade to empty states and source status.
- Done: The inventory is searchable and remains responsive on desktop and mobile layouts.

### TB-705: Config Change Preview

Status: Done

Goal: Preview active profile config changes safely before any apply endpoint exists.

Tasks:

- Done: Add read-only `POST /api/config/preview`.
- Done: Return current/proposed active profile, change diff, validation checks, and source metadata.
- Done: Keep apply unavailable until audit, backup, and rollback behavior is designed.
- Done: Add Profiles page preview panel and smoke coverage.

Acceptance criteria:

- Done: The endpoint does not write files.
- Done: Unsupported draft fields are returned explicitly.
- Done: Future apply work has a validation and rollback contract to build on.

### TB-706: Exportable Diagnostic Report

Status: Done

Goal: Provide a support-friendly read-only report that captures local health, config validation, inventory, activity, source status, and risk signals.

Tasks:

- Done: Add `GET /api/diagnostics/report`.
- Done: Keep recent thread and activity samples capped.
- Done: Add System page JSON export action.
- Done: Add smoke coverage for the report contract.

Acceptance criteria:

- Done: The endpoint does not write files or mutate local Codex state.
- Done: The report includes a format version for future export compatibility.
- Done: Support and release checks can use one export without expanding `/api/summary`.

### TB-707: Trend Analytics

Status: Done

Goal: Add a dedicated analytics contract and page for local Codex usage trends without expanding `/api/summary`.

Tasks:

- Done: Add `GET /api/analytics/trends`.
- Done: Return UTC daily buckets, totals, averages, and capped model/target/level distributions.
- Done: Add Analytics page, route, navigation item, and data hook.
- Done: Add smoke coverage for the trend analytics contract.

Acceptance criteria:

- Done: Invalid or excessive ranges are clamped before database access.
- Done: Missing SQLite sources degrade to zero-filled buckets with source status.
- Done: Analytics can grow through its own endpoint instead of summary payload changes.

### TB-708: Multi-Workspace Support

Status: Done

Goal: Show which local project roots Codex has worked in without expanding the Overview payload.

Tasks:

- Done: Add `GET /api/workspaces`.
- Done: Group recent threads by `cwd` and expose readable/missing path status.
- Done: Join capped per-thread log counts from `logs_2.sqlite`.
- Done: Add Workspaces page, route, navigation item, and data hook.
- Done: Add smoke coverage for the workspace contract.

Acceptance criteria:

- Done: Workspace inventory remains read-only.
- Done: Missing state or log SQLite sources degrade to empty stats/source status.
- Done: The page supports search and responsive workspace cards.

### TB-709: Test Coverage And Release Health Panels

Status: Done

Goal: Make release readiness visible inside the dashboard without hiding missing test infrastructure.

Tasks:

- Done: Add read-only `GET /api/release/health`.
- Done: Derive verification checks from backend/frontend package scripts.
- Done: Discover capped backend/frontend `*.test` and `*.spec` files.
- Done: Add Release page, route, navigation item, and data hook.
- Done: Add smoke coverage for the release health contract.

Acceptance criteria:

- Done: The endpoint does not run shell commands from HTTP requests.
- Done: Missing test runners/files are visible as release gaps.
- Done: The page remains responsive and separates source refresh time from actual validation execution.

### TB-710: Real Test Infrastructure

Status: Done

Goal: Replace release-gap-only test visibility with executable backend and frontend tests.

Tasks:

- Done: Add backend `npm.cmd test` using Node's built-in `node --test` runner.
- Done: Export the Express app without opening a port during tests.
- Done: Add backend API contract tests for health, release health, and removed database inspection routes.
- Done: Add frontend `npm.cmd test` using Vitest, Testing Library, and jsdom.
- Done: Add frontend API client tests and Release page render coverage.

Acceptance criteria:

- Done: Backend tests pass locally.
- Done: Frontend tests pass locally.
- Done: `/api/release/health` reports configured backend and frontend runners with discovered test files.

## Cross-Cutting Rules

- Keep `/api/summary` compact.
- Add backend-side limits before displaying growing lists.
- Prefer read-only endpoints until validation/rollback patterns exist.
- Do not introduce mutation endpoints in MVP.
- Keep UI states consistent: loading, empty, error, success.
- Every new endpoint must be added to `docs/API_CONTRACTS.md`.
- Every new data source must be added to `docs/DATA_SOURCES.md`.
