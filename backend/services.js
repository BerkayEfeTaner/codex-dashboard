const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { 
  CODEX_DIR, 
  PROJECT_ROOT, 
  dashboardFiles, 
} = require('./constants');
const { 
  readJsonFile, 
  readTextFile, 
  canReadPath, 
  statPath, 
  groupBy, 
  clampLimit, 
  clampOffset, 
  parseUnixTimeFilter, 
  normalizeUnixTime, 
  parseJsonSafe 
} = require('./utils');
const { checkSqliteAvailability, openReadonlyDatabase } = require('./db');
const { getAgentIdentitySet, readAgents, threadMatchesAgent } = require('./services/agents');
const { buildCapabilitiesPayload } = require('./services/skills');
const { buildUsageSummary, readUsageLimitSettings } = require('./services/usage');
const { buildHealthSummary, buildSystemSummary: buildBaseSystemSummary, statSourceFile } = require('./services/system');

// --- Helper Functions ---
function clampDays(value, fallback = 14, max = 90) {
  const parsed = parseInt(value, 10);
  return (isNaN(parsed) || parsed <= 0) ? fallback : Math.min(parsed, max);
}

function buildUtcDayBuckets(days) {
  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(todayUtc - (days - i - 1) * 86400000).toISOString().slice(0, 10));
}

function getRangeStartUnix(day) {
  return Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / 1000);
}

// --- Threads & Sessions ---
function normalizeThreadRow(thread) {
  const sandbox = parseJsonSafe(thread.sandboxPolicy, {});
  return {
    ...thread,
    createdAtIso: normalizeUnixTime(thread.createdAt),
    updatedAtIso: normalizeUnixTime(thread.updatedAt),
    sandboxType: sandbox?.type || thread.sandboxPolicy || 'unknown',
    archived: Boolean(thread.archived)
  };
}

function selectThreadFields() {
  return `id, title, source, model, reasoning_effort AS reasoningEffort, approval_mode AS approvalMode, sandbox_policy AS sandboxPolicy, cwd, tokens_used AS tokensUsed, created_at AS createdAt, updated_at AS updatedAt, first_user_message AS firstUserMessage, agent_nickname AS agentNickname, agent_role AS agentRole, archived`;
}

function readThreads(limit = 20) {
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return [];
  try { return db.prepare(`SELECT ${selectThreadFields()} FROM threads ORDER BY updated_at DESC LIMIT ?`).all(limit).map(normalizeThreadRow); }
  catch { return []; } finally { db.close(); }
}

function readThreadById(id) {
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return null;
  try {
    const thread = db.prepare(`SELECT ${selectThreadFields()} FROM threads WHERE id = ? LIMIT 1`).get(id);
    return thread ? normalizeThreadRow(thread) : null;
  } catch { return null; } finally { db.close(); }
}

function readThreadStats() {
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return { total: 0, archived: 0, active: 0, byModel: {}, byApproval: {}, bySandbox: {} };
  try {
    const total = db.prepare('SELECT COUNT(*) AS count FROM threads').get().count;
    const archived = db.prepare('SELECT COUNT(*) AS count FROM threads WHERE archived = 1').get().count;
    const rows = db.prepare('SELECT model, approval_mode AS approvalMode, sandbox_policy AS sandboxPolicy FROM threads').all();
    return {
      total, archived, active: total - archived,
      byModel: groupBy(rows, 'model'),
      byApproval: groupBy(rows, 'approvalMode'),
      bySandbox: rows.reduce((acc, row) => {
        const sandbox = parseJsonSafe(row.sandboxPolicy, {});
        acc[sandbox?.type || 'unknown'] = (acc[sandbox?.type || 'unknown'] || 0) + 1;
        return acc;
      }, {})
    };
  } catch { return { total: 0, archived: 0, active: 0, byModel: {}, byApproval: {}, bySandbox: {} }; } finally { db.close(); }
}

