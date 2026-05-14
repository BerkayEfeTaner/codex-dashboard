const express = require('express');
const cors = require('cors');
const { PORT, CORS_ORIGINS, CODEX_DIR } = require('./constants');
const { clampLimit, clampOffset } = require('./utils');
const { 
  readAgents, 
  readThreads, 
  readThreadById, 
  readThreadStats, 
  readRecentLogs, 
  countRecentLogs, 
  readLogStats,
  readWorkspaces, 
  buildSummary, 
  buildHealthSummary, 
  buildAnalyticsPayload, 
  buildSystemSummary,
  buildCapabilitiesPayload,
  buildProfilesPayload,
  buildDiagnosticReportPayload,
  buildReleaseHealth,
  buildConfigPreviewPayload,
  buildAgentDetailPayload,
  buildSessionDetailPayload
} = require('./services');

const app = express();

app.use(cors({
  origin: CORS_ORIGINS
}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.json({ limit: '25mb' }));

// --- API Routes ---

app.get('/api/health', (req, res) => res.json(buildHealthSummary()));
app.get('/api/summary', (req, res) => res.json(buildSummary()));
app.get('/api/agents', (req, res) => res.json(readAgents()));

app.get('/api/agents/:id', (req, res) => {
  const agent = readAgents().find(a => a.id === String(req.params.id));
  if (!agent) return res.status(404).json({ error: 'agent_not_found', id: req.params.id });
  res.json(buildAgentDetailPayload(agent));
});

app.get('/api/capabilities', (req, res) => res.json(buildCapabilitiesPayload()));
app.get('/api/profiles', (req, res) => res.json(buildProfilesPayload()));
app.post('/api/config/preview', (req, res) => res.json(buildConfigPreviewPayload(req.body || {})));
app.get('/api/diagnostics/report', (req, res) => res.json(buildDiagnosticReportPayload()));
app.get('/api/analytics/trends', (req, res) => res.json(buildAnalyticsPayload({ days: req.query.days })));
app.get('/api/workspaces', (req, res) => res.json(readWorkspaces({ limit: req.query.limit })));

app.get('/api/sessions', (req, res) => {
  const limit = clampLimit(req.query.limit, 24, 100);
  res.json({ threads: readThreads(limit), stats: readThreadStats(), limit, refreshedAt: new Date().toISOString() });
});

app.get('/api/sessions/:id', (req, res) => {
  const thread = readThreadById(String(req.params.id));
  if (!thread) return res.status(404).json({ error: 'session_not_found', id: req.params.id });
  res.json(buildSessionDetailPayload(thread));
});

app.get('/api/activity', (req, res) => {
  const filters = {
    level: req.query.level || '',
    target: req.query.target || '',
    threadId: req.query.threadId || '',
    query: req.query.query || '',
    from: req.query.from || '',
    to: req.query.to || '',
    limit: clampLimit(req.query.limit, 50, 200),
    offset: clampOffset(req.query.offset)
  };
  const total = countRecentLogs(filters);
  res.json({ 
    activity: readRecentLogs(filters), 
    stats: { ...readLogStats(), total },
    filters,
    pagination: { limit: filters.limit, offset: filters.offset, total, hasNext: filters.offset + filters.limit < total },
    refreshedAt: new Date().toISOString() 
  });
});

app.get('/api/system', (req, res) => res.json(buildSystemSummary()));
app.get('/api/release/health', (req, res) => res.json(buildReleaseHealth()));

// --- Server Startup ---

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Codex Dashboard API running on http://localhost:${PORT}`);
    console.log(`Reading Codex data from ${CODEX_DIR}`);
  });
}

module.exports = { app, buildReleaseHealth };
