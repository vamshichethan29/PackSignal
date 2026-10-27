import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateTypographyRules,
  getRequiredNetQuantityTypeHeight,
  FDA_NET_QUANTITY_PDP_TIERS,
} from '../lib/font-preflight.mjs';

test('1. FDA 21 CFR 101.105(h) PDP tiers scale required character height', () => {
  // Small PDP (<= 5 sq in) => 1/16 in (1.5875 mm)
  assert.equal(getRequiredNetQuantityTypeHeight(4).minHeightInches, '1/16 in');

  // Medium PDP (20 sq in) => 1/8 in (3.175 mm)
  assert.equal(getRequiredNetQuantityTypeHeight(20).minHeightInches, '1/8 in');

  // Large PDP (50 sq in) => 3/16 in (4.7625 mm)
  assert.equal(getRequiredNetQuantityTypeHeight(50).minHeightInches, '3/16 in');

  // Extra Large PDP (150 sq in) => 1/4 in (6.35 mm)
  assert.equal(getRequiredNetQuantityTypeHeight(150).minHeightInches, '1/4 in');
});

test('2. Nominal point size distinguished from actual lowercase glyph height', () => {
  // 9 pt font with lowercase 'o' measured at 1.4 mm (below 1/8 in = 3.175 mm for 20 sq in PDP)
  const runs = [
    {
      id: 'net-qty-run-1',
      sourceText: 'NET WT 16 OZ (1 LB) 454g',
      fontName: 'Helvetica-Bold',
      fontSubtype: 'TrueType',
      nominalFontSizePt: 9.0,
      nominalHeightMm: 3.175,
      actualGlyphHeightMm: 1.65, // Lowercase 'o' or 'g' height
      hasLowercase: true,
      extractionMethod: 'NATIVE_FONT_MEASUREMENT',
      page: 1,
      boundingBox: [0.1, 0.8, 0.4, 0.85],
    },
  ];

  // For 20 sq in PDP, required minimum height is 3.175 mm (1/8 in)
  const findings = evaluateTypographyRules({
    textRuns: runs,
    pdpAreaSqIn: 20,
    market: 'US',
  });

  assert.equal(findings.length, 1);
  const netQtyFinding = findings[0];
  assert.equal(netQtyFinding.status, 'issue');
  assert.equal(netQtyFinding.verdict, 'NET_QUANTITY_TYPE_TOO_SMALL');
  assert.equal(netQtyFinding.nominalSizePt, 9.0);
  assert.equal(netQtyFinding.measuredGlyphHeightMm, 1.65);
  assert.ok(netQtyFinding.proofLine.includes('Measured lowercase-o height: 1.65 mm'));
});

test('3. Nutrition Facts enforces nominal point size minimum (no universal 4.5 pt rule)', () => {
  const runs = [
    {
      id: 'nutrition-run-1',
      sourceText: 'Nutrition Facts',
      fontName: 'Helvetica-Black',
      fontSubtype: 'TrueType',
      nominalFontSizePt: 12.0,
      nominalHeightMm: 4.23,
      actualGlyphHeightMm: 2.15,
      extractionMethod: 'NATIVE_FONT_MEASUREMENT',
      page: 1,
      boundingBox: [0.6, 0.1, 0.9, 0.15],
    },
    {
      id: 'nutrition-run-2',
      sourceText: 'Calories 240',
      fontName: 'Helvetica',
      fontSubtype: 'TrueType',
      nominalFontSizePt: 5.0, // Below 8.0 pt minimum
      nominalHeightMm: 1.76,
      actualGlyphHeightMm: 0.9,
      extractionMethod: 'NATIVE_FONT_MEASUREMENT',
      page: 1,
      boundingBox: [0.6, 0.2, 0.9, 0.25],
    },
  ];

  const findings = evaluateTypographyRules({
    textRuns: runs,
    pdpAreaSqIn: 20,
    market: 'US',
    isSmallPackage: false,
  });

  const titleFinding = findings.find(f => f.sourceText.includes('Nutrition Facts'));
  const calFinding = findings.find(f => f.sourceText.includes('Calories'));

  assert.equal(titleFinding.status, 'match');
  assert.equal(calFinding.status, 'issue');
  assert.equal(calFinding.verdict, 'NUTRITION_TYPE_SIZE_TOO_SMALL');
  assert.equal(calFinding.nominalSizePt, 5.0);
});

test('4. Outlined and rasterized text handled honestly without fabricated font metadata', () => {
  const runs = [
    {
      id: 'outlined-text-1',
      sourceText: 'NET WT 500g',
      fontName: 'NONE (CONVERTED_TO_OUTLINES)',
      nominalFontSizePt: null,
      actualGlyphHeightMm: null,
      extractionMethod: 'VECTOR_OUTLINE_ESTIMATE',
      limitations: 'Text converted to vector paths.',
      page: 1,
      boundingBox: [0.1, 0.8, 0.4, 0.85],
    },
  ];

  const findings = evaluateTypographyRules({
    textRuns: runs,
    pdpAreaSqIn: 10,
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].status, 'review');
  assert.equal(findings[0].verdict, 'TYPOGRAPHY_METRICS_ESTIMATE_ONLY');
  assert.equal(findings[0].nominalSizePt, null);
  assert.ok(findings[0].explanation.includes('Physical print proof must be measured'));
});
