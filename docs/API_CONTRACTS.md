# API Contracts

The backend runs on port `3132` by default. The frontend uses Vite proxy routes under `/api`.

Current endpoints return raw JSON payloads. Sprint 0 records the existing contracts first; later sprints can standardize envelopes without changing behavior blindly.

## `GET /api/health`

Purpose: Backend and local Codex source availability check.

Response:

```json
{
  "ok": true,
  "status": "healthy",
  "codexHome": "C:\\Users\\sezer\\.codex",
  "codexHomeExists": true,
  "codexHomeReadable": true,
  "refreshedAt": "2026-05-07T13:34:04.723Z",
  "runtime": {
    "node": "v22.20.0",
    "platform": "Windows_NT 10.0.26100",
    "pid": 1234
  },
  "sources": {
    "total": 7,
    "existing": 7,
    "missing": 0,
    "readable": 7,
    "files": []
  },
  "databases": {
    "total": 2,
    "available": 2,
    "missing": 0,
    "errored": 0,
    "files": []
  }
}
```

Rules:

- `ok` is boolean and represents overall local dashboard health.
- `status` is `healthy` when all required SQLite databases are available and Codex home is readable; otherwise `degraded`.
- `refreshedAt` is the API response time.
- This contract is additive from the original health response: `ok`, `codexHome`, and `refreshedAt` remain present.
- Missing or unreadable source files must be represented in `sources.files`.
- Missing, unreadable, or invalid SQLite databases must be represented in `databases.files`.

## `GET /api/summary`

Purpose: Main dashboard bootstrap payload.

Top-level fields:

| Field | Type | Description |
| --- | --- | --- |
| `codexHome` | string | Active Codex data directory |
| `refreshedAt` | ISO string | Dashboard fetch/build time |
| `version` | object | Parsed `version.json` |
| `activeProfile` | object/null | Active profile from config |
| `profiles` | array | Profile list |
| `agents` | array | Agent list |
| `teams` | object | Agent count by team |
| `models` | object | Agent count by model |
| `files` | array | File status objects |
| `databases` | array | Inspected SQLite database summaries |
| `threads` | array | Recent Codex threads |
| `activity` | array | Recent log entries |
| `system` | object | Runtime, file, DB, thread, and log stats |
| `health` | object | Compact health response matching `/api/health` |
| `usage` | object | Real local Codex usage windows and optional configured token limits |
| `recentHistory` | array | Tail of `history.jsonl` |
| `sessionIndex` | array | Tail of `session_index.jsonl` |
| `counts` | object | Overview counts |

Important nested shapes:

```json
{
  "counts": {
    "agents": 0,
    "teams": 0,
    "profiles": 0,
    "agentSessions": 0,
    "reviewHistory": 0,
    "threads": 0,
    "logs": 0
  }
}
```

```json
{
  "system": {
    "node": "v22.20.0",
    "platform": "Windows_NT 10.0.26100",
    "codexHome": "C:\\Users\\sezer\\.codex",
    "activeModel": "gpt-5.4",
    "activeReasoningEffort": "medium",
    "activeApprovalMode": "on-request",
    "databaseFiles": [],
    "sourceFiles": [],
    "threadStats": {},
    "logStats": {}
  }
}
```

```json
{
  "usage": {
    "source": {
      "type": "local-codex-sqlite",
      "accountLimitAvailable": true,
      "accountLimitConfigured": false
    },
    "rateLimits": {
      "source": {
        "type": "local-codex-session-jsonl",
        "available": true,
        "filesScanned": 25
      },
      "updatedAt": "2026-05-08T12:00:00.000Z",
      "planType": "plus",
      "primary": {
        "label": "5-hour",
        "windowMinutes": 300,
        "usedPercent": 47,
        "remainingPercent": 53,
        "resetsAt": "2026-05-08T14:00:00.000Z",
        "status": "ok"
      },
      "secondary": {
        "label": "weekly",
        "windowMinutes": 10080,
        "usedPercent": 64,
        "remainingPercent": 36,
        "resetsAt": "2026-05-11T12:00:00.000Z",
        "status": "ok"
      }
    },
    "periods": {
      "daily": {
        "window": "rolling_24h",
        "usedTokens": 0,
        "limitTokens": null,
        "remainingTokens": null,
        "status": "unconfigured",
        "sessions": 0,
        "logEvents": 0
      },
      "weekly": {
        "window": "rolling_7d",
        "usedTokens": 0,
        "limitTokens": null,
        "remainingTokens": null,
        "status": "unconfigured",
        "sessions": 0,
        "logEvents": 0
      }
    }
  }
}
```

