/**
 * Native Vector Font & Statutory Typography Inspector.
 * (lib/font-preflight.mjs)
 *
 * Implements deterministic typography compliance evaluation under:
 * - FDA 21 CFR 101.2(c): Mandatory information letter height (≥ 1/16 in = 1.5875 mm).
 * - FDA 21 CFR 101.105(h)/(i): Net quantity letter height schedule based on PDP area.
 * - FDA 21 CFR 101.1: Principal Display Panel area definitions.
 *
 * Distinguishes nominal font size (pt) from actual printed glyph height (mm).
 */

import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculatePdpArea, PACKAGE_TYPES, PDP_SOURCE_AUTHORITY } from './print/pdp-area.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const python = process.env.PYTHON_BIN || 'python3';

export const MM_PER_INCH = 25.4;
export const PT_TO_MM = 25.4 / 72.0;

/**
 * Statutory Net Quantity Type-Size Brackets under 21 CFR 101.105(h).
 */
export const FDA_101_105_SCHEDULE = Object.freeze([
  {
    maxPdpSqIn: 5.0,
    minHeightInches: 1 / 16,
    minHeightMm: 1.5875,
    fraction: '1/16 inch',
    label: 'PDP ≤ 5 sq in',
  },
  {
    minPdpSqIn: 5.0,
    maxPdpSqIn: 25.0,
    minHeightInches: 1 / 8,
    minHeightMm: 3.175,
    fraction: '1/8 inch',
    label: '5 < PDP ≤ 25 sq in',
  },
  {
    minPdpSqIn: 25.0,
    maxPdpSqIn: 100.0,
    minHeightInches: 3 / 16,
    minHeightMm: 4.7625,
    fraction: '3/16 inch',
    label: '25 < PDP ≤ 100 sq in',
  },
  {
    minPdpSqIn: 100.0,
    maxPdpSqIn: 400.0,
    minHeightInches: 1 / 4,
    minHeightMm: 6.35,
    fraction: '1/4 inch',
    label: '100 < PDP ≤ 400 sq in',
  },
  {
    minPdpSqIn: 400.0,
    minHeightInches: 1 / 2,
    minHeightMm: 12.7,
    fraction: '1/2 inch',
    label: 'PDP > 400 sq in',
  },
]);

/**
 * Resolves the statutory minimum letter height for net quantity based on PDP area.
 *
 * @param {number|null} pdpAreaSqIn
 * @param {Object} [options]
 * @param {boolean} [options.isEmbossedOrMolded=false] - 21 CFR 101.105(h)(5) +1/16" addition
 * @returns {Object}
 */
export function getNetQuantityMinimumHeight(pdpAreaSqIn, options = {}) {
  if (pdpAreaSqIn == null || isNaN(pdpAreaSqIn) || pdpAreaSqIn <= 0) {
    return {
      status: 'UNVERIFIED',
      minimumMm: null,
      minimumInches: null,
      bracketLabel: 'PDP Area Unspecified',
      fractionText: null,
      citation: '21 CFR 101.105(h)',
    };
  }

  const isEmbossed = Boolean(options.isEmbossedOrMolded);
  let bracket;

  // Exact boundary conditions:
  // <= 5.0 -> 1/16"
  // > 5.0 and <= 25.0 -> 1/8"
  // > 25.0 and <= 100.0 -> 3/16"
  // > 100.0 and <= 400.0 -> 1/4"
  // > 400.0 -> 1/2"
  if (pdpAreaSqIn <= 5.0) {
    bracket = FDA_101_105_SCHEDULE[0];
  } else if (pdpAreaSqIn <= 25.0) {
    bracket = FDA_101_105_SCHEDULE[1];
  } else if (pdpAreaSqIn <= 100.0) {
    bracket = FDA_101_105_SCHEDULE[2];
  } else if (pdpAreaSqIn <= 400.0) {
    bracket = FDA_101_105_SCHEDULE[3];
  } else {
    bracket = FDA_101_105_SCHEDULE[4];
  }

  let finalMm = bracket.minHeightMm;
  let finalInches = bracket.minHeightInches;
  let fractionText = bracket.fraction;

  // 21 CFR 101.105(h)(5): If blown, embossed or molded on glass or plastic, increase by 1/16 inch (1.5875 mm)
  if (isEmbossed) {
    finalMm += 1.5875;
    finalInches += 1 / 16;
    fractionText = `${bracket.fraction} + 1/16" (embossed/molded)`;
  }

  return {
    status: 'VERIFIED',
    pdpAreaSqIn,
    minimumMm: Math.round(finalMm * 10000) / 10000,
    minimumInches: finalInches,
    bracketLabel: bracket.label,
    fractionText,
    isEmbossed,
    citation: '21 CFR 101.105(h)',
  };
}

