# Data Sources

Codex Dashboard reads local Codex data from `CODEX_HOME`. If `CODEX_HOME` is not set, the backend falls back to `C:\Users\<user>\.codex`.

The dashboard is read-only at the MVP stage. Missing, unreadable, or malformed sources must be shown as explicit empty/error states instead of being hidden.

## Files

| Source | Type | Current Usage | Expected Fallback |
| --- | --- | --- | --- |
| `.codex/agents/*.toml`, `~/.codex/agents/*.toml` | TOML | Official Codex custom subagent catalog | Empty subagent list or profile-note fallback |
| `~/.codex/agents/*.md` | Markdown | Local role/profile notes fallback when no TOML subagents exist | Empty profile-note list |
| `dashboard-agents.json` | JSON | Legacy fallback catalog only; not the primary Codex subagent source | Empty fallback list |
| `dashboard-config.json` | JSON | Profiles, active profile, and config preview source | Empty profile list, no active profile, blocked preview apply |
| `dashboard-agent-sessions.json` | JSON | Agent session count and orchestration session links | Empty session count |
| `dashboard-review-history.json` | JSON | Review history count | Empty review history |
| `version.json` | JSON | Codex version metadata | Empty object |
| `history.jsonl` | JSONL | Recent history preview | Empty list |
| `session_index.jsonl` | JSONL | Session index preview | Empty list |
| `.codex/skills/**/SKILL.md`, `~/.codex/skills/**/SKILL.md` | Markdown/frontmatter | Official Codex skill catalog | Empty skill list |
| `.tmp/plugins/plugins/**/.codex-plugin/plugin.json` | JSON | Plugin manifest catalog | Empty plugin list |
| `.tmp/plugins/.agents/plugins/marketplace.json` | JSON | Plugin marketplace policy and category metadata | Local-only plugin metadata |
| `sessions/**/*.jsonl` | JSONL | Codex `token_count.rate_limits` events for 5-hour and weekly account-limit percentages | Usage Limits shows rate limits unavailable |
| `dashboard-limits.json` | JSON | Optional rolling 24h/7d dashboard token limits for local usage-window remaining calculation | Local usage remains real, remaining token count stays null |
| `backend/package.json`, `frontend/package.json` | JSON | Release check command inventory and test runner detection | Missing check/gap rows |
| `backend/scripts/smoke-check.mjs` | JavaScript | API smoke endpoint inventory | Empty smoke endpoint list |
| `docs/RELEASE_CHECKLIST.md` | Markdown | Release readiness source status | Missing checklist warning |

## Internal SQLite Sources

| Source | Current Tables Used | Current Usage | Expected Fallback |
| --- | --- | --- | --- |
| `state_5.sqlite` | `threads` | Session/thread list, thread detail, thread stats, orchestration thread links, trend analytics, and workspace inventory | Empty thread list/detail/workspace list and zero stats |
| `logs_2.sqlite` | `logs` | Paginated activity timeline, related session activity, log stats, trend analytics, and per-workspace log counts | Empty activity list and zero stats |

## Derived Backend Data

| Field | Derived From | Notes |
| --- | --- | --- |
| `counts` | Subagents/profile notes, skills, config, sessions, review history, thread stats, log stats | Used by Overview |
| `system.threadStats` | `state_5.sqlite` | Total, active, archived, by model, by approval, by sandbox |
| `system.logStats` | `logs_2.sqlite` | Total, by level, recent targets |
| `orchestration` | Agents, agent sessions, recent threads | Read-only operating map from TOML/profile discovery and local thread links |
| `capabilities` | Official skill files and plugin manifests | Read-only skill/plugin inventory, category counts, policy summaries, and source status |
| `configPreview` | `dashboard-config.json` plus draft payload | Read-only diff, validation checks, unsupported fields, and blocked apply state |
| `diagnosticReport` | Health, config validation, system stats, capabilities, orchestration, capped recent history | Read-only export package for support, audits, and release checks |
| `analyticsTrends` | `state_5.sqlite`, `logs_2.sqlite` | UTC day buckets, totals, averages, and capped model/target/level distributions |
| `usage.rateLimits` | `sessions/**/*.jsonl` | Real Codex 5-hour and weekly rate-limit percentages when local session events expose `rate_limits` |
| `usage.periods` | `state_5.sqlite`, `logs_2.sqlite`, optional env/config limits | Rolling 24h and 7d local usage with remaining tokens only when explicit dashboard limits are configured |
| `workspaces` | `state_5.sqlite`, `logs_2.sqlite`, filesystem checks | Groups thread history by `cwd`, joins capped log counts, and exposes current path availability |
| `releaseHealth` | Package scripts, smoke-check source, test file discovery, release docs | Read-only readiness score, verification commands, smoke coverage, and test gaps |

## Page Dependencies

| Page | Current Data Dependency | Future Direction |
| --- | --- | --- |
| Overview | `/api/summary` | Keep summary compact; move heavy lists to dedicated endpoints |
| Analytics | `/api/analytics/trends` | Keep trends separate from summary; add future filters through query params |
| Workspaces | `/api/workspaces` | Keep workspace grouping separate from summary; add filters before exposing larger history windows |
| Subagents | `/api/agents`, `/api/agents/:id` | Keep list compact; read official TOML subagents before local fallback notes |
| Skills | `/api/capabilities` | Keep inventory read-only; add install/update/delete only after preview, validation, audit, and rollback design |
| Activity | `/api/activity` | Keep backend-side filters and pagination before adding saved views |
| Profiles | `/api/profiles`, `/api/config/preview` | Keep apply disabled until preview, validation, audit, backup, and rollback contracts are complete |
| Sessions | `/api/sessions`, `/api/sessions/:id` | Keep list compact; grow selected thread metadata through detail endpoint |
| System | `/api/summary.system`, `/api/diagnostics/report` | Use `/api/system` for direct diagnostics and keep report export capped/read-only |
| Release | `/api/release/health` | Keep release signals read-only; add real test coverage metrics only after runners exist |

## Data Rules

- Refresh time is the dashboard fetch time.
- Event time is the source record time.
- Both should be displayed separately when the page shows recent activity or sessions.
- Usage windows use real local SQLite records. Account quota limits are not inferred or scraped.
- List endpoints should have a default limit.
- Growing list endpoints should gain filters or pagination before the UI depends on large payloads.
- Parsing should be tolerant, but visible errors should be returned when a source is missing or unreadable.
