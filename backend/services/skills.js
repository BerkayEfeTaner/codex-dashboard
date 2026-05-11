const fs = require('fs');
const path = require('path');
const {
  PROJECT_SKILLS_DIR,
  SKILLS_DIR,
  PLUGIN_CACHE_DIR,
  PLUGIN_ROOT_DIR,
  MARKETPLACE_FILE,
  DISCOVERY_CACHE_TTL_MS
} = require('../constants');
const { readJsonFile, readTextFile, statPath } = require('../utils');
const { createTtlCache } = require('./cache');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractMarkdownSummary(content) {
  return content
    .replace(/^---[\s\S]*?---/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#')) || '';
}

function parseSkillManifest(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields = frontmatter ? frontmatter[1].split(/\r?\n/).reduce((acc, line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (match) acc[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    return acc;
  }, {}) : {};

  return {
    ...fields,
    description: fields.description || extractMarkdownSummary(content)
  };
}

function discoverSkillFiles(rootDir, scope) {
  const files = [];
  const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage']);

  function walk(directory, depth = 0) {
    if (files.length >= 500 || depth > 5) return;
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
      files.push({ scope, filePath: path.join(directory, 'SKILL.md') });
      return;
    }

    entries
      .filter((entry) => entry.isDirectory() && !ignored.has(entry.name))
      .forEach((entry) => walk(path.join(directory, entry.name), depth + 1));
  }

  walk(rootDir);
  return files;
}

function readSkillsFromDirectory(rootDir, scope) {
  return discoverSkillFiles(rootDir, scope).map(({ filePath }) => {
    const skillDir = path.dirname(filePath);
    const content = readTextFile(filePath, '');
    const manifest = parseSkillManifest(content);
    const stat = fs.statSync(filePath);
    const name = manifest.name || path.basename(skillDir);

    return {
      id: slugify(`${scope}-${skillDir}`),
      name,
      displayName: manifest.display_name || manifest.displayName || name,
      description: manifest.description || '',
      scope,
      path: skillDir,
      manifestPath: filePath,
      hasScripts: fs.existsSync(path.join(skillDir, 'scripts')),
      hasAssets: fs.existsSync(path.join(skillDir, 'assets')),
      hasReferences: fs.existsSync(path.join(skillDir, 'references')),
      modifiedAt: stat.mtime.toISOString()
    };
  });
}

function readPluginManifests() {
  const manifests = [];
  const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage']);

  function walk(directory, depth = 0) {
    if (manifests.length >= 100 || depth > 4) return;
    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    entries.forEach((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isFile() && entry.name === 'plugin.json') {
        const plugin = readJsonFile(entryPath, {});
        manifests.push({
          id: slugify(entryPath),
          name: plugin.name || path.basename(path.dirname(entryPath)),
          displayName: plugin.displayName || plugin.display_name || plugin.name,
          description: plugin.description || '',
          category: plugin.category || 'uncategorized',
          version: plugin.version || null,
          policy: plugin.policy || {},
          capabilities: Array.isArray(plugin.capabilities) ? plugin.capabilities : [],
          marketplaceStatus: plugin.marketplaceStatus || 'LOCAL',
          path: path.dirname(entryPath),
          manifestPath: entryPath,
          hasSkills: fs.existsSync(path.join(path.dirname(entryPath), 'skills')),
          hasApps: fs.existsSync(path.join(path.dirname(entryPath), 'apps'))
        });
      } else if (entry.isDirectory() && !ignored.has(entry.name)) {
        walk(entryPath, depth + 1);
      }
    });
  }

  walk(PLUGIN_ROOT_DIR);
  return manifests;
}

const skillDiscoveryCache = createTtlCache(DISCOVERY_CACHE_TTL_MS);
const pluginDiscoveryCache = createTtlCache(DISCOVERY_CACHE_TTL_MS);

function buildCapabilitiesPayload() {
  const skills = skillDiscoveryCache.get(() => [
    ...readSkillsFromDirectory(PROJECT_SKILLS_DIR, 'project'),
    ...readSkillsFromDirectory(SKILLS_DIR, 'global')
  ]);
  const plugins = pluginDiscoveryCache.get(readPluginManifests);
  const pluginCategories = new Set(plugins.map((plugin) => plugin.category).filter(Boolean)).size;
  const pluginsRequiringAuth = plugins.filter((plugin) => plugin.policy?.authentication).length;

  return {
    skills,
    plugins,
    stats: {
      skills: skills.length,
      plugins: plugins.length,
      pluginCategories,
      pluginsRequiringAuth
    },
    source: {
      projectSkillsDirectory: statPath('project skills', PROJECT_SKILLS_DIR),
      skillsDirectory: statPath('global skills', SKILLS_DIR),
      pluginCache: statPath('plugin cache', PLUGIN_CACHE_DIR),
      pluginManifests: statPath('plugin root', PLUGIN_ROOT_DIR),
      marketplace: statPath('marketplace', MARKETPLACE_FILE)
    },
    refreshedAt: new Date().toISOString()
  };
}

module.exports = {
  buildCapabilitiesPayload,
  discoverSkillFiles,
  readPluginManifests,
  readSkillsFromDirectory
};