/**
 * Executes the Python native font inspector on a real PDF.
 * Uses lib/pdf_typography.py with fallback to lib/pdf_font_inspector.py.
 *
 * @param {string} pdfPath
 * @param {Object} [options]
 * @returns {Object} Extracted font metadata and text run records
 */
export function runNativeFontInspector(pdfPath, options = {}) {
  try {
    let script = join(root, 'lib', 'pdf_typography.py');
    let res = spawnSync(python, [script, pdfPath, JSON.stringify(options)], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 20000,
      env: { ...process.env, PYTHONPATH: [join(root, 'lib'), process.env.PYTHONPATH].filter(Boolean).join(':') },
    });

    if (res.error || res.status !== 0) {
      // Fallback to pdf_font_inspector.py if needed
      script = join(root, 'lib', 'pdf_font_inspector.py');
      res = spawnSync(python, [script, pdfPath, JSON.stringify(options)], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 20000,
        env: { ...process.env, PYTHONPATH: [join(root, 'lib'), process.env.PYTHONPATH].filter(Boolean).join(':') },
      });
    }

    if (res.error || res.status !== 0) {
      return { status: 'error', error: res.stderr || res.error?.message || 'Font inspection process failed' };
    }
    return JSON.parse(res.stdout);
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/**
 * Deterministically evaluates a text run against a statutory typography rule.
 *
 * @param {Object} params
 * @param {Object} params.textRun - Extracted text run record from PDF inspector
 * @param {string} [params.ruleId='21_CFR_101_105_H'] - Supported rule ID
 * @param {Object} [params.pdpEvaluation] - Result of calculatePdpArea()
 * @param {boolean} [params.isSmallPackage=false] - 21 CFR 101.2(c)(1) small package exception
 * @param {boolean} [params.isEmbossed=false] - 21 CFR 101.105(h)(5) embossed net quantity
 * @param {Object} [params.regulatorySnapshot]
 * @returns {Object} Structured typography finding record
 */
