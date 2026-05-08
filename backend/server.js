const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 3132);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const USER_HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const CODEX_DIR = process.env.CODEX_HOME || path.join(USER_HOME, '.codex');
const SKILLS_DIR = path.join(CODEX_DIR, 'skills');
const PLUGIN_CACHE_DIR = path.join(CODEX_DIR, '.tmp', 'plugins');
const PLUGIN_ROOT_DIR = path.join(PLUGIN_CACHE_DIR, 'plugins');
const MARKETPLACE_FILE = path.join(PLUGIN_CACHE_DIR, '.agents', 'plugins', 'marketplace.json');

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
  ]
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

const dashboardFiles = {
  agents: 'dashboard-agents.json',
  config: 'dashboard-config.json',
  agentSessions: 'dashboard-agent-sessions.json',
  reviewHistory: 'dashboard-review-history.json',
  version: 'version.json'
};

const sqliteFiles = ['logs_2.sqlite', 'state_5.sqlite'];
const jsonlFiles = ['history.jsonl', 'session_index.jsonl'];

function readJsonFile(filePath, fallback) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function readTextFile(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return fallback;
  }
}

function readJsonlTail(filePath, limit = 20) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      })
      .reverse();
  } catch {
    return [];
  }
}

function statFile(fileName) {
  const filePath = path.join(CODEX_DIR, fileName);
  try {
    const stat = fs.statSync(filePath);
    return {
      name: fileName,
      path: filePath,
      exists: true,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch {
    return {
      name: fileName,
      path: filePath,
      exists: false,
      size: 0,
      modifiedAt: null
    };
  }
}

function statPath(name, targetPath) {
  try {
    const stat = fs.statSync(targetPath);
    return {
      name,
      path: targetPath,
      exists: true,
      readable: canReadPath(targetPath),
      size: stat.size,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch {
    return {
      name,
      path: targetPath,
      exists: false,
      readable: false,
      size: 0,
      modifiedAt: null
    };
  }
}

function canReadPath(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function statSourceFile(fileName) {
  const file = statFile(fileName);
  return {
    ...file,
    readable: file.exists && canReadPath(file.path)
  };
}

function checkSqliteAvailability(fileName) {
  const file = statSourceFile(fileName);

  if (!file.exists) {
    return { ...file, available: false, error: 'missing' };
  }

  if (!file.readable) {
    return { ...file, available: false, error: 'unreadable' };
  }

  try {
    const db = new Database(file.path, { readonly: true, fileMustExist: true });
    db.prepare('SELECT name FROM sqlite_master LIMIT 1').get();
    db.close();
    return { ...file, available: true, error: null };
  } catch (error) {
    return { ...file, available: false, error: error.message };
  }
}

function normalizeAgents(payload) {
  return Array.isArray(payload?.agents) ? payload.agents.filter(Boolean) : [];
}

function stableAgentId(agent) {
  if (agent?.id) return String(agent.id);

  const slug = [agent?.team, agent?.name]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || null;
}

function readAgents() {
  const agentsPayload = readJsonFile(path.join(CODEX_DIR, dashboardFiles.agents), { agents: [] });
  return normalizeAgents(agentsPayload)
    .map((agent) => ({ ...agent, id: stableAgentId(agent) }))
    .filter((agent) => agent.id);
}

function normalizeAgentSessions(payload) {
  return Array.isArray(payload?.sessions) ? payload.sessions.filter(Boolean) : [];
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function clampLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function clampOffset(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function parseUnixTimeFilter(value) {
  if (!value) return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 9999999999 ? Math.floor(numeric / 1000) : numeric;
  }

  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function inspectSqlite(fileName) {
  const filePath = path.join(CODEX_DIR, fileName);
  const file = statFile(fileName);

  if (!file.exists) {
    return { ...file, tables: [], error: 'missing' };
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => {
        const tableName = quoteIdentifier(row.name);
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        let count = null;
        try {
          count = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
        } catch {
          count = null;
        }
        return {
          name: row.name,
          count,
          columns: columns.map((column) => ({ name: column.name, type: column.type }))
        };
      });
    db.close();
    return { ...file, tables };
  } catch (error) {
    return { ...file, tables: [], error: error.message };
  }
}

function openReadonlyDatabase(fileName) {
  const filePath = path.join(CODEX_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  return new Database(filePath, { readonly: true, fileMustExist: true });
}

function normalizeUnixTime(value) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function workspaceId(workspacePath) {
  return crypto
    .createHash('sha1')
    .update(String(workspacePath || 'unknown'))
    .digest('hex')
    .slice(0, 12);
}

function workspaceName(workspacePath) {
  if (!workspacePath) return 'Unknown workspace';
  return path.basename(workspacePath) || workspacePath;
}

function parseJsonSafe(value, fallback = null) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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
  return `
    id,
    title,
    source,
    model,
    reasoning_effort AS reasoningEffort,
    approval_mode AS approvalMode,
    sandbox_policy AS sandboxPolicy,
    cwd,
    tokens_used AS tokensUsed,
    created_at AS createdAt,
    updated_at AS updatedAt,
    first_user_message AS firstUserMessage,
    agent_nickname AS agentNickname,
    agent_role AS agentRole,
    archived
  `;
}

function readThreads(limit = 20) {
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return [];

  try {
    return db.prepare(`
      SELECT ${selectThreadFields()}
      FROM threads
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit).map(normalizeThreadRow);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function readThreadById(id) {
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return null;

  try {
    const thread = db.prepare(`
      SELECT ${selectThreadFields()}
      FROM threads
      WHERE id = ?
      LIMIT 1
    `).get(id);

    return thread ? normalizeThreadRow(thread) : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function readThreadStats() {
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return { total: 0, archived: 0, active: 0, byModel: {}, byApproval: {}, bySandbox: {} };

  try {
    const total = db.prepare('SELECT COUNT(*) AS count FROM threads').get().count;
    const archived = db.prepare('SELECT COUNT(*) AS count FROM threads WHERE archived = 1').get().count;
    const rows = db.prepare(`
      SELECT model, approval_mode AS approvalMode, sandbox_policy AS sandboxPolicy
      FROM threads
    `).all();

    return {
      total,
      archived,
      active: total - archived,
      byModel: groupBy(rows, 'model'),
      byApproval: groupBy(rows, 'approvalMode'),
      bySandbox: rows.reduce((acc, row) => {
        const sandbox = parseJsonSafe(row.sandboxPolicy, {});
        const key = sandbox?.type || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    };
  } catch {
    return { total: 0, archived: 0, active: 0, byModel: {}, byApproval: {}, bySandbox: {} };
  } finally {
    db.close();
  }
}

function countLogsByThreadIds(threadIds) {
  const ids = [...new Set(threadIds.filter(Boolean))].slice(0, 500);
  if (ids.length === 0) return {};

  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return {};

  try {
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`
      SELECT thread_id AS threadId, COUNT(*) AS count
      FROM logs
      WHERE thread_id IN (${placeholders})
      GROUP BY thread_id
    `).all(...ids).reduce((acc, row) => {
      acc[row.threadId] = row.count;
      return acc;
    }, {});
  } catch {
    return {};
  } finally {
    db.close();
  }
}

function summarizeWorkspaceBuckets(rows, limit) {
  const buckets = new Map();
  const logCountsByThread = countLogsByThreadIds(rows.map((row) => row.id));

  rows.forEach((row) => {
    const cwd = row.cwd || '';
    const key = cwd || '__unknown__';
    const existing = buckets.get(key) || {
      id: workspaceId(key),
      path: cwd || null,
      name: workspaceName(cwd),
      exists: cwd ? fs.existsSync(cwd) : false,
      readable: cwd ? canReadPath(cwd) : false,
      threadCount: 0,
      activeThreads: 0,
      archivedThreads: 0,
      tokensUsed: 0,
      logEvents: 0,
      lastActivity: 0,
      lastActivityIso: null,
      models: {},
      approvalModes: {},
      sandboxTypes: {},
      recentThreads: []
    };
    const sandbox = parseJsonSafe(row.sandboxPolicy, {});
    const sandboxType = sandbox?.type || row.sandboxPolicy || 'unknown';
    const logEvents = logCountsByThread[row.id] || 0;

    existing.threadCount += 1;
    existing.archivedThreads += row.archived ? 1 : 0;
    existing.activeThreads += row.archived ? 0 : 1;
    existing.tokensUsed += row.tokensUsed || 0;
    existing.logEvents += logEvents;
    existing.models[row.model || 'unknown'] = (existing.models[row.model || 'unknown'] || 0) + 1;
    existing.approvalModes[row.approvalMode || 'unknown'] = (existing.approvalModes[row.approvalMode || 'unknown'] || 0) + 1;
    existing.sandboxTypes[sandboxType] = (existing.sandboxTypes[sandboxType] || 0) + 1;

    if ((row.updatedAt || 0) > existing.lastActivity) {
      existing.lastActivity = row.updatedAt || 0;
      existing.lastActivityIso = normalizeUnixTime(row.updatedAt);
    }

    if (existing.recentThreads.length < 5) {
      existing.recentThreads.push({
        id: row.id,
        title: row.title || 'Untitled session',
        model: row.model || null,
        updatedAtIso: normalizeUnixTime(row.updatedAt)
      });
    }

    buckets.set(key, existing);
  });

  return [...buckets.values()]
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .slice(0, limit)
    .map(({ lastActivity, ...workspace }) => workspace);
}

function readWorkspaces(options = {}) {
  const limit = clampLimit(options.limit, 24, 100);
  const db = openReadonlyDatabase('state_5.sqlite');
  const source = {
    state: checkSqliteAvailability('state_5.sqlite'),
    logs: checkSqliteAvailability('logs_2.sqlite')
  };

  if (!db) {
    return {
      workspaces: [],
      stats: { total: 0, readable: 0, missing: 0, threads: 0, activeThreads: 0, archivedThreads: 0, logEvents: 0, tokensUsed: 0 },
      limit,
      source,
      refreshedAt: new Date().toISOString()
    };
  }

  try {
    const rows = db.prepare(`
      SELECT ${selectThreadFields()}
      FROM threads
      ORDER BY updated_at DESC
      LIMIT 1000
    `).all();
    const workspaces = summarizeWorkspaceBuckets(rows, limit);
    const stats = workspaces.reduce((acc, workspace) => {
      acc.total += 1;
      acc.readable += workspace.readable ? 1 : 0;
      acc.missing += workspace.exists ? 0 : 1;
      acc.threads += workspace.threadCount;
      acc.activeThreads += workspace.activeThreads;
      acc.archivedThreads += workspace.archivedThreads;
      acc.logEvents += workspace.logEvents;
      acc.tokensUsed += workspace.tokensUsed;
      return acc;
    }, { total: 0, readable: 0, missing: 0, threads: 0, activeThreads: 0, archivedThreads: 0, logEvents: 0, tokensUsed: 0 });

    return {
      workspaces,
      stats,
      limit,
      source,
      refreshedAt: new Date().toISOString()
    };
  } catch {
    return {
      workspaces: [],
      stats: { total: 0, readable: 0, missing: 0, threads: 0, activeThreads: 0, archivedThreads: 0, logEvents: 0, tokensUsed: 0 },
      limit,
      source,
      refreshedAt: new Date().toISOString()
    };
  } finally {
    db.close();
  }
}

function buildLogFilters(options = 30) {
  const filters = typeof options === 'number' ? { limit: options } : options;
  const conditions = ["(level != 'TRACE' OR target NOT IN ('log'))"];
  const params = [];

  if (filters.level) {
    conditions.push('level = ?');
    params.push(String(filters.level));
  }

  if (filters.target) {
    conditions.push('target = ?');
    params.push(String(filters.target));
  }

  if (filters.threadId) {
    conditions.push('thread_id = ?');
    params.push(String(filters.threadId));
  }

  const fromTs = parseUnixTimeFilter(filters.from);
  if (fromTs) {
    conditions.push('ts >= ?');
    params.push(fromTs);
  }

  const toTs = parseUnixTimeFilter(filters.to);
  if (toTs) {
    conditions.push('ts <= ?');
    params.push(toTs);
  }

  if (filters.query) {
    const query = `%${String(filters.query).trim()}%`;
    conditions.push(`(
      target LIKE ?
      OR feedback_log_body LIKE ?
      OR thread_id LIKE ?
      OR file LIKE ?
      OR module_path LIKE ?
    )`);
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
    return db.prepare(`
      SELECT
        id,
        ts,
        level,
        target,
        substr(feedback_log_body, 1, 320) AS message,
        module_path AS modulePath,
        file,
        line,
        thread_id AS threadId,
        estimated_bytes AS estimatedBytes
      FROM logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY ts DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset).map((entry) => ({
      ...entry,
      tsIso: normalizeUnixTime(entry.ts)
    }));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function countRecentLogs(options = {}) {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return 0;

  const { conditions, params } = buildLogFilters(options);

  try {
    return db.prepare(`
      SELECT COUNT(*) AS count
      FROM logs
      WHERE ${conditions.join(' AND ')}
    `).get(...params).count;
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

function clampDays(value, fallback = 14, max = 90) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parsePositiveInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readUsageLimitConfig() {
  return readJsonFile(path.join(CODEX_DIR, 'dashboard-limits.json'), {});
}

function resolveUsageLimit(configValue, envValue, configKey, envKey) {
  const envLimit = parsePositiveInteger(envValue);
  if (envLimit) {
    return {
      limitTokens: envLimit,
      source: 'env',
      sourceKey: envKey
    };
  }

  const configLimit = parsePositiveInteger(configValue);
  if (configLimit) {
    return {
      limitTokens: configLimit,
      source: 'config',
      sourceKey: `dashboard-limits.json:${configKey}`
    };
  }

  return {
    limitTokens: null,
    source: 'unconfigured',
    sourceKey: null
  };
}

function readUsageLimitSettings() {
  const config = readUsageLimitConfig();

  return {
    daily: resolveUsageLimit(
      config.dailyTokenLimit,
      process.env.CODEX_DAILY_TOKEN_LIMIT,
      'dailyTokenLimit',
      'CODEX_DAILY_TOKEN_LIMIT'
    ),
    weekly: resolveUsageLimit(
      config.weeklyTokenLimit,
      process.env.CODEX_WEEKLY_TOKEN_LIMIT,
      'weeklyTokenLimit',
      'CODEX_WEEKLY_TOKEN_LIMIT'
    )
  };
}

function listSessionJsonlFiles(dirPath, maxFiles = 250) {
  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => b.name.localeCompare(a.name))
      .forEach((entry) => stack.push(path.join(current, entry.name)));

    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .forEach((entry) => {
        const filePath = path.join(current, entry.name);
        try {
          const stat = fs.statSync(filePath);
          files.push({
            path: filePath,
            modifiedAt: stat.mtime.toISOString(),
            modifiedMs: stat.mtimeMs,
            size: stat.size
          });
        } catch {
          // Ignore files that disappear while scanning.
        }
      });
  }

  return files.sort((a, b) => b.modifiedMs - a.modifiedMs).slice(0, maxFiles);
}

function readLatestRateLimitEvent(filePath) {
  let lines = [];

  try {
    lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const event = JSON.parse(lines[index]);
      if (event?.payload?.type === 'token_count' && event.payload.rate_limits) {
        return event;
      }
    } catch {
      // Ignore malformed JSONL rows.
    }
  }

  return null;
}

function rateLimitStatus(usedPercent) {
  if (!Number.isFinite(usedPercent)) return 'unknown';
  if (usedPercent >= 100) return 'exhausted';
  if (usedPercent >= 85) return 'warning';
  return 'ok';
}

function normalizeRateLimitWindow(limit, fallbackLabel) {
  if (!limit) return null;

  const usedPercent = Number(limit.used_percent);
  const safeUsedPercent = Number.isFinite(usedPercent) ? Math.min(Math.max(usedPercent, 0), 100) : null;
  const resetUnixSeconds = Number(limit.resets_at);
  const windowMinutes = Number(limit.window_minutes);

  return {
    label: fallbackLabel,
    windowMinutes: Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : null,
    usedPercent: safeUsedPercent,
    remainingPercent: safeUsedPercent === null ? null : Number((100 - safeUsedPercent).toFixed(1)),
    resetsAt: Number.isFinite(resetUnixSeconds) ? new Date(resetUnixSeconds * 1000).toISOString() : null,
    status: rateLimitStatus(safeUsedPercent)
  };
}

function mapRateLimitEvent(event, file) {
  const payload = event.payload;
  const rateLimits = payload.rate_limits;

  return {
    source: {
      type: 'local-codex-session-jsonl',
      path: file.path,
      available: true,
      filesScanned: 0,
      error: null
    },
    updatedAt: event.timestamp || file.modifiedAt,
    planType: rateLimits.plan_type || null,
    limitId: rateLimits.limit_id || null,
    limitName: rateLimits.limit_name || null,
    rateLimitReachedType: rateLimits.rate_limit_reached_type || null,
    primary: normalizeRateLimitWindow(rateLimits.primary, '5-hour'),
    secondary: normalizeRateLimitWindow(rateLimits.secondary, 'weekly')
  };
}

function buildCodexRateLimitSummary() {
  const sessionsDir = path.join(CODEX_DIR, 'sessions');
  const source = statPath('sessions', sessionsDir);

  if (!source.exists || !source.readable) {
    return {
      source: {
        type: 'local-codex-session-jsonl',
        path: sessionsDir,
        available: false,
        filesScanned: 0,
        error: source.exists ? 'unreadable' : 'missing'
      },
      updatedAt: null,
      planType: null,
      limitId: null,
      limitName: null,
      rateLimitReachedType: null,
      primary: null,
      secondary: null
    };
  }

  const files = listSessionJsonlFiles(sessionsDir, 250);

  for (const file of files) {
    const event = readLatestRateLimitEvent(file.path);
    if (event) {
      const summary = mapRateLimitEvent(event, file);
      summary.source.filesScanned = files.length;
      return summary;
    }
  }

  return {
    source: {
      type: 'local-codex-session-jsonl',
      path: sessionsDir,
      available: false,
      filesScanned: files.length,
      error: files.length === 0 ? 'no_session_files' : 'no_rate_limit_events'
    },
    updatedAt: null,
    planType: null,
    limitId: null,
    limitName: null,
    rateLimitReachedType: null,
    primary: null,
    secondary: null
  };
}

function compactSourceAvailability(fileName) {
  const source = checkSqliteAvailability(fileName);
  return {
    name: source.name,
    available: source.available,
    modifiedAt: source.modifiedAt,
    error: source.error
  };
}

function readUsageWindowStats(fromTs) {
  const stats = {
    usedTokens: 0,
    sessions: 0,
    logEvents: 0,
    estimatedBytes: 0,
    sources: {
      threads: compactSourceAvailability('state_5.sqlite'),
      logs: compactSourceAvailability('logs_2.sqlite')
    }
  };

  const stateDb = openReadonlyDatabase('state_5.sqlite');
  if (stateDb) {
    try {
      const row = stateDb.prepare(`
        SELECT
          COUNT(*) AS sessions,
          COALESCE(SUM(tokens_used), 0) AS usedTokens
        FROM threads
        WHERE COALESCE(updated_at, created_at, 0) >= ?
      `).get(fromTs);
      stats.sessions = Number(row?.sessions || 0);
      stats.usedTokens = Number(row?.usedTokens || 0);
    } catch {
      stats.sources.threads.available = false;
      stats.sources.threads.error = 'query_failed';
    } finally {
      stateDb.close();
    }
  }

  const logsDb = openReadonlyDatabase('logs_2.sqlite');
  if (logsDb) {
    try {
      const row = logsDb.prepare(`
        SELECT
          COUNT(*) AS logEvents,
          COALESCE(SUM(estimated_bytes), 0) AS estimatedBytes
        FROM logs
        WHERE ts >= ?
          AND (level != 'TRACE' OR target NOT IN ('log'))
      `).get(fromTs);
      stats.logEvents = Number(row?.logEvents || 0);
      stats.estimatedBytes = Number(row?.estimatedBytes || 0);
    } catch {
      stats.sources.logs.available = false;
      stats.sources.logs.error = 'query_failed';
    } finally {
      logsDb.close();
    }
  }

  return stats;
}

function buildUsagePeriod({ key, label, window, days, limit, nowSeconds, nowIso }) {
  const fromTs = nowSeconds - days * 86400;
  const stats = readUsageWindowStats(fromTs);
  const remainingTokens = limit.limitTokens === null ? null : Math.max(limit.limitTokens - stats.usedTokens, 0);
  const percentUsed = limit.limitTokens === null
    ? null
    : Math.min(100, Number(((stats.usedTokens / limit.limitTokens) * 100).toFixed(1)));
  const status = limit.limitTokens === null
    ? 'unconfigured'
    : remainingTokens <= 0
      ? 'exhausted'
      : percentUsed >= 85
        ? 'warning'
        : 'ok';

  return {
    key,
    label,
    window,
    from: new Date(fromTs * 1000).toISOString(),
    to: nowIso,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    usedTokens: stats.usedTokens,
    limitTokens: limit.limitTokens,
    remainingTokens,
    percentUsed,
    status,
    limitSource: limit.source,
    limitSourceKey: limit.sourceKey,
    sessions: stats.sessions,
    logEvents: stats.logEvents,
    estimatedBytes: stats.estimatedBytes,
    sources: stats.sources
  };
}

function buildUsageSummary() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const nowIso = new Date(nowSeconds * 1000).toISOString();
  const limits = readUsageLimitSettings();
  const accountLimitConfigured = Boolean(limits.daily.limitTokens || limits.weekly.limitTokens);
  const rateLimits = buildCodexRateLimitSummary();

  return {
    source: {
      type: 'local-codex-sqlite',
      codexHome: CODEX_DIR,
      accountLimitAvailable: Boolean(rateLimits.primary || rateLimits.secondary),
      accountLimitConfigured,
      note: 'SQLite windows are local usage estimates; Codex account rate-limit percentages are exposed under usage.rateLimits when session events contain rate_limits.'
    },
    rateLimits,
    periods: {
      daily: buildUsagePeriod({
        key: 'daily',
        label: 'Daily',
        window: 'rolling_24h',
        days: 1,
        limit: limits.daily,
        nowSeconds,
        nowIso
      }),
      weekly: buildUsagePeriod({
        key: 'weekly',
        label: 'Weekly',
        window: 'rolling_7d',
        days: 7,
        limit: limits.weekly,
        nowSeconds,
        nowIso
      })
    },
    refreshedAt: nowIso
  };
}

function buildUtcDayBuckets(days) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return Array.from({ length: days }, (_, index) => {
    const offset = days - index - 1;
    return new Date(todayUtc - offset * 86400000).toISOString().slice(0, 10);
  });
}

function getRangeStartUnix(day) {
  return Math.floor(new Date(`${day}T00:00:00.000Z`).getTime() / 1000);
}

function readThreadTrend(days) {
  const buckets = buildUtcDayBuckets(days);
  const db = openReadonlyDatabase('state_5.sqlite');
  if (!db) return { buckets, rows: [], models: [] };

  try {
    const fromTs = getRangeStartUnix(buckets[0]);
    const rows = db.prepare(`
      SELECT
        date(updated_at, 'unixepoch') AS day,
        COUNT(*) AS sessions,
        COALESCE(SUM(tokens_used), 0) AS tokensUsed
      FROM threads
      WHERE updated_at >= ?
      GROUP BY day
      ORDER BY day ASC
    `).all(fromTs);
    const models = db.prepare(`
      SELECT COALESCE(model, 'unknown') AS name, COUNT(*) AS count
      FROM threads
      WHERE updated_at >= ?
      GROUP BY name
      ORDER BY count DESC, name ASC
      LIMIT 8
    `).all(fromTs);

    return { buckets, rows, models };
  } catch {
    return { buckets, rows: [], models: [] };
  } finally {
    db.close();
  }
}

function readLogTrend(days) {
  const buckets = buildUtcDayBuckets(days);
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return { buckets, rows: [], targets: [], levels: [] };

  try {
    const fromTs = getRangeStartUnix(buckets[0]);
    const baseCondition = "ts >= ? AND (level != 'TRACE' OR target NOT IN ('log'))";
    const rows = db.prepare(`
      SELECT
        date(ts, 'unixepoch') AS day,
        COUNT(*) AS logEvents,
        COALESCE(SUM(estimated_bytes), 0) AS estimatedBytes
      FROM logs
      WHERE ${baseCondition}
      GROUP BY day
      ORDER BY day ASC
    `).all(fromTs);
    const targets = db.prepare(`
      SELECT COALESCE(target, 'unknown') AS name, COUNT(*) AS count
      FROM logs
      WHERE ${baseCondition}
      GROUP BY name
      ORDER BY count DESC, name ASC
      LIMIT 8
    `).all(fromTs);
    const levels = db.prepare(`
      SELECT COALESCE(level, 'unknown') AS name, COUNT(*) AS count
      FROM logs
      WHERE ${baseCondition}
      GROUP BY name
      ORDER BY count DESC, name ASC
      LIMIT 8
    `).all(fromTs);

    return { buckets, rows, targets, levels };
  } catch {
    return { buckets, rows: [], targets: [], levels: [] };
  } finally {
    db.close();
  }
}

function buildAnalyticsPayload(options = {}) {
  const days = clampDays(options.days, 14, 90);
  const threadTrend = readThreadTrend(days);
  const logTrend = readLogTrend(days);
  const threadRowsByDay = new Map(threadTrend.rows.map((row) => [row.day, row]));
  const logRowsByDay = new Map(logTrend.rows.map((row) => [row.day, row]));
  const daily = buildUtcDayBuckets(days).map((day) => {
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
    distributions: {
      models: threadTrend.models,
      targets: logTrend.targets,
      levels: logTrend.levels
    },
    source: {
      threads: checkSqliteAvailability('state_5.sqlite'),
      logs: checkSqliteAvailability('logs_2.sqlite')
    },
    refreshedAt: new Date().toISOString()
  };
}

function readSessionFileGraph(threadId, limit = 12) {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db || !threadId) return { files: [], links: [], totals: { files: 0, events: 0 } };

  try {
    const rows = db.prepare(`
      SELECT
        COALESCE(NULLIF(file, ''), NULLIF(module_path, ''), 'unknown') AS filePath,
        module_path AS modulePath,
        target,
        level,
        COUNT(*) AS events,
        MIN(ts) AS firstSeen,
        MAX(ts) AS lastSeen
      FROM logs
      WHERE thread_id = ?
        AND (file IS NOT NULL OR module_path IS NOT NULL)
        AND (level != 'TRACE' OR target NOT IN ('log'))
      GROUP BY filePath, modulePath, target, level
      ORDER BY events DESC, lastSeen DESC
      LIMIT ?
    `).all(String(threadId), clampLimit(limit, 12, 50));

    const fileMap = new Map();
    const links = [];

    for (const row of rows) {
      const filePath = row.filePath || 'unknown';
      const existing = fileMap.get(filePath) || {
        path: filePath,
        modulePath: row.modulePath || '',
        events: 0,
        levels: {},
        targets: {},
        firstSeen: row.firstSeen,
        lastSeen: row.lastSeen
      };

      existing.events += row.events;
      existing.levels[row.level || 'unknown'] = (existing.levels[row.level || 'unknown'] || 0) + row.events;
      existing.targets[row.target || 'unknown'] = (existing.targets[row.target || 'unknown'] || 0) + row.events;
      existing.firstSeen = Math.min(existing.firstSeen || row.firstSeen, row.firstSeen || existing.firstSeen);
      existing.lastSeen = Math.max(existing.lastSeen || row.lastSeen, row.lastSeen || existing.lastSeen);
      fileMap.set(filePath, existing);

      links.push({
        threadId: String(threadId),
        filePath,
        target: row.target || 'unknown',
        level: row.level || 'unknown',
        events: row.events,
        firstSeenIso: normalizeUnixTime(row.firstSeen),
        lastSeenIso: normalizeUnixTime(row.lastSeen)
      });
    }

    const files = Array.from(fileMap.values()).map((file) => ({
      ...file,
      firstSeenIso: normalizeUnixTime(file.firstSeen),
      lastSeenIso: normalizeUnixTime(file.lastSeen)
    }));

    return {
      files,
      links,
      totals: {
        files: files.length,
        events: files.reduce((sum, file) => sum + file.events, 0)
      }
    };
  } catch {
    return { files: [], links: [], totals: { files: 0, events: 0 } };
  } finally {
    db.close();
  }
}

function readLogStats() {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return { total: 0, byLevel: {}, recentTargets: [] };

  try {
    const total = db.prepare('SELECT COUNT(*) AS count FROM logs').get().count;
    const byLevelRows = db.prepare('SELECT level, COUNT(*) AS count FROM logs GROUP BY level ORDER BY count DESC').all();
    const recentTargets = db.prepare(`
      SELECT target, COUNT(*) AS count, MAX(ts) AS lastSeen
      FROM logs
      GROUP BY target
      ORDER BY lastSeen DESC
      LIMIT 8
    `).all().map((target) => ({ ...target, lastSeenIso: normalizeUnixTime(target.lastSeen) }));

    return {
      total,
      byLevel: byLevelRows.reduce((acc, row) => {
        acc[row.level || 'unknown'] = row.count;
        return acc;
      }, {}),
      recentTargets
    };
  } catch {
    return { total: 0, byLevel: {}, recentTargets: [] };
  } finally {
    db.close();
  }
}

function buildSystemSummary(activeProfile) {
  const databaseFiles = sqliteFiles.map(statFile);
  const sourceFiles = [...Object.values(dashboardFiles), ...jsonlFiles].map(statFile);
  const threadStats = readThreadStats();
  const logStats = readLogStats();

  return {
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
    codexHome: CODEX_DIR,
    activeModel: activeProfile?.model || null,
    activeReasoningEffort: activeProfile?.reasoningEffort || null,
    activeApprovalMode: activeProfile?.approvalMode || null,
    databaseFiles,
    sourceFiles,
    threadStats,
    logStats
  };
}

function listFilesRecursive(rootDir, matcher, options = {}) {
  const limit = options.limit || 200;
  const results = [];

  function walk(currentDir) {
    if (results.length >= limit) return;

    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.forEach((entry) => {
      if (results.length >= limit) return;
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'coverage', '.git', '.vite'].includes(entry.name)) return;
        walk(fullPath);
        return;
      }

      if (matcher(entry.name, relativePath)) {
        results.push(relativePath);
      }
    });
  }

  walk(rootDir);
  return results;
}

function detectTestSetup(packageJson) {
  const scripts = packageJson?.scripts || {};
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  };
  const candidateRunners = ['vitest', 'jest', 'mocha', 'tap', 'node:test'];
  const scriptText = Object.values(scripts).join(' ');
  const runners = candidateRunners.filter((runner) => {
    if (runner === 'node:test') return scriptText.includes('node --test');
    return Boolean(dependencies[runner]) || scriptText.includes(runner);
  });

  return {
    configured: Boolean(scripts.test || runners.length),
    script: scripts.test || null,
    runners
  };
}

function discoverTestFiles(relativeDir) {
  const rootDir = path.join(PROJECT_ROOT, relativeDir);
  return listFilesRecursive(
    rootDir,
    (fileName) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(fileName),
    { limit: 150 }
  );
}

function sourceStatus(label, relativePath) {
  return statPath(label, path.join(PROJECT_ROOT, relativePath));
}

function countSmokeEndpoints(smokeScript) {
  return [...smokeScript.matchAll(/fetchJson\('([^']+)'/g)]
    .map((match) => match[1])
    .filter((endpoint, index, all) => all.indexOf(endpoint) === index);
}

function buildReleaseHealth() {
  const backendPackage = readJsonFile(path.join(PROJECT_ROOT, 'backend', 'package.json'), {});
  const frontendPackage = readJsonFile(path.join(PROJECT_ROOT, 'frontend', 'package.json'), {});
  const smokeScript = readTextFile(path.join(PROJECT_ROOT, 'backend', 'scripts', 'smoke-check.mjs'));
  const backendTests = discoverTestFiles('backend');
  const frontendTests = discoverTestFiles('frontend');
  const backendSetup = detectTestSetup(backendPackage);
  const frontendSetup = detectTestSetup(frontendPackage);
  const smokeEndpoints = countSmokeEndpoints(smokeScript);
  const source = {
    backendPackage: sourceStatus('backend/package.json', 'backend/package.json'),
    frontendPackage: sourceStatus('frontend/package.json', 'frontend/package.json'),
    smokeCheck: sourceStatus('backend/scripts/smoke-check.mjs', 'backend/scripts/smoke-check.mjs'),
    releaseChecklist: sourceStatus('docs/RELEASE_CHECKLIST.md', 'docs/RELEASE_CHECKLIST.md'),
    apiContracts: sourceStatus('docs/API_CONTRACTS.md', 'docs/API_CONTRACTS.md')
  };
  const checks = [
    {
      id: 'backend-syntax',
      label: 'Backend syntax',
      command: 'npm run check',
      scope: 'backend',
      status: backendPackage.scripts?.check ? 'configured' : 'missing',
      detail: backendPackage.scripts?.check || 'No backend check script'
    },
    {
      id: 'backend-smoke',
      label: 'Backend API smoke',
      command: 'npm run smoke',
      scope: 'backend',
      status: backendPackage.scripts?.smoke ? 'configured' : 'missing',
      detail: `${smokeEndpoints.length} endpoint assertions`
    },
    {
      id: 'frontend-lint',
      label: 'Frontend lint',
      command: 'npm run lint',
      scope: 'frontend',
      status: frontendPackage.scripts?.lint ? 'configured' : 'missing',
      detail: frontendPackage.scripts?.lint || 'No frontend lint script'
    },
    {
      id: 'frontend-build',
      label: 'Frontend build',
      command: 'npm run build',
      scope: 'frontend',
      status: frontendPackage.scripts?.build ? 'configured' : 'missing',
      detail: frontendPackage.scripts?.build || 'No frontend build script'
    },
    {
      id: 'frontend-analysis',
      label: 'Bundle analysis',
      command: 'npm run analyze',
      scope: 'frontend',
      status: frontendPackage.scripts?.analyze ? 'configured' : 'missing',
      detail: frontendPackage.scripts?.analyze || 'No analyze script'
    }
  ];
  const gaps = [];

  if (!backendSetup.configured) gaps.push('Backend unit/integration test runner is not configured.');
  if (!frontendSetup.configured) gaps.push('Frontend unit/component test runner is not configured.');
  if (backendTests.length === 0) gaps.push('Backend has no discovered *.test or *.spec files.');
  if (frontendTests.length === 0) gaps.push('Frontend has no discovered *.test or *.spec files.');
  if (!source.releaseChecklist.exists) gaps.push('Release checklist document is missing.');

  const blockers = checks.filter((check) => check.status === 'missing').map((check) => check.label);
  const warnings = [...gaps];
  const configuredChecks = checks.filter((check) => check.status === 'configured').length;
  const score = Math.round(((configuredChecks / checks.length) * 70)
    + (Math.min(smokeEndpoints.length, 12) / 12) * 20
    + (Math.min(backendTests.length + frontendTests.length, 6) / 6) * 10);

  return {
    release: {
      readiness: blockers.length ? 'blocked' : warnings.length ? 'attention' : 'ready',
      score,
      blockers,
      warnings
    },
    checks,
    testCoverage: {
      backend: {
        ...backendSetup,
        testFiles: backendTests,
        testFileCount: backendTests.length
      },
      frontend: {
        ...frontendSetup,
        testFiles: frontendTests,
        testFileCount: frontendTests.length
      },
      totals: {
        testFiles: backendTests.length + frontendTests.length,
        configuredRunners: Number(backendSetup.configured) + Number(frontendSetup.configured)
      },
      gaps
    },
    smoke: {
      endpointCount: smokeEndpoints.length,
      endpoints: smokeEndpoints
    },
    source,
    refreshedAt: new Date().toISOString()
  };
}

function buildHealthSummary() {
  const codexHomeExists = fs.existsSync(CODEX_DIR);
  const codexHomeReadable = codexHomeExists && canReadPath(CODEX_DIR);
  const sourceFiles = [...Object.values(dashboardFiles), ...jsonlFiles].map(statSourceFile);
  const databaseFiles = sqliteFiles.map(checkSqliteAvailability);
  const sourceCounts = sourceFiles.reduce((acc, file) => {
    acc.total += 1;
    if (file.exists) acc.existing += 1;
    if (!file.exists) acc.missing += 1;
    if (file.readable) acc.readable += 1;
    return acc;
  }, { total: 0, existing: 0, missing: 0, readable: 0 });
  const databaseCounts = databaseFiles.reduce((acc, file) => {
    acc.total += 1;
    if (file.available) acc.available += 1;
    if (!file.exists) acc.missing += 1;
    if (file.exists && !file.available) acc.errored += 1;
    return acc;
  }, { total: 0, available: 0, missing: 0, errored: 0 });
  const ok = codexHomeReadable && databaseCounts.available === databaseCounts.total;

  return {
    ok,
    status: ok ? 'healthy' : 'degraded',
    codexHome: CODEX_DIR,
    codexHomeExists,
    codexHomeReadable,
    refreshedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: `${os.type()} ${os.release()}`,
      pid: process.pid
    },
    sources: {
      ...sourceCounts,
      files: sourceFiles
    },
    databases: {
      ...databaseCounts,
      files: databaseFiles
    }
  };
}

function buildProfilesPayload() {
  const config = readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { profiles: [] });
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const activeProfile = profiles.find((profile) => profile.id === config.activeProfileId) || null;

  return {
    activeProfile,
    profiles,
    source: statSourceFile(dashboardFiles.config),
    refreshedAt: new Date().toISOString()
  };
}

