const fs = require('fs');
const path = require('path');
const { CODEX_DIR } = require('../constants');
const { readJsonFile, readJsonlTail, statPath } = require('../utils');
const { checkSqliteAvailability, openReadonlyDatabase } = require('../db');
const { createTtlCache } = require('./cache');

const USAGE_SUMMARY_TTL_MS = 15000;
const usageSummaryCache = createTtlCache(USAGE_SUMMARY_TTL_MS);

function readUsageLimitSettings() {
  const config = readJsonFile(path.join(CODEX_DIR, 'dashboard-limits.json'), {});
  const resolveLimit = (configValue, envValue, configKey, envKey) => {
    const envLimit = parseInt(envValue, 10);
    if (envLimit > 0) return { limitTokens: envLimit, source: 'env', sourceKey: envKey };

    const configLimit = parseInt(configValue, 10);
    if (configLimit > 0) return { limitTokens: configLimit, source: 'config', sourceKey: `dashboard-limits.json:${configKey}` };

    return { limitTokens: null, source: 'unconfigured', sourceKey: null };
  };

  return {
    daily: resolveLimit(config.dailyTokenLimit, process.env.CODEX_DAILY_TOKEN_LIMIT, 'dailyTokenLimit', 'CODEX_DAILY_TOKEN_LIMIT'),
    weekly: resolveLimit(config.weeklyTokenLimit, process.env.CODEX_WEEKLY_TOKEN_LIMIT, 'weeklyTokenLimit', 'CODEX_WEEKLY_TOKEN_LIMIT')
  };
}

function collectSessionJsonlFiles(rootDir, limit = 250) {
  const files = [];

  function visit(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          files.push({ path: fullPath, modifiedAt: fs.statSync(fullPath).mtimeMs });
        } catch {
          files.push({ path: fullPath, modifiedAt: 0 });
        }
      }
    }
  }

  visit(rootDir);
  return files.sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, limit);
}

function clampPercentValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Number(parsed.toFixed(1)), 0), 100);
}

function getLimitStatus(remainingPercent, stale) {
  if (stale) return 'stale';
  if (remainingPercent === null) return 'unknown';
  if (remainingPercent <= 0) return 'exhausted';
  if (remainingPercent <= 20) return 'warning';
  return 'ok';
}

function normalizeCodexRateLimit(limit, fallbackLabel, nowMs) {
  if (!limit) return null;

  const usedPercent = clampPercentValue(limit.used_percent);
  const remainingPercent = usedPercent === null ? null : Number((100 - usedPercent).toFixed(1));
  const resetSeconds = Number(limit.resets_at);
  const resetsAt = Number.isFinite(resetSeconds) && resetSeconds > 0 ? new Date(resetSeconds * 1000).toISOString() : null;
  const resetMs = resetsAt ? Date.parse(resetsAt) : null;
  const stale = Number.isFinite(resetMs) && resetMs <= nowMs;

  return {
    label: limit.label || fallbackLabel,
    windowMinutes: Number.isFinite(Number(limit.window_minutes)) ? Number(limit.window_minutes) : null,
    usedPercent,
    remainingPercent,
    resetsAt,
    stale,
    status: getLimitStatus(remainingPercent, stale)
  };
}

function getEventTimestamp(event, fallbackMs = 0) {
  const direct = Date.parse(event?.timestamp || event?.time || event?.created_at || '');
  if (!Number.isNaN(direct)) return direct;

  const payloadTs = Number(event?.payload?.timestamp || event?.payload?.ts);
  if (Number.isFinite(payloadTs) && payloadTs > 0) {
    return payloadTs > 9999999999 ? payloadTs : payloadTs * 1000;
  }

  return fallbackMs;
}

function findLatestCodexRateLimitSnapshot(files) {
  let latest = null;

  files.forEach((file) => {
    const events = readJsonlTail(file.path, 1200);
    events.forEach((event) => {
      const rateLimits = event?.payload?.rate_limits;
      if (!rateLimits) return;

      const observedMs = getEventTimestamp(event, file.modifiedAt);
      if (!latest || observedMs > latest.observedMs) {
        latest = { rateLimits, observedMs };
      }
    });
  });

  return latest;
}

