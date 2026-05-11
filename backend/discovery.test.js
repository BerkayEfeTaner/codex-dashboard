const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { readSubagentTomlFilesUncached } = require('./services/agents');
const { readSkillsFromDirectory } = require('./services/skills');

function withTempDir(prefix, run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('discovers TOML subagents with arrays, comments, and multiline prompt', () => {
  withTempDir('codex-dashboard-agents-', (tempDir) => {
    const agentFile = path.join(tempDir, 'planner.toml');
    fs.writeFileSync(agentFile, [
      'name = "planner"',
      'description = "Plans implementation work"',
      'model = "gpt-5.4"',
      'reasoning_effort = "high"',
      'tools = ["shell", "apply_patch"] # inline comment',
      'skills = ["repo-architect", "test-triage-fixer"]',
      'prompt = """',
      '# Planner',
      'Use local project context.',
      '"""'
    ].join('\n'));

    const agents = readSubagentTomlFilesUncached([{ scope: 'test', dir: tempDir }]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0].name, 'planner');
    assert.equal(agents[0].model, 'gpt-5.4');
    assert.equal(agents[0].reasoningEffort, 'high');
    assert.deepEqual(agents[0].tools, ['shell', 'apply_patch']);
    assert.deepEqual(agents[0].skills, ['repo-architect', 'test-triage-fixer']);
    assert.equal(agents[0].source, 'codex-subagent-toml');
  });
});

test('discovers skills from SKILL.md manifests', () => {
  withTempDir('codex-dashboard-skills-', (tempDir) => {
    const skillDir = path.join(tempDir, 'quality-check');
    fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: quality-check',
      'display_name: Quality Check',
      'description: Checks backend discovery behavior',
      '---',
      '',
      '# Quality Check'
    ].join('\n'));

    const skills = readSkillsFromDirectory(tempDir, 'test');

    assert.equal(skills.length, 1);
    assert.equal(skills[0].name, 'quality-check');
    assert.equal(skills[0].displayName, 'Quality Check');
    assert.equal(skills[0].description, 'Checks backend discovery behavior');
    assert.equal(skills[0].scope, 'test');
    assert.equal(skills[0].hasScripts, true);
  });
});
