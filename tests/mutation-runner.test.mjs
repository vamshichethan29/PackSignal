import test from 'node:test';
import assert from 'node:assert/strict';
import { runMutationBenchmark } from '../lib/benchmark/mutation-runner.mjs';
import { ALL_MUTATION_OPERATORS, ALL_CLEAN_CONTROLS } from '../lib/benchmark/mutation-operators.mjs';
import { analyze } from '../lib/engine.mjs';

test('Mutation Runner - runs full benchmark suite deterministically', async () => {
  const result1 = await runMutationBenchmark({ seed: 20261025, tier: 'deterministic' });
  assert.equal(result1.summary.totalEligibleMutations, 31);
  assert.equal(result1.summary.totalCleanControls, 5);
  assert.equal(result1.cases.length, 36);
  assert.equal(result1.summary.tp, 31);
  assert.equal(result1.summary.recall, 100);
  assert.equal(result1.summary.fn, 0);

  const result2 = await runMutationBenchmark({ seed: 20261025, tier: 'deterministic' });
  assert.equal(result1.runId !== result2.runId, true); // unique run IDs
  assert.equal(result1.summary.tp, result2.summary.tp);
  assert.equal(result1.summary.tn, result2.summary.tn);
});

test('Mutation Runner - isolates engine input (no answer keys leak)', async () => {
  const result = await runMutationBenchmark({ seed: 12345, maxCases: 3 });
  assert.ok(result.cases.length <= 3);

  for (const c of result.cases) {
    assert.ok(c.id);
    assert.ok(c.classification);
    assert.ok(c.elapsedMs >= 0);
  }
});

test('Mutation Runner - respects maxCases limiter', async () => {
  const partial = await runMutationBenchmark({ maxCases: 5 });
  assert.equal(partial.cases.length, 5);
});

test('Phase 30: Test an intentionally weaker engine double for metric integrity', async () => {
  // Create a weakened engine double that intentionally ignores barcode quiet zone violations (B5)
  const intentionallyWeakenedEngine = (review) => {
    const realResult = analyze(review);
    // Strip out barcode quiet zone issues to simulate a missed defect
    const filteredFindings = (realResult.findings || []).filter(f => 
      f.check !== 'barcode_quiet_zone' &&
      !f.title?.toLowerCase().includes('quiet zone')
    );
    return {
      ...realResult,
      findings: filteredFindings
    };
  };

  const weakenedRun = await runMutationBenchmark({
    engineDouble: intentionallyWeakenedEngine,
    tier: 'deterministic'
  });

  // Verify that the benchmark honestly reflects the missed defect!
  assert.equal(weakenedRun.summary.totalEligibleMutations, 31);
  assert.equal(weakenedRun.summary.tp, 30);
  assert.equal(weakenedRun.summary.fn, 1);
  
  // Mutation recall should be 30 / 31 = 96.8%
  assert.equal(weakenedRun.summary.recall, 96.8);

  // Verify the specific missed case is B5 (quiet zone violation)
  const missedB5 = weakenedRun.cases.find(c => c.id === 'B5');
  assert.ok(missedB5);
  assert.equal(missedB5.classification, 'MISSED');
  assert.equal(missedB5.isCleanControl, false);
});
