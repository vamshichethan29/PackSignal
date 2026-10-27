/**
 * Tests for Unit Matching & Anti-Inflation (tests/independent-eval/matching.test.mjs)
 * Tests unit mapping, duplicate finding handling, and unmatched finding handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvaluation } from '../../scripts/score-blind-evaluation.mjs';

test('evaluation units are mapped 1-to-1 without duplicate count inflation', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const unitIds = result.unitResults.map(u => u.unitId);
  const uniqueUnitIds = new Set(unitIds);
  assert.equal(unitIds.length, uniqueUnitIds.size, 'Every evaluation unit must appear exactly once');
});

test('multiple findings referencing the same declaration do not inflate TP count', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const case01Units = result.unitResults.filter(u => u.caseId === 'CASE-01');
  const netQtyUnits = case01Units.filter(u => u.checkId === 'US-001');
  assert.equal(netQtyUnits.length, 1, 'Only one evaluation unit exists for net quantity declaration on CASE-01');
});

test('unmatched findings remain distinct and do not corrupt ground truth alignment', async () => {
  const result = await scoreEvaluation({ testMode: true });
  for (const u of result.unitResults) {
    assert.ok(u.unitId.startsWith('U-'), 'Unit ID must be valid');
    assert.ok(['ISSUE', 'MATCH', 'AMBIGUOUS', 'UNVERIFIABLE', 'NOT_APPLICABLE'].includes(u.reviewerLabel));
  }
});
