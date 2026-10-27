import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateLegalTypographyCompliance,
  analyzeShelfReadability,
  DECLARATION_TYPES
} from '../lib/readability/shelf-readability.mjs';

import {
  calculatePdpArea,
  PACKAGE_TYPES
} from '../lib/print/pdp-area.mjs';

test('1. Legal status remains strictly unchanged across all distance slider positions (30 cm, 1 m, 2 m)', () => {
  const textRun = {
    textRunId: 'tr-net-qty',
    originalText: 'Net Wt 16 oz (454 g)',
    category: 'net_quantity',
    fontName: 'Helvetica',
    measuredGlyphHeightMm: 3.5, // 3.5 mm letter
    visibility: 'visible'
  };

  // 32 sq in PDP requires 3/16" = 4.7625 mm.
  // 3.5 mm is below 4.7625 mm -> Legal status must be ISSUE.
  const pdpEval = {
    status: 'PDP_AREA_VERIFIED',
    pdpAreaSqIn: 32.0,
    dimensions: { widthInches: 4.0, heightInches: 8.0 }
  };

  const sim30cm = analyzeShelfReadability({
    textRegions: [textRun],
    distanceCm: 30,
    packageGeometry: { dimensions: { widthInches: 4.0, heightInches: 8.0 } }
  });

  const sim100cm = analyzeShelfReadability({
    textRegions: [textRun],
    distanceCm: 100,
    packageGeometry: { dimensions: { widthInches: 4.0, heightInches: 8.0 } }
  });

  const sim200cm = analyzeShelfReadability({
    textRegions: [textRun],
    distanceCm: 200,
    packageGeometry: { dimensions: { widthInches: 4.0, heightInches: 8.0 } }
  });

  // Verify legal status is identical across all three distances!
  const r30 = sim30cm.evaluatedRegions[0];
  const r100 = sim100cm.evaluatedRegions[0];
  const r200 = sim200cm.evaluatedRegions[0];

  assert.equal(r30.legalTypography.status, 'ISSUE');
  assert.equal(r100.legalTypography.status, 'ISSUE');
  assert.equal(r200.legalTypography.status, 'ISSUE');

  // But visual angles and simulation risk CHANGE with distance!
  assert.ok(r30.angularHeightArcMin > r100.angularHeightArcMin);
  assert.ok(r100.angularHeightArcMin > r200.angularHeightArcMin);
  assert.notEqual(r30.readabilityRisk, r200.readabilityRisk);
});

test('2. Exact 25.0 sq in boundary requires 1/8 inch (3.175 mm), whereas 25.01 sq in requires 3/16 inch (4.763 mm)', () => {
  const pdp25 = {
    status: 'PDP_AREA_VERIFIED',
    pdpAreaSqIn: 25.0
  };
  const pdp25_01 = {
    status: 'PDP_AREA_VERIFIED',
    pdpAreaSqIn: 25.01
  };

  const textRun = {
    textRunId: 'tr-01',
    category: 'net_quantity',
    originalText: '12 FL OZ (355 mL)',
    measuredGlyphHeightMm: 3.5
  };

  const eval25 = evaluateLegalTypographyCompliance(textRun, pdp25);
  const eval25_01 = evaluateLegalTypographyCompliance(textRun, pdp25_01);

  // At 25.0 sq in: required is 3.175 mm (1/8"). 3.5 mm passes (MATCH).
  assert.equal(eval25.requiredHeightMm, 3.175);
  assert.equal(eval25.status, 'MATCH');

  // At 25.01 sq in: required moves to 4.7625 mm (3/16"). 3.5 mm fails (ISSUE).
  assert.equal(eval25_01.requiredHeightMm, 4.7625);
  assert.equal(eval25_01.status, 'ISSUE');
});

test('3. Unknown or missing PDP dimensions returns UNABLE without fabricating a statutory threshold', () => {
  const textRun = {
    textRunId: 'tr-net-qty',
    category: 'net_quantity',
    originalText: 'Net Wt 16 oz',
    measuredGlyphHeightMm: 3.0
  };

  // Missing PDP
  const evalNoPdp = evaluateLegalTypographyCompliance(textRun, null);
  assert.equal(evalNoPdp.status, 'UNABLE');
  assert.equal(evalNoPdp.requiredHeightMm, null);
  assert.ok(evalNoPdp.explanation.includes('PDP'));
});

test('4. Occluded or hidden text is excluded from compliance and returns an ISSUE', () => {
  const hiddenRun = {
    textRunId: 'tr-hidden',
    originalText: 'Ingredients: Whole Oats',
    category: 'ingredients',
    measuredGlyphHeightMm: 2.0,
    visibility: 'hidden',
    excludedFromCompliance: true
  };

  const evalHidden = evaluateLegalTypographyCompliance(hiddenRun, { pdpAreaSqIn: 30 });
  assert.equal(evalHidden.status, 'ISSUE');
  assert.equal(evalHidden.checkVerdict, 'TEXT_HIDDEN_OCCLUDED');
  assert.equal(evalHidden.measuredHeightMm, 0);
});

test('5. General mandatory declarations (ingredients, allergens) require 1/16 inch (1.5875 mm)', () => {
  const ingRunPass = {
    textRunId: 'tr-ing-pass',
    category: 'ingredients',
    originalText: 'Ingredients: Rolled oats, honey, almonds.',
    measuredGlyphHeightMm: 1.80 // >= 1.5875 mm
  };
  const ingRunFail = {
    textRunId: 'tr-ing-fail',
    category: 'ingredients',
    originalText: 'Ingredients: Rolled oats, honey, almonds.',
    measuredGlyphHeightMm: 1.20 // < 1.5875 mm
  };

  const evalPass = evaluateLegalTypographyCompliance(ingRunPass);
  const evalFail = evaluateLegalTypographyCompliance(ingRunFail);

  assert.equal(evalPass.status, 'MATCH');
  assert.equal(evalPass.requiredHeightMm, 1.5875);

  assert.equal(evalFail.status, 'ISSUE');
  assert.equal(evalFail.requiredHeightMm, 1.5875);
});
