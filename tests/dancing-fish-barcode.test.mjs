import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';
import { hasValidGtinCheckDigit, gtinDigits } from '../lib/gtin.mjs';

test('Positive Control P01: Barcode check digit validates GS1 Modulo-10 and passes as a clean control', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const barcodeCheck = suite.positiveControl;
  assert.ok(barcodeCheck);
  assert.equal(barcodeCheck.canonicalId, 'P01');
  assert.equal(barcodeCheck.status, 'match');
  assert.equal(barcodeCheck.isPositiveControl, true);
  assert.equal(barcodeCheck.findingStatus, 'BARCODE_CHECK_DIGIT_VALID');
  assert.match(barcodeCheck.sourceQuote, /1 20000 00003 6/);
  assert.match(barcodeCheck.calculationProof, /check digit 6/);

  // Pure GS1 calculation check
  const digits = gtinDigits('1 20000 00003 6');
  assert.equal(digits, '120000000036');
  assert.equal(hasValidGtinCheckDigit(digits), true);
});

test('Valid barcode checksum does not become a planted defect or count against recall', () => {
  const suite = getDancingFish16Checks();
  assert.equal(suite.summary.positiveControls.passed, 1);
  assert.equal(suite.summary.positiveControls.total, 1);
  assert.equal(suite.summary.issues, 10);
});
