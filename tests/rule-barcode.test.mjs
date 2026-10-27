import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';
import { hasValidGtinCheckDigit, canonicalGtin, gtinDigits } from '../lib/gtin.mjs';

test('Barcode GTIN: Validates GS1 Mod-10 check digit for GTIN-8, 12, 13, and 14', () => {
  // GTIN-8
  assert.equal(hasValidGtinCheckDigit('96385074'), true);
  assert.equal(hasValidGtinCheckDigit('96385075'), false);

  // GTIN-12 (UPC-A)
  assert.equal(hasValidGtinCheckDigit('036000291452'), true);
  assert.equal(hasValidGtinCheckDigit('036000291450'), false);
  assert.equal(hasValidGtinCheckDigit('120000000043'), true); // 12 digits valid

  // GTIN-13 (EAN-13)
  assert.equal(hasValidGtinCheckDigit('5012345678900'), true); // 13 digits
  assert.equal(hasValidGtinCheckDigit('5012345678901'), false);

  // GTIN-14 (ITF-14)
  assert.equal(hasValidGtinCheckDigit('10012345678902'), true);
  assert.equal(hasValidGtinCheckDigit('10012345678900'), false);
});

test('Barcode GTIN: Matches valid GTIN-8', () => {
  const rule = compilePackagingRule('Printed barcode must match GTIN-8 96385074');
  const res = executeCompiledRule(rule, {
    barcode: '96385074',
    facts: [{ field: 'gtin', value: '96385074' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BARCODE_GTIN_VERIFIED');
});

test('Barcode GTIN: Matches valid GTIN-12 (UPC-A)', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved UPC-A 036000291452');
  const res = executeCompiledRule(rule, {
    barcode: '036000291452',
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BARCODE_GTIN_VERIFIED');
});

test('Barcode GTIN: Matches valid GTIN-13 (EAN-13)', () => {
  const rule = compilePackagingRule('Printed EAN-13 code must match approved SKU 5012345678900');
  const res = executeCompiledRule(rule, {
    barcode: '5012345678900',
    facts: [{ field: 'gtin', value: '5012345678900' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BARCODE_GTIN_VERIFIED');
});

test('Barcode GTIN: Matches valid GTIN-14 (ITF-14 / Shipping Container)', () => {
  const rule = compilePackagingRule('Case pack barcode must match GTIN-14 10012345678902');
  const res = executeCompiledRule(rule, {
    barcode: '10012345678902',
    facts: [{ field: 'gtin', value: '10012345678902' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BARCODE_GTIN_VERIFIED');
});

test('Barcode GTIN: Preserves leading zeros during canonical comparison', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved SKU 036000291452');
  const res = executeCompiledRule(rule, {
    barcode: '036000291452',
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.ok(res.expected.includes('00036000291452'));
});

test('Barcode GTIN: Detects GTIN mismatch between specification and artwork', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved SKU 036000291452');
  const res = executeCompiledRule(rule, {
    barcode: '5012345678900', // Different barcode printed
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'BARCODE_GTIN_MISMATCH');
  assert.equal(res.checkVerdict, 'GTIN_MISMATCH');
});

test('Barcode GTIN: Detects invalid check digit on decoded barcode', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved SKU 036000291452');
  const res = executeCompiledRule(rule, {
    barcode: '036000291459', // Check digit 9 is invalid for 03600029145
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'GTIN_CHECK_DIGIT_INVALID');
});

test('Barcode GTIN: Missing decoded barcode returns UNABLE instead of claiming pass or false defect', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved SKU 036000291452');
  const res = executeCompiledRule(rule, {
    barcode: null,
    artworkText: 'No barcode symbols here',
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'unable');
  assert.equal(res.verdict, 'BARCODE_NOT_DECODED');
});

test('Barcode GTIN: Missing approved specification GTIN returns UNABLE with missing source fact', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved SKU specification.');
  const res = executeCompiledRule(rule, {
    barcode: '036000291452',
    facts: [], // Missing GTIN fact
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'unable');
  assert.equal(res.verdict, 'MISSING_SOURCE_FACT');
});

test('Barcode GTIN: Distinguishes GTIN identity matching from ISO/IEC 15416 print-quality verification', () => {
  const rule = compilePackagingRule('Barcode identifier must match approved SKU 036000291452');
  const res = executeCompiledRule(rule, {
    barcode: '036000291452',
    facts: [{ field: 'gtin', value: '036000291452' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BARCODE_GTIN_VERIFIED');
  // Calculation proof should verify identity and check digit without claiming an ISO print grade
  assert.equal(res.calculationProof.checkDigitValid, true);
  assert.equal(res.calculationProof.match, true);
});
