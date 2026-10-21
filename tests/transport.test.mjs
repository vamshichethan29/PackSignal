import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_MAX_ATTEMPTS = '2';
process.env.GEMINI_MAX_REQUESTS_PER_SESSION = '8';
process.env.GEMINI_MAX_REQUESTS_PER_MINUTE = '5';
process.env.GEMINI_MIN_INTERVAL_MS = '1000';

const { geminiRequest, geminiStatus, projectWindowDelay, shouldFailoverCredential } = await import('../lib/gemini-transport.mjs?rate-pool-test');
const overloadTransport = await import('../lib/gemini-transport.mjs?provider-overload-test');

const response = (status, payload, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: name => headers[name.toLowerCase()] || null },
  json: async () => payload,
});

test('retries a temporary provider error with the same credential and cools down failing key while alternate key succeeds', async () => {
  const credentials = [];
  let calls = 0;
  const fetcher = async (_url, options) => {
    credentials.push(options.headers['x-goog-api-key']);
    calls += 1;
    if (calls === 1) return response(503, { error: { message: 'temporary' } }, { 'retry-after': '0' });
    return response(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
  };

  const completed = await geminiRequest('test-key-A', 'gemini-test', '{}', fetcher);
  assert.equal(completed.transport.attempts, 2);
  assert.deepEqual(credentials, ['test-key-A', 'test-key-A']);

  // Daily quota 429 on key-A cools down only key-A; key-B is unaffected and can succeed.
  const quotaFetcher = async () => response(429, {
    error: {
      details: [{
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        violations: [{ quotaValue: '0', quotaId: 'requests-per-day' }],
      }],
    },
  }, { 'retry-after': '0' });

  await assert.rejects(
    geminiRequest('test-key-A', 'gemini-test', '{}', quotaFetcher),
    error => error.code === 'GEMINI_KEY_QUOTA',
  );

  // key-A is on per-key cooldown, so it immediately rejects with PROVIDER_COOLDOWN.
  await assert.rejects(
    geminiRequest('test-key-A', 'gemini-test', '{}', async () => {}),
    error => error.code === 'PROVIDER_COOLDOWN',
  );

  // key-B is a different account key and is NOT blocked by key-A's quota.
  const successFetcher = async () =>
    response(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
  const altResult = await geminiRequest('test-key-B', 'gemini-test', '{}', successFetcher);
  assert.equal(altResult.transport.attempts, 1);

  // Failover classification: per-key quota triggers failover; pool-wide outages do not.
  assert.equal(shouldFailoverCredential({ code: 'GEMINI_KEY_QUOTA', message: 'key quota exhausted' }), true);
  assert.equal(shouldFailoverCredential({ code: 'PROVIDER_COOLDOWN', message: 'credential cooling down' }), true);
  assert.equal(shouldFailoverCredential({ code: 'GEMINI_PROVIDER_OVERLOADED', message: 'overloaded' }), false);
  assert.equal(shouldFailoverCredential({ code: 'PROVIDER_OVERLOAD_COOLDOWN', message: 'paused' }), false);
});

test('rate-limits all configured API keys through one shared rolling project window', () => {
  const starts = [1000, 13000, 25000, 37000, 49000];
  assert.equal(projectWindowDelay(starts, 50000, 5), 11000);
  assert.equal(projectWindowDelay(starts, 61000, 5), 0);
  const status = geminiStatus(5);
  assert.equal(status.maxRequestsPerMinute, 5);
  assert.equal(status.configuredCredentials, 5);
});

test('HTTP 503 cooldown pauses the whole API-key pool instead of probing every key', async () => {
  let calls = 0;
  const overloaded = async () => {
    calls++;
    return response(503, { error: { message: 'temporary overload' } }, { 'retry-after': '0' });
  };
  await assert.rejects(
    overloadTransport.geminiRequest('test-key-A', 'gemini-test', '{}', overloaded),
    error => error.code === 'GEMINI_PROVIDER_OVERLOADED',
  );
  assert.equal(calls, 2, 'the same credential receives only the configured bounded retries');
  assert.equal(overloadTransport.geminiStatus().cooldownScope, 'provider');
  assert.equal(shouldFailoverCredential({ code: 'GEMINI_PROVIDER_OVERLOADED', message: 'temporarily overloaded' }), false);
  await assert.rejects(
    overloadTransport.geminiRequest('test-key-B', 'gemini-test', '{}', async () => { calls++; }),
    error => error.code === 'PROVIDER_OVERLOAD_COOLDOWN',
  );
  assert.equal(calls, 2, 'a second API key does not retry the same provider outage');
});
