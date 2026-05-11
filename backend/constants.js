const path = require('path');
const os = require('os');

const USER_HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const CODEX_DIR = process.env.CODEX_HOME || path.join(USER_HOME, '.codex');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];

function parsePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

function parsePort(value, fallback = 3132) {
  return parsePositiveInteger(value, fallback, 65535);
}

function parseCorsOrigins(value) {
  if (!value) return DEFAULT_CORS_ORIGINS;
  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

module.exports = {
  PORT: parsePort(process.env.CODEX_DASHBOARD_PORT || process.env.PORT),
  CORS_ORIGINS: parseCorsOrigins(process.env.CODEX_DASHBOARD_CORS_ORIGINS || process.env.CORS_ORIGINS),
  DISCOVERY_CACHE_TTL_MS: parsePositiveInteger(process.env.CODEX_DASHBOARD_DISCOVERY_CACHE_TTL_MS, 30000),
  PROJECT_ROOT,
  CODEX_DIR,
  AGENTS_DIR: path.join(CODEX_DIR, 'agents'),
  PROJECT_AGENTS_DIR: path.join(PROJECT_ROOT, '.codex', 'agents'),
  SKILLS_DIR: path.join(CODEX_DIR, 'skills'),
  PROJECT_SKILLS_DIR: path.join(PROJECT_ROOT, '.codex', 'skills'),
  PLUGIN_CACHE_DIR: path.join(CODEX_DIR, '.tmp', 'plugins'),
  PLUGIN_ROOT_DIR: path.join(CODEX_DIR, '.tmp', 'plugins', 'plugins'),
  MARKETPLACE_FILE: path.join(CODEX_DIR, '.tmp', 'plugins', '.agents', 'plugins', 'marketplace.json'),
  
  dashboardFiles: {
    agents: 'dashboard-agents.json',
    config: 'dashboard-config.json',
    agentSessions: 'dashboard-agent-sessions.json',
    reviewHistory: 'dashboard-review-history.json',
    version: 'version.json'
  },
  
  sqliteFiles: ['logs_2.sqlite', 'state_5.sqlite'],
  jsonlFiles: ['history.jsonl', 'session_index.jsonl']
};