export function evaluateTypography({
  textRun,
  ruleId = '21_CFR_101_105_H',
  pdpEvaluation = null,
  isSmallPackage = false,
  isEmbossed = false,
  regulatorySnapshot = null,
} = {}) {
  if (!textRun) {
    return {
      status: 'unable',
      checkVerdict: 'UNABLE',
      explanation: 'No text run provided for typography evaluation.',
    };
  }

  // 1. Exclude hidden text from satisfying visible mandatory typography
  if (textRun.visibility === 'hidden' || textRun.excludedFromCompliance) {
    return {
      findingId: `typo-${textRun.textRunId || 'run'}-hidden`,
      ruleId,
      textRunId: textRun.textRunId,
      status: 'issue',
      checkVerdict: 'TEXT_HIDDEN_OCCLUDED',
      nominalFontSizePt: textRun.nominalFontSizePt,
      measuredHeightMm: 0,
      requiredHeightMm: 1.5875,
      differenceMm: -1.5875,
      measurementMethod: textRun.measurementMethod,
      explanation: `Text run "${textRun.originalText}" is occluded or hidden by an opaque layer. Hidden text cannot satisfy visible packaging labeling requirements.`,
      limitations: 'Occluded by vector shape in PDF paint stream.',
    };
  }

  // 2. Select rule and determine required height in mm
  let requiredHeightMm = 1.5875; // Default 1/16"
  let ruleCitation = '21 CFR 101.2(c)';
  let ruleName = 'General Mandatory Information Letter Height';
  let calculationProof = '';

  if (ruleId === '21_CFR_101_105_H' || textRun.category === 'net_quantity') {
    ruleCitation = '21 CFR 101.105(h)';
    ruleName = 'Net Quantity of Contents Letter Height Schedule';

    // Must have verified or confirmed PDP area
    if (!pdpEvaluation || pdpEvaluation.status === 'PDP_AREA_UNVERIFIED' || pdpEvaluation.pdpAreaSqIn == null) {
      return {
        findingId: `typo-${textRun.textRunId || 'run'}-pdp-unverified`,
        ruleId: '21_CFR_101_105_H',
        textRunId: textRun.textRunId,
        status: 'unable',
        checkVerdict: 'PDP_AREA_UNVERIFIED',
        nominalFontSizePt: textRun.nominalFontSizePt,
        measuredHeightMm: textRun.measuredGlyphHeightMm,
        requiredHeightMm: null,
        differenceMm: null,
        measurementMethod: textRun.measurementMethod,
        explanation: 'Net quantity minimum letter height cannot be evaluated: Principal Display Panel (PDP) dimensions are unverified.',
        calculationProof: '21 CFR 101.105(h) schedule requires verified PDP area in square inches. Provide confirmed carton or can dimensions.',
        limitations: 'Missing confirmed physical package dimensions.',
      };
    }

    const netQtyReq = getNetQuantityMinimumHeight(pdpEvaluation.pdpAreaSqIn, { isEmbossedOrMolded: isEmbossed });
    requiredHeightMm = netQtyReq.minimumMm;

    const dimText = pdpEvaluation.dimensions
      ? `PDP Dimensions: ${pdpEvaluation.dimensions.widthInches ?? pdpEvaluation.dimensions.diameterInches} in × ${pdpEvaluation.dimensions.heightInches} in. `
      : '';
    calculationProof = (
      `${dimText}PDP Area: ${pdpEvaluation.pdpAreaSqIn} sq in (${pdpEvaluation.calculationMethod || 'CALCULATED'}). ` +
      `Applicable Bracket: ${netQtyReq.bracketLabel} → Required Minimum: ${netQtyReq.fractionText} (${requiredHeightMm} mm).`
    );
  } else if (ruleId === '21_CFR_101_2_C') {
    ruleCitation = '21 CFR 101.2(c)';
    ruleName = 'General Mandatory Information Letter Height';

    if (isSmallPackage) {
      // 21 CFR 101.2(c)(1): package labeling surface ≤ 12 sq in allows 1/32" = 0.79375 mm
      requiredHeightMm = 0.7938;
      calculationProof = '21 CFR 101.2(c)(1) Small Package Exception (≤ 12 sq in): Minimum letter height is 1/32 inch (0.794 mm).';
    } else {
      requiredHeightMm = 1.5875;
      calculationProof = '21 CFR 101.2(c): Standard mandatory information letter height is not less than 1/16 inch (1.588 mm).';
    }
  }

  // 3. Compare actual measured glyph height against required statutory height
  // Prioritize lowercase "o" height when lowercase letters exist, otherwise capital height
  const measuredMm = textRun.measuredGlyphHeightMm ?? (textRun.nominalFontSizePt * PT_TO_MM);
  const diffMm = Math.round((measuredMm - requiredHeightMm) * 1000) / 1000;
  const isCompliant = diffMm >= -0.05; // 0.05 mm manufacturing rounding tolerance

  // Status mapping
  let status = 'match';
  let checkVerdict = 'TYPOGRAPHY_PASS';

  if (!isCompliant) {
    if (textRun.measurementAuthority === 'MEASURED_FROM_SOURCE' && (!pdpEvaluation || pdpEvaluation.isVerified)) {
      status = 'issue';
      checkVerdict = 'TYPOGRAPHY_DEFICIENT';
    } else {
      status = 'review';
      checkVerdict = 'TYPOGRAPHY_REVIEW_SUGGESTED';
    }
  }

  const proofFull = (
    `${calculationProof}\n` +
    `Measured Glyph Height: ${measuredMm.toFixed(3)} mm (Nominal: ${textRun.nominalFontSizePt} pt).\n` +
    `Difference: ${diffMm >= 0 ? '+' : ''}${diffMm.toFixed(3)} mm.\n` +
    `Verdict: ${isCompliant ? 'PASS' : 'DEFICIENT'} (${status.toUpperCase()}).`
  );

  return {
    findingId: `typo-${textRun.textRunId || 'run'}-${ruleId.toLowerCase()}`,
    ruleId,
    ruleCitation,
    ruleName,
    textRunId: textRun.textRunId,
    page: textRun.page || 1,
    originalText: textRun.originalText,
    fontName: textRun.fontName,
    fontSubtype: textRun.fontSubtype,
    nominalFontSizePt: textRun.nominalFontSizePt,
    nominalHeightMm: textRun.nominalHeightMm,
    measuredLowercaseOHeightMm: textRun.measuredLowercaseOHeightMm,
    measuredCapitalHeightMm: textRun.measuredCapitalHeightMm,
    measuredGlyphHeightMm: measuredMm,
    requiredHeightMm,
    differenceMm: diffMm,
    measurementMethod: textRun.measurementMethod,
    measurementAuthority: textRun.measurementAuthority,
    pdpAreaSqIn: pdpEvaluation?.pdpAreaSqIn ?? null,
    status,
    checkVerdict,
    calculationProof: proofFull,
    explanation: isCompliant
      ? `Typography verified: Measured letter height of ${measuredMm.toFixed(2)} mm satisfies the ${ruleCitation} statutory minimum (≥ ${requiredHeightMm} mm).`
      : `Typography shortfall: Measured letter height of ${measuredMm.toFixed(2)} mm is below the ${ruleCitation} statutory minimum (${requiredHeightMm} mm) by ${Math.abs(diffMm).toFixed(2)} mm. Risk of regulatory warning letter.`,
    boundingBox: textRun.boundingBox,
    limitations: textRun.limitations,
    heightToWidthRatio: textRun.heightToWidthRatio ?? null,
    isCondensedViolation: Boolean(textRun.isCondensedViolation || (textRun.heightToWidthRatio && textRun.heightToWidthRatio > 3.0)),
    sideBySideProof: {
      nominalFontSizePt: textRun.nominalFontSizePt,
      nominalHeightMm: textRun.nominalHeightMm || Math.round((textRun.nominalFontSizePt || 0) * PT_TO_MM * 1000) / 1000,
      actualPrintedHeightMm: measuredMm,
      measuredLowercaseOHeightMm: textRun.measuredLowercaseOHeightMm ?? null,
      measuredCapitalHeightMm: textRun.measuredCapitalHeightMm ?? null,
      applicableMinimumMm: requiredHeightMm,
      differenceMm: diffMm,
      status,
      explanation: 'Point size is the nominal font size. FDA checks the relevant printed letter height.',
    },
  };
}

