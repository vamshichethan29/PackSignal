import test from 'node:test';
import assert from 'node:assert/strict';
import { runEvaluationSuite } from '../lib/evaluation/runner.mjs';

test('runEvaluationSuite emits progress callbacks and catches planted defects', () => {
  const events = [];
  const result = runEvaluationSuite(null, {
    seed: 42,
    onProgress(evt) {
      events.push(evt);
    },
  });

  assert.ok(events.length > 0, 'Progress events must be emitted');
  assert.equal(events[events.length - 1].percent, 100);

  assert.ok(result.runId.startsWith('run-'));
  assert.ok(result.scoreboard.caughtX > 0);
  assert.ok(result.outcomes.length > 0);
  assert.ok(result.avgLatencyMs >= 0);
});

test('runEvaluationSuite respects category filters', () => {
  const result = runEvaluationSuite(null, {
    seed: 42,
    category: 'quantity',
  });

  assert.ok(result.totalCases > 0);
  assert.ok(result.outcomes.every(o => o.category === 'quantity'));
});
