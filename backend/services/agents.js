const fs = require('fs');
const path = require('path');
const TOML = require('@iarna/toml');
const {
  CODEX_DIR,
  AGENTS_DIR,
  PROJECT_AGENTS_DIR,
  dashboardFiles,
  DISCOVERY_CACHE_TTL_MS
} = require('../constants');
const { readJsonFile, readTextFile } = require('../utils');
const { createTtlCache } = require('./cache');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listFilesByExtension(directory, extension) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

function parseToml(content) {
  try {
    return TOML.parse(content);
  } catch {
    return {};
  }
}

function extractMarkdownSummary(content) {
  return content
    .replace(/^---[\s\S]*?---/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#')) || '';
}

function stableAgentId(agent) {
  if (agent?.id) return String(agent.id);
  return slugify([agent?.scope, agent?.type, agent?.team, agent?.name, agent?.sourcePath].filter(Boolean).join('-')) || null;
}

function normalizeAgents(payload) {
  return Array.isArray(payload?.agents) ? payload.agents.filter(Boolean) : [];
}

function readSubagentTomlFilesUncached(sourceDirs = null) {
  const dirs = sourceDirs || [
    { scope: 'project', dir: PROJECT_AGENTS_DIR },
    { scope: 'global', dir: AGENTS_DIR }
  ];

  return dirs.flatMap(({ scope, dir }) => listFilesByExtension(dir, '.toml').map((filePath) => {
    const content = readTextFile(filePath, '');
    const config = parseToml(content);
    const stat = fs.statSync(filePath);
    const name = config.name || path.basename(filePath, '.toml');
    return {
      id: stableAgentId({ scope, type: 'subagent', name, sourcePath: filePath }),
      name,
      description: config.description || extractMarkdownSummary(config.prompt || content),
      model: config.model || null,
      reasoningEffort: config.reasoning_effort || config.reasoningEffort || null,
      tools: Array.isArray(config.tools) ? config.tools : [],
      skills: Array.isArray(config.skills) ? config.skills : [],
      scope,
      type: 'subagent',
      source: 'codex-subagent-toml',
      sourcePath: filePath,
      modifiedAt: stat.mtime.toISOString()
    };
  }));
}

function readMarkdownAgentProfiles() {
  return listFilesByExtension(AGENTS_DIR, '.md')
    .filter((filePath) => path.basename(filePath).toLowerCase() !== 'readme.md')
    .map((filePath) => {
      const content = readTextFile(filePath, '');
      const stat = fs.statSync(filePath);
      const name = path.basename(filePath, '.md');
      return {
        id: stableAgentId({ scope: 'global', type: 'profile', name, sourcePath: filePath }),
        name,
        description: extractMarkdownSummary(content),
        scope: 'global',
        type: 'profile',
        source: 'local-profile-markdown',
        sourcePath: filePath,
        modifiedAt: stat.mtime.toISOString(),
        skills: []
      };
    });
}

function readAgentsUncached() {
  const subagents = readSubagentTomlFilesUncached();
  if (subagents.length > 0) return subagents;

  const profiles = readMarkdownAgentProfiles();
  if (profiles.length > 0) return profiles;

  const legacyPath = path.join(CODEX_DIR, dashboardFiles.agents);
  const agentsPayload = readJsonFile(legacyPath, { agents: [] });
  return normalizeAgents(agentsPayload)
    .map((agent) => ({
      ...agent,
      id: stableAgentId({ ...agent, type: 'legacy', sourcePath: legacyPath }),
      type: 'legacy',
      source: 'dashboard-agents-json',
      sourcePath: legacyPath
    }))
    .filter((agent) => agent.id);
}

const agentsCache = createTtlCache(DISCOVERY_CACHE_TTL_MS);

function readAgents() {
  return agentsCache.get(readAgentsUncached);
}

function getAgentIdentitySet(agent) {
  return new Set([agent.id, agent.name, agent.sourceAgentId, agent.sourceAgentType].filter(Boolean).map(v => String(v).trim().toLowerCase()));
}

function threadMatchesAgent(thread, identity) {
  return [thread.agentNickname, thread.agentRole, thread.model].filter(Boolean).map(v => String(v).trim().toLowerCase()).some(c => identity.has(c));
}

module.exports = {
  getAgentIdentitySet,
  readAgents,
  readAgentsUncached,
  readSubagentTomlFilesUncached,
  stableAgentId,
  threadMatchesAgent
};