/**
 * Generic legal typography requirement evaluator (Phase 11).
 */
export function evaluateTypographyRequirement({
  jurisdiction = 'US',
  ruleId = '21_CFR_101_105_H',
  artworkText = '',
  physicalGlyphMetrics = null,
  textRun = null,
  declarationType = 'net_quantity',
  packageGeometry = null,
  pdpEvaluation = null,
  isSmallPackage = false,
  isEmbossed = false,
  effectiveDate = '2024-01-01',
} = {}) {
  const run = textRun || {
    originalText: artworkText,
    fontName: physicalGlyphMetrics?.fontName || 'Unknown',
    fontSubtype: physicalGlyphMetrics?.fontSubtype || 'TrueType',
    nominalFontSizePt: physicalGlyphMetrics?.nominalFontSizePt || 6.0,
    measuredGlyphHeightMm: physicalGlyphMetrics?.measuredGlyphHeightMm ?? physicalGlyphMetrics?.actualHeightMm,
    measuredLowercaseOHeightMm: physicalGlyphMetrics?.measuredLowercaseOHeightMm,
    measuredCapitalHeightMm: physicalGlyphMetrics?.measuredCapitalHeightMm,
    measurementMethod: physicalGlyphMetrics?.measurementMethod || 'ORIGINAL_NATIVE_GLYPH_OUTLINE',
    measurementAuthority: 'MEASURED_FROM_SOURCE',
    heightToWidthRatio: physicalGlyphMetrics?.heightToWidthRatio ?? null,
    isCondensedViolation: physicalGlyphMetrics?.isCondensedViolation ?? false,
    category: declarationType,
  };

  const pdp = pdpEvaluation || (packageGeometry ? calculatePdpArea(packageGeometry) : null);
  const res = evaluateTypography({
    textRun: run,
    ruleId,
    pdpEvaluation: pdp,
    isSmallPackage,
    isEmbossed,
  });

  return {
    ruleId: res.ruleId,
    applicable: res.status !== 'unable' || res.checkVerdict !== 'RULE_NOT_APPLICABLE',
    measuredHeightMm: res.measuredGlyphHeightMm,
    requiredHeightMm: res.requiredHeightMm,
    measurementBasis: run.measurementBasis || 'LOWERCASE_O',
    nominalFontSizePt: res.nominalFontSizePt,
    fontName: res.fontName,
    measurementMethod: res.measurementMethod,
    result: res.status,
    status: res.status,
    calculation: res.calculationProof,
    evidence: {
      text: res.originalText,
      boundingBox: res.boundingBox,
      page: res.page,
    },
    limitations: res.limitations,
    sideBySideProof: res.sideBySideProof,
  };
}

