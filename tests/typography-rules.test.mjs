import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNetQuantityMinimumHeight,
  evaluateTypography,
  FDA_101_105_SCHEDULE
} from '../lib/font-preflight.mjs';

test('1. Exact 5.0 sq in PDP boundary requires 1/16 inch (1.588 mm)', () => {
  const req = getNetQuantityMinimumHeight(5.0);
  assert.equal(req.status, 'VERIFIED');
  assert.equal(req.minimumMm, 1.5875);
  assert.equal(req.fractionText, '1/16 inch');
  assert.equal(req.bracketLabel, 'PDP ≤ 5 sq in');
});

test('2. PDP of 5.01 sq in moves to 1/8 inch bracket (3.175 mm)', () => {
  const req = getNetQuantityMinimumHeight(5.01);
  assert.equal(req.minimumMm, 3.175);
  assert.equal(req.fractionText, '1/8 inch');
  assert.equal(req.bracketLabel, '5 < PDP ≤ 25 sq in');
});

test('3. Exact 25.0 sq in PDP boundary requires 1/8 inch (3.175 mm)', () => {
  const req = getNetQuantityMinimumHeight(25.0);
  assert.equal(req.minimumMm, 3.175);
  assert.equal(req.fractionText, '1/8 inch');
});

test('4. PDP of 25.01 sq in moves to 3/16 inch bracket (4.763 mm)', () => {
  const req = getNetQuantityMinimumHeight(25.01);
  assert.equal(req.minimumMm, 4.7625);
  assert.equal(req.fractionText, '3/16 inch');
});

test('5. Exact 100.0 sq in PDP boundary requires 3/16 inch (4.763 mm)', () => {
  const req = getNetQuantityMinimumHeight(100.0);
  assert.equal(req.minimumMm, 4.7625);
  assert.equal(req.fractionText, '3/16 inch');
});

test('6. PDP of 100.01 sq in moves to 1/4 inch bracket (6.35 mm)', () => {
  const req = getNetQuantityMinimumHeight(100.01);
  assert.equal(req.minimumMm, 6.35);
  assert.equal(req.fractionText, '1/4 inch');
});

test('7. Exact 400.0 sq in PDP boundary requires 1/4 inch (6.35 mm)', () => {
  const req = getNetQuantityMinimumHeight(400.0);
  assert.equal(req.minimumMm, 6.35);
  assert.equal(req.fractionText, '1/4 inch');
});

test('8. PDP of 400.01 sq in moves to 1/2 inch bracket (12.7 mm)', () => {
  const req = getNetQuantityMinimumHeight(400.01);
  assert.equal(req.minimumMm, 12.7);
  assert.equal(req.fractionText, '1/2 inch');
});

test('9. Embossed / molded net quantity declaration adds +1/16 inch (+1.588 mm) under 101.105(h)(5)', () => {
  // On a 32 sq in PDP, ordinary is 3/16" (4.763 mm). Embossed becomes 3/16 + 1/16 = 1/4" (6.35 mm).
  const req = getNetQuantityMinimumHeight(32.0, { isEmbossedOrMolded: true });
  assert.equal(req.minimumMm, 6.35);
  assert.ok(req.fractionText.includes('+ 1/16"'));
});

