import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getNetQuantityMinimumHeight,
  evaluateTypography,
  evaluateTypographyRequirement,
  FDA_101_105_SCHEDULE,
} from '../lib/font-preflight.mjs';

describe('FDA Statutory Typography Rule Verification (21 CFR 101.2 & 101.105)', () => {
  it('1. General type size under 21 CFR 101.2(c) requires ≥ 1/16 inch (1.5875 mm)', () => {
    const res = evaluateTypographyRequirement({
      ruleId: '21_CFR_101_2_C',
      artworkText: 'Manufactured for PackSignal Co.',
      physicalGlyphMetrics: {
        fontName: 'Helvetica',
        nominalFontSizePt: 8.0,
        measuredGlyphHeightMm: 1.85,
      },
      declarationType: 'contact',
    });

    assert.equal(res.status, 'match');
    assert.equal(res.requiredHeightMm, 1.5875);
    assert.ok(res.measuredHeightMm >= res.requiredHeightMm);
  });

  it('2. Small package exception under 21 CFR 101.2(c)(1) allows 1/32 inch (0.7938 mm)', () => {
    const res = evaluateTypographyRequirement({
      ruleId: '21_CFR_101_2_C',
      artworkText: 'Allergen info: contains soy.',
      physicalGlyphMetrics: {
        fontName: 'Helvetica',
        nominalFontSizePt: 5.0,
        measuredGlyphHeightMm: 1.10, // Pass for 1/32", fail for 1/16"
      },
      declarationType: 'allergen',
      isSmallPackage: true, // Total surface ≤ 12 sq in
    });

    assert.equal(res.status, 'match');
    assert.equal(res.requiredHeightMm, 0.7938);
    assert.ok(res.measuredHeightMm >= res.requiredHeightMm);
  });

  it('3. FDA 21 CFR 101.105(h) PDP Tier exact boundaries: 5.0, 25.0, 100.0, 400.0 sq in', () => {
    // Exactly 5.0 sq in -> 1/16" (1.5875 mm)
    const t5 = getNetQuantityMinimumHeight(5.0);
    assert.equal(t5.minimumMm, 1.5875);
    assert.equal(t5.fractionText, '1/16 inch');

    // 5.01 sq in -> 1/8" (3.175 mm)
    const t5_01 = getNetQuantityMinimumHeight(5.01);
    assert.equal(t5_01.minimumMm, 3.175);
    assert.equal(t5_01.fractionText, '1/8 inch');

    // Exactly 25.0 sq in -> 1/8" (3.175 mm) [CRITICAL RULE: not 3/16"]
    const t25 = getNetQuantityMinimumHeight(25.0);
    assert.equal(t25.minimumMm, 3.175);
    assert.equal(t25.fractionText, '1/8 inch');

    // 25.01 sq in -> 3/16" (4.7625 mm)
    const t25_01 = getNetQuantityMinimumHeight(25.01);
    assert.equal(t25_01.minimumMm, 4.7625);
    assert.equal(t25_01.fractionText, '3/16 inch');

    // Exactly 100.0 sq in -> 3/16" (4.7625 mm)
    const t100 = getNetQuantityMinimumHeight(100.0);
    assert.equal(t100.minimumMm, 4.7625);
    assert.equal(t100.fractionText, '3/16 inch');

    // 100.01 sq in -> 1/4" (6.35 mm)
    const t100_01 = getNetQuantityMinimumHeight(100.01);
    assert.equal(t100_01.minimumMm, 6.35);
    assert.equal(t100_01.fractionText, '1/4 inch');

    // Exactly 400.0 sq in -> 1/4" (6.35 mm)
    const t400 = getNetQuantityMinimumHeight(400.0);
    assert.equal(t400.minimumMm, 6.35);
    assert.equal(t400.fractionText, '1/4 inch');

    // 400.01 sq in -> 1/2" (12.7 mm)
    const t400_01 = getNetQuantityMinimumHeight(400.01);
    assert.equal(t400_01.minimumMm, 12.7);
    assert.equal(t400_01.fractionText, '1/2 inch');
  });

  it('4. Embossed/molded net quantity adds +1/16" (1.5875 mm) under 21 CFR 101.105(h)(5)', () => {
    // 20 sq in standard bracket is 1/8" (3.175 mm). If embossed: 1/8" + 1/16" = 3/16" = 4.7625 mm
    const embossed = getNetQuantityMinimumHeight(20.0, { isEmbossedOrMolded: true });
    assert.equal(embossed.minimumMm, 4.7625);
    assert.ok(embossed.isEmbossed);
    assert.ok(embossed.fractionText.includes('embossed/molded'));
  });

  it('5. Height-to-width ratio under 101.105(h): letters must not be > 3 times as high as wide', () => {
    const res = evaluateTypography({
      textRun: {
        textRunId: 'tr-condensed-net-qty',
        originalText: 'NET WT 16 OZ (454g)',
        fontName: 'SuperCondensed-Bold',
        nominalFontSizePt: 12.0,
        measuredGlyphHeightMm: 3.5, // Satisfies 3.175 mm height
        averageGlyphWidthMm: 0.9, // 3.5 / 0.9 = 3.89 > 3.0 ratio!
        heightToWidthRatio: 3.89,
        isCondensedViolation: true,
        category: 'net_quantity',
      },
      ruleId: '21_CFR_101_105_H',
      pdpEvaluation: { pdpAreaSqIn: 20.0, isVerified: true },
    });

    assert.ok(res.isCondensedViolation);
    assert.equal(res.heightToWidthRatio, 3.89);
  });

  it('6. Missing PDP dimensions returns status UNABLE without fabricating a threshold', () => {
    const res = evaluateTypography({
      textRun: {
        textRunId: 'tr-unknown-pdp',
        originalText: 'NET WT 500 mL',
        fontName: 'Helvetica',
        nominalFontSizePt: 9.0,
        measuredGlyphHeightMm: 2.1,
        category: 'net_quantity',
      },
      ruleId: '21_CFR_101_105_H',
      pdpEvaluation: null, // Unknown PDP
    });

    assert.equal(res.status, 'unable');
    assert.equal(res.checkVerdict, 'PDP_AREA_UNVERIFIED');
    assert.equal(res.requiredHeightMm, null);
  });
});
