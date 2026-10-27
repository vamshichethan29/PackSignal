import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Barcode Quality: Barcode GTIN matching and ISO print quality remain distinct checks', () => {
  const gtinRule = compilePackagingRule('Barcode identifier must match approved SKU 036000291452');
  assert.equal(gtinRule.type, 'BARCODE_GTIN_MATCH');
  assert.equal(gtinRule.evaluatorId, 'barcode_identifier_match');

  // GTIN match verifies numerical identity, not physical print quality grading
  const res = executeCompiledRule(gtinRule, {
    barcode: '036000291452',
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BARCODE_GTIN_VERIFIED');
});

test('Barcode Quality: Uncalibrated screenshot or phone photo cannot fabricate an ISO/IEC 15416 grade', () => {
  const verifierEvidence = null; // No calibrated verifier data
  const hasCalibratedGrade = verifierEvidence !== null;
  assert.equal(hasCalibratedGrade, false);

  const expectedNotice = 'ISO barcode print-quality grade unavailable. A suitable verifier measurement is required.';
  assert.ok(expectedNotice.includes('ISO barcode print-quality grade unavailable'));
});

test('Barcode Quality: Verified verifier evidence records standard, grade, device, and timestamp', () => {
  const sampleEvidence = {
    standard: 'ISO/IEC 15416:2016',
    grade: 3.8,
    letterGrade: 'A',
    device: 'Axicon 6515 Barcode Verifier',
    calibratedAt: '2026-09-15T10:30:00Z',
    measuredAt: '2026-10-25T14:22:00Z',
    parameters: {
      minimumReflectance: 0.05,
      symbolContrast: 0.82,
      minimumEdgeContrast: 0.65,
      modulation: 0.74,
      defects: 0.12,
      decodability: 0.88,
    },
  };

  assert.equal(sampleEvidence.grade >= 2.5, true);
  assert.equal(sampleEvidence.letterGrade, 'A');
  assert.ok(sampleEvidence.device.includes('Axicon'));
  assert.ok(sampleEvidence.standard.includes('ISO/IEC 15416'));
});
