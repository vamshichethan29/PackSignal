import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';

test('DF-16: Content sheet draft status is recognized as governance blocker', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  assert.equal(result.sourceDoc.approvalStatus, 'Draft / In Review');
  assert.equal(result.sourceDoc.isDraft, true);

  const df16 = suite.checks.find(c => c.canonicalId === 'DF-16');
  assert.ok(df16);
  assert.equal(df16.sourceCell, 'E3');
  assert.equal(df16.sourceQuote, 'Draft / In Review');
  assert.equal(df16.status, 'review');
  assert.equal(df16.findingStatus, 'SOURCE_CONFIRMATION_REQUIRED');
  assert.match(df16.limitations, /draft source document/i);
});

test('DF-01: Honey percentage discrepancy preserves draft authority without false certainty', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const honeyCheck = suite.checks.find(c => c.canonicalId === 'DF-01');
  assert.ok(honeyCheck);
  assert.equal(honeyCheck.sourceCell, 'B26');
  assert.equal(honeyCheck.sourceQuote, 'Honey (9%)');
  assert.equal(honeyCheck.artworkQuote, 'Honey (1%)');
  assert.equal(honeyCheck.expectedValue, 'Honey (9%)');
  assert.equal(honeyCheck.observedValue, 'Honey (1%)');

  // Because content sheet is Draft / In Review, status is SOURCE_ARTWORK_MISMATCH, not CONFIRMED_ISSUE
  assert.equal(honeyCheck.findingStatus, 'SOURCE_ARTWORK_MISMATCH');
  assert.match(honeyCheck.limitations, /Draft \/ In Review/i);
  assert.equal(honeyCheck.department, 'R&D');
  assert.deepEqual(honeyCheck.collaborators, ['BRAND']);
});

test('Source authority prevents treating draft spreadsheet values as incontrovertible ground truth', () => {
  const result = runOrganizerVerification();
  const sheetLogic = result.candidateChecks.find(c => c.checkId === 'DF-CHK-SHEET-CARB-SUGAR-LOGIC');

  assert.ok(sheetLogic);
  assert.equal(sheetLogic.findingStatus, 'SOURCE_DOCUMENT_DEFECT');
  assert.match(sheetLogic.calculationProof, /SUGARS_EXCEED_CARBOHYDRATES/i);
});