// --- Logs & Activity ---
function readLogStats() {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return { total: 0, byLevel: {}, recentTargets: [] };
  try {
    const total = db.prepare('SELECT COUNT(*) AS count FROM logs').get().count;
    const byLevelRows = db.prepare('SELECT level, COUNT(*) AS count FROM logs GROUP BY level ORDER BY count DESC').all();
    const recentTargets = db.prepare(`SELECT target, COUNT(*) AS count, MAX(ts) AS lastSeen FROM logs GROUP BY target ORDER BY lastSeen DESC LIMIT 8`).all().map((t) => ({ ...t, lastSeenIso: normalizeUnixTime(t.lastSeen) }));
    return {
      total,
      byLevel: byLevelRows.reduce((acc, row) => { acc[row.level || 'unknown'] = row.count; return acc; }, {}),
      recentTargets
    };
  } catch { return { total: 0, byLevel: {}, recentTargets: [] }; } finally { db.close(); }
}

function buildLogFilters(options = 30) {
  const filters = typeof options === 'number' ? { limit: options } : options;
  const conditions = ["(level != 'TRACE' OR target NOT IN ('log'))"];
  const params = [];
  if (filters.level) { conditions.push('level = ?'); params.push(String(filters.level)); }
  if (filters.target) { conditions.push('target = ?'); params.push(String(filters.target)); }
  if (filters.threadId) { conditions.push('thread_id = ?'); params.push(String(filters.threadId)); }
  const fromTs = parseUnixTimeFilter(filters.from);
  if (fromTs) { conditions.push('ts >= ?'); params.push(fromTs); }
  const toTs = parseUnixTimeFilter(filters.to);
  if (toTs) { conditions.push('ts <= ?'); params.push(toTs); }
  if (filters.query) {
    const query = `%${String(filters.query).trim()}%`;
    conditions.push(`(target LIKE ? OR feedback_log_body LIKE ? OR thread_id LIKE ? OR file LIKE ? OR module_path LIKE ?)`);
    params.push(query, query, query, query, query);
  }
  return { filters, conditions, params };
}

function readRecentLogs(options = 30) {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return [];
  const { filters, conditions, params } = buildLogFilters(options);
  const limit = clampLimit(filters.limit, 30, 200);
  const offset = clampOffset(filters.offset);
  try {
    return db.prepare(`SELECT id, ts, level, target, substr(feedback_log_body, 1, 320) AS message, module_path AS modulePath, file, line, thread_id AS threadId, estimated_bytes AS estimatedBytes FROM logs WHERE ${conditions.join(' AND ')} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset).map((e) => ({ ...e, tsIso: normalizeUnixTime(e.ts) }));
  } catch { return []; } finally { db.close(); }
}

function countRecentLogs(options = {}) {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return 0;
  const { conditions, params } = buildLogFilters(options);
  try { return db.prepare(`SELECT COUNT(*) AS count FROM logs WHERE ${conditions.join(' AND ')}`).get(...params).count; } catch { return 0; } finally { db.close(); }
}

// --- Workspaces ---
function workspaceId(workspacePath) {
  return crypto.createHash('sha1').update(String(workspacePath || 'unknown')).digest('hex').slice(0, 12);
}

function workspaceName(workspacePath) {
  return workspacePath ? (path.basename(workspacePath) || workspacePath) : 'Unknown workspace';
}

function countLogsByThreadIds(threadIds) {
  const ids = [...new Set(threadIds.filter(Boolean))].slice(0, 500);
  if (ids.length === 0) return {};
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return {};
  try {
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT thread_id AS threadId, COUNT(*) AS count FROM logs WHERE thread_id IN (${placeholders}) GROUP BY thread_id`).all(...ids).reduce((acc, row) => { acc[row.threadId] = row.count; return acc; }, {});
  } catch { return {}; } finally { db.close(); }
}

