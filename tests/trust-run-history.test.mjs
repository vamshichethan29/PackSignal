import test from 'node:test';
import assert from 'node:assert/strict';
import { persistEvaluationRun, getRunHistory, compareEvaluationRuns } from '../lib/evaluation/benchmark-store.mjs';

test('Benchmark store persists evaluation run and retrieves history', () => {
  const dummyRun = {
    runId: `run-test-hist-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    suiteVersion: '1.0.0-freeze',
    modelId: 'deterministic-local-engine',
    mode: 'deterministic',
    totalCases: 10,
    scoreboard: {
      headline: 'Caught 8 of 8 Planted Defects',
      caughtX: 8,
      attemptedY: 8,
      detectionRate: 100,
      precision: '100.0%',
      recall: '100.0%',
      f1Score: '100.0%',
      avgLatencyMs: 0.8,
    },
    outcomes: [
      { caseId: 'case-01', name: 'Case 01', pass: true, actual: 'issue' },
      { caseId: 'case-02', name: 'Case 02', pass: true, actual: 'match' },
    ],
  };

  const savedPath = persistEvaluationRun(dummyRun, { seed: 1234 });
  assert.ok(typeof savedPath === 'string');

  const history = getRunHistory();
  assert.ok(Array.isArray(history));
  const found = history.find(h => h.runId === dummyRun.runId);
  assert.ok(found, 'Saved run must exist in history log');
  assert.equal(found.caughtX, 8);
});

test('compareEvaluationRuns calculates shared case deltas and detects regressions', () => {
  const run1 = {
    runId: 'run-prev',
    scoreboard: { caughtX: 10, detectionRate: 100 },
    avgLatencyMs: 1.0,
    outcomes: [
      { caseId: 'tc-01', name: 'TC 01', pass: true, actual: 'issue' },
      { caseId: 'tc-02', name: 'TC 02', pass: true, actual: 'match' },
    ],
  };

  const run2 = {
    runId: 'run-curr',
    scoreboard: { caughtX: 9, detectionRate: 90 },
    avgLatencyMs: 1.2,
    outcomes: [
      { caseId: 'tc-01', name: 'TC 01', pass: true, actual: 'issue' },
      { caseId: 'tc-02', name: 'TC 02', pass: false, actual: 'issue', diagnostic: 'False alarm regression' },
    ],
  };

  const comp = compareEvaluationRuns(run1, run2);
  assert.equal(comp.sharedCasesCount, 2);
  assert.equal(comp.regressionsCount, 1);
  assert.equal(comp.regressions[0].caseId, 'tc-02');
  assert.equal(comp.deltas.caughtDelta, -1);
});
