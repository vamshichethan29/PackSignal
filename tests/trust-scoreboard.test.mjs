import test from 'node:test';
import assert from 'node:assert/strict';
import { runMutationBenchmark } from '../lib/benchmark/mutation-runner.mjs';

test('Trust Scoreboard Export - formats reproducible evaluation report schema', async () => {
  const runResult = await runMutationBenchmark({ seed: 20261025, maxCases: 10 });
  
  // Verify mandatory schema fields for export
  assert.ok(runResult.runId);
  assert.ok(runResult.startedAt);
  assert.ok(runResult.finishedAt);
  assert.equal(runResult.seed, 20261025);
  assert.ok(runResult.engineVersion);
  assert.ok(runResult.benchmarkVersion);
  assert.ok(runResult.disclaimer.includes('Controlled synthetic mutation benchmark'));
  assert.ok(runResult.summary);
  assert.ok(runResult.cases);
  assert.ok(runResult.cases.length <= 10);

  // Each case contains necessary metadata for drilldown inspection
  for (const c of runResult.cases) {
    assert.ok(c.id);
    assert.ok(c.family);
    assert.ok(c.classification);
    assert.ok(typeof c.elapsedMs === 'number');
    assert.ok(c.groundTruth);
  }
});

test('Trust Scoreboard Metric Calculation - handles empty or partial cases without division by zero', async () => {
  const { computeBenchmarkMetrics } = await import('../lib/benchmark/mutation-scoring.mjs');
  const emptyMetrics = computeBenchmarkMetrics([]);

  assert.equal(emptyMetrics.tp, 0);
  assert.equal(emptyMetrics.fn, 0);
  assert.equal(emptyMetrics.fp, 0);
  assert.equal(emptyMetrics.tn, 0);
  assert.equal(emptyMetrics.recall, null);
  assert.equal(emptyMetrics.recallFormatted, 'N/A');
  assert.equal(emptyMetrics.precision, null);
  assert.equal(emptyMetrics.precisionFormatted, 'N/A');
  assert.equal(emptyMetrics.specificity, null);
  assert.equal(emptyMetrics.specificityFormatted, 'N/A');
  assert.equal(emptyMetrics.f1, null);
  assert.equal(emptyMetrics.f1Formatted, 'N/A');
});

test('Trust Scoreboard Family Grouping - organizes all 5 families', async () => {
  const { computeBenchmarkMetrics } = await import('../lib/benchmark/mutation-scoring.mjs');
  const mockCases = [
    { family: 'family-a-allergens', classification: 'CAUGHT', isCleanControl: false },
    { family: 'family-a-allergens', classification: 'MISSED', isCleanControl: false },
    { family: 'family-b-barcodes', classification: 'CAUGHT', isCleanControl: false },
    { family: 'family-c-nutrition', classification: 'CAUGHT', isCleanControl: false },
    { family: 'family-d-quantity-claims', classification: 'CAUGHT', isCleanControl: false },
    { family: 'family-e-prepress', classification: 'CAUGHT', isCleanControl: false },
    { family: 'family-a-allergens', classification: 'CLEAN_PASSED', isCleanControl: true },
  ];

  const metrics = computeBenchmarkMetrics(mockCases);
  assert.equal(metrics.tp, 5);
  assert.equal(metrics.fn, 1);
  assert.equal(metrics.tn, 1);
  assert.equal(metrics.familyBreakdown['family-a-allergens'].caught, 1);
  assert.equal(metrics.familyBreakdown['family-a-allergens'].missed, 1);
  assert.equal(metrics.familyBreakdown['family-b-barcodes'].caught, 1);
});
