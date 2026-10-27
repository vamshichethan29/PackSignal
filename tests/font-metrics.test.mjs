import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PT_TO_MM,
  MM_PER_INCH,
  evaluateTypography,
  evaluateTypographyRequirement,
} from '../lib/font-preflight.mjs';

describe('Native Font Metrics & Physical Dimension Tests', () => {
  it('1. Physical unit conversions are exact: 1 pt = 25.4 / 72 mm ≈ 0.352778 mm', () => {
    assert.ok(Math.abs(PT_TO_MM - 25.4 / 72.0) < 1e-9);
    assert.equal(MM_PER_INCH, 25.4);
    assert.ok(Math.abs(1 / 16 * MM_PER_INCH - 1.5875) < 1e-9);
    assert.ok(Math.abs(1 / 8 * MM_PER_INCH - 3.175) < 1e-9);
    assert.ok(Math.abs(3 / 16 * MM_PER_INCH - 4.7625) < 1e-9);
    assert.ok(Math.abs(1 / 4 * MM_PER_INCH - 6.35) < 1e-9);
    assert.ok(Math.abs(1 / 2 * MM_PER_INCH - 12.7) < 1e-9);
  });

  it('2. Nominal 4.5 pt is mathematically 1.5875 mm, but produces undersized lowercase "o" (~1.11 mm)', () => {
    const nominalPt = 4.5;
    const nominalMm = nominalPt * PT_TO_MM;
    assert.ok(Math.abs(nominalMm - 1.5875) < 0.001, '4.5 pt em-height equals 1.5875 mm');

    // In typical fonts (e.g. Helvetica / Arial), lowercase "o" x-height is ~50-70% of em-size
    const measuredLowercaseOMm = 1.11; // 70% of 4.5 pt
    const finding = evaluateTypography({
      textRun: {
        textRunId: 'tr-nominal-4-5',
        originalText: 'Distributed by Organics Ltd',
        fontName: 'Helvetica',
        nominalFontSizePt: nominalPt,
        nominalHeightMm: nominalMm,
        measuredGlyphHeightMm: measuredLowercaseOMm,
        measuredLowercaseOHeightMm: measuredLowercaseOMm,
        measurementMethod: 'ORIGINAL_NATIVE_GLYPH_OUTLINE',
        measurementAuthority: 'MEASURED_FROM_SOURCE',
        category: 'contact',
      },
      ruleId: '21_CFR_101_2_C', // Requires ≥ 1/16 in = 1.5875 mm
      isSmallPackage: false,
    });

    // Must be flagged as an ISSUE because actual printed glyph height (1.11 mm) is below 1.5875 mm
    assert.equal(finding.status, 'issue');
    assert.equal(finding.checkVerdict, 'TYPOGRAPHY_DEFICIENT');
    assert.ok(finding.differenceMm < 0);
    assert.ok(finding.sideBySideProof.actualPrintedHeightMm < finding.sideBySideProof.applicableMinimumMm);
  });

  it('3. Text transformations: horizontal/vertical scaling changes actual physical glyph height', () => {
    const basePt = 8.0;
    // With 0.5 vertical scaling in text matrix
    const scaledHeightMm = (basePt * PT_TO_MM) * 0.5 * 0.70; // ~0.988 mm

    const res = evaluateTypographyRequirement({
      ruleId: '21_CFR_101_2_C',
      artworkText: 'Ingredients: Whole grain oats.',
      physicalGlyphMetrics: {
        fontName: 'Arial-Condensed',
        nominalFontSizePt: basePt,
        measuredGlyphHeightMm: scaledHeightMm,
        measuredLowercaseOHeightMm: scaledHeightMm,
        measurementMethod: 'NATIVE_CHARACTER_GEOMETRY',
      },
      declarationType: 'ingredients',
    });

    assert.equal(res.status, 'issue');
    assert.equal(res.measuredHeightMm, scaledHeightMm);
    assert.equal(res.requiredHeightMm, 1.5875);
  });

  it('4. Outlined text converted to paths without embedded metrics is flagged as review/estimate', () => {
    const res = evaluateTypography({
      textRun: {
        textRunId: 'tr-vector-outline',
        originalText: 'DISTRIBUTED BY ORGANIC FOODS',
        fontName: 'Outlines_Converted',
        nominalFontSizePt: null,
        measuredGlyphHeightMm: 1.4,
        measurementMethod: 'VECTOR_OUTLINE_ESTIMATE',
        measurementAuthority: 'ESTIMATED_FROM_OUTLINE',
        category: 'contact',
      },
      ruleId: '21_CFR_101_2_C',
    });

    // If measurement authority is not MEASURED_FROM_SOURCE, verdict is REVIEW not automatic pass
    assert.equal(res.status, 'review');
    assert.equal(res.checkVerdict, 'TYPOGRAPHY_REVIEW_SUGGESTED');
  });

  it('5. Hidden/occluded text is excluded from compliance and returns an ISSUE', () => {
    const res = evaluateTypography({
      textRun: {
        textRunId: 'tr-hidden-statutory',
        originalText: 'Keep refrigerated after opening.',
        fontName: 'Helvetica-Bold',
        nominalFontSizePt: 10.0,
        measuredGlyphHeightMm: 2.4,
        visibility: 'hidden',
        excludedFromCompliance: true,
      },
      ruleId: '21_CFR_101_2_C',
    });

    assert.equal(res.status, 'issue');
    assert.equal(res.checkVerdict, 'TEXT_HIDDEN_OCCLUDED');
    assert.equal(res.measuredHeightMm, 0);
  });
});