function summarizeWorkspaceBuckets(rows, limit) {
  const buckets = new Map();
  const logCounts = countLogsByThreadIds(rows.map(r => r.id));
  rows.forEach(r => {
    const key = r.cwd || '__unknown__';
    const existing = buckets.get(key) || { id: workspaceId(key), path: r.cwd || null, name: workspaceName(r.cwd), exists: r.cwd ? fs.existsSync(r.cwd) : false, readable: r.cwd ? canReadPath(r.cwd) : false, threadCount: 0, activeThreads: 0, archivedThreads: 0, tokensUsed: 0, logEvents: 0, lastActivity: 0, lastActivityIso: null, models: {}, approvalModes: {}, sandboxTypes: {}, recentThreads: [] };
    const sandbox = parseJsonSafe(r.sandboxPolicy, {});
    const sType = sandbox?.type || r.sandboxPolicy || 'unknown';
    existing.threadCount++; existing.archivedThreads += r.archived ? 1 : 0; existing.activeThreads += r.archived ? 0 : 1; existing.tokensUsed += r.tokensUsed || 0; existing.logEvents += logCounts[r.id] || 0;
    existing.models[r.model || 'unknown'] = (existing.models[r.model || 'unknown'] || 0) + 1;
    existing.approvalModes[r.approvalMode || 'unknown'] = (existing.approvalModes[r.approvalMode || 'unknown'] || 0) + 1;
    existing.sandboxTypes[sType] = (existing.sandboxTypes[sType] || 0) + 1;
    if ((r.updatedAt || 0) > existing.lastActivity) { existing.lastActivity = r.updatedAt; existing.lastActivityIso = normalizeUnixTime(r.updatedAt); }
    if (existing.recentThreads.length < 5) existing.recentThreads.push({ id: r.id, title: r.title || 'Untitled', model: r.model || null, updatedAtIso: normalizeUnixTime(r.updatedAt) });
    buckets.set(key, existing);
  });
  return [...buckets.values()].sort((a, b) => b.lastActivity - a.lastActivity).slice(0, limit);
}

function readWorkspaces(options = {}) {
  const limit = clampLimit(options.limit, 24, 100);
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return { workspaces: [], stats: {}, limit, refreshedAt: new Date().toISOString() };
  try {
    const rows = db.prepare(`SELECT ${selectThreadFields()} FROM threads ORDER BY updated_at DESC LIMIT 1000`).all();
    const workspaces = summarizeWorkspaceBuckets(rows, limit);
    const stats = workspaces.reduce((acc, w) => { acc.total++; acc.readable += w.readable ? 1 : 0; acc.missing += w.exists ? 0 : 1; acc.threads += w.threadCount; acc.activeThreads += w.activeThreads; acc.archivedThreads += w.archivedThreads; acc.logEvents += w.logEvents; acc.tokensUsed += w.tokensUsed; return acc; }, { total: 0, readable: 0, missing: 0, threads: 0, activeThreads: 0, archivedThreads: 0, logEvents: 0, tokensUsed: 0 });
    return { workspaces, stats, limit, refreshedAt: new Date().toISOString() };
  } finally { db.close(); }
}

// --- Analytics ---
function readThreadTrend(days) {
  const buckets = buildUtcDayBuckets(days);
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return { buckets, rows: [], models: [] };
  try {
    const fromTs = getRangeStartUnix(buckets[0]);
    const rows = db.prepare("SELECT date(updated_at, 'unixepoch') AS day, COUNT(*) AS sessions, COALESCE(SUM(tokens_used), 0) AS tokensUsed FROM threads WHERE updated_at >= ? GROUP BY day").all(fromTs);
    const models = db.prepare("SELECT COALESCE(model, 'unknown') AS name, COUNT(*) AS count FROM threads WHERE updated_at >= ? GROUP BY name ORDER BY count DESC LIMIT 8").all(fromTs);
    return { buckets, rows, models };
  } finally { db.close(); }
}

function readLogTrend(days) {
  const buckets = buildUtcDayBuckets(days);
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return { buckets, rows: [], targets: [], levels: [] };
  try {
    const fromTs = getRangeStartUnix(buckets[0]);
    const rows = db.prepare("SELECT date(ts, 'unixepoch') AS day, COUNT(*) AS logEvents, COALESCE(SUM(estimated_bytes), 0) AS estimatedBytes FROM logs WHERE ts >= ? GROUP BY day").all(fromTs);
    const targets = db.prepare("SELECT COALESCE(target, 'unknown') AS name, COUNT(*) AS count FROM logs WHERE ts >= ? GROUP BY name ORDER BY count DESC LIMIT 8").all(fromTs);
    const levels = db.prepare("SELECT COALESCE(level, 'unknown') AS name, COUNT(*) AS count FROM logs WHERE ts >= ? GROUP BY name ORDER BY count DESC LIMIT 8").all(fromTs);
    return { buckets, rows, targets, levels };
  } finally { db.close(); }
}