function readConfigPayload() {
  return readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { activeProfileId: null, profiles: [] });
}

function cloneConfig(config) {
  return {
    ...config,
    profiles: Array.isArray(config.profiles) ? config.profiles.map((profile) => ({ ...profile })) : []
  };
}

function validateConfig(config) {
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const ids = profiles.map((profile) => String(profile?.id || '').trim()).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const activeProfileExists = ids.includes(String(config.activeProfileId || ''));
  const invalidProfiles = profiles
    .filter((profile) => !profile?.id || !profile?.name || !profile?.model)
    .map((profile) => profile?.id || 'unknown');

  return {
    valid: profiles.length > 0 && activeProfileExists && duplicateIds.length === 0 && invalidProfiles.length === 0,
    checks: [
      { id: 'profiles-array', label: 'Profiles array exists', ok: Array.isArray(config.profiles) },
      { id: 'profiles-present', label: 'At least one profile exists', ok: profiles.length > 0 },
      { id: 'active-profile', label: 'Active profile exists', ok: activeProfileExists },
      { id: 'unique-profile-ids', label: 'Profile ids are unique', ok: duplicateIds.length === 0 },
      { id: 'required-fields', label: 'Required profile fields exist', ok: invalidProfiles.length === 0 }
    ],
    duplicateIds: [...new Set(duplicateIds)],
    invalidProfiles
  };
}