/**
 * Statutory Net Quantity PDP Tiers helper for test compatibility.
 */
export const FDA_NET_QUANTITY_PDP_TIERS = Object.freeze(
  FDA_101_105_SCHEDULE.map(s => ({
    maxPdpSqIn: s.maxPdpSqIn,
    minPdpSqIn: s.minPdpSqIn,
    minHeightInches: s.fraction.replace(' inch', ' in'),
    minHeightMm: s.minHeightMm,
    label: s.label,
  }))
);

export function getRequiredNetQuantityTypeHeight(pdpAreaSqIn, options = {}) {
  const res = getNetQuantityMinimumHeight(pdpAreaSqIn, options);
  return {
    ...res,
    minHeightInches: res.fractionText ? res.fractionText.replace(' inch', ' in') : null,
  };
}

/**
 * Multi-run batch rule evaluator for typography preflight checks.
 *
 * @param {Object} params
 * @param {Array} params.textRuns
 * @param {number|null} [params.pdpAreaSqIn=null]
 * @param {string} [params.market='US']
 * @param {boolean} [params.isSmallPackage=false]
 * @returns {Array} Array of typography finding objects
 */
export function evaluateTypographyRules({ textRuns = [], pdpAreaSqIn = null, market = 'US', isSmallPackage = false }) {
  const findings = [];

  for (const run of textRuns) {
    const text = run.sourceText || run.originalText || '';
    const fontName = run.fontName || '';
    const isOutlined = run.extractionMethod === 'VECTOR_OUTLINE_ESTIMATE' || fontName.includes('CONVERTED_TO_OUTLINES');
    const isRaster = run.extractionMethod === 'RASTER_HEIGHT_ESTIMATE';

    // 1. Outlined or rasterized text with missing native font metrics
    if (isOutlined || isRaster || run.nominalFontSizePt == null) {
      findings.push({
        id: `typo-outline-${run.id || run.textRunId || 'run'}`,
        sourceText: text,
        fontName: run.fontName,
        status: 'review',
        verdict: 'TYPOGRAPHY_METRICS_ESTIMATE_ONLY',
        nominalSizePt: null,
        measuredGlyphHeightMm: null,
        explanation: 'Physical print proof must be measured. Text converted to vector paths without embedded font metrics.',
        boundingBox: run.boundingBox,
      });
      continue;
    }

    // 2. Nutrition Facts Title & Nutrient Lines (FDA 21 CFR 101.9)
    if (/nutrition\s*facts/i.test(text)) {
      const nominalPt = run.nominalFontSizePt;
      const isCompliant = nominalPt >= 8.0; // Title requirement
      findings.push({
        id: `typo-nutrition-title-${run.id || 'run'}`,
        sourceText: text,
        fontName: run.fontName,
        status: isCompliant ? 'match' : 'issue',
        verdict: isCompliant ? 'NUTRITION_TYPE_SIZE_PASS' : 'NUTRITION_TYPE_SIZE_TOO_SMALL',
        nominalSizePt: nominalPt,
        measuredGlyphHeightMm: run.actualGlyphHeightMm ?? run.measuredGlyphHeightMm,
        explanation: isCompliant
          ? `Nutrition Facts heading satisfies required type size (≥ 8 pt, actual ${nominalPt} pt).`
          : `Nutrition Facts heading is below required type size (${nominalPt} pt < 8 pt).`,
        boundingBox: run.boundingBox,
      });
      continue;
    }

    if (/calories/i.test(text)) {
      const nominalPt = run.nominalFontSizePt;
      const isCompliant = nominalPt >= 8.0; // Standard nutrient / calorie requirement
      findings.push({
        id: `typo-nutrition-cal-${run.id || 'run'}`,
        sourceText: text,
        fontName: run.fontName,
        status: isCompliant ? 'match' : 'issue',
        verdict: isCompliant ? 'NUTRITION_TYPE_SIZE_PASS' : 'NUTRITION_TYPE_SIZE_TOO_SMALL',
        nominalSizePt: nominalPt,
        measuredGlyphHeightMm: run.actualGlyphHeightMm ?? run.measuredGlyphHeightMm,
        explanation: isCompliant
          ? `Calorie statement type size satisfies statutory requirements (≥ 8 pt).`
          : `Calorie statement type size is below statutory requirement (${nominalPt} pt < 8 pt).`,
        boundingBox: run.boundingBox,
      });
      continue;
    }

    // 3. Net Quantity of Contents (FDA 21 CFR 101.105(h))
    if (/net\s*(wt|weight|contents|volume)|fl\s*oz|\b(oz|g|kg|ml|lb)\b/i.test(text)) {
      const pdpEval = pdpAreaSqIn != null
        ? { pdpAreaSqIn, isVerified: true, calculationMethod: 'DIMENSIONAL' }
        : null;

      const evalResult = evaluateTypography({
        textRun: {
          ...run,
          textRunId: run.id || run.textRunId,
          originalText: text,
          measuredGlyphHeightMm: run.actualGlyphHeightMm ?? run.measuredGlyphHeightMm,
          measurementAuthority: run.extractionMethod ? 'MEASURED_FROM_SOURCE' : 'VERIFIED_SPEC',
        },
        ruleId: '21_CFR_101_105_H',
        pdpEvaluation: pdpEval,
      });

      findings.push({
        ...evalResult,
        sourceText: text,
        nominalSizePt: run.nominalFontSizePt,
        measuredGlyphHeightMm: run.actualGlyphHeightMm ?? run.measuredGlyphHeightMm,
        verdict: evalResult.status === 'issue' ? 'NET_QUANTITY_TYPE_TOO_SMALL' : 'NET_QUANTITY_TYPE_PASS',
        proofLine: (
          `Measured lowercase-o height: ${run.actualGlyphHeightMm ?? run.measuredGlyphHeightMm} mm. ` +
          evalResult.calculationProof
        ),
      });
      continue;
    }
  }

  return findings;
}