function buildAnalyticsPayload(options = {}) {
  const days = clampDays(options.days, 14, 90);
  const tt = readThreadTrend(days);
  const lt = readLogTrend(days);
  const threadRowsByDay = new Map(tt.rows.map((row) => [row.day, row]));
  const logRowsByDay = new Map(lt.rows.map((row) => [row.day, row]));
  const daily = tt.buckets.map((day) => {
    const threadRow = threadRowsByDay.get(day) || {};
    const logRow = logRowsByDay.get(day) || {};
    return {
      day,
      sessions: threadRow.sessions || 0,
      logEvents: logRow.logEvents || 0,
      tokensUsed: threadRow.tokensUsed || 0,
      estimatedBytes: logRow.estimatedBytes || 0
    };
  });
  const totals = daily.reduce((acc, row) => ({
    sessions: acc.sessions + row.sessions,
    logEvents: acc.logEvents + row.logEvents,
    tokensUsed: acc.tokensUsed + row.tokensUsed,
    estimatedBytes: acc.estimatedBytes + row.estimatedBytes
  }), { sessions: 0, logEvents: 0, tokensUsed: 0, estimatedBytes: 0 });

  return {
    range: {
      days,
      from: `${daily[0]?.day}T00:00:00.000Z`,
      to: new Date().toISOString(),
      timezone: 'UTC'
    },
    daily,
    totals,
    averages: {
      sessionsPerDay: Number((totals.sessions / days).toFixed(2)),
      logEventsPerDay: Number((totals.logEvents / days).toFixed(2)),
      tokensPerDay: Number((totals.tokensUsed / days).toFixed(2))
    },
    distributions: { models: tt.models, targets: lt.targets, levels: lt.levels },
    source: {
      threads: checkSqliteAvailability('state_5.sqlite'),
      logs: checkSqliteAvailability('logs_2.sqlite')
    },
    refreshedAt: new Date().toISOString()
  };
}

// --- System ---
function buildSystemSummary(profile) {
  return buildBaseSystemSummary({
    profile,
    threadStats: readThreadStats(),
    logStats: readLogStats()
  });
}

function buildOrchestrationPayload() {
  const agents = readAgents();
  const threads = readThreads(100);
  const enrichedAgents = agents.map((agent) => {
    const identity = getAgentIdentitySet(agent);
    const matchedThreads = threads.filter((thread) => threadMatchesAgent(thread, identity));
    return {
      ...agent,
      status: matchedThreads.length > 0 ? 'recent' : 'configured',
      metrics: {
        threadCount: matchedThreads.length,
        skillCount: Array.isArray(agent.skills) ? agent.skills.length : 0
      }
    };
  });
  const edges = enrichedAgents.flatMap((agent) => {
    const identity = getAgentIdentitySet(agent);
    return threads
      .filter((thread) => threadMatchesAgent(thread, identity))
      .slice(0, 5)
      .map((thread) => ({
        id: `${agent.id}:${thread.id}`,
        from: agent.id,
        to: thread.id,
        label: thread.title || thread.id,
        type: 'agent-thread',
        updatedAtIso: thread.updatedAtIso
      }));
  });
  const configuredAgents = enrichedAgents.filter((agent) => agent.status !== 'recent');

  return {
    agents: enrichedAgents,
    lanes: [
      {
        id: 'recent-agents',
        label: 'Recently active agents',
        agents: enrichedAgents.filter((agent) => agent.status === 'recent')
      },
      {
        id: 'configured-agents',
        label: 'Configured agents',
        agents: configuredAgents
      },
      {
        id: 'recent-threads',
        label: 'Recent sessions',
        threads: threads.slice(0, 12)
      }
    ],
    edges,
    stats: {
      agents: enrichedAgents.length,
      recentlyActiveAgents: enrichedAgents.filter((agent) => agent.status === 'recent').length,
      skills: enrichedAgents.reduce((count, agent) => count + (Array.isArray(agent.skills) ? agent.skills.length : 0), 0),
      links: edges.length,
      agentSessions: edges.length
    },
    source: {
      agents: enrichedAgents[0]?.sourcePath ? statPath('agents', enrichedAgents[0].sourcePath) : statSourceFile(dashboardFiles.agents),
      agentSessions: statSourceFile(dashboardFiles.agentSessions),
      threads: checkSqliteAvailability('state_5.sqlite')
    },
    refreshedAt: new Date().toISOString()
  };
}

