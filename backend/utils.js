const fs = require('fs');
const path = require('path');
const { CODEX_DIR } = require('./constants');

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

function canReadPath(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
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

function statFile(fileName) {
  const filePath = path.join(CODEX_DIR, fileName);
  return statPath(fileName, filePath);
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

function normalizeUnixTime(value) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function parseJsonSafe(value, fallback = null) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  readJsonFile,
  readTextFile,
  readJsonlTail,
  canReadPath,
  statPath,
  statFile,
  groupBy,
  clampLimit,
  clampOffset,
  parseUnixTimeFilter,
  quoteIdentifier,
  normalizeUnixTime,
  parseJsonSafe
};