function summarizeConfigChanges(currentConfig, proposedConfig) {
  const changes = [];
  const currentProfiles = Array.isArray(currentConfig.profiles) ? currentConfig.profiles : [];
  const proposedProfiles = Array.isArray(proposedConfig.profiles) ? proposedConfig.profiles : [];

  if (currentConfig.activeProfileId !== proposedConfig.activeProfileId) {
    changes.push({
      type: 'activeProfileId',
      label: 'Active profile',
      before: currentConfig.activeProfileId || null,
      after: proposedConfig.activeProfileId || null
    });
  }

  const currentIds = new Set(currentProfiles.map((profile) => profile.id));
  const proposedIds = new Set(proposedProfiles.map((profile) => profile.id));
  const addedProfiles = [...proposedIds].filter((id) => !currentIds.has(id));
  const removedProfiles = [...currentIds].filter((id) => !proposedIds.has(id));

  if (addedProfiles.length > 0) {
    changes.push({ type: 'profiles-added', label: 'Profiles added', before: 0, after: addedProfiles.length, ids: addedProfiles });
  }

  if (removedProfiles.length > 0) {
    changes.push({ type: 'profiles-removed', label: 'Profiles removed', before: removedProfiles.length, after: 0, ids: removedProfiles });
  }

  return changes;
}

