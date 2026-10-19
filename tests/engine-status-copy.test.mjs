import test from 'node:test';
import assert from 'node:assert/strict';
import { engineStatusCopy } from '../public/engine-status-copy.js';

test('configured AI status describes bounded retries without claiming a live request', () => {
  const copy = engineStatusCopy({
    aiConnection: 'configured',
    aiUsage: { minIntervalMs: 6000, lastOutcome: 'No live request yet' },
  });
  assert.match(copy.connection, /credentials are configured/i);
  assert.match(copy.connection, /retries are bounded/i);
  assert.match(copy.lastDispatch, /No live request yet/);
  assert.match(copy.failover, /extra keys do not multiply a shared project quota/i);
  assert.match(copy.credentials, /browser never receives/i);
  assert.doesNotMatch(copy.connection, /operational and verified|cluster active/i);
});

test('verified status reports only the most recent request outcome', () => {
  const copy = engineStatusCopy({ aiConnection: 'verified' });
  assert.match(copy.connection, /most recent live AI request completed/i);
  assert.match(copy.connection, /Future availability can still vary/i);
});

test('attention and running states accurately distinguish current failures from active requests', () => {
  const attention = engineStatusCopy({
    aiConnection: 'attention',
    aiUsage: { lastOutcome: 'Network unavailable' },
  });
  const running = engineStatusCopy({ aiConnection: 'running' });
  assert.match(attention.connection, /needs attention \(Network unavailable\)/);
  assert.match(attention.connection, /Exact checks remain available/);
  assert.match(running.connection, /request is running now/i);
});

test('health copy reports the configured pacing, cooldown, and exhausted request allowance', () => {
  const copy = engineStatusCopy({
    aiUsage: {
      minIntervalMs: 12000,
      lastOutcome: 'HTTP 429',
      cooldownUntil: '2026-10-18T00:00:00.000Z',
      remainingAttempts: 0,
    },
  });
  assert.match(copy.pacing, /12 seconds/);
  assert.match(copy.pacing, /5 provider attempts per minute/);
  assert.equal(copy.cooldownUntil, '2026-10-18T00:00:00.000Z');
  assert.match(copy.allowance, /AI requests are paused for this session/i);
  assert.match(copy.allowance, /Exact checks and cached AI results remain available/i);
});
