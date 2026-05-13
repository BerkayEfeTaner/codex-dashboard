const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3132';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(path, options) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, options);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`${path} returned invalid JSON: ${error.message}`);
  }
}

function pass(label) {
  console.log(`PASS ${label}`);
}

function skip(label, reason) {
  console.log(`SKIP ${label} (${reason})`);
}

async function checkHealth() {
  const health = await fetchJson('/api/health');
  assert(typeof health.status === 'string', '/api/health must include status');
  assert(typeof health.codexHome === 'string', '/api/health must include codexHome');
  pass('/api/health');
}

async function checkSummary() {
  const summary = await fetchJson('/api/summary');
  assert(typeof summary.codexHome === 'string', '/api/summary must include codexHome');
  assert(summary.counts && typeof summary.counts === 'object', '/api/summary must include counts');
  assert(summary.usage?.source?.type === 'local-codex-sqlite', '/api/summary must include local usage source');
  assert(summary.usage?.rateLimits?.source?.type === 'local-codex-session-jsonl', '/api/summary must include Codex rate-limit source');
  assert(typeof summary.usage.rateLimits.source.filesScanned === 'number', '/api/summary rate limits must include scan metadata');
  assert(summary.usage?.periods?.daily?.window === 'rolling_24h', '/api/summary must include daily usage window');
  assert(summary.usage?.periods?.weekly?.window === 'rolling_7d', '/api/summary must include weekly usage window');
  assert(typeof summary.usage.periods.daily.usedTokens === 'number', '/api/summary daily usage must include used tokens');
  pass('/api/summary');
}

async function checkAgents() {
  const agents = await fetchJson('/api/agents');
  assert(Array.isArray(agents), '/api/agents must return an array');
  pass('/api/agents');

  if (!agents[0]?.id) {
    skip('/api/agents/:id', 'no agent records');
    return;
  }

  const detail = await fetchJson(`/api/agents/${encodeURIComponent(agents[0].id)}`);
  assert(detail.agent?.id === agents[0].id, '/api/agents/:id must return the selected agent');
  pass('/api/agents/:id');
}

async function checkOrchestration() {
  const orchestration = await fetchJson('/api/orchestration');
  assert(Array.isArray(orchestration.agents), '/api/orchestration must include agents array');
  assert(Array.isArray(orchestration.lanes), '/api/orchestration must include lanes array');
  assert(Array.isArray(orchestration.edges), '/api/orchestration must include edges array');
  assert(orchestration.stats && typeof orchestration.stats === 'object', '/api/orchestration must include stats');
  pass('/api/orchestration');
}

async function checkCapabilities() {
  const capabilities = await fetchJson('/api/capabilities');
  assert(Array.isArray(capabilities.skills), '/api/capabilities must include skills array');
  assert(Array.isArray(capabilities.plugins), '/api/capabilities must include plugins array');
  assert(capabilities.stats && typeof capabilities.stats === 'object', '/api/capabilities must include stats');
  assert(capabilities.source && typeof capabilities.source === 'object', '/api/capabilities must include source');
  pass('/api/capabilities');
}

async function checkProfiles() {
  const profiles = await fetchJson('/api/profiles');
  assert(Array.isArray(profiles.profiles), '/api/profiles must include profiles array');
  pass('/api/profiles');
}

async function checkConfigPreview() {
  const profiles = await fetchJson('/api/profiles');
  const activeProfileId = profiles.activeProfile?.id || profiles.profiles?.[0]?.id;

  if (!activeProfileId) {
    skip('/api/config/preview', 'no profile records');
    return;
  }

  const preview = await fetchJson('/api/config/preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ activeProfileId })
  });

  assert(Array.isArray(preview.changes), '/api/config/preview must include changes array');
  assert(preview.validation && typeof preview.validation.valid === 'boolean', '/api/config/preview must include validation');
  assert(preview.apply?.available === false, '/api/config/preview must keep apply unavailable in MVP');
  pass('/api/config/preview');
}

async function checkDiagnosticReport() {
  const report = await fetchJson('/api/diagnostics/report');
  assert(report.report?.formatVersion === 1, '/api/diagnostics/report must include report format version');
  assert(report.health && typeof report.health.status === 'string', '/api/diagnostics/report must include health status');
  assert(report.profile?.validation, '/api/diagnostics/report must include profile validation');
  assert(Array.isArray(report.risks), '/api/diagnostics/report must include risks array');
  pass('/api/diagnostics/report');
}

