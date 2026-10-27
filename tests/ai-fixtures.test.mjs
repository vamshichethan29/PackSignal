import test from 'node:test';
import assert from 'node:assert/strict';
import { AiFixtureAdapter, AI_MODES } from '../lib/ai-fixture-adapter.mjs';

test('Phase 2 Test 1: Recorded response validates against schema', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  const fixture = await adapter.fetchFixture('artwork_transcription');

  assert.equal(fixture.taskName, 'artwork_transcription');
  assert.equal(fixture.schemaVersion, '1.0');
  assert.equal(fixture.status, 'success');
  assert.ok(fixture.output.pages.length > 0);
});

test('Phase 2 Test 2: Invalid JSON or malformed payload is rejected', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  assert.throws(() => {
    adapter.validateFixturePayload('not a json object');
  }, /must be a JSON object/);
});

test('Phase 2 Test 3: Fixture missing required schema fields is rejected', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  assert.throws(() => {
    adapter.validateFixturePayload({ taskName: 'foo' });
  }, /missing required field/);
});

test('Phase 2 Test 4: Secret material is detected and rejected by validation', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  const tainted = {
    taskName: 'test',
    promptVersion: '1.0',
    schemaVersion: '1.0',
    modelIdentifier: 'gemini',
    status: 'success',
    apiKey: 'AIzaSyA_FakeApiKeyForTestingSanitization1234',
  };
  assert.throws(() => {
    adapter.validateFixturePayload(tainted);
  }, /Security violation/);
});

test('Phase 2 Test 5: A changed prompt version invalidates stale cache', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  await assert.rejects(async () => {
    await adapter.fetchFixture('artwork_transcription', { promptVersion: '2.5-unmatched' });
  }, /Stale fixture: expected promptVersion/);
});

test('Phase 2 Test 6: A changed file hash invalidates cache', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  await assert.rejects(async () => {
    await adapter.fetchFixture('artwork_transcription', { inputHash: '0000000000000000' });
  }, /Stale fixture: inputHash mismatch/);
});

test('Phase 2 Test 7: Provider error fixture is handled gracefully without crashing', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  await assert.rejects(async () => {
    await adapter.executeTask('provider_error');
  }, /Replayed Provider Error/);
});

test('Phase 2 Test 8: OFFLINE_DETERMINISTIC mode bypasses AI cleanly', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.OFFLINE_DETERMINISTIC });
  const result = await adapter.executeTask('artwork_transcription', async () => {
    throw new Error('Should not invoke live executor in offline deterministic mode');
  });
  assert.equal(result, null, 'Deterministic mode returns null to signal deterministic fallback');
});

test('Phase 2 Test 9: Recorded fixture produces repeatable deterministic results across repeated invocations', async () => {
  const adapter = new AiFixtureAdapter({ mode: AI_MODES.REPLAY });
  const res1 = await adapter.fetchFixture('source_facts');
  const res2 = await adapter.fetchFixture('source_facts');
  assert.deepEqual(res1, res2);
  assert.equal(res1.output.productName, 'Granola Berry Crunch');
});

test('Phase 2 Test 10: Secret material is sanitized automatically on recording', async () => {
  const adapter = new AiFixtureAdapter();
  const rawWithSecret = {
    authHeader: 'Bearer secret_token_xyz_123',
    apiKey: 'AIzaSyA_TestKeyHere35CharactersLength12',
    data: 'ok'
  };
  const sanitized = adapter.sanitizeData(rawWithSecret);
  assert.equal(sanitized.authHeader, '[REDACTED_CREDENTIAL]');
  assert.equal(sanitized.apiKey, '[REDACTED_CREDENTIAL]');
});
