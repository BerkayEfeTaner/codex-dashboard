# Codex Dashboard Project Plan

## Product Vision

Codex Dashboard is a local-first control panel for understanding Codex usage, sessions, agents, profiles, activity, and system health from one place.

The dashboard should answer these questions quickly:

- What is Codex doing now?
- Which sessions, agents, profiles, and tools are involved?
- Which local source and config files are being used?
- Is the local environment healthy?
- What changed recently, and where should I inspect next?

## Current Baseline

Implemented pages:

- Overview
- Analytics
- Workspaces
- Agents
- Orchestration
- Capabilities
- Activity
- Profiles
- Sessions
- System
- Release

Implemented backend endpoints:

- `/api/health`
- `/api/summary`
- `/api/agents`
- `/api/agents/:id`
- `/api/orchestration`
- `/api/capabilities`
- `/api/config/preview`
- `/api/diagnostics/report`
- `/api/analytics/trends`
- `/api/workspaces`
- `/api/activity`
- `/api/sessions`
- `/api/sessions/:id`
- `/api/system`
- `/api/release/health`

Current frontend stack:

- React
- Vite
- React Router
- Tailwind CSS utilities with `tw-` prefix
- Reactstrap
- Bootstrap
- lucide-react
- Recharts

Current backend stack:

- Node.js
- Express
- CORS
- better-sqlite3

## Required Product Areas

### 1. Overview

Purpose: Give a fast operational summary.

Required sections:

- System health summary
- Active/recent sessions
- Recent activity
- Agent/profile summary
- Warnings and errors
- Last refresh time and source event times

### 2. Sessions

Purpose: Track Codex work history and resume context.

Required sections:

- Session list
- Session detail
- Tool timeline
- Model/profile/sandbox metadata
- Related activity records
- Empty/error states for missing session data

### 3. Activity

Purpose: Inspect recent Codex actions.

Required sections:

- Chronological event timeline
- Tool calls
- Shell commands
- File and tool activity
- Error and warning events
- Search and filters by type/time/status

### 4. Agents

Purpose: Understand available agent profiles and capabilities.

Required sections:

- Agent list
- Agent detail
- Skills/capabilities
- Model and permission metadata
- Last usage indicators
- Config source path

### 5. Profiles

Purpose: Inspect Codex runtime profiles.

Required sections:

- Profile list
- Active/default profile
- Model settings
- Sandbox and approval settings
- MCP/tooling configuration
- Risk indicators for permissive settings

### 6. System

Purpose: Diagnose local runtime health.

Required sections:

- Backend/frontend service status
- Ports
- `CODEX_HOME`
- Config paths
- Runtime versions
- Log availability
- Health check results

### 7. Shared UX

Required across all pages:

- Loading state
- Empty state
- Error state
- Responsive layout
- Search/filter where lists can grow
- Stable refresh behavior
- Clear distinction between refresh time and event time

### 8. Analytics

Purpose: Show usage trends without overloading the Overview payload.

Required sections:

- Session and log event trend
- Token and log byte volume
- Model, target, and level distributions
- Range controls with backend-side clamping
- Source availability and refresh metadata

### 9. Workspaces

Purpose: Show Codex usage by local project root.

Required sections:

- Workspace inventory from thread `cwd` values
- Readable/missing path status
- Thread, token, and log event totals
- Recent threads per workspace
- Model and sandbox policy distribution
- Source availability and refresh metadata

## MVP Scope

The MVP is a reliable read-only observability dashboard.

Included:

- All main routes render correctly.
- Backend exposes stable read endpoints.
- Overview summarizes the system in under 30 seconds of reading.
- Sessions and Activity show recent records chronologically.
- Agents and Profiles reflect local config data.
- Workspaces show local project roots and recent Codex usage.
- System shows local runtime health.
- UI handles empty, loading, and error states.
- Basic responsive behavior is verified.

Excluded from MVP:

- Starting/stopping Codex jobs from the dashboard
- Editing config from the dashboard
- Cloud sync
- Authentication
- Multi-user support
- Advanced analytics
- Full-text log search