function buildConfigPreviewPayload(draft = {}) {
  const currentConfig = readConfigPayload();
  const proposedConfig = cloneConfig(currentConfig);
  const allowedFields = ['activeProfileId'];
  const unsupportedFields = Object.keys(draft).filter((key) => !allowedFields.includes(key));

  if (Object.prototype.hasOwnProperty.call(draft, 'activeProfileId')) {
    proposedConfig.activeProfileId = draft.activeProfileId;
  }

  const validation = validateConfig(proposedConfig);
  const changes = summarizeConfigChanges(currentConfig, proposedConfig);
  const source = statSourceFile(dashboardFiles.config);

  return {
    current: {
      activeProfileId: currentConfig.activeProfileId || null
    },
    proposed: {
      activeProfileId: proposedConfig.activeProfileId || null,
      activeProfile: proposedConfig.profiles.find((profile) => profile.id === proposedConfig.activeProfileId) || null
    },
    changes,
    validation: {
      ...validation,
      supported: unsupportedFields.length === 0,
      unsupportedFields
    },
    apply: {
      available: false,
      reason: 'apply_flow_requires_preview_audit_and_rollback_design'
    },
    rollback: {
      sourcePath: source.path,
      backupRequired: true
    },
    source,
    refreshedAt: new Date().toISOString()
  };
}

function normalizeIdentityValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getAgentIdentitySet(agent) {
  return new Set([
    agent.id,
    agent.name,
    agent.sourceAgentId,
    agent.sourceAgentType
  ].filter(Boolean).map(normalizeIdentityValue));
}

function threadMatchesAgent(thread, identity) {
  const candidates = [
    thread.agentNickname,
    thread.agentRole,
    thread.model
  ].filter(Boolean).map(normalizeIdentityValue);

  return candidates.some((candidate) => identity.has(candidate));
}

function findAgentLastKnownUsage(agent) {
  const identity = getAgentIdentitySet(agent);

  const match = readThreads(100).find((thread) => threadMatchesAgent(thread, identity));

  if (!match) return null;

  return {
    threadId: match.id,
    title: match.title,
    model: match.model,
    updatedAt: match.updatedAt,
    updatedAtIso: match.updatedAtIso
  };
}

function buildAgentDetailPayload(agent) {
  return {
    agent,
    source: statSourceFile(dashboardFiles.agents),
    lastKnownUsage: findAgentLastKnownUsage(agent),
    refreshedAt: new Date().toISOString()
  };
}

function summarizeAgentSession(session) {
  return {
    id: session.id || null,
    agentId: session.agentId || null,
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
    messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    previousResponseId: session.previousResponseId || null
  };
}

