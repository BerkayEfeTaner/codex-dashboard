# Frontend Data Hooks

This document defines the frontend data hook convention before pages move away from `/api/summary`.

## Base Hook

Use `frontend/src/hooks/useEndpoint.js` for endpoint-backed reads.

Return shape:

```js
{
  data,
  loading,
  error,
  reload
}
```

Rules:

- Keep page components away from raw `fetch`.
- Keep endpoint-specific functions in `frontend/src/api/client.js`.
- Name page hooks as `use<Resource>`, for example `useActivity`, `useSessions`, `useProfiles`.
- Add a dedicated hook only when the matching backend endpoint exists or is added in the same change.
- Keep `useSummary` return shape as `{ summary, loading, error, reload }` because `Shell` and current pages already depend on it.

## Current Hooks

| Hook | Endpoint helper | Status |
| --- | --- | --- |
| `useSummary` | `fetchSummary` | Active, used by the app shell and current pages |
| `useActivity` | `fetchActivity` | Active, used by Activity page with backend filters |
| `useAgents` | `fetchAgents` | Active, used by Agents page |
| `useAgentDetail` | `fetchAgentDetail` | Active, used by Agents page detail panel |
| `useCapabilities` | `fetchCapabilities` | Active, used by Capabilities page |
| `useAnalyticsTrends` | `fetchAnalyticsTrends` | Active, used by Analytics page |
| `useWorkspaces` | `fetchWorkspaces` | Active, used by Workspaces page |
| `useProfiles` | `fetchProfiles` | Active, used by Profiles page |
| `useSessions` | `fetchSessions` | Active, used by Sessions page |
| `useSessionDetail` | `fetchSessionDetail` | Active, used by Sessions page detail panel |
| `useSystem` | `fetchSystem` | Ready for System page migration |
| `useReleaseHealth` | `fetchReleaseHealth` | Active, used by Release page |

## Action Helpers

| Helper | Endpoint | Status |
| --- | --- | --- |
| `previewConfigChange` | `POST /api/config/preview` | Active, read-only preview used by Profiles page |
