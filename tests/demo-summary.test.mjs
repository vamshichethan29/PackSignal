import test from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';

test('Dancing Fish verification produces honest adjudicated counts (not 16/16 defects)', () => {
  const result = runOrganizerVerification();
  const suite = result.dancingFish16;

  assert.ok(suite, 'Dancing Fish 16 suite must exist');
  assert.equal(suite.summary.total, 16, 'Total candidate checks must be 16');
  assert.equal(suite.summary.evaluated, 16, 'All 16 candidate checks must be evaluated');

  // Must NOT hardcode 16 detected defects
  assert.notEqual(suite.summary.issues, 16, 'Engine must NOT claim 16 defects');
  assert.equal(suite.summary.issues, 10, 'Confirmed issues must be exactly 10');
  assert.equal(suite.summary.reviews, 5, 'Needs review checks must be exactly 5');
  assert.equal(suite.summary.matches, 1, 'Verified matches must be exactly 1');
  assert.equal(suite.summary.unable, 0, 'Unable to verify must be 0');

  // Positive controls are strictly separate
  assert.equal(suite.summary.positiveControls.total, 1, 'Positive controls must be tracked separately');
  assert.equal(suite.summary.positiveControls.passed, 1, 'UPC positive control must pass');
});

test('UPC Barcode positive control P01 is not counted as a defect', () => {
  const suite = getDancingFish16Checks();
  const p01 = suite.positiveControl;

  assert.ok(p01, 'P01 positive control must exist');
  assert.equal(p01.canonicalId, 'P01');
  assert.equal(p01.status, 'match', 'UPC check digit must be a match');
  assert.equal(p01.checkType, 'BARCODE_CHECK_DIGIT');

  // Verify P01 is NOT among the 10 issues
  const issueIds = suite.checks.filter(c => c.status === 'issue').map(c => c.canonicalId);
  assert.ok(!issueIds.includes('P01'), 'P01 must NOT be counted as an issue');
});

test('Review warnings under Draft source status are not counted as confirmed defects', () => {
  const suite = getDancingFish16Checks();
  assert.equal(suite.sourceAuthority, 'Draft / In Review');

  const reviews = suite.checks.filter(c => c.status === 'review');
  assert.equal(reviews.length, 5, 'Must have 5 checks requiring human review');

  // DF-05 (Vegan vs Honey) and DF-10 (Atwater arithmetic) are reviews
  const df05 = suite.checks.find(c => c.canonicalId === 'DF-05');
  assert.equal(df05.status, 'review', 'DF-05 Honey vs Vegan must be review, not confirmed issue');

  const df10 = suite.checks.find(c => c.canonicalId === 'DF-10');
  assert.equal(df10.status, 'review', 'DF-10 Atwater math must be review, not confirmed issue');
});

test('Finding coordinates and citations exist for top featured findings', () => {
  const suite = getDancingFish16Checks();
  const df01 = suite.checks.find(c => c.canonicalId === 'DF-01');

  assert.ok(df01, 'DF-01 must exist');
  assert.equal(df01.artworkQuote, 'Honey (1%)');
  assert.equal(df01.sourceQuote, 'Honey (9%)');
  assert.equal(df01.sourceCell, 'B26');
  assert.ok(Array.isArray(df01.artworkBoundingBox), 'Bounding box must be an array');
  assert.equal(df01.artworkBoundingBox.length, 4, 'Bounding box must have [top, left, width, height]');
});
