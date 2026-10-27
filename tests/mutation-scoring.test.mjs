/**
 * PackSignal Mutation Scoring Unit Tests (tests/mutation-scoring.test.mjs)
 * Phase 27: Mathematical verification of TP, FN, FP, TN, Recall, Precision, Specificity, F1.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreMutationFinding,
  computeBenchmarkMetrics,
} from '../lib/benchmark/mutation-scoring.mjs';

test('1. True positive correctly classified when engine reports matching defect', () => {
  const manifest = {
    mutationId: 'A1',
    family: 'family-a-allergens',
    targetField: 'allergen_statement',
    expectedRuleId: 'RULE-A-ALLERGEN',
    expectedFindingType: 'issue',
  };

  const actualFindings = [
    {
      id: 'f1',
      status: 'issue',
      rule: { id: 'RULE-A-ALLERGEN', field: 'allergen_statement' },
      explanation: 'Allergen statement missing',
    }
  ];

  const score = scoreMutationFinding(manifest, actualFindings, []);
  assert.equal(score.classification, 'CAUGHT');
  assert.equal(score.isCatch, true);
  assert.ok(score.details.includes('allergen_statement'));
});

test('2. False negative correctly classified when engine fails to detect defect', () => {
  const manifest = {
    mutationId: 'B1',
    family: 'family-b-barcodes',
    targetField: 'gtin',
    expectedRuleId: 'RULE-B-GTIN',
    expectedFindingType: 'issue',
  };

  // Engine produced only match findings or unrelated warning
  const actualFindings = [
    { id: 'f2', status: 'match', rule: { id: 'RULE-B-GTIN' } }
  ];

  const score = scoreMutationFinding(manifest, actualFindings, []);
  assert.equal(score.classification, 'MISSED');
  assert.equal(score.isCatch, false);
});

test('3. Unrelated issue is not credited as a catch', () => {
  const manifest = {
    mutationId: 'B1',
    family: 'family-b-barcodes',
    targetField: 'gtin',
    expectedRuleId: 'RULE-B-GTIN',
    expectedFindingType: 'issue',
  };

  // Engine reported an unrelated typography issue
  const actualFindings = [
    { id: 'f3', status: 'issue', rule: { id: 'RULE-TYPOGRAPHY', field: 'typography' } }
  ];

  const score = scoreMutationFinding(manifest, actualFindings, []);
  assert.equal(score.classification, 'MISSED');
});

test('4. Clean control passed with zero false alarms is classified as CLEAN_PASSED (TN)', () => {
  const manifest = {
    mutationId: 'CTRL-A',
    isCleanControl: true,
  };

  const actualFindings = [
    { id: 'f4', status: 'match', title: 'Allergen check passed' }
  ];

  const score = scoreMutationFinding(manifest, actualFindings, []);
  assert.equal(score.classification, 'CLEAN_PASSED');
  assert.equal(score.isClean, true);
  assert.equal(score.isFalseAlarm, false);
});

test('5. Clean control reporting unexpected defect issue is classified as FALSE_ALARM (FP)', () => {
  const manifest = {
    mutationId: 'CTRL-A',
    isCleanControl: true,
  };

  const actualFindings = [
    { id: 'f5', status: 'issue', title: 'Unexpected defect assertion on clean property' }
  ];

  const score = scoreMutationFinding(manifest, actualFindings, []);
  assert.equal(score.classification, 'FALSE_ALARM');
  assert.equal(score.isFalseAlarm, true);
});

test('6. Metric formulas: Recall, Precision, Specificity, F1 computed correctly', () => {
  // Mock 10 cases: 7 TP, 1 FN, 1 FP (false alarm on clean), 1 TN (clean pass)
  const mockCases = [
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-a-allergens' },
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-a-allergens' },
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-b-barcodes' },
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-b-barcodes' },
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-c-nutrition' },
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-c-nutrition' },
    { classification: 'CAUGHT', isCleanControl: false, family: 'family-d-quantity-claims' },
    { classification: 'MISSED', isCleanControl: false, family: 'family-e-prepress' },
    { classification: 'CLEAN_PASSED', isCleanControl: true, family: 'family-a-allergens' },
    { classification: 'FALSE_ALARM', isCleanControl: true, family: 'family-b-barcodes' },
  ];

  const metrics = computeBenchmarkMetrics(mockCases);

  assert.equal(metrics.tp, 7);
  assert.equal(metrics.fn, 1);
  assert.equal(metrics.fp, 1);
  assert.equal(metrics.tn, 1);

  // Recall = 7 / (7 + 1) = 87.5%
  assert.equal(metrics.recall, 87.5);
  assert.equal(metrics.recallFormatted, '87.5%');

  // Precision = 7 / (7 + 1) = 87.5%
  assert.equal(metrics.precision, 87.5);

  // Specificity = 1 / (1 + 1) = 50.0%
  assert.equal(metrics.specificity, 50.0);

  // F1 = 2 * 0.875 * 0.875 / (0.875 + 0.875) = 0.875
  assert.equal(metrics.f1, 0.875);
});

test('7. Zero-denominator edge cases safely return N/A without division by zero', () => {
  const metrics = computeBenchmarkMetrics([]);

  assert.equal(metrics.tp, 0);
  assert.equal(metrics.fn, 0);
  assert.equal(metrics.recall, null);
  assert.equal(metrics.recallFormatted, 'N/A');
  assert.equal(metrics.precision, null);
  assert.equal(metrics.precisionFormatted, 'N/A');
  assert.equal(metrics.f1, null);
  assert.equal(metrics.f1Formatted, 'N/A');
});