function buildCodexRateLimitSummary() {
  const sessionsDir = path.join(CODEX_DIR, 'sessions');
  const source = statPath('sessions', sessionsDir);
  let files = [];
  let snapshot = null;

  if (source.exists && source.readable) {
    try {
      files = collectSessionJsonlFiles(sessionsDir);
      snapshot = findLatestCodexRateLimitSnapshot(files);
    } catch {
      files = [];
      snapshot = null;
    }
  }

  const observedAt = snapshot?.observedMs ? new Date(snapshot.observedMs).toISOString() : null;
  const rateLimits = snapshot?.rateLimits || null;

  return {
    source: {
      type: 'local-codex-session-jsonl',
      path: sessionsDir,
      available: Boolean(source.exists && source.readable),
      filesScanned: files.length,
      error: source.exists ? (source.readable ? null : 'unreadable') : 'missing'
    },
    updatedAt: observedAt,
    planType: rateLimits?.plan_type || null,
    limitId: rateLimits?.limit_id || null,
    limitName: rateLimits?.limit_name || null,
    rateLimitReachedType: rateLimits?.rate_limit_reached_type || null,
    primary: normalizeCodexRateLimit(rateLimits?.primary, '5-hour', Date.now()),
    secondary: normalizeCodexRateLimit(rateLimits?.secondary, 'weekly', Date.now())
  };
}

function buildUsagePeriod({ key, label, window, days, limit, nowSeconds, nowIso }) {
  const fromTs = nowSeconds - days * 86400;
  let usedTokens = 0;
  let sessions = 0;
  let logEvents = 0;
  let estimatedBytes = 0;

  const stateDb = openReadonlyDatabase('state_5.sqlite');
  if (stateDb) {
    try {
      const row = stateDb.prepare("SELECT COUNT(*) AS sessions, COALESCE(SUM(tokens_used), 0) AS usedTokens FROM threads WHERE updated_at >= ?").get(fromTs);
      sessions = row.sessions;
      usedTokens = row.usedTokens;
    } finally {
      stateDb.close();
    }
  }

  const logDb = openReadonlyDatabase('logs_2.sqlite');
  if (logDb) {
    try {
      const row = logDb.prepare("SELECT COUNT(*) AS logEvents, COALESCE(SUM(estimated_bytes), 0) AS estimatedBytes FROM logs WHERE ts >= ?").get(fromTs);
      logEvents = row.logEvents;
      estimatedBytes = row.estimatedBytes;
    } finally {
      logDb.close();
    }
  }

  const remainingTokens = limit.limitTokens === null ? null : Math.max(limit.limitTokens - usedTokens, 0);
  const percentUsed = limit.limitTokens === null ? null : Math.min(100, Number(((usedTokens / limit.limitTokens) * 100).toFixed(1)));

  return {
    key,
    label,
    window,
    from: new Date(fromTs * 1000).toISOString(),
    to: nowIso,
    usedTokens,
    limitTokens: limit.limitTokens,
    remainingTokens,
    percentUsed,
    status: limit.limitTokens === null ? 'unconfigured' : remainingTokens <= 0 ? 'exhausted' : percentUsed >= 85 ? 'warning' : 'ok',
    sessions,
    logEvents,
    estimatedBytes
  };
}

function buildUsageSummary() {
  return usageSummaryCache.get(() => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const nowIso = new Date().toISOString();
    const limits = readUsageLimitSettings();

    return {
      source: {
        type: 'local-codex-sqlite',
        threads: checkSqliteAvailability('state_5.sqlite'),
        logs: checkSqliteAvailability('logs_2.sqlite')
      },
      rateLimits: buildCodexRateLimitSummary(),
      refreshedAt: nowIso,
      periods: {
        daily: buildUsagePeriod({ key: 'daily', label: 'Daily', window: 'rolling_24h', days: 1, limit: limits.daily, nowSeconds, nowIso }),
        weekly: buildUsagePeriod({ key: 'weekly', label: 'Weekly', window: 'rolling_7d', days: 7, limit: limits.weekly, nowSeconds, nowIso })
      }
    };
  });
}

module.exports = {
  buildUsageSummary,
  readUsageLimitSettings
};
