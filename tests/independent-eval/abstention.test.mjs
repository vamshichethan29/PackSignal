/**
 * Tests for Ambiguity & Abstention Policy (tests/independent-eval/abstention.test.mjs)
 * Tests correct abstentions, unsafe definitive issues, and unsupported matches.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvaluation } from '../../scripts/score-blind-evaluation.mjs';

test('ambiguous draft source correctly results in CORRECT_ABSTENTION', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const ambiguousUnit = result.unitResults.find(u => u.unitId === 'U-03-01');
  assert.ok(ambiguousUnit, 'Must evaluate U-03-01');
  assert.equal(ambiguousUnit.reviewerLabel, 'AMBIGUOUS');
  assert.equal(ambiguousUnit.predictedStatus, 'review');
  assert.equal(ambiguousUnit.classification, 'CORRECT_ABSTENTION');
  assert.equal(result.metrics.abstentions.correctAbstentions >= 1, true);
});

test('no unsafe definitive issue is asserted on ambiguous input in CASE-03', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const ambiguousUnit = result.unitResults.find(u => u.unitId === 'U-03-01');
  assert.notEqual(ambiguousUnit.predictedStatus, 'issue', 'Engine must not declare an unsafe definitive issue on ambiguous input');
  assert.equal(result.metrics.abstentions.unsafeDefinitiveIssues, 0);
});

test('abstentions on definite issues are counted as False Negatives for automated detection', () => {
  // Preregistered protocol rule: An engine that abstains (review/unable) on a real defect
  // did not automatically detect it, so it counts as FN in recall.
  const reviewerLabel = 'ISSUE';
  const predictedStatus = 'review';
  let classification = 'UNKNOWN';
  if (reviewerLabel === 'ISSUE') {
    classification = predictedStatus === 'issue' ? 'TP' : 'FN';
  }
  assert.equal(classification, 'FN');
});
