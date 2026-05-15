const crypto = require('crypto');
const { checkSqliteAvailability, openReadonlyDatabase } = require('../db');
const { normalizeUnixTime } = require('../utils');

const DEFAULT_INTERVAL_MS = 60000;
const DEFAULT_LOOKBACK_DAYS = 14;
const MIN_EVIDENCE_COUNT = 3;

const IGNORED_TARGET_PATTERNS = [
  /opentelemetry/i,
  /codex_otel/i,
  /otel/i,
  /hyper_util/i,
  /legacy::/i,
  /codex_api::endpoint/i,
  /^codex_tui::/i,
  /^codex_api::/i,
  /^codex_app_server::/i,
  /^codex_core::/i,
  /^codex_core_skills::/i,
  /^codex_analytics::/i,
  /^codex_models_manager::/i,
  /^codex_client::(?!custom_ca$)/i,
  /^rmcp::/i,
  /^log$/i
];

function slugifySkillName(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54)
    .replace(/-+$/g, '');

  return slug || 'codex-workflow';
}

function humanizeSignal(value) {
  return String(value || 'Codex signal')
    .replace(/[_:.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCandidateSignal(row) {
  const target = String(row?.target || '').trim();
  if (!target) return false;
  if (IGNORED_TARGET_PATTERNS.some((pattern) => pattern.test(target))) return false;
  return Number(row?.count || 0) >= MIN_EVIDENCE_COUNT;
}

function classifyCandidate(target) {
  const value = String(target || '').toLowerCase();
  if (/error|fail|exception|denied|blocked|warn/.test(value)) {
    return {
      kind: 'guardrail',
      prefix: 'stabilize',
      meaning: 'Recurring risk or failure pattern'
    };
  }
  if (/test|lint|build|verify|coverage/.test(value)) {
    return {
      kind: 'verification',
      prefix: 'verification',
      meaning: 'Repeatable verification workflow'
    };
  }
  if (/file|edit|patch|apply|write/.test(value)) {
    return {
      kind: 'editing',
      prefix: 'file-edit',
      meaning: 'Repeatable file-editing workflow'
    };
  }
  if (/shell|command|terminal|process|exec/.test(value)) {
    return {
      kind: 'execution',
      prefix: 'command',
      meaning: 'Repeatable command execution workflow'
    };
  }
  return {
    kind: 'workflow',
    prefix: 'codex',
    meaning: 'Repeated local Codex workflow'
  };
}

function makeCandidateId(name, target) {
  return crypto.createHash('sha1').update(`${name}:${target}`).digest('hex').slice(0, 12);
}

function buildCandidateFromRow(row) {
  const target = String(row.target || 'unknown');
  const count = Number(row.count || 0);
  const lastSeenIso = normalizeUnixTime(row.lastSeen);
  const signalName = humanizeSignal(target);
  const classification = classifyCandidate(target);
  const name = slugifySkillName(`${classification.prefix}-${signalName}`);
  const confidence = Number(Math.min(0.95, 0.45 + count * 0.04).toFixed(2));

  return {
    id: makeCandidateId(name, target),
    name,
    title: signalName,
    description: classification.meaning,
    status: 'candidate',
    source: 'local-codex-logs',
    trigger: `Use when ${signalName.toLowerCase()} appears repeatedly during Codex work.`,
    evidenceCount: count,
    confidence,
    confidenceLabel: confidence >= 0.75 ? 'high' : confidence >= 0.6 ? 'medium' : 'watch',
    signals: [{
      kind: classification.kind,
      label: target,
      count,
      lastSeenIso
    }],
    suggestedSkill: {
      name,
      description: `Use when Codex repeatedly handles ${signalName.toLowerCase()} and needs a reusable workflow, validation checklist, or guardrail.`,
      bodyOutline: [
        'Trigger conditions',
        'Minimal workflow',
        'Validation checklist',
        'Known failure modes'
      ]
    },
    createdAt: lastSeenIso,
    updatedAt: lastSeenIso
  };
}

function mergeCandidate(existing, incoming) {
  if (!existing) return incoming;

  const evidenceCount = existing.evidenceCount + incoming.evidenceCount;
  const confidence = Number(Math.min(0.95, 0.45 + evidenceCount * 0.04).toFixed(2));
  const updatedAt = [existing.updatedAt, incoming.updatedAt].filter(Boolean).sort().at(-1) || null;

  return {
    ...existing,
    evidenceCount,
    confidence,
    confidenceLabel: confidence >= 0.75 ? 'high' : confidence >= 0.6 ? 'medium' : 'watch',
    updatedAt,
    signals: [...existing.signals, ...incoming.signals]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
}

function buildSkillCandidatesFromRows(rows = []) {
  const byName = new Map();

  rows
    .filter(isCandidateSignal)
    .map(buildCandidateFromRow)
    .forEach((candidate) => {
      byName.set(candidate.name, mergeCandidate(byName.get(candidate.name), candidate));
    });

  return [...byName.values()]
    .sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount)
    .slice(0, 12);
}

function readSignalRows({ lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}) {
  const db = openReadonlyDatabase('logs_2.sqlite');
  if (!db) return [];

  const since = Math.floor(Date.now() / 1000) - (lookbackDays * 86400);

  try {
    return db.prepare(`
      SELECT
        COALESCE(target, 'unknown') AS target,
        COUNT(*) AS count,
        MAX(ts) AS lastSeen
      FROM logs
      WHERE ts >= ?
      GROUP BY COALESCE(target, 'unknown')
      HAVING count >= ?
      ORDER BY count DESC, lastSeen DESC
      LIMIT 80
    `).all(since, MIN_EVIDENCE_COUNT);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function createEmptySnapshot(extra = {}) {
  return {
    daemon: {
      status: 'idle',
      mode: 'read-only',
      intervalMs: DEFAULT_INTERVAL_MS,
      writesSkills: false
    },
    candidates: [],
    stats: {
      candidates: 0,
      highConfidence: 0,
      signals: 0
    },
    source: {
      logs: checkSqliteAvailability('logs_2.sqlite')
    },
    refreshedAt: new Date().toISOString(),
    ...extra
  };
}

function buildSkillCandidateSnapshot(options = {}) {
  const rows = readSignalRows(options);
  const candidates = buildSkillCandidatesFromRows(rows);

  return createEmptySnapshot({
    daemon: {
      status: 'watching',
      mode: 'read-only',
      intervalMs: options.intervalMs || DEFAULT_INTERVAL_MS,
      writesSkills: false
    },
    candidates,
    stats: {
      candidates: candidates.length,
      highConfidence: candidates.filter((candidate) => candidate.confidence >= 0.75).length,
      signals: rows.filter(isCandidateSignal).length
    }
  });
}

function createSkillCandidateDaemon({ intervalMs = DEFAULT_INTERVAL_MS, lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}) {
  let timer = null;
  let snapshot = createEmptySnapshot({
    daemon: {
      status: 'idle',
      mode: 'read-only',
      intervalMs,
      writesSkills: false
    }
  });

  function refresh() {
    snapshot = buildSkillCandidateSnapshot({ intervalMs, lookbackDays });
    return snapshot;
  }

  function start() {
    if (timer) return snapshot;
    refresh();
    timer = setInterval(refresh, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    return snapshot;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    snapshot = {
      ...snapshot,
      daemon: {
        ...snapshot.daemon,
        status: 'idle'
      }
    };
  }

  function getSnapshot({ refreshIfStale = false } = {}) {
    if (refreshIfStale && (!snapshot.refreshedAt || snapshot.daemon.status === 'idle')) {
      return refresh();
    }
    return snapshot;
  }

  return {
    start,
    stop,
    refresh,
    getSnapshot
  };
}

module.exports = {
  buildSkillCandidateSnapshot,
  buildSkillCandidatesFromRows,
  createSkillCandidateDaemon,
  isCandidateSignal,
  slugifySkillName
};
