import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEvaluationMetrics } from '../lib/evaluation/metrics.mjs';

test('computeEvaluationMetrics calculates precision, recall, F1, and caught X of Y correctly', () => {
  const outcomes = [
    // 3 defects: 2 caught (TP), 1 missed (FN)
    { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'CORRECT_DETECTION' }, elapsedMs: 1 },
    { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'CORRECT_DETECTION' }, elapsedMs: 1 },
    { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'MISSED_DEFECT' }, elapsedMs: 1 },
    // 2 clean controls: 1 passed (TN), 1 false positive (FP)
    { evalCase: { expectedOutcome: 'match' }, matchedResult: { classification: 'TRUE_NEGATIVE' }, elapsedMs: 1 },
    { evalCase: { expectedOutcome: 'match' }, matchedResult: { classification: 'FALSE_POSITIVE' }, elapsedMs: 1 },
  ];

  const m = computeEvaluationMetrics(outcomes);

  assert.equal(m.caughtX, 2);
  assert.equal(m.attemptedY, 3);
  assert.equal(m.detectionRate, 66.7);

  // Precision: TP / (TP + FP) = 2 / (2 + 1) = 66.7%
  assert.equal(m.metrics.precision, '66.7%');

  // Recall: TP / (TP + FN) = 2 / (2 + 1) = 66.7%
  assert.equal(m.metrics.recall, '66.7%');

  // F1: 2 * (0.6667 * 0.6667) / (0.6667 + 0.6667) = 66.7%
  assert.equal(m.metrics.f1Score, '66.7%');

  // Specificity: TN / (TN + FP) = 1 / (1 + 1) = 50.0%
  assert.equal(m.metrics.specificity, '50.0%');

  // False positive rate: FP / (FP + TN) = 1 / (1 + 1) = 50.0%
  assert.equal(m.metrics.falsePositiveRate, '50.0%');
});

test('computeEvaluationMetrics safely handles zero denominators without NaN', () => {
  const emptyOutcomes = [];
  const m = computeEvaluationMetrics(emptyOutcomes);

  assert.equal(m.metrics.precision, 'N/A');
  assert.equal(m.metrics.recall, 'N/A');
  assert.equal(m.metrics.f1Score, 'N/A');
  assert.equal(m.caughtX, 0);
  assert.equal(m.attemptedY, 0);
});

test('computeEvaluationMetrics excludes invalid fixtures from denominator Y', () => {
  const outcomes = [
    { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'CORRECT_DETECTION' }, elapsedMs: 1 },
    { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'INVALID_FIXTURE' }, elapsedMs: 0 },
  ];

  const m = computeEvaluationMetrics(outcomes);
  assert.equal(m.attemptedY, 1, 'Invalid fixture must not be included in eligible denominator Y');
  assert.equal(m.caughtX, 1);
  assert.equal(m.counts.invalidFixturesExcluded, 1);
});