async function checkAnalyticsTrends() {
  const trends = await fetchJson('/api/analytics/trends?days=14');
  assert(trends.range?.days === 14, '/api/analytics/trends must echo clamped day range');
  assert(Array.isArray(trends.daily), '/api/analytics/trends must include daily array');
  assert(trends.daily.length === 14, '/api/analytics/trends must return one bucket per day');
  assert(trends.totals && typeof trends.totals === 'object', '/api/analytics/trends must include totals');
  pass('/api/analytics/trends');
}

async function checkWorkspaces() {
  const workspaces = await fetchJson('/api/workspaces?limit=12');
  assert(Array.isArray(workspaces.workspaces), '/api/workspaces must include workspaces array');
  assert(workspaces.stats && typeof workspaces.stats === 'object', '/api/workspaces must include stats');
  assert(workspaces.source && typeof workspaces.source === 'object', '/api/workspaces must include source');
  assert(workspaces.limit === 12, '/api/workspaces must echo clamped limit');
  pass('/api/workspaces');
}

async function checkSessions() {
  const sessions = await fetchJson('/api/sessions?limit=1');
  assert(Array.isArray(sessions.threads), '/api/sessions must include threads array');
  assert(sessions.stats && typeof sessions.stats === 'object', '/api/sessions must include stats');
  pass('/api/sessions');

  if (!sessions.threads[0]?.id) {
    skip('/api/sessions/:id', 'no session records');
    return;
  }

  const detail = await fetchJson(`/api/sessions/${encodeURIComponent(sessions.threads[0].id)}`);
  assert(detail.thread?.id === sessions.threads[0].id, '/api/sessions/:id must return the selected thread');
  assert(Array.isArray(detail.activity), '/api/sessions/:id must include activity array');
  assert(detail.fileGraph && Array.isArray(detail.fileGraph.files), '/api/sessions/:id must include fileGraph files');
  pass('/api/sessions/:id');
}

async function checkActivity() {
  const activity = await fetchJson('/api/activity?limit=2&offset=0');
  assert(Array.isArray(activity.activity), '/api/activity must include activity array');
  assert(activity.pagination && typeof activity.pagination === 'object', '/api/activity must include pagination');
  pass('/api/activity');

  const filtered = await fetchJson('/api/activity?limit=1&from=2000-01-01T00:00&to=2999-01-01T00:00');
  assert(filtered.filters?.from, '/api/activity must echo from filter');
  assert(filtered.filters?.to, '/api/activity must echo to filter');
  pass('/api/activity date filters');
}

async function checkSystem() {
  const system = await fetchJson('/api/system');
  assert(typeof system.node === 'string', '/api/system must include node version');
  assert(typeof system.codexHome === 'string', '/api/system must include codexHome');
  pass('/api/system');
}

async function checkReleaseHealth() {
  const releaseHealth = await fetchJson('/api/release/health');
  assert(releaseHealth.release && typeof releaseHealth.release === 'object', '/api/release/health must include release summary');
  assert(Array.isArray(releaseHealth.checks), '/api/release/health must include checks array');
  assert(releaseHealth.testCoverage && typeof releaseHealth.testCoverage === 'object', '/api/release/health must include test coverage');
  assert(releaseHealth.smoke && Array.isArray(releaseHealth.smoke.endpoints), '/api/release/health must include smoke endpoints');
  assert(releaseHealth.source && typeof releaseHealth.source === 'object', '/api/release/health must include source map');
  pass('/api/release/health');
}

async function main() {
  console.log(`Smoke check target: ${baseUrl}`);
  await checkHealth();
  await checkSummary();
  await checkAgents();
  await checkOrchestration();
  await checkCapabilities();
  await checkProfiles();
  await checkConfigPreview();
  await checkDiagnosticReport();
  await checkAnalyticsTrends();
  await checkWorkspaces();
  await checkSessions();
  await checkActivity();
  await checkSystem();
  await checkReleaseHealth();
  console.log('Smoke check completed.');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
