const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  buildSkillCandidatesFromRows,
  isCandidateSignal,
  slugifySkillName
} = require('./services/skillCandidates');

test('candidate signal filter ignores telemetry and weak evidence', () => {
  assert.equal(isCandidateSignal({ target: 'opentelemetry_sdk', count: 18 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_otel.trace_safe', count: 18 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_tui::markdown_stream', count: 500 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_core::session::turn', count: 40 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_core_skills::manager', count: 40 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_analytics::client', count: 40 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_client::default_client', count: 40 }), false);
  assert.equal(isCandidateSignal({ target: 'rmcp::transport::worker', count: 40 }), false);
  assert.equal(isCandidateSignal({ target: 'codex_client::custom_ca', count: 40 }), true);
  assert.equal(isCandidateSignal({ target: 'feedback_tags', count: 40 }), true);
  assert.equal(isCandidateSignal({ target: 'file.edit.apply', count: 2 }), false);
  assert.equal(isCandidateSignal({ target: 'file.edit.apply', count: 3 }), true);
});

test('skill candidate builder merges equivalent signals into one candidate', () => {
  const candidates = buildSkillCandidatesFromRows([
    { target: 'file.edit.apply', count: 5, lastSeen: 1770000000 },
    { target: 'file-edit-apply', count: 4, lastSeen: 1770000100 },
    { target: 'hyper_util::client::legacy::pool', count: 40, lastSeen: 1770000200 }
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, 'file-edit-file-edit-apply');
  assert.equal(candidates[0].evidenceCount, 9);
  assert.equal(candidates[0].status, 'candidate');
  assert.equal(candidates[0].source, 'local-codex-logs');
  assert.equal(candidates[0].suggestedSkill.name, candidates[0].name);
});

test('skill name slug is stable and bounded', () => {
  const slug = slugifySkillName('A Very Long Workflow Name That Needs Cleanup Before Becoming A Skill Name');

  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(slug.length <= 54);
});
