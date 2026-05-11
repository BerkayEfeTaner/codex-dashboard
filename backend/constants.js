const path = require('path');
const os = require('os');

const USER_HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const CODEX_DIR = process.env.CODEX_HOME || path.join(USER_HOME, '.codex');

module.exports = {
  PORT: Number(process.env.PORT || 3132),
  PROJECT_ROOT: path.resolve(__dirname, '..'),
  CODEX_DIR,
  SKILLS_DIR: path.join(CODEX_DIR, 'skills'),
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