Rules:

- This payload should stay suitable for initial page load.
- `health` is additive and keeps the same shape as `/api/health` so Overview can show actionable health without a second request.
- `usage.rateLimits` is read from the newest local Codex session JSONL `token_count.rate_limits` event. `primary.windowMinutes = 300` is the 5-hour limit; `secondary.windowMinutes = 10080` is the weekly limit.
- `usage.periods.*.usedTokens`, `sessions`, and `logEvents` are read from local SQLite sources.
- `usage.periods.daily` is a backward-compatible rolling 24h local usage window, not the Codex 5-hour account limit.
- `remainingTokens` in `usage.periods` is calculated only when `CODEX_DAILY_TOKEN_LIMIT`, `CODEX_WEEKLY_TOKEN_LIMIT`, or `dashboard-limits.json` values are configured.
- Heavy detail data should move to dedicated endpoints before the payload becomes large.
- Missing sources should return empty arrays, nulls, zero counts, or explicit source errors.

## `GET /api/agents`

Purpose: Agent list.

Current response:

```json
[
  {
    "name": "Example Agent",
    "team": "dev-team",
    "model": "gpt-5.4"
  }
]
```

Rules:

- Returns an array.
- `id` is the stable route identifier for detail requests.
- If a source record has no `id`, the backend derives one from team and name.
- Missing agent source returns `[]`.
- Detail view must use `/api/agents/:id` instead of expanding the list response with heavy fields later.

## `GET /api/agents/:id`

Purpose: Stable agent detail contract.

Current response:

```json
{
  "agent": {
    "id": "ai-ops-team-team-lead",
    "name": "Team Lead",
    "team": "ai-ops-team",
    "model": "gpt-5.4",
    "reasoningEffort": "medium",
    "skills": []
  },
  "source": {
    "name": "dashboard-agents.json",
    "path": "C:\\Users\\sezer\\.codex\\dashboard-agents.json",
    "exists": true,
    "readable": true,
    "size": 12345,
    "modifiedAt": "2026-05-07T13:34:04.723Z"
  },
  "lastKnownUsage": null,
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Not found response:

```json
{
  "error": "agent_not_found",
  "id": "unknown-agent",
  "source": {}
}
```

Rules:

- This endpoint is additive and does not change the `/api/agents` array shape.
- `agent.id` must match the route id and list id.
- `source` identifies the agent source file and readability.
- `lastKnownUsage` is nullable because local Codex thread data does not always identify an agent.
- Unknown agent ids return `404`.

## `GET /api/orchestration`

Purpose: Read-only agent operating map that connects configured agents, detected agent sessions, and recent Codex threads.

Current response:

```json
{
  "agents": [
    {
      "id": "ai-ops-team-team-lead",
      "name": "team-lead",
      "team": "ai-ops-team",
      "model": "gpt-5.4-mini",
      "reasoningEffort": "medium",
      "skills": [],
      "status": "configured",
      "recentThreads": [],
      "sessions": [],
      "metrics": {
        "skillCount": 0,
        "threadCount": 0,
        "sessionCount": 0
      }
    }
  ],
  "lanes": [],
  "edges": [],
  "unmappedThreads": [],
  "stats": {
    "agents": 0,
    "recentlyActiveAgents": 0,
    "configuredOnlyAgents": 0,
    "skills": 0,
    "links": 0,
    "agentSessions": 0,
    "unmappedThreads": 0
  },
  "source": {},
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Rules:

- This endpoint is read-only and must not start, stop, or mutate agents.
- The agent list is derived from `dashboard-agents.json`.
- Agent sessions are derived from `dashboard-agent-sessions.json`.
- Thread links are derived from recent rows in `state_5.sqlite` and capped so the route stays suitable for UI loading.
- `lanes` and `edges` are presentation-ready summaries; the raw source files remain available through `source`.

## `GET /api/capabilities`

Purpose: Read-only skill and plugin inventory for Codex capabilities.

Current response:

```json
{
  "skills": [
    {
      "id": "user:clean-code",
      "name": "clean-code",
      "description": "Code quality workflow",
      "scope": "user",
      "path": "C:\\Users\\sezer\\.codex\\skills\\clean-code",
      "hasAgents": false,
      "hasAssets": false,
      "hasScripts": false,
      "hasReferences": false,
      "modifiedAt": "2026-05-07T13:34:04.723Z"
    }
  ],
  "plugins": [
    {
      "id": "github",
      "name": "github",
      "displayName": "GitHub",
      "description": "GitHub integration",
      "version": "1.0.0",
      "category": "Productivity",
      "capabilities": [],
      "keywords": [],
      "author": "",
      "path": "C:\\Users\\sezer\\.codex\\.tmp\\plugins\\plugins\\github",
      "policy": null,
      "marketplaceStatus": "LOCAL",
      "hasSkills": false,
      "hasApps": false,
      "modifiedAt": "2026-05-07T13:34:04.723Z"
    }
  ],
  "stats": {
    "skills": 0,
    "systemSkills": 0,
    "userSkills": 0,
    "plugins": 0,
    "pluginCategories": 0,
    "pluginsWithSkills": 0,
    "pluginsWithApps": 0,
    "pluginsRequiringAuth": 0,
    "pluginsWithWriteCapability": 0
  },
  "categories": {
    "skillsByScope": {},
    "pluginsByCategory": {},
    "pluginsByInstallation": {}
  },
  "source": {},
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Rules:

- This endpoint is read-only and must not install, update, delete, or enable skills/plugins.
- Skill data is derived from immediate `skills/*/SKILL.md` entries and `.system/*/SKILL.md` entries.
- Plugin data is derived from immediate cached plugin manifests under `.tmp/plugins/plugins/*/.codex-plugin/plugin.json`.
- Marketplace metadata is joined from `.tmp/plugins/.agents/plugins/marketplace.json` when available.
- Inventory arrays are capped so the route stays suitable for UI loading.

## `GET /api/databases`

Purpose: SQLite source inspection.

Current response:

```json
[
  {
    "name": "state_5.sqlite",
    "path": "C:\\Users\\sezer\\.codex\\state_5.sqlite",
    "exists": true,
    "size": 12345,
    "modifiedAt": "2026-05-07T13:34:04.723Z",
    "tables": [
      {
        "name": "threads",
        "count": 10,
        "columns": [
          { "name": "id", "type": "TEXT" }
        ]
      }
    ]
  }
]
```

Rules:

- Returns an array.
- Each database object includes `exists`.
- Unreadable or missing DBs include `error` where available.

## `GET /api/databases/:name/tables/:table`

Purpose: Paginated SQLite table detail and row preview.

Query params:

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | `50` | `200` | Maximum rows to return |
| `offset` | integer | `0` | - | Row offset for pagination |

Current response:

```json
{
  "database": "state_5.sqlite",
  "table": "threads",
  "columns": [
    { "name": "id", "type": "TEXT" }
  ],
  "rowCount": 43,
  "rows": [],
  "limit": 25,
  "offset": 0,
  "source": {
    "name": "state_5.sqlite",
    "path": "C:\\Users\\sezer\\.codex\\state_5.sqlite",
    "exists": true,
    "readable": true,
    "available": true
  },
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Rules:

- `name` must be one of the known local SQLite files.
- Unknown database names return `400` with `unknown_database`.
- Unknown table names return `404` with `table_not_found`.
- Missing or unavailable databases return a clear non-200 response with `source`.
- `limit` is clamped before database access.
- Table identifiers are verified through `sqlite_master` and quoted by the backend before query execution.

## `GET /api/activity`

Purpose: Recent log activity.

Query params:

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `level` | string | `""` | - | Exact log level filter |
| `target` | string | `""` | - | Exact target filter |
| `threadId` | string | `""` | - | Exact thread id filter |
| `query` | string | `""` | - | Text search across target, message, thread, file, and module fields |
| `from` | datetime/string/unix | `""` | - | Inclusive lower bound for log event time |
| `to` | datetime/string/unix | `""` | - | Inclusive upper bound for log event time |
| `limit` | integer | `50` | `200` | Maximum activity rows to return |
| `offset` | integer | `0` | - | Row offset for pagination |

Current response:

```json
{
  "activity": [],
  "stats": {
    "total": 0,
    "byLevel": {},
    "recentTargets": []
  },
  "filters": {
    "level": "",
    "target": "",
    "threadId": "",
    "query": "",
    "from": "",
    "to": "",
    "limit": 50,
    "offset": 0
  },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 0,
    "hasNext": false
  },
  "refreshedAt": "2026-05-07T00:00:00.000Z"
}
```

Rules:

- Activity entries should include source event time as `tsIso` when available.
- Default backend limit is `50`.
- Invalid or excessive limits are clamped before database access.
- Invalid `from` and `to` values are ignored by the database filter and echoed as received for UI state.
- Filters and pagination are applied backend-side; the default response still includes `activity` and `stats`.
- `pagination.total` is the filtered log count, not the global log count.

## `GET /api/sessions`

Purpose: Recent Codex thread list and thread statistics.

Query params:

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | `24` | `100` | Maximum thread rows to return |

Current response:

```json
{
  "threads": [],
  "stats": {
    "total": 0,
    "archived": 0,
    "active": 0,
    "byModel": {},
    "byApproval": {},
    "bySandbox": {}
  },
  "limit": 24,
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Rules:

- Returns the same thread row shape currently exposed through `summary.threads`.
- Invalid or excessive `limit` values are clamped.
- Missing or unreadable `state_5.sqlite` returns empty threads and zero stats.

## `GET /api/sessions/:id`

Purpose: Single Codex thread detail and related activity.

Current response:

```json
{
  "thread": {
    "id": "thread-id",
    "title": "Thread title",
    "model": "gpt-5.4",
    "reasoningEffort": "medium",
    "approvalMode": "on-request",
    "sandboxPolicy": "{\"type\":\"workspace-write\"}",
    "sandboxType": "workspace-write",
    "cwd": "C:\\Users\\sezer",
    "tokensUsed": 1234,
    "createdAtIso": "2026-05-07T13:34:04.723Z",
    "updatedAtIso": "2026-05-07T13:34:04.723Z",
    "firstUserMessage": "Example",
    "archived": false
  },
  "activity": [],
  "fileGraph": {
    "files": [
      {
        "path": "C:\\project\\src\\App.jsx",
        "modulePath": "src/App.jsx",
        "events": 4,
        "levels": { "INFO": 4 },
        "targets": { "exec": 4 },
        "firstSeenIso": "2026-05-07T13:34:04.723Z",
        "lastSeenIso": "2026-05-07T13:40:04.723Z"
      }
    ],
    "links": [
      {
        "threadId": "thread-id",
        "filePath": "C:\\project\\src\\App.jsx",
        "target": "exec",
        "level": "INFO",
        "events": 4,
        "firstSeenIso": "2026-05-07T13:34:04.723Z",
        "lastSeenIso": "2026-05-07T13:40:04.723Z"
      }
    ],
    "totals": {
      "files": 1,
      "events": 4
    }
  },
  "source": {
    "name": "state_5.sqlite",
    "path": "C:\\Users\\sezer\\.codex\\state_5.sqlite",
    "exists": true,
    "readable": true,
    "available": true
  },
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Not found response:

```json
{
  "error": "session_not_found",
  "id": "unknown-thread",
  "source": {}
}
```

Rules:

- This endpoint is additive and does not change the `/api/sessions` list shape.
- `thread.id` must match the route id.
- `activity` is capped related log activity for the selected thread.
- `fileGraph` is derived from related log rows and capped to the most active file/module relationships.
- Unknown thread ids return `404`.

## `GET /api/profiles`

Purpose: Active Codex profile and configured profile list.

Current response:

```json
{
  "activeProfile": null,
  "profiles": [],
  "source": {
    "name": "dashboard-config.json",
    "path": "C:\\Users\\sezer\\.codex\\dashboard-config.json",
    "exists": true,
    "readable": true,
    "size": 12345,
    "modifiedAt": "2026-05-07T13:34:04.723Z"
  },
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Rules:

- Returns the same profile object shape currently exposed through `summary.profiles`.
- Missing or malformed config returns `profiles: []` and `activeProfile: null`.
- `source` must expose whether the config file exists and is readable so the UI can show a visible fallback.

## `POST /api/config/preview`

Purpose: Read-only preview for proposed Codex config changes before any apply flow exists.

Current request:

```json
{
  "activeProfileId": "default"
}
```

Current response:

```json
{
  "current": {
    "activeProfileId": "economy"
  },
  "proposed": {
    "activeProfileId": "default",
    "activeProfile": {}
  },
  "changes": [
    {
      "type": "activeProfileId",
      "label": "Active profile",
      "before": "economy",
      "after": "default"
    }
  ],
  "validation": {
    "valid": true,
    "checks": [],
    "duplicateIds": [],
    "invalidProfiles": [],
    "supported": ["activeProfileId"],
    "unsupportedFields": []
  },
  "apply": {
    "available": false,
    "reason": "apply_flow_requires_preview_audit_and_rollback_design"
  },
  "rollback": {
    "sourcePath": "C:\\Users\\sezer\\.codex\\dashboard-config.json",
    "backupRequired": true
  },
  "source": {},
  "refreshedAt": "2026-05-07T13:34:04.723Z"
}
```

Rules:

- This endpoint is read-only and must not write `dashboard-config.json`.
- The current MVP supports previewing only `activeProfileId`; unsupported request fields must be returned in `validation.unsupportedFields`.
- `validation.checks` must explain whether profiles exist, active profile is valid, ids are unique, and required profile fields exist.
- `apply.available` remains `false` until a separate audited apply flow with backup and rollback behavior is designed.
- Future apply endpoints must consume a validated preview contract instead of accepting arbitrary config writes.

## `GET /api/diagnostics/report`

Purpose: Export a capped read-only diagnostic package for support, audits, and release checks.

Current response:

```json
{
  "report": {
    "title": "Codex Dashboard Diagnostic Report",
    "formatVersion": 1,
    "generatedAt": "2026-05-07T13:34:04.723Z",
    "scope": "local-read-only"
  },
  "environment": {},
  "health": {},
  "profile": {
    "activeProfileId": "default",
    "activeProfile": {},
    "totalProfiles": 1,
    "validation": {},
    "source": {}
  },
  "inventory": {},
  "activity": {
    "threads": {},
    "logs": {},
    "recentThreads": [],
    "recentActivity": []
  },
  "orchestration": {
    "stats": {},
    "unmappedThreads": []
  },
  "sources": {
    "files": [],
    "databases": []
  },
  "risks": []
}
```

Rules:

- This endpoint is read-only and must not mutate Codex config, skills, plugins, sessions, or databases.
- `report.formatVersion` is the compatibility marker for future JSON/PDF/HTML export formats.
- Recent thread and activity samples are capped so the report remains support-friendly.
- The report may include local paths and source status, but should avoid unbounded raw logs.
- `risks` are advisory signals derived from health, config validation, capabilities, and local history availability.

## `GET /api/analytics/trends`

Purpose: Dedicated trend analytics for sessions, logs, tokens, and source distributions without expanding `/api/summary`.

Query params:

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `days` | integer | `14` | `90` | Number of UTC day buckets to return |

Current response:

```json
{
  "range": {
    "days": 14,
    "from": "2026-04-24T00:00:00.000Z",
    "to": "2026-05-08T13:34:04.723Z",
    "timezone": "UTC"
  },
  "daily": [
    {
      "day": "2026-05-08",
      "sessions": 0,
      "logEvents": 0,
      "tokensUsed": 0,
      "estimatedBytes": 0
    }
  ],
  "totals": {
    "sessions": 0,
    "logEvents": 0,
    "tokensUsed": 0,
    "estimatedBytes": 0
  },
  "averages": {
    "sessionsPerDay": 0,
    "logEventsPerDay": 0,
    "tokensPerDay": 0
  },
  "distributions": {
    "models": [],
    "targets": [],
    "levels": []
  },
  "source": {},
  "refreshedAt": "2026-05-08T13:34:04.723Z"
}
```

Rules:

- The endpoint is read-only and uses capped UTC day buckets.
- Invalid or excessive `days` values are clamped before database access.
- Missing `state_5.sqlite` or `logs_2.sqlite` returns zero-filled daily buckets with source status.
- Daily event times represent source record dates; `refreshedAt` represents dashboard fetch/build time.

## `GET /api/workspaces`

Purpose: Multi-workspace inventory derived from Codex thread history without expanding `/api/summary`.

Query params:

| Param | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | `24` | `100` | Maximum workspace groups to return |

Current response:

```json
{
  "workspaces": [
    {
      "id": "workspace-hash",
      "path": "C:\\project",
      "name": "project",
      "exists": true,
      "readable": true,
      "threadCount": 4,
      "activeThreads": 3,
      "archivedThreads": 1,
      "tokensUsed": 1234,
      "logEvents": 22,
      "lastActivityIso": "2026-05-08T13:34:04.723Z",
      "models": {},
      "approvalModes": {},
      "sandboxTypes": {},
      "recentThreads": []
    }
  ],
  "stats": {
    "total": 1,
    "readable": 1,
    "missing": 0,
    "threads": 4,
    "activeThreads": 3,
    "archivedThreads": 1,
    "logEvents": 22,
    "tokensUsed": 1234
  },
  "limit": 24,
  "source": {},
  "refreshedAt": "2026-05-08T13:34:04.723Z"
}
```

Rules:

- This endpoint is read-only and derives workspace groups from `state_5.sqlite` thread `cwd` values.
- Log event counts are joined from `logs_2.sqlite` by thread id when available.
- Missing SQLite sources return an empty workspace list, zero stats, and source status.
- `exists` and `readable` reflect current filesystem status at dashboard refresh time.
- Source event time is represented by workspace and thread activity fields; `refreshedAt` is the dashboard fetch time.

## `GET /api/system`

Purpose: Runtime and source health diagnostics.

Current response shape matches `summary.system`.

Rules:

- Should stay small and diagnostic.
- Should not require loading thread or log detail lists.

## `GET /api/release/health`

Purpose: Read-only release readiness, verification command, smoke coverage, and test inventory summary.

Current response:

```json
{
  "release": {
    "readiness": "attention",
    "score": 80,
    "blockers": [],
    "warnings": []
  },
  "checks": [],
  "testCoverage": {
    "backend": {
      "configured": false,
      "script": null,
      "runners": [],
      "testFiles": [],
      "testFileCount": 0
    },
    "frontend": {},
    "totals": {
      "testFiles": 0,
      "configuredRunners": 0
    },
    "gaps": []
  },
  "smoke": {
    "endpointCount": 0,
    "endpoints": []
  },
  "source": {},
  "refreshedAt": "2026-05-08T13:34:04.723Z"
}
```

Rules:

- This endpoint is read-only and must not run shell commands or mutate project files.
- Verification checks are derived from `package.json` scripts and smoke-check source.
- Test files are discovered from capped `*.test.*` and `*.spec.*` scans outside `node_modules`, `dist`, and `coverage`.
- `refreshedAt` is dashboard response time; check execution time is not implied by this endpoint.

## Proposed Next Contracts

No pending read contracts in the current MVP backlog.

## Standardization Target

Before adding mutation endpoints, use a consistent response envelope for new endpoints:

```json
{
  "data": {},
  "meta": {
    "refreshedAt": "2026-05-07T13:34:04.723Z",
    "source": "state_5.sqlite"
  },
  "error": null
}
```

Existing endpoints should not be migrated until the frontend can be updated in the same change.
