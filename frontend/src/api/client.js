async function requestJson(path, options) {
  const method = String(options?.method || 'GET').toUpperCase();
  let requestPath = path;

  if (method === 'GET') {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(path, baseUrl);
    url.searchParams.set('_', String(Date.now()));
    requestPath = `${url.pathname}${url.search}${url.hash}`;
  }

  const response = await fetch(requestPath, {
    cache: 'no-store',
    ...options
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export function fetchSummary() {
  return requestJson('/api/summary');
}

export function fetchHealth() {
  return requestJson('/api/health');
}

export function fetchAgents() {
  return requestJson('/api/agents');
}

export function fetchAgentDetail(id) {
  return requestJson(`/api/agents/${encodeURIComponent(id)}`);
}

export function fetchCapabilities() {
  return requestJson('/api/capabilities');
}

export function fetchProfiles() {
  return requestJson('/api/profiles');
}

export function previewConfigChange(payload) {
  return requestJson('/api/config/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export function fetchDiagnosticReport() {
  return requestJson('/api/diagnostics/report');
}

export function fetchAnalyticsTrends({ days = 14 } = {}) {
  const params = new URLSearchParams({ days: String(days) });
  return requestJson(`/api/analytics/trends?${params.toString()}`);
}

export function fetchWorkspaces({ limit = 24 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  return requestJson(`/api/workspaces?${params.toString()}`);
}

export function fetchActivity({
  level = '',
  target = '',
  threadId = '',
  query = '',
  from = '',
  to = '',
  limit = 50,
  offset = 0
} = {}) {
  const params = new URLSearchParams();
  if (level) params.set('level', level);
  if (target) params.set('target', target);
  if (threadId) params.set('threadId', threadId);
  if (query) params.set('query', query);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(`/api/activity${suffix}`);
}

export function fetchSessions({ limit = 24 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  return requestJson(`/api/sessions?${params.toString()}`);
}

export function fetchSessionDetail(id) {
  return requestJson(`/api/sessions/${encodeURIComponent(id)}`);
}

export function fetchSystem() {
  return requestJson('/api/system');
}
