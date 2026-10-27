import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';

test('DF-13: Hidden EU nutrition table is detected by drawing sequence and excluded from visible copy checks', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const hiddenTable = suite.checks.find(c => c.canonicalId === 'DF-13');
  assert.ok(hiddenTable);
  assert.equal(hiddenTable.status, 'match');
  assert.equal(hiddenTable.visibilityStatus, 'POTENTIALLY_OCCLUDED');
  assert.equal(hiddenTable.findingStatus, 'OCCLUDED_OBJECT_DETECTED');
  assert.match(hiddenTable.calculationProof, /seqno 227/);
  assert.match(hiddenTable.calculationProof, /seqno 241/);

  // Hidden text must NOT produce a false printed issue in visible consumer copy
  const visibleSpans = result.artworkDoc.spansSummary;
  assert.ok(visibleSpans);
});

test('DF-12: Visible EU copy is evaluated separately from hidden EU text and does not claim illegal by default', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const euIcons = suite.checks.find(c => c.canonicalId === 'DF-12');
  assert.ok(euIcons);
  assert.equal(euIcons.status, 'review'); // Policy / company standard review, not automatic statutory crime
  assert.equal(euIcons.visibilityStatus, 'CONSUMER_VISIBLE');
  assert.equal(euIcons.department, 'BRAND');
  assert.match(euIcons.artworkQuote, /197kJ 4%/);
  assert.match(euIcons.artworkQuote, /Cereals Containing Gluten/);
});

test('Dieline production guides are classified as non-consumer text', () => {
  const result = runOrganizerVerification();
  const guideCheck = result.candidateChecks.find(c => c.checkId === 'DF-CHK-DIELINE-GUIDES');

  assert.ok(guideCheck);
  assert.equal(guideCheck.visibilityStatus, 'PRODUCTION_GUIDE');
  assert.equal(guideCheck.findingStatus, 'CLASSIFIED_PRODUCTION_GUIDE');
  assert.equal(guideCheck.status, 'match');
});
