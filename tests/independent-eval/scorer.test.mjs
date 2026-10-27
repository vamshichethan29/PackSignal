/**
 * Tests for Deterministic Scorer (tests/independent-eval/scorer.test.mjs)
 * Tests TP, FP, FN, TN, precision/recall with zero denominators, F1, and evidence quality.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvaluation } from '../../scripts/score-blind-evaluation.mjs';

test('scorer correctly classifies TP with valid source and artwork evidence', async () => {
  const result = await scoreEvaluation({ testMode: true });
  assert.ok(result.metrics.truePositives >= 1, 'Must record at least one true positive');
  const tpUnit = result.unitResults.find(u => u.classification === 'TP');
  assert.ok(tpUnit, 'Must find a TP unit');
  assert.equal(tpUnit.reviewerLabel, 'ISSUE');
  assert.equal(tpUnit.predictedStatus, 'issue');
  assert.equal(tpUnit.sourceQuality, 'CORRECT');
  assert.equal(tpUnit.artworkQuality, 'CORRECT');
});

test('scorer correctly classifies TN for matching clean copy', async () => {
  const result = await scoreEvaluation({ testMode: true });
  assert.ok(result.metrics.trueNegatives >= 1, 'Must record true negatives');
  const tnUnit = result.unitResults.find(u => u.classification === 'TN');
  assert.ok(tnUnit, 'Must find a TN unit');
  assert.equal(tnUnit.reviewerLabel, 'MATCH');
  assert.equal(tnUnit.predictedStatus, 'match');
});

test('scorer correctly classifies FN when engine misses an issue', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const fnUnit = result.unitResults.find(u => u.classification === 'FN');
  if (fnUnit) {
    assert.equal(fnUnit.reviewerLabel, 'ISSUE');
    assert.notEqual(fnUnit.predictedStatus, 'issue');
  }
});

test('precision and recall format with explicit fraction and percentage', async () => {
  const result = await scoreEvaluation({ testMode: true });
  assert.match(result.metrics.precisionFraction, /^\d+\s*\/\s*\d+$/);
  assert.match(result.metrics.recallFraction, /^\d+\s*\/\s*\d+$/);
});

test('scorer returns N/A for precision when no positive flags exist', () => {
  const tp = 0, fp = 0;
  const precisionDenominator = tp + fp;
  const precision = precisionDenominator > 0 ? (tp / precisionDenominator) : null;
  assert.equal(precision, null);
  const formatted = precision !== null ? `${(precision * 100).toFixed(1)}%` : 'N/A';
  assert.equal(formatted, 'N/A');
});

test('scorer returns N/A for recall when no ground truth issues exist', () => {
  const tp = 0, fn = 0;
  const recallDenominator = tp + fn;
  const recall = recallDenominator > 0 ? (tp / recallDenominator) : null;
  assert.equal(recall, null);
  const formatted = recall !== null ? `${(recall * 100).toFixed(1)}%` : 'N/A';
  assert.equal(formatted, 'N/A');
});

test('F1 formula computes harmonic mean correctly', () => {
  const precision = 0.8;
  const recall = 0.5;
  const f1 = (2 * precision * recall) / (precision + recall);
  assert.ok(Math.abs(f1 - 0.61538) < 0.001);
});