// --- Summary ---
function buildSummary() {
  const agents = readAgents(); const threads = readThreads(24); const activity = readRecentLogs(32);
  const capabilities = buildCapabilitiesPayload();
  const config = readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { profiles: [] });
  const activeProfile = config.profiles?.find(p => p.id === config.activeProfileId) || null;
  return { refreshedAt: new Date().toISOString(), agents, threads, activity, health: buildHealthSummary(), usage: buildUsageSummary(), system: buildSystemSummary(activeProfile), counts: { agents: agents.length, skills: capabilities.stats.skills, threads: threads.length, logs: activity.length } };
}

function readPackageJson(relativePath) {
  return readJsonFile(path.join(PROJECT_ROOT, relativePath), { scripts: {}, dependencies: {}, devDependencies: {} });
}

function walkFiles(rootDir, predicate, limit = 250) {
  const results = [];
  const ignored = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite']);

  function visit(dir) {
    if (results.length >= limit) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= limit) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) visit(fullPath);
      } else if (predicate(fullPath)) {
        results.push(path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/'));
      }
    }
  }

  visit(rootDir);
  return results;
}

function discoverTestFiles(scope) {
  return walkFiles(path.join(PROJECT_ROOT, scope), (filePath) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath));
}

function detectTestSetup(pkg) {
  const script = pkg.scripts?.test || null;
  const scriptsText = Object.values(pkg.scripts || {}).join(' ');
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const runners = [];

  if (deps.vitest || scriptsText.includes('vitest')) runners.push('vitest');
  if (deps.jest || scriptsText.includes('jest')) runners.push('jest');
  if (deps.mocha || scriptsText.includes('mocha')) runners.push('mocha');
  if (scriptsText.includes('node --test')) runners.push('node:test');
  if (script && runners.length === 0) runners.push('custom');

  return { configured: Boolean(script || runners.length), script, runners };
}

