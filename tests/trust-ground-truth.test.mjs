import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGroundTruthProtection } from '../lib/evaluation/truth-validator.mjs';
import { buildIsolatedReviewInput } from '../lib/evaluation/runner.mjs';

test('Ground truth protection flags forbidden leaked answer keys', () => {
  const safeReview = {
    documents: [{ text: 'Sample artwork' }],
    options: { completeArtwork: true },
  };
  const safeCheck = checkGroundTruthProtection(safeReview);
  assert.equal(safeCheck.leaked, false);
  assert.equal(safeCheck.violations.length, 0);

  const leakedReview = {
    documents: [{ text: 'Artwork' }],
    expectedOutcome: 'issue',
    mutationManifest: { plantedDefect: 'Tree nuts' },
  };
  const leakCheck = checkGroundTruthProtection(leakedReview);
  assert.equal(leakCheck.leaked, true);
  assert.ok(leakCheck.violations.length >= 2);
});

test('buildIsolatedReviewInput strips protected evaluation answer keys from engine inputs', () => {
  const rawCase = {
    caseId: 'tc-isolated-01',
    expectedOutcome: 'issue',
    expectedRuleId: 'rules:EVAL-01',
    expectedField: 'net_quantity',
    reference: '16 FL OZ (473 mL)',
    artwork: ['NET WT 14 FL OZ'],
    metadata: {
      mutationManifest: { target: '14 FL OZ', defect: true },
      scoringKey: { passIfCaught: true },
    },
  };

  const reviewInput = buildIsolatedReviewInput(rawCase);
  const check = checkGroundTruthProtection(reviewInput);

  assert.equal(check.leaked, false, 'Isolated review input must have zero leaked ground truth keys');
  assert.ok(reviewInput.documents.length >= 2, 'Must contain artwork and rules/specs');
});