test('10. Passing nominal font size with deficient actual glyph height flags an ISSUE', () => {
  // Nominal 10.0 pt font (em-height = 3.528 mm).
  // On a 32 sq in carton, required is 4.763 mm (3/16 in).
  // Even if user assumed 10 pt is "big enough", actual lowercase 'o' is 2.20 mm.
  const textRun = {
    textRunId: 'tr-01',
    category: 'net_quantity',
    originalText: 'Net Wt 16 oz (454 g)',
    fontName: 'Helvetica',
    nominalFontSizePt: 10.0,
    measuredLowercaseOHeightMm: 2.20,
    measuredGlyphHeightMm: 2.20,
    measurementAuthority: 'MEASURED_FROM_SOURCE',
    visibility: 'visible',
    boundingBox: [0.1, 0.8, 0.4, 0.85],
  };

  const pdpEval = {
    status: 'PDP_AREA_VERIFIED',
    isVerified: true,
    pdpAreaSqIn: 32.0,
    dimensions: { widthInches: 4.0, heightInches: 8.0 },
    calculationMethod: 'RECTANGULAR_H_X_W',
  };

  const evalRes = evaluateTypography({
    textRun,
    ruleId: '21_CFR_101_105_H',
    pdpEvaluation: pdpEval,
  });

  assert.equal(evalRes.status, 'issue');
  assert.equal(evalRes.checkVerdict, 'TYPOGRAPHY_DEFICIENT');
  assert.equal(evalRes.requiredHeightMm, 4.7625);
  assert.equal(evalRes.measuredGlyphHeightMm, 2.20);
  assert.ok(evalRes.differenceMm < 0);
  assert.ok(evalRes.calculationProof.includes('Required Minimum: 3/16 inch (4.7625 mm)'));
});

test('11. Text meeting the statutory letter height standard returns MATCH', () => {
  const textRun = {
    textRunId: 'tr-02',
    category: 'net_quantity',
    originalText: 'NET WT 16 OZ (454 g)',
    fontName: 'Helvetica-Bold',
    nominalFontSizePt: 16.0,
    measuredCapitalHeightMm: 5.10,
    measuredGlyphHeightMm: 5.10,
    measurementAuthority: 'MEASURED_FROM_SOURCE',
    visibility: 'visible',
    boundingBox: [0.1, 0.8, 0.4, 0.85],
  };

  const pdpEval = {
    status: 'PDP_AREA_VERIFIED',
    isVerified: true,
    pdpAreaSqIn: 32.0,
    dimensions: { widthInches: 4.0, heightInches: 8.0 },
    calculationMethod: 'RECTANGULAR_H_X_W',
  };

  const evalRes = evaluateTypography({
    textRun,
    ruleId: '21_CFR_101_105_H',
    pdpEvaluation: pdpEval,
  });

  assert.equal(evalRes.status, 'match');
  assert.equal(evalRes.checkVerdict, 'TYPOGRAPHY_PASS');
  assert.ok(evalRes.differenceMm > 0);
});

test('12. Missing PDP dimensions returns status UNABLE without guessing', () => {
  const textRun = {
    textRunId: 'tr-03',
    category: 'net_quantity',
    originalText: 'Net Wt 16 oz (454 g)',
    nominalFontSizePt: 10.0,
    measuredGlyphHeightMm: 2.20,
    measurementAuthority: 'MEASURED_FROM_SOURCE',
    visibility: 'visible',
  };

  const evalRes = evaluateTypography({
    textRun,
    ruleId: '21_CFR_101_105_H',
    pdpEvaluation: null, // Unverified PDP dimensions
  });

  assert.equal(evalRes.status, 'unable');
  assert.equal(evalRes.checkVerdict, 'PDP_AREA_UNVERIFIED');
  assert.equal(evalRes.requiredHeightMm, null);
});

test('13. Occluded or hidden text is excluded from compliance and produces an ISSUE', () => {
  const textRun = {
    textRunId: 'tr-hidden',
    category: 'net_quantity',
    originalText: 'Obsolete Net Wt 12 oz',
    nominalFontSizePt: 14.0,
    measuredGlyphHeightMm: 4.5,
    visibility: 'hidden',
    excludedFromCompliance: true,
  };

  const evalRes = evaluateTypography({
    textRun,
    ruleId: '21_CFR_101_2_C',
  });

  assert.equal(evalRes.status, 'issue');
  assert.equal(evalRes.checkVerdict, 'TEXT_HIDDEN_OCCLUDED');
  assert.ok(evalRes.explanation.includes('occluded or hidden'));
});