function buildOrchestrationPayload() {
  const agents = readAgents();
  const threads = readThreads(100);
  const agentSessions = normalizeAgentSessions(
    readJsonFile(path.join(CODEX_DIR, dashboardFiles.agentSessions), { sessions: [] })
  );

  const matchedThreadIds = new Set();
  const enrichedAgents = agents.map((agent) => {
    const identity = getAgentIdentitySet(agent);
    const sessionAliases = new Set([
      ...identity,
      normalizeIdentityValue(agent.name),
      normalizeIdentityValue(agent.id?.split('-').at(-1))
    ].filter(Boolean));
    const recentThreads = threads
      .filter((thread) => threadMatchesAgent(thread, identity))
      .slice(0, 4)
      .map((thread) => {
        matchedThreadIds.add(thread.id);
        return {
          id: thread.id,
          title: thread.title,
          model: thread.model,
          updatedAt: thread.updatedAt,
          updatedAtIso: thread.updatedAtIso
        };
      });
    const sessions = agentSessions
      .filter((session) => sessionAliases.has(normalizeIdentityValue(session.agentId)))
      .slice(0, 4)
      .map(summarizeAgentSession);

    return {
      id: agent.id,
      name: agent.name || agent.id,
      team: agent.team || 'unknown',
      model: agent.model || 'unknown',
      reasoningEffort: agent.reasoningEffort || '',
      skills: Array.isArray(agent.skills) ? agent.skills : [],
      status: recentThreads.length || sessions.length ? 'recent' : 'configured',
      recentThreads,
      sessions,
      metrics: {
        skillCount: Array.isArray(agent.skills) ? agent.skills.length : 0,
        threadCount: recentThreads.length,
        sessionCount: sessions.length
      }
    };
  });

  const edges = enrichedAgents.flatMap((agent) => [
    ...agent.recentThreads.map((thread) => ({
      id: `${agent.id}:thread:${thread.id}`,
      from: agent.id,
      to: thread.id,
      type: 'agent-thread',
      label: thread.title || thread.id,
      updatedAtIso: thread.updatedAtIso
    })),
    ...agent.sessions.map((session) => ({
      id: `${agent.id}:agent-session:${session.id}`,
      from: agent.id,
      to: session.id,
      type: 'agent-session',
      label: session.agentId || session.id,
      updatedAtIso: session.updatedAt
    }))
  ]);
  const unmappedThreads = threads
    .filter((thread) => !matchedThreadIds.has(thread.id))
    .slice(0, 8)
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      model: thread.model,
      updatedAtIso: thread.updatedAtIso,
      agentNickname: thread.agentNickname,
      agentRole: thread.agentRole
    }));
  const uniqueSkills = new Set(enrichedAgents.flatMap((agent) => agent.skills));
  const lanes = [
    {
      id: 'recent',
      label: 'Recently active',
      agents: enrichedAgents.filter((agent) => agent.status === 'recent')
    },
    {
      id: 'configured',
      label: 'Configured only',
      agents: enrichedAgents.filter((agent) => agent.status === 'configured')
    },
    {
      id: 'unmapped',
      label: 'Unmapped threads',
      threads: unmappedThreads
    }
  ];

  return {
    agents: enrichedAgents,
    lanes,
    edges,
    unmappedThreads,
    stats: {
      agents: enrichedAgents.length,
      recentlyActiveAgents: lanes[0].agents.length,
      configuredOnlyAgents: lanes[1].agents.length,
      skills: uniqueSkills.size,
      links: edges.length,
      agentSessions: agentSessions.length,
      unmappedThreads: unmappedThreads.length
    },
    source: {
      agents: statSourceFile(dashboardFiles.agents),
      agentSessions: statSourceFile(dashboardFiles.agentSessions),
      threads: checkSqliteAvailability('state_5.sqlite')
    },
    refreshedAt: new Date().toISOString()
  };
}

function readDirectoryEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  return match[1].split(/\r?\n/).reduce((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return acc;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function readSkillManifest(skillPath) {
  try {
    const content = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf8').replace(/^\uFEFF/, '');
    return parseFrontmatter(content);
  } catch {
    return {};
  }
}

function summarizeSkill(skillPath, scope, fallbackName) {
  const manifest = readSkillManifest(skillPath);
  const source = statPath('SKILL.md', path.join(skillPath, 'SKILL.md'));

  return {
    id: `${scope}:${manifest.name || fallbackName}`,
    name: manifest.name || fallbackName,
    description: manifest.description || '',
    scope,
    path: skillPath,
    hasAgents: fs.existsSync(path.join(skillPath, 'agents')),
    hasAssets: fs.existsSync(path.join(skillPath, 'assets')),
    hasScripts: fs.existsSync(path.join(skillPath, 'scripts')),
    hasReferences: fs.existsSync(path.join(skillPath, 'references')),
    modifiedAt: source.modifiedAt
  };
}

function readSkills() {
  const skills = [];

  readDirectoryEntries(SKILLS_DIR).forEach((entry) => {
    if (!entry.isDirectory()) return;

    const entryPath = path.join(SKILLS_DIR, entry.name);
    if (entry.name === '.system') {
      readDirectoryEntries(entryPath).forEach((systemEntry) => {
        if (!systemEntry.isDirectory()) return;
        const skillPath = path.join(entryPath, systemEntry.name);
        if (fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
          skills.push(summarizeSkill(skillPath, 'system', systemEntry.name));
        }
      });
      return;
    }

    if (fs.existsSync(path.join(entryPath, 'SKILL.md'))) {
      skills.push(summarizeSkill(entryPath, 'user', entry.name));
    }
  });

  return skills
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 200);
}

function normalizePluginCapabilities(manifest) {
  const capabilities = manifest?.interface?.capabilities;
  if (!Array.isArray(capabilities)) return [];
  return capabilities.filter(Boolean).map(String).slice(0, 12);
}

function readMarketplacePlugins() {
  const marketplace = readJsonFile(MARKETPLACE_FILE, { plugins: [] });
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  return new Map(plugins.filter((plugin) => plugin?.name).map((plugin) => [plugin.name, plugin]));
}

function summarizePlugin(pluginDir, marketplaceByName) {
  const manifestPath = path.join(pluginDir, '.codex-plugin', 'plugin.json');
  const manifest = readJsonFile(manifestPath, null);
  if (!manifest?.name) return null;

  const marketplaceEntry = marketplaceByName.get(manifest.name);
  const category = manifest.interface?.category || marketplaceEntry?.category || 'Uncategorized';
  const displayName = manifest.interface?.displayName || manifest.name;

  return {
    id: manifest.name,
    name: manifest.name,
    displayName,
    description: manifest.interface?.shortDescription || manifest.description || '',
    version: manifest.version || '',
    category,
    capabilities: normalizePluginCapabilities(manifest),
    keywords: Array.isArray(manifest.keywords) ? manifest.keywords.slice(0, 8) : [],
    author: manifest.author || '',
    path: pluginDir,
    policy: marketplaceEntry?.policy || null,
    marketplaceStatus: marketplaceEntry?.policy?.installation || 'LOCAL',
    hasSkills: Array.isArray(manifest.skills) && manifest.skills.length > 0,
    hasApps: Array.isArray(manifest.apps) && manifest.apps.length > 0,
    modifiedAt: statPath('plugin.json', manifestPath).modifiedAt
  };
}

function readPlugins() {
  const marketplaceByName = readMarketplacePlugins();

  return readDirectoryEntries(PLUGIN_ROOT_DIR)
    .filter((entry) => entry.isDirectory())
    .map((entry) => summarizePlugin(path.join(PLUGIN_ROOT_DIR, entry.name), marketplaceByName))
    .filter(Boolean)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 200);
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const value = getKey(item) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildCapabilitiesPayload() {
  const skills = readSkills();
  const plugins = readPlugins();
  const pluginCategories = countBy(plugins, (plugin) => plugin.category);
  const skillScopes = countBy(skills, (skill) => skill.scope);
  const pluginsRequiringAuth = plugins.filter((plugin) => plugin.policy?.authentication).length;
  const pluginsWithWriteCapability = plugins.filter((plugin) =>
    plugin.capabilities.some((capability) => capability.toLowerCase().includes('write'))
  ).length;

  return {
    skills,
    plugins,
    stats: {
      skills: skills.length,
      systemSkills: skillScopes.system || 0,
      userSkills: skillScopes.user || 0,
      plugins: plugins.length,
      pluginCategories: Object.keys(pluginCategories).length,
      pluginsWithSkills: plugins.filter((plugin) => plugin.hasSkills).length,
      pluginsWithApps: plugins.filter((plugin) => plugin.hasApps).length,
      pluginsRequiringAuth,
      pluginsWithWriteCapability
    },
    categories: {
      skillsByScope: skillScopes,
      pluginsByCategory: pluginCategories,
      pluginsByInstallation: countBy(plugins, (plugin) => plugin.marketplaceStatus)
    },
    source: {
      skillsDirectory: statPath('skills', SKILLS_DIR),
      pluginCache: statPath('plugin-cache', PLUGIN_CACHE_DIR),
      pluginManifests: statPath('plugins', PLUGIN_ROOT_DIR),
      marketplace: statPath('marketplace.json', MARKETPLACE_FILE)
    },
    refreshedAt: new Date().toISOString()
  };
}

function buildSessionDetailPayload(thread) {
  return {
    thread,
    activity: readRecentLogs({ threadId: thread.id, limit: 25 }),
    fileGraph: readSessionFileGraph(thread.id),
    source: checkSqliteAvailability('state_5.sqlite'),
    refreshedAt: new Date().toISOString()
  };
}

function readDatabaseTable(fileName, table, options = {}) {
  if (!sqliteFiles.includes(fileName)) {
    return {
      status: 400,
      payload: {
        error: 'unknown_database',
        name: fileName,
        allowed: sqliteFiles
      }
    };
  }

  const source = checkSqliteAvailability(fileName);
  if (!source.available) {
    return {
      status: source.exists ? 503 : 404,
      payload: {
        error: source.error || 'database_unavailable',
        database: fileName,
        source
      }
    };
  }

  const limit = clampLimit(options.limit, 50, 200);
  const offset = clampOffset(options.offset);
  const db = openReadonlyDatabase(fileName);

  try {
    const tableRow = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `).get(table);

    if (!tableRow) {
      return {
        status: 404,
        payload: {
          error: 'table_not_found',
          database: fileName,
          table,
          source
        }
      };
    }

    const tableName = quoteIdentifier(tableRow.name);
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
      .map((column) => ({ name: column.name, type: column.type }));
    const rowCount = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
    const rows = db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);

    return {
      status: 200,
      payload: {
        database: fileName,
        table: tableRow.name,
        columns,
        rowCount,
        rows,
        limit,
        offset,
        source,
        refreshedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      status: 500,
      payload: {
        error: error.message,
        database: fileName,
        table,
        source
      }
    };
  } finally {
    if (db) db.close();
  }
}

function buildSummary() {
  const config = readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { profiles: [] });
  const agentSessions = readJsonFile(path.join(CODEX_DIR, dashboardFiles.agentSessions), { sessions: [] });
  const reviewHistory = readJsonFile(path.join(CODEX_DIR, dashboardFiles.reviewHistory), []);
  const version = readJsonFile(path.join(CODEX_DIR, dashboardFiles.version), {});
  const agents = readAgents();
  const activeProfile = config.profiles?.find((profile) => profile.id === config.activeProfileId) || null;
  const threads = readThreads(24);
  const activity = readRecentLogs(32);
  const system = buildSystemSummary(activeProfile);
  const health = buildHealthSummary();
  const usage = buildUsageSummary();

  return {
    codexHome: CODEX_DIR,
    refreshedAt: new Date().toISOString(),
    version,
    activeProfile,
    profiles: config.profiles || [],
    agents,
    teams: groupBy(agents, 'team'),
    models: groupBy(agents, 'model'),
    files: [...Object.values(dashboardFiles), ...jsonlFiles].map(statFile),
    databases: sqliteFiles.map(inspectSqlite),
    threads,
    activity,
    system,
    health,
    usage,
    recentHistory: readJsonlTail(path.join(CODEX_DIR, 'history.jsonl'), 12),
    sessionIndex: readJsonlTail(path.join(CODEX_DIR, 'session_index.jsonl'), 12),
    counts: {
      agents: agents.length,
      teams: Object.keys(groupBy(agents, 'team')).length,
      profiles: config.profiles?.length || 0,
      agentSessions: agentSessions.sessions?.length || 0,
      reviewHistory: Array.isArray(reviewHistory) ? reviewHistory.length : 0,
      threads: system.threadStats.total,
      logs: system.logStats.total
    }
  };
}

function buildDiagnosticRisks({ health, configValidation, capabilities, system }) {
  const risks = [];

  if (!health.ok) {
    risks.push({
      id: 'health-degraded',
      severity: 'high',
      label: 'Health degraded',
      detail: 'One or more required local Codex sources are missing, unreadable, or unavailable.'
    });
  }

  if (!configValidation.valid) {
    risks.push({
      id: 'config-validation-failed',
      severity: 'high',
      label: 'Config validation failed',
      detail: 'The active profile configuration has missing profiles, duplicate ids, or invalid required fields.'
    });
  }

  if ((capabilities.stats?.pluginsWithWriteCapability || 0) > 0) {
    risks.push({
      id: 'write-capable-plugins',
      severity: 'medium',
      label: 'Write-capable plugins detected',
      detail: 'At least one cached plugin advertises write capabilities and should be reviewed before mutation flows are added.'
    });
  }

  if ((system.threadStats?.total || 0) === 0) {
    risks.push({
      id: 'no-thread-history',
      severity: 'low',
      label: 'No thread history detected',
      detail: 'Session analytics will remain limited until local Codex thread history is available.'
    });
  }

  return risks;
}

function buildDiagnosticReportPayload() {
  const config = readConfigPayload();
  const profiles = Array.isArray(config.profiles) ? config.profiles : [];
  const activeProfile = profiles.find((profile) => profile.id === config.activeProfileId) || null;
  const agents = readAgents();
  const health = buildHealthSummary();
  const system = buildSystemSummary(activeProfile);
  const capabilities = buildCapabilitiesPayload();
  const orchestration = buildOrchestrationPayload();
  const configValidation = validateConfig(config);
  const generatedAt = new Date().toISOString();

  return {
    report: {
      title: 'Codex Dashboard Diagnostic Report',
      formatVersion: 1,
      generatedAt,
      scope: 'local-read-only'
    },
    environment: {
      codexHome: CODEX_DIR,
      node: process.version,
      platform: `${os.type()} ${os.release()}`,
      pid: process.pid
    },
    health: {
      ok: health.ok,
      status: health.status,
      sources: health.sources,
      databases: health.databases
    },
    profile: {
      activeProfileId: config.activeProfileId || null,
      activeProfile,
      totalProfiles: profiles.length,
      validation: configValidation,
      source: statSourceFile(dashboardFiles.config)
    },
    inventory: {
      agents: agents.length,
      teams: groupBy(agents, 'team'),
      models: groupBy(agents, 'model'),
      skills: capabilities.stats.skills,
      plugins: capabilities.stats.plugins,
      pluginsRequiringAuth: capabilities.stats.pluginsRequiringAuth,
      pluginsWithWriteCapability: capabilities.stats.pluginsWithWriteCapability
    },
    activity: {
      threads: system.threadStats,
      logs: system.logStats,
      recentThreads: readThreads(10),
      recentActivity: readRecentLogs({ limit: 10 })
    },
    orchestration: {
      stats: orchestration.stats,
      unmappedThreads: orchestration.unmappedThreads
    },
    sources: {
      files: health.sources.files,
      databases: sqliteFiles.map(inspectSqlite)
    },
    risks: buildDiagnosticRisks({ health, configValidation, capabilities, system })
  };
}

app.get('/api/health', (req, res) => {
  res.json(buildHealthSummary());
});

app.get('/api/summary', (req, res) => {
  res.json(buildSummary());
});

app.get('/api/agents', (req, res) => {
  res.json(readAgents());
});

app.get('/api/agents/:id', (req, res) => {
  const agentId = String(req.params.id);
  const agent = readAgents().find((item) => item.id === agentId);

  if (!agent) {
    res.status(404).json({
      error: 'agent_not_found',
      id: agentId,
      source: statSourceFile(dashboardFiles.agents)
    });
    return;
  }

  res.json(buildAgentDetailPayload(agent));
});

app.get('/api/orchestration', (req, res) => {
  res.json(buildOrchestrationPayload());
});

app.get('/api/capabilities', (req, res) => {
  res.json(buildCapabilitiesPayload());
});

app.get('/api/profiles', (req, res) => {
  res.json(buildProfilesPayload());
});

app.post('/api/config/preview', (req, res) => {
  res.json(buildConfigPreviewPayload(req.body || {}));
});

app.get('/api/diagnostics/report', (req, res) => {
  res.json(buildDiagnosticReportPayload());
});

app.get('/api/analytics/trends', (req, res) => {
  res.json(buildAnalyticsPayload({ days: req.query.days }));
});

app.get('/api/workspaces', (req, res) => {
  res.json(readWorkspaces({ limit: req.query.limit }));
});

app.get('/api/databases', (req, res) => {
  res.json(sqliteFiles.map(inspectSqlite));
});

app.get('/api/databases/:name/tables/:table', (req, res) => {
  const result = readDatabaseTable(req.params.name, req.params.table, {
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.status(result.status).json(result.payload);
});

app.get('/api/sessions', (req, res) => {
  const limit = clampLimit(req.query.limit, 24, 100);
  res.json({
    threads: readThreads(limit),
    stats: readThreadStats(),
    limit,
    refreshedAt: new Date().toISOString()
  });
});

app.get('/api/sessions/:id', (req, res) => {
  const id = String(req.params.id);
  const thread = readThreadById(id);

  if (!thread) {
    res.status(404).json({
      error: 'session_not_found',
      id,
      source: checkSqliteAvailability('state_5.sqlite')
    });
    return;
  }

  res.json(buildSessionDetailPayload(thread));
});

app.get('/api/activity', (req, res) => {
  const filters = {
    level: req.query.level,
    target: req.query.target,
    threadId: req.query.threadId,
    query: req.query.query,
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit,
    offset: req.query.offset
  };
  const limit = clampLimit(filters.limit, 50, 200);
  const offset = clampOffset(filters.offset);
  const total = countRecentLogs({ ...filters, limit, offset });
  res.json({
    activity: readRecentLogs({ ...filters, limit, offset }),
    stats: readLogStats(),
    filters: {
      level: filters.level || '',
      target: filters.target || '',
      threadId: filters.threadId || '',
      query: filters.query || '',
      from: filters.from || '',
      to: filters.to || '',
      limit,
      offset
    },
    pagination: {
      limit,
      offset,
      total,
      hasNext: offset + limit < total
    },
    refreshedAt: new Date().toISOString()
  });
});

app.get('/api/system', (req, res) => {
  const config = readJsonFile(path.join(CODEX_DIR, dashboardFiles.config), { profiles: [] });
  const activeProfile = config.profiles?.find((profile) => profile.id === config.activeProfileId) || null;
  res.json(buildSystemSummary(activeProfile));
});

app.get('/api/release/health', (req, res) => {
  res.json(buildReleaseHealth());
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Codex Dashboard API running on http://localhost:${PORT}`);
    console.log(`Reading Codex data from ${CODEX_DIR}`);
  });
}

module.exports = {
  app,
  buildReleaseHealth
};