function extractSmokeEndpoints() {
  const tests = discoverTestFiles('backend');
  const endpoints = new Set();

  tests.forEach((relativePath) => {
    const content = readTextFile(path.join(PROJECT_ROOT, relativePath), '');
    for (const match of content.matchAll(/['"`](\/api\/[^'"`\s)]+)['"`]/g)) {
      endpoints.add(match[1]);
    }
  });

  return [...endpoints].sort();
}

function buildReleaseHealth() {
  const backendPackage = readPackageJson('backend/package.json');
  const frontendPackage = readPackageJson('frontend/package.json');
  const backendSetup = detectTestSetup(backendPackage);
  const frontendSetup = detectTestSetup(frontendPackage);
  const backendTests = discoverTestFiles('backend');
  const frontendTests = discoverTestFiles('frontend');
  const endpoints = extractSmokeEndpoints();
  const checks = [
    {
      id: 'backend-tests',
      label: 'Backend API contract tests',
      status: backendSetup.configured && backendTests.length > 0 ? 'ready' : 'warn',
      detail: backendSetup.configured ? `${backendTests.length} backend test files discovered.` : 'Backend test runner is not configured.'
    },
    {
      id: 'frontend-tests',
      label: 'Frontend component tests',
      status: frontendSetup.configured && frontendTests.length > 0 ? 'ready' : 'warn',
      detail: frontendSetup.configured ? `${frontendTests.length} frontend test files discovered.` : 'Frontend test runner is not configured.'
    },
    {
      id: 'smoke-endpoints',
      label: 'API smoke coverage',
      status: endpoints.length > 0 ? 'ready' : 'warn',
      detail: `${endpoints.length} smoke endpoints discovered.`
    }
  ];
  const warnings = checks.filter((check) => check.status !== 'ready').map((check) => check.detail);
  const score = Math.max(0, 100 - warnings.length * 15);

  return {
    release: {
      readiness: warnings.length === 0 ? 'ready' : 'attention',
      score,
      blockers: [],
      warnings
    },
    checks,
    testCoverage: {
      backend: { ...backendSetup, testFiles: backendTests, testFileCount: backendTests.length },
      frontend: { ...frontendSetup, testFiles: frontendTests, testFileCount: frontendTests.length },
      totals: {
        testFiles: backendTests.length + frontendTests.length,
        configuredRunners: Number(backendSetup.configured) + Number(frontendSetup.configured)
      },
      gaps: warnings
    },
    smoke: { endpointCount: endpoints.length, endpoints },
    source: {
      backendPackage: statPath('backend/package.json', path.join(PROJECT_ROOT, 'backend/package.json')),
      frontendPackage: statPath('frontend/package.json', path.join(PROJECT_ROOT, 'frontend/package.json'))
    },
    refreshedAt: new Date().toISOString()
  };
}

function buildProfilesPayload() {
  const source = statSourceFile(dashboardFiles.config);
  const config = readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { profiles: [] });
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const activeProfile = profiles.find((profile) => profile.id === config.activeProfileId) || null;

  return { profiles, activeProfile, source, refreshedAt: new Date().toISOString() };
}

function buildConfigPreviewPayload(draft = {}) {
  const config = readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { profiles: [] });
  const proposedActiveProfileId = draft.activeProfileId || config.activeProfileId || null;
  const profileExists = !proposedActiveProfileId || (config.profiles || []).some((profile) => profile.id === proposedActiveProfileId);

  return {
    current: { activeProfileId: config.activeProfileId || null },
    proposed: { activeProfileId: proposedActiveProfileId },
    validation: {
      valid: profileExists,
      checks: [{ id: 'profile-exists', label: 'Profile exists', ok: profileExists }]
    },
    changes: config.activeProfileId === proposedActiveProfileId ? [] : [{
      type: 'activeProfileId',
      label: 'Active profile',
      before: config.activeProfileId || null,
      after: proposedActiveProfileId
    }],
    apply: { available: false, reason: 'read_only_preview' },
    source: statSourceFile(dashboardFiles.config),
    refreshedAt: new Date().toISOString()
  };
}

function buildDiagnosticReportPayload() {
  const health = buildHealthSummary();
  const profiles = buildProfilesPayload();

  return {
    report: { version: 1, generatedAt: new Date().toISOString(), scope: 'read-only diagnostics' },
    environment: { node: process.version, platform: `${os.type()} ${os.release()}`, codexHome: CODEX_DIR },
    health,
    profiles: { count: profiles.profiles.length, activeProfile: profiles.activeProfile },
    system: buildSystemSummary(profiles.activeProfile),
    risks: health.ok ? [] : ['Codex home sources are degraded.']
  };
}

function buildAgentDetailPayload(agent) {
  const identity = getAgentIdentitySet(agent);
  const threads = readThreads(100).filter((thread) => threadMatchesAgent(thread, identity)).slice(0, 20);

  return {
    agent,
    threads,
    metrics: { threadCount: threads.length, skillCount: Array.isArray(agent.skills) ? agent.skills.length : 0 },
    source: agent.sourcePath ? statPath(agent.name || agent.id, agent.sourcePath) : statSourceFile(dashboardFiles.agents),
    refreshedAt: new Date().toISOString()
  };
}

function buildSessionDetailPayload(thread) {
  return {
    thread,
    activity: readRecentLogs({ threadId: thread.id, limit: 50 }),
    source: checkSqliteAvailability('state_5.sqlite'),
    refreshedAt: new Date().toISOString()
  };
}

module.exports = {
  readAgents, readThreads, readThreadById, readThreadStats, readRecentLogs, countRecentLogs, readWorkspaces, readUsageLimitSettings, readLogStats, buildSummary, buildHealthSummary, buildAnalyticsPayload, buildSystemSummary, buildOrchestrationPayload, buildCapabilitiesPayload, buildProfilesPayload, buildDiagnosticReportPayload, buildReleaseHealth, buildConfigPreviewPayload, buildAgentDetailPayload, buildSessionDetailPayload
};
