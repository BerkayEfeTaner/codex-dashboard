const fs = require('fs');
const os = require('os');
const { CODEX_DIR, dashboardFiles, jsonlFiles, sqliteFiles } = require('../constants');
const { canReadPath, statFile } = require('../utils');
const { checkSqliteAvailability } = require('../db');

function statSourceFile(fileName) {
  return statFile(fileName);
}

function buildHealthSummary() {
  const codexHomeExists = fs.existsSync(CODEX_DIR);
  const codexHomeReadable = codexHomeExists && canReadPath(CODEX_DIR);
  const sourceFiles = [...Object.values(dashboardFiles), ...jsonlFiles].map(statSourceFile);
  const databaseFiles = sqliteFiles.map(checkSqliteAvailability);
  const sourceCounts = sourceFiles.reduce((acc, file) => {
    acc.total += 1;
    acc.existing += file.exists ? 1 : 0;
    acc.missing += file.exists ? 0 : 1;
    acc.readable += file.readable ? 1 : 0;
    return acc;
  }, { total: 0, existing: 0, missing: 0, readable: 0 });
  const databaseCounts = databaseFiles.reduce((acc, file) => {
    acc.total += 1;
    acc.available += file.available ? 1 : 0;
    acc.missing += file.exists ? 0 : 1;
    acc.errored += file.exists && !file.available ? 1 : 0;
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
    runtime: { node: process.version, platform: `${os.type()} ${os.release()}`, pid: process.pid },
    sources: { ...sourceCounts, files: sourceFiles },
    databases: { ...databaseCounts, files: databaseFiles }
  };
}

function buildSystemSummary({ profile, threadStats, logStats }) {
  return {
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
    codexHome: CODEX_DIR,
    threadStats,
    logStats,
    activeModel: profile?.model || null,
    activeApprovalMode: profile?.approvalMode || null,
    sourceFiles: [...Object.values(dashboardFiles), ...jsonlFiles].map(statSourceFile),
    databaseFiles: sqliteFiles.map(checkSqliteAvailability)
  };
}

module.exports = {
  buildHealthSummary,
  buildSystemSummary,
  statSourceFile
};
