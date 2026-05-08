const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const { app } = require('./server');

let server;
let baseUrl;

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json();
  return { response, body };
}

describe('Codex Dashboard API', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns a health summary', async () => {
    const { response, body } = await getJson('/api/health');

    assert.equal(response.status, 200);
    assert.equal(typeof body.status, 'string');
    assert.ok(Array.isArray(body.sources.files));
    assert.ok(Array.isArray(body.databases.files));
    assert.equal(typeof body.refreshedAt, 'string');
  });

  it('returns release health with test coverage metadata', async () => {
    const { response, body } = await getJson('/api/release/health');

    assert.equal(response.status, 200);
    assert.equal(typeof body.release.score, 'number');
    assert.ok(Array.isArray(body.checks));
    assert.equal(body.testCoverage.backend.configured, true);
    assert.equal(body.testCoverage.frontend.configured, true);
    assert.ok(body.testCoverage.totals.configuredRunners >= 2);
    assert.ok(body.smoke.endpointCount > 0);
    assert.equal(typeof body.refreshedAt, 'string');
  });

  it('returns real local usage windows in the summary contract', async () => {
    const previousDailyLimit = process.env.CODEX_DAILY_TOKEN_LIMIT;
    process.env.CODEX_DAILY_TOKEN_LIMIT = '999999999999';

    try {
      const { response, body } = await getJson('/api/summary');
      const daily = body.usage?.periods?.daily;
      const weekly = body.usage?.periods?.weekly;

      assert.equal(response.status, 200);
      assert.equal(body.usage?.source?.type, 'local-codex-sqlite');
      assert.equal(body.usage?.rateLimits?.source?.type, 'local-codex-session-jsonl');
      assert.equal(typeof body.usage?.rateLimits?.source?.filesScanned, 'number');
      assert.ok(body.usage?.rateLimits?.primary === null || body.usage?.rateLimits?.primary?.windowMinutes === 300);
      assert.ok(body.usage?.rateLimits?.secondary === null || body.usage?.rateLimits?.secondary?.windowMinutes === 10080);
      assert.equal(daily.window, 'rolling_24h');
      assert.equal(weekly.window, 'rolling_7d');
      assert.equal(typeof daily.usedTokens, 'number');
      assert.equal(typeof weekly.usedTokens, 'number');
      assert.equal(daily.limitTokens, 999999999999);
      assert.equal(typeof daily.remainingTokens, 'number');
      assert.ok(['ok', 'warning', 'exhausted'].includes(daily.status));
      assert.ok(['ok', 'warning', 'exhausted', 'unconfigured'].includes(weekly.status));
    } finally {
      if (previousDailyLimit === undefined) {
        delete process.env.CODEX_DAILY_TOKEN_LIMIT;
      } else {
        process.env.CODEX_DAILY_TOKEN_LIMIT = previousDailyLimit;
      }
    }
  });

  it('protects unknown database table reads with a validation response', async () => {
    const { response, body } = await getJson('/api/databases/unknown.sqlite/tables/missing');

    assert.equal(response.status, 400);
    assert.equal(body.error, 'unknown_database');
    assert.ok(Array.isArray(body.allowed));
  });
});