## Development Phases

### Sprint 0: Product And Data Foundation

Goal: Make the scope and data contracts explicit.

Tasks:

- Map all Codex local data sources. Done in `docs/DATA_SOURCES.md`.
- Document backend response shapes. Done in `docs/API_CONTRACTS.md`.
- Decide which pages use `/api/summary` and which need dedicated endpoints. Done in `docs/TECHNICAL_BACKLOG.md`.
- Define standard API response format. Initial target documented in `docs/API_CONTRACTS.md`.
- Define empty/error/loading state requirements. Initial rules documented in `docs/DATA_SOURCES.md` and `docs/TECHNICAL_BACKLOG.md`.

Acceptance criteria:

- Every page has known data dependencies.
- Every endpoint has a documented response shape.
- Missing data behavior is defined before UI work expands.

### Sprint 1: Dashboard Shell And Health

Goal: Make the dashboard stable as a product shell.

Tasks:

- Improve shared layout and responsive behavior.
- Add consistent page headers.
- Add global refresh metadata.
- Strengthen `/api/health`.
- Improve Overview and System as first diagnostic pages.

Acceptance criteria:

- Dashboard opens cleanly on desktop/tablet/mobile widths.
- Overview shows health, sessions, activity, and config status.
- System shows actionable runtime information.

### Sprint 2: Sessions And Activity

Goal: Make Codex work history inspectable.

Tasks:

- Add dedicated sessions endpoint if needed.
- Add session detail view.
- Add activity filters.
- Show event time separately from refresh time.
- Add clear error/empty states for missing history files.

Acceptance criteria:

- User can inspect recent sessions without reading raw files.
- User can filter activity by type/status/time.
- Broken or missing history data is visible, not silent.

### Sprint 3: Agents And Profiles

Goal: Make Codex operating identity understandable.

Tasks:

- Normalize agent/profile parsing.
- Add agent detail sections.
- Add profile setting detail sections.
- Surface sandbox, approval, model, and skill metadata.
- Add warnings for risky or missing config.

Acceptance criteria:

- User can see which agent/profile configuration exists.
- Important permission/sandbox settings are visible.
- Config source paths are shown.

### Sprint 4: MVP Hardening

Goal: Prepare a usable MVP release.

Tasks:

- Run lint/build/analyze.
- Add API smoke checks.
- Check responsive layouts.
- Remove dead/demo code.
- Update README and run instructions.
- Review accessibility basics.

Acceptance criteria:

- Main flows work.
- No known broken page remains.
- README accurately explains local startup and data sources.
- Bundle warnings are understood or resolved with a scalable approach.

## Backlog After MVP

- Advanced activity search: Done
- Session-to-file relationship graph: Done
- Agent orchestration view: Done
- Skill/plugin management view: Done
- Config change preview: Done; safe apply flow deferred until audit, backup, and rollback are designed
- Exportable diagnostic report: Done
- Trend analytics: Done
- Multi-workspace support: Done
- Test/coverage/release health panels: Done
- Real backend/frontend test infrastructure: Done

## Project Management Rules

- Prefer read-only features until observability is reliable.
- Do not add dashboard actions that mutate Codex config before preview, validation, and rollback exist.
- Keep `/api/summary` small enough for overview usage; move heavy details to dedicated endpoints.
- Keep page components focused; shared formatting and data helpers should live outside pages.
- Every growing list needs a limit, filter, or pagination path.
- Every new page section needs loading, empty, and error behavior.
- Use Tailwind utilities with `tw-` prefix to avoid Bootstrap conflicts.
- Use Reactstrap for common Bootstrap-compatible UI components.
- Prefer long-term maintainable fixes over suppressing warnings.

## Validation Checklist

Use this before closing each sprint:

- Project is responsive.
- No unnecessary code remains.
- No unnecessary files remain.
- Main functions work correctly.
- Project structure remains coherent.
- `npm run lint` passes for frontend.
- `npm run build` passes for frontend.
- Backend health endpoint responds.
- Main API endpoints respond.
- UI data matches local source data where practical.
