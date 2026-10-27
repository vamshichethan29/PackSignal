/**
 * PackSignal — Pack Quantity Consistency Engine (lib/pack-quantity-consistency.mjs)
 * 
 * Verifies mathematical consistency between:
 * - SERVINGS_PER_CONTAINER
 * - SERVING_SIZE
 * - DECLARED_NET_WEIGHT
 * 
 * Formula:
 * EXPECTED_PACK_WEIGHT = SERVINGS_PER_CONTAINER × SERVING_SIZE
 * DIFFERENCE = EXPECTED_PACK_WEIGHT - DECLARED_NET_WEIGHT
 * ABSOLUTE_DIFFERENCE = ABS(DIFFERENCE)
 * PERCENT_DIFFERENCE = ABSOLUTE_DIFFERENCE / DECLARED_NET_WEIGHT × 100
 * 
 * Pure mathematical engine:
 * - Precise unit conversions (mg, g, kg, oz, lb to grams).
 * - Dimensionally safe: blocks volume (mL, fl oz) vs mass (g) without verified density.
 * - Parses serving count qualifiers ("About 8", "8.5", "Servings vary").
 * - Validates preparation basis (AS_PACKAGED vs AS_PREPARED / COOKED / DRAINED).
 * - Prevents cross-variant/SKU confusion.
 * - Preserves evidence citations, document hashes, and bounding boxes.
 */

import { convertUnits, normalizeUnit, getUnitDimension } from './nutrition/units.mjs';

export const SERVING_COUNT_QUALIFIER = {
  EXACT: 'EXACT',
  APPROXIMATE: 'APPROXIMATE',
  VARIABLE: 'VARIABLE',
  UNKNOWN: 'UNKNOWN'
};

export const SERVING_SIZE_PREPARATION_BASIS = {
  AS_PACKAGED: 'AS_PACKAGED',
  AS_PREPARED: 'AS_PREPARED',
  DRY_PRODUCT: 'DRY_PRODUCT',
  COOKED_PRODUCT: 'COOKED_PRODUCT',
  DRAINED_PRODUCT: 'DRAINED_PRODUCT',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN'
};

export const SERVING_BASIS_TYPES = SERVING_SIZE_PREPARATION_BASIS;

export const QUANTITY_SCREENING_VERDICT = {
  MATCH: 'MATCH',
  REVIEW: 'REVIEW',
  ISSUE: 'ISSUE',
  UNABLE: 'UNABLE'
};

/**
 * Parses servings per container input into structured number and approximation qualifier.
 */
export function parseServingsCount(input) {
  if (input === null || input === undefined) {
    return { value: null, qualifier: SERVING_COUNT_QUALIFIER.UNKNOWN, isApproximate: false, originalText: '', sourceStatus: null };
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return { value: input, qualifier: SERVING_COUNT_QUALIFIER.EXACT, isApproximate: false, originalText: String(input), sourceStatus: null };
    return { value: input, qualifier: SERVING_COUNT_QUALIFIER.EXACT, isApproximate: false, originalText: String(input), sourceStatus: null };
  }

  if (typeof input === 'object' && (input.value !== undefined || input.amount !== undefined)) {
    const rawVal = input.value !== undefined ? input.value : input.amount;
    const val = Number(rawVal);
    const orig = input.originalText || input.quote || String(rawVal);
    const isApprox = input.qualifier === SERVING_COUNT_QUALIFIER.APPROXIMATE || /about|approx|~\s*|circa/i.test(orig);
    const isVar = input.qualifier === SERVING_COUNT_QUALIFIER.VARIABLE || /varies|vary/i.test(orig);
    const isSuspiciousB = /^\s*[B|b]\s+servings?\b/i.test(orig);
    return {
      value: isSuspiciousB ? null : (Number.isFinite(val) ? val : null),
      qualifier: isVar ? SERVING_COUNT_QUALIFIER.VARIABLE : isApprox ? SERVING_COUNT_QUALIFIER.APPROXIMATE : (input.qualifier || SERVING_COUNT_QUALIFIER.EXACT),
      isApproximate: isApprox,
      suspiciousOcr: isSuspiciousB,
      reason: isSuspiciousB ? 'Suspicious OCR: letter "B" detected where numeric serving count expected.' : null,
      originalText: orig,
      evidence: input.evidence || null,
      sku: input.sku || input.productVariant || null,
      productVariant: input.productVariant || input.sku || null,
      artworkVersion: input.artworkVersion || null,
      sourceStatus: input.sourceStatus || null,
      documentId: input.documentId || null
    };
  }

  const str = String(input).trim();
  if (!str) return { value: null, qualifier: SERVING_COUNT_QUALIFIER.UNKNOWN, isApproximate: false, originalText: '', sourceStatus: null };

  // Detect OCR anomalies: e.g. "B servings"
  if (/^\s*[B|b]\s+servings?\b/i.test(str)) {
    return {
      value: null,
      qualifier: SERVING_COUNT_QUALIFIER.UNKNOWN,
      isApproximate: false,
      suspiciousOcr: true,
      originalText: str,
      reason: 'Suspicious OCR: letter "B" detected where numeric serving count expected.',
      sourceStatus: null
    };
  }

  const isVariable = /varies|vary/i.test(str);
  if (isVariable) {
    return { value: null, qualifier: SERVING_COUNT_QUALIFIER.VARIABLE, isApproximate: true, originalText: str, sourceStatus: null };
  }

  const isApproximate = /about|approx|~\s*|circa|estimated/i.test(str);

  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) {
    return { value: null, qualifier: SERVING_COUNT_QUALIFIER.UNKNOWN, isApproximate: false, originalText: str, sourceStatus: null };
  }

  const val = parseFloat(numMatch[1]);
  return {
    value: val,
    qualifier: isApproximate ? SERVING_COUNT_QUALIFIER.APPROXIMATE : SERVING_COUNT_QUALIFIER.EXACT,
    isApproximate,
    originalText: str,
    sourceStatus: null
  };
}

/**
 * Parses serving size declaration into metric amount, unit, and preparation basis.
 */
export function parseServingSize(input) {
  if (input === null || input === undefined) {
    return { amount: null, unit: '', basis: SERVING_SIZE_PREPARATION_BASIS.UNKNOWN, originalText: '', sourceStatus: null };
  }

  if (typeof input === 'object' && (input.amount !== undefined || input.value !== undefined)) {
    const rawAmt = input.amount !== undefined ? input.amount : input.value;
    const unit = normalizeUnit(input.unit || 'g');
    const orig = input.originalText || input.quote || `${rawAmt} ${unit}`;
    let basis = input.basis || SERVING_SIZE_PREPARATION_BASIS.AS_PACKAGED;
    if (/prepared|with\s+milk|with\s+water/i.test(orig)) basis = SERVING_SIZE_PREPARATION_BASIS.AS_PREPARED;
    else if (/cooked/i.test(orig)) basis = SERVING_SIZE_PREPARATION_BASIS.COOKED_PRODUCT;
    else if (/drained/i.test(orig)) basis = SERVING_SIZE_PREPARATION_BASIS.DRAINED_PRODUCT;
    else if (/dry\s+mix|uncooked/i.test(orig)) basis = SERVING_SIZE_PREPARATION_BASIS.DRY_PRODUCT;

    return {
      amount: Number(rawAmt),
      value: Number(rawAmt),
      unit,
      basis,
      originalText: orig,
      evidence: input.evidence || null,
      sku: input.sku || input.productVariant || null,
      productVariant: input.productVariant || input.sku || null,
      artworkVersion: input.artworkVersion || null,
      sourceStatus: input.sourceStatus || null,
      documentId: input.documentId || null
    };
  }

  const str = String(input).trim();
  if (!str) return { amount: null, value: null, unit: '', basis: SERVING_SIZE_PREPARATION_BASIS.UNKNOWN, originalText: '', sourceStatus: null };

  // Detect preparation basis
  let basis = SERVING_SIZE_PREPARATION_BASIS.AS_PACKAGED;
  if (/with\s+milk|with\s+water|prepared|as\s+prepared/i.test(str)) {
    basis = SERVING_SIZE_PREPARATION_BASIS.AS_PREPARED;
  } else if (/cooked|after\s+cooking/i.test(str)) {
    basis = SERVING_SIZE_PREPARATION_BASIS.COOKED_PRODUCT;
  } else if (/drained/i.test(str)) {
    basis = SERVING_SIZE_PREPARATION_BASIS.DRAINED_PRODUCT;
  } else if (/dry\s+mix|uncooked|dry/i.test(str)) {
    basis = SERVING_SIZE_PREPARATION_BASIS.DRY_PRODUCT;
  }

  // Look for parenthetical metric first: e.g. "1/2 cup (85 g)" or "1 bar (40g)"
  const parenMatch = str.match(/\(([\d.]+)\s*([a-zA-Z]+)\)/);
  if (parenMatch) {
    const amt = parseFloat(parenMatch[1]);
    return {
      amount: amt,
      value: amt,
      unit: normalizeUnit(parenMatch[2]),
      basis,
      originalText: str,
      sourceStatus: null
    };
  }

  // Direct match: e.g. "85 g", "0.085 kg", "3 oz"
  const directMatch = str.match(/([\d.]+)\s*(kg|mg|g|ml|cl|l|oz|lb)\b/i);
  if (directMatch) {
    const amt = parseFloat(directMatch[1]);
    return {
      amount: amt,
      value: amt,
      unit: normalizeUnit(directMatch[2]),
      basis,
      originalText: str,
      sourceStatus: null
    };
  }

  // Generic numeric match with trailing unit
  const genericMatch = str.match(/([\d.]+)\s*([a-zA-Z]+)/);
  if (genericMatch) {
    const amt = parseFloat(genericMatch[1]);
    return {
      amount: amt,
      value: amt,
      unit: normalizeUnit(genericMatch[2]),
      basis,
      originalText: str,
      sourceStatus: null
    };
  }

  return { amount: null, value: null, unit: '', basis, originalText: str, sourceStatus: null };
}

/**
 * Parses declared net quantity declaration into amount and unit.
 * Excludes gross weight references.
 */
export function parseNetWeight(input) {
  if (input === null || input === undefined) {
    return { amount: null, value: null, unit: '', originalText: '', isGrossWeight: false, isFluidOunce: false, sourceStatus: null };
  }

  if (typeof input === 'number') {
    return {
      amount: input,
      value: input,
      unit: 'g',
      originalText: `${input} g`,
      isGrossWeight: false,
      isFluidOunce: false,
      sourceStatus: null
    };
  }

  if (typeof input === 'object' && (input.amount !== undefined || input.value !== undefined)) {
    const rawAmt = input.amount !== undefined ? input.amount : input.value;
    const unit = normalizeUnit(input.unit || 'g');
    return {
      amount: Number(rawAmt),
      value: Number(rawAmt),
      unit,
      originalText: input.originalText || input.quote || `${rawAmt} ${unit}`,
      isGrossWeight: Boolean(input.isGrossWeight),
      isFluidOunce: unit === 'fl oz',
      evidence: input.evidence || null,
      sku: input.sku || input.productVariant || null,
      productVariant: input.productVariant || input.sku || null,
      artworkVersion: input.artworkVersion || null,
      sourceStatus: input.sourceStatus || null,
      documentId: input.documentId || null
    };
  }

  const str = String(input).trim();
  if (!str) return { amount: null, value: null, unit: '', originalText: '', isGrossWeight: false, isFluidOunce: false, sourceStatus: null };

  // Detect gross weight vs net weight
  const hasNet = /\bnet\s*(?:wt\.?|weight|quantity)?\b/i.test(str);
  const isGrossOnly = /\bgross\s*(?:wt\.?|weight)\b/i.test(str) && !hasNet;

  // Check fluid ounces
  const isFluidOunce = /\bfl(?:uid)?\.?\s*oz\b/i.test(str);

  // If both Net and Gross are present (e.g. "Gross Weight 550 g (Net 480 g)"):
  const parenNetMatch = str.match(/\(net\s*(?:wt\.?|weight)?\s*:?\s*(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|l|oz|lb|fl\s*oz)?\)/i);
  if (parenNetMatch) {
    const amt = parseFloat(parenNetMatch[1]);
    const unit = normalizeUnit(parenNetMatch[2] || 'g');
    return {
      amount: amt,
      value: amt,
      unit,
      originalText: str,
      isGrossWeight: false,
      isFluidOunce: unit === 'fl oz' || isFluidOunce,
      sourceStatus: null
    };
  }

  // Extract explicit NET weight if present
  const netExplicitMatch = str.match(/\bnet\s*(?:wt\.?|weight|quantity)?\s*:?\s*(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|l|oz|lb|fl\s*oz)\b/i);
  if (netExplicitMatch) {
    const amt = parseFloat(netExplicitMatch[1]);
    const unit = normalizeUnit(netExplicitMatch[2]);
    return {
      amount: amt,
      value: amt,
      unit,
      originalText: str,
      isGrossWeight: false,
      isFluidOunce: unit === 'fl oz' || isFluidOunce,
      sourceStatus: null
    };
  }

  // Match standard quantity
  const match = str.match(/(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|l|oz|lb|fl\s*oz)\b/i);
  if (match) {
    const amt = parseFloat(match[1]);
    const unit = normalizeUnit(match[2]);
    return {
      amount: amt,
      value: amt,
      unit,
      originalText: str,
      isGrossWeight: isGrossOnly,
      isFluidOunce: unit === 'fl oz' || isFluidOunce,
      sourceStatus: null
    };
  }

  return { amount: null, value: null, unit: '', originalText: str, isGrossWeight: isGrossOnly, isFluidOunce, sourceStatus: null };
}

/**
 * Pure deterministic packaging quantity consistency evaluator.
 * 
 * Formula:
 * EXPECTED_PACK_WEIGHT = SERVINGS_PER_CONTAINER × SERVING_SIZE
 * DIFFERENCE = EXPECTED_PACK_WEIGHT - DECLARED_NET_WEIGHT
 * ABSOLUTE_DIFFERENCE = ABS(DIFFERENCE)
 * PERCENT_DIFFERENCE = ABSOLUTE_DIFFERENCE / DECLARED_NET_WEIGHT × 100
 */
export function evaluatePackQuantityConsistency({
  servings,
  servingSize,
  netQuantity,
  productContext = {},
  ruleProfile = {},
  densityGPerMl = null,
  tolerance = 0.05
} = {}) {
  const parsedServings = parseServingsCount(servings);
  const parsedServingSize = parseServingSize(servingSize);
  const parsedNet = parseNetWeight(netQuantity);

  const calculationSteps = [];
  const limitations = [];
  const assumptions = [];
  const blockers = [];
  const anomalies = [];

  const inputEvidence = {
    servings: parsedServings,
    servingSize: parsedServingSize,
    netWeight: parsedNet
  };

  // Check draft or unconfirmed source authority
  const draftSources = [parsedServings.sourceStatus, parsedServingSize.sourceStatus, parsedNet.sourceStatus, productContext.sourceStatus].filter(Boolean);
  if (draftSources.some(s => /draft|in\s*review|unconfirmed/i.test(s))) {
    assumptions.push(`Draft or In Review source reference authority used (${[...new Set(draftSources)].join(', ')}).`);
  }

  // 1. OCR anomaly check
  if (parsedServings.suspiciousOcr) {
    anomalies.push({ field: 'servings', message: parsedServings.reason });
    blockers.push(parsedServings.reason);
    return {
      status: 'review',
      verdict: QUANTITY_SCREENING_VERDICT.REVIEW,
      ruleEvaluationOutcome: 'REVIEW',
      screeningOutcome: 'REVIEW_OCR_ANOMALY',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: parsedNet.amount,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: [parsedServings.reason],
      limitations: ['Human review required to verify suspicious OCR character in serving count declaration.'],
      assumptions,
      blockers,
      anomalies,
      reason: parsedServings.reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (OCR Anomaly)'
    };
  }

  // 2. Missing inputs check
  const missing = [];
  if (parsedServings.value === null || parsedServings.value === undefined) missing.push('Serving count');
  if (parsedServingSize.amount === null || parsedServingSize.amount === undefined) missing.push('Serving size');
  if (parsedNet.amount === null || parsedNet.amount === undefined) missing.push('Declared net weight');

  if (missing.length > 0) {
    const reason = `Essential quantity inputs missing: ${missing.join(', ')}. Cannot compute package quantity consistency.`;
    blockers.push(reason);
    return {
      status: 'unable',
      verdict: QUANTITY_SCREENING_VERDICT.UNABLE,
      ruleEvaluationOutcome: 'UNABLE',
      screeningOutcome: 'UNABLE_MISSING_INPUTS',
      passes: false,
      missingInputs: missing,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: [`Missing inputs: ${missing.join(', ')}`],
      limitations: ['Calculation blocked: incomplete input data.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Incomplete Inputs)'
    };
  }

  const sCount = Number(parsedServings.value);
  const sAmount = Number(parsedServingSize.amount);
  const netAmount = Number(parsedNet.amount);

  // 3. Negative inputs check
  if (sCount < 0 || sAmount < 0 || netAmount < 0) {
    const reason = 'Negative quantity inputs are physically invalid. Must be positive values.';
    blockers.push(reason);
    return {
      status: 'unable',
      verdict: QUANTITY_SCREENING_VERDICT.UNABLE,
      ruleEvaluationOutcome: 'UNABLE',
      screeningOutcome: 'UNABLE_NEGATIVE_INPUT',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: ['Input validation failed: negative values supplied.'],
      limitations: ['Negative values rejected.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Invalid Negative Input)'
    };
  }

  // 4. Zero net quantity check
  if (netAmount === 0) {
    const reason = 'Declared net weight is zero; cannot compute ratio or percentage discrepancy. Must be a positive quantity.';
    blockers.push(reason);
    return {
      status: 'unable',
      verdict: QUANTITY_SCREENING_VERDICT.UNABLE,
      ruleEvaluationOutcome: 'UNABLE',
      screeningOutcome: 'UNABLE_ZERO_NET_WEIGHT',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: 0,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: ['Declared net weight is zero.'],
      limitations: ['Zero net weight declaration.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Zero Net Weight)'
    };
  }

  // 5. Gross weight confusion check
  if (parsedNet.isGrossWeight) {
    const reason = 'Gross weight declared instead of net weight. Exclude tare packaging mass before mathematical verification.';
    blockers.push(reason);
    return {
      status: 'review',
      verdict: QUANTITY_SCREENING_VERDICT.REVIEW,
      ruleEvaluationOutcome: 'REVIEW',
      screeningOutcome: 'REVIEW_GROSS_WEIGHT',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: [reason],
      limitations: ['Gross weight cannot be compared directly against net contents.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Gross vs Net Mismatch)'
    };
  }

  // 6. Conflicting Source Values Check
  if (Array.isArray(productContext?.conflictingCandidates) && productContext.conflictingCandidates.length > 1) {
    const reason = `Conflicting source values detected in specification candidates (${productContext.conflictingCandidates.map(c => c.label || c.netWeight || 'candidate').join(' vs ')}).`;
    blockers.push(reason);
    return {
      status: 'review',
      verdict: QUANTITY_SCREENING_VERDICT.REVIEW,
      ruleEvaluationOutcome: 'REVIEW',
      screeningOutcome: 'REVIEW_CONFLICTING_SOURCES',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: [reason],
      limitations: ['Conflicting specification sources require reviewer resolution.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Conflicting Sources)'
    };
  }

  // 7. Cross-Variant / Cross-SKU separation
  const skuA = parsedServings.sku || parsedServings.productVariant || productContext.servingsSku;
  const skuB = parsedServingSize.sku || parsedServingSize.productVariant || productContext.servingSizeSku;
  const skuC = parsedNet.sku || parsedNet.productVariant || productContext.netWeightSku;
  const skus = [skuA, skuB, skuC].filter(Boolean);
  if (skus.length > 1 && new Set(skus).size > 1) {
    const reason = `Cross-SKU product variant mismatch detected across quantity sources (${[...new Set(skus)].join(' ↔ ')}). Do not combine values from different SKUs.`;
    blockers.push(reason);
    return {
      status: 'review',
      verdict: QUANTITY_SCREENING_VERDICT.REVIEW,
      ruleEvaluationOutcome: 'REVIEW',
      screeningOutcome: 'REVIEW_CROSS_SKU',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: [reason],
      limitations: ['Cross-variant calculation blocked.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Cross-SKU Blocked)'
    };
  }

  // 8. Artwork version separation
  const verA = parsedServings.artworkVersion;
  const verB = parsedServingSize.artworkVersion;
  const verC = parsedNet.artworkVersion;
  const versions = [verA, verB, verC].filter(Boolean);
  if (versions.length > 1 && new Set(versions).size > 1) {
    const reason = `Artwork version/revision mismatch detected across quantity sources (${[...new Set(versions)].join(' ↔ ')}). Do not mix revisions.`;
    blockers.push(reason);
    return {
      status: 'review',
      verdict: QUANTITY_SCREENING_VERDICT.REVIEW,
      ruleEvaluationOutcome: 'REVIEW',
      screeningOutcome: 'REVIEW_REVISION_MISMATCH',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      calculationSteps: [reason],
      limitations: ['Multi-revision calculation blocked.'],
      assumptions,
      blockers,
      anomalies,
      reason,
      formula: 'Expected Pack Mass = Servings × Serving Size (Revision Mismatch)'
    };
  }

  // 9. Unit Normalization to Grams
  const sUnitDim = getUnitDimension(parsedServingSize.unit);
  const netUnitDim = getUnitDimension(parsedNet.unit);

  if (parsedNet.isFluidOunce || sUnitDim === 'volume' || netUnitDim === 'volume') {
    if (sUnitDim !== netUnitDim) {
      if (!densityGPerMl || Number(densityGPerMl) <= 0) {
        const reason = `Mass (${parsedServingSize.unit}) is not interchangeable with volume (${parsedNet.unit}) without verified product density data. (1 mL ≠ 1 g for non-water matrices).`;
        blockers.push(reason);
        return {
          status: 'unable',
          verdict: QUANTITY_SCREENING_VERDICT.UNABLE,
          ruleEvaluationOutcome: 'UNABLE',
          screeningOutcome: 'UNABLE_VOLUME_MASS_MISMATCH',
          passes: false,
          expectedPackMassG: null,
          declaredPackMassG: null,
          differenceG: null,
          absoluteDifferenceG: null,
          percentDifference: null,
          percentDifferenceFormatted: 'N/A',
          inputEvidence,
          reason,
          calculationSteps: [
            `Serving size unit: ${parsedServingSize.unit} (${sUnitDim})`,
            `Declared net quantity unit: ${parsedNet.unit} (${netUnitDim})`,
            `Cross-dimensional comparison blocked without density.`
          ],
          limitations: ['Mass and volume cannot be equated without verified product density.'],
          assumptions,
          blockers,
          anomalies,
          formula: 'Expected Pack Mass = Servings × Serving Size (Density Required)'
        };
      }
    }
  }

  const servingConv = convertUnits(sAmount, parsedServingSize.unit, 'g', { densityGPerMl });
  const netConv = convertUnits(netAmount, parsedNet.unit, 'g', { densityGPerMl });

  if (!servingConv.ok || !netConv.ok) {
    const reason = `Unit conversion failure: ${servingConv.error || netConv.error}`;
    blockers.push(reason);
    return {
      status: 'unable',
      verdict: QUANTITY_SCREENING_VERDICT.UNABLE,
      ruleEvaluationOutcome: 'UNABLE',
      screeningOutcome: 'UNABLE_UNIT_CONVERSION',
      passes: false,
      expectedPackMassG: null,
      declaredPackMassG: null,
      differenceG: null,
      absoluteDifferenceG: null,
      percentDifference: null,
      percentDifferenceFormatted: 'N/A',
      inputEvidence,
      reason,
      calculationSteps: [reason],
      limitations: ['Unit conversion failure.'],
      assumptions,
      blockers,
      anomalies,
      formula: 'Expected Pack Mass = Servings × Serving Size (Conversion Failed)'
    };
  }

  const servingSizeG = servingConv.value;
  const declaredPackMassG = netConv.value;

  // 10. Serving Size Preparation Basis Check (AS_PACKAGED vs AS_PREPARED / COOKED)
  const prepBasis = parsedServingSize.basis || SERVING_SIZE_PREPARATION_BASIS.AS_PACKAGED;
  const isBasisMismatch = prepBasis === SERVING_SIZE_PREPARATION_BASIS.AS_PREPARED ||
                          prepBasis === SERVING_SIZE_PREPARATION_BASIS.COOKED_PRODUCT;

  // 11. Core Arithmetic: Exact Calculations (Unrounded intermediate representation)
  const exactExpectedPackMassG = sCount * servingSizeG;
  const exactDifferenceG = exactExpectedPackMassG - declaredPackMassG;
  const exactAbsoluteDifferenceG = Math.abs(exactDifferenceG);
  const exactPercentDifference = (exactAbsoluteDifferenceG / declaredPackMassG) * 100;

  // Clean rounding for display
  const displayExpectedG = Number(exactExpectedPackMassG.toFixed(2));
  const displayDeclaredG = Number(declaredPackMassG.toFixed(2));
  const displayDifferenceG = Number(exactDifferenceG.toFixed(2));
  const displayAbsDiffG = Number(exactAbsoluteDifferenceG.toFixed(2));
  const displayPercentDiff = Number(exactPercentDifference.toFixed(1));
  const percentDifferenceFormatted = `${displayPercentDiff}%`;

  // Build step-by-step arithmetic proof trail
  calculationSteps.push(`Servings per container: ${sCount}${parsedServings.isApproximate ? ` (${parsedServings.qualifier})` : ''}`);
  calculationSteps.push(`Serving size: ${sAmount} ${parsedServingSize.unit}${parsedServingSize.unit !== 'g' ? ` = ${servingSizeG.toFixed(2)} g` : ''} (${prepBasis})`);
  calculationSteps.push(`Expected package mass: ${sCount} servings × ${servingSizeG.toFixed(2)} g = ${displayExpectedG} g`);
  calculationSteps.push(`Declared net weight: ${netAmount} ${parsedNet.unit}${parsedNet.unit !== 'g' ? ` = ${displayDeclaredG} g` : ''}`);
  calculationSteps.push(`Difference: ${displayExpectedG} g - ${displayDeclaredG} g = ${exactDifferenceG >= 0 ? '+' : ''}${displayDifferenceG} g (${percentDifferenceFormatted})`);

  // 12. Verdict Classification
  let status = 'match';
  let verdict = QUANTITY_SCREENING_VERDICT.MATCH;
  let ruleEvaluationOutcome = 'MATCH';
  let screeningOutcome = 'MATCH_CONSISTENT';
  let explanation = '';

  const isExactMatch = exactAbsoluteDifferenceG <= 0.05 || exactPercentDifference <= 0.5;
  const isWithinTolerance = exactPercentDifference <= (tolerance * 100);

  if (isBasisMismatch) {
    status = 'review';
    verdict = QUANTITY_SCREENING_VERDICT.REVIEW;
    ruleEvaluationOutcome = 'REVIEW';
    screeningOutcome = 'REVIEW_BASIS_MISMATCH';
    explanation = `Serving size is declared on a prepared/cooked basis (${prepBasis}), which includes external ingredients or water uptake. Cannot directly verify dry package net weight without yield conversion data.`;
    limitations.push(`Preparation basis mismatch: serving size represents ${prepBasis}, while net weight represents packaged goods.`);
  } else if (parsedServings.isApproximate) {
    assumptions.push(`Approximate serving count declaration limits precision of exact mass-balance check.`);
    if (isWithinTolerance) {
      status = 'match';
      verdict = QUANTITY_SCREENING_VERDICT.MATCH;
      ruleEvaluationOutcome = 'MATCH';
      screeningOutcome = 'MATCH_APPROXIMATE';
      explanation = `Serving count (${sCount} ${parsedServings.qualifier}) × serving size (${sAmount} ${parsedServingSize.unit}) approximately matches net weight (${netAmount} ${parsedNet.unit}) within ${percentDifferenceFormatted}.`;
    } else {
      status = 'review';
      verdict = QUANTITY_SCREENING_VERDICT.REVIEW;
      ruleEvaluationOutcome = 'REVIEW';
      screeningOutcome = 'REVIEW_APPROXIMATE_COUNT';
      explanation = `Implied package mass (${displayExpectedG} g) differs by ${displayAbsDiffG} g (${percentDifferenceFormatted}) from declared net weight (${displayDeclaredG} g). Because serving count is approximate ("${parsedServings.originalText}"), confirm count and packaging target with R&D before release.`;
      limitations.push('Approximate serving count declaration limits precision of exact mass-balance check.');
    }
  } else if (productContext.sourceStatus && /draft|in\s*review|unconfirmed/i.test(productContext.sourceStatus)) {
    status = 'review';
    verdict = QUANTITY_SCREENING_VERDICT.REVIEW;
    ruleEvaluationOutcome = 'REVIEW';
    screeningOutcome = 'REVIEW_DRAFT_SOURCE';
    explanation = `Package quantity arithmetic differs by ${displayAbsDiffG} g (${percentDifferenceFormatted}), but source specification is ${productContext.sourceStatus}. Confirm approved formulation values.`;
    limitations.push('Unconfirmed or draft specification provided as reference.');
  } else {
    // Exact verified inputs
    if (isWithinTolerance) {
      status = 'match';
      verdict = QUANTITY_SCREENING_VERDICT.MATCH;
      ruleEvaluationOutcome = 'MATCH';
      screeningOutcome = 'MATCH_EXACT';
      explanation = `Serving count (${sCount}) × serving size (${sAmount} ${parsedServingSize.unit}) equals ${displayExpectedG} g, aligning consistently with declared net weight (${displayDeclaredG} g).`;
    } else {
      status = 'issue';
      verdict = QUANTITY_SCREENING_VERDICT.ISSUE;
      ruleEvaluationOutcome = 'ISSUE';
      screeningOutcome = 'ISSUE_DISCREPANCY';
      explanation = `Material quantity discrepancy: ${sCount} servings × ${sAmount} ${parsedServingSize.unit} implies ${displayExpectedG} g package mass, contradicting declared net weight of ${displayDeclaredG} g by ${displayAbsDiffG} g (${percentDifferenceFormatted}).`;
    }
  }

  const formula = `${sCount} servings × ${sAmount} ${parsedServingSize.unit} = ${displayExpectedG} g (Declared: ${displayDeclaredG} g, Diff: ${displayAbsDiffG} g / ${percentDifferenceFormatted})`;

  return {
    status,
    verdict,
    ruleEvaluationOutcome,
    screeningOutcome,
    passes: status === 'match',
    servingsCount: sCount,
    servingSizeGrams: servingSizeG,
    declaredNetWeightGrams: declaredPackMassG,
    expectedPackMassG: displayExpectedG,
    declaredPackMassG: displayDeclaredG,
    differenceG: displayDifferenceG,
    absoluteDifferenceG: displayAbsDiffG,
    percentDifference: exactPercentDifference,
    percentDifferenceFormatted,
    rawExpectedPackMassG: exactExpectedPackMassG,
    rawDifferenceG: exactDifferenceG,
    rawAbsoluteDifferenceG: exactAbsoluteDifferenceG,
    rawPercentDifference: exactPercentDifference,
    inputEvidence,
    inputs: {
      servings: {
        value: sCount,
        qualifier: parsedServings.qualifier,
        isApproximate: parsedServings.isApproximate,
        originalText: parsedServings.originalText,
        evidence: parsedServings.evidence,
        sourceStatus: parsedServings.sourceStatus
      },
      servingSize: {
        amount: sAmount,
        unit: parsedServingSize.unit,
        grams: servingSizeG,
        basis: prepBasis,
        originalText: parsedServingSize.originalText,
        evidence: parsedServingSize.evidence,
        sourceStatus: parsedServingSize.sourceStatus
      },
      netWeight: {
        amount: netAmount,
        unit: parsedNet.unit,
        grams: declaredPackMassG,
        originalText: parsedNet.originalText,
        evidence: parsedNet.evidence,
        sourceStatus: parsedNet.sourceStatus
      }
    },
    formula,
    calculationSteps,
    explanation,
    limitations,
    assumptions,
    blockers,
    anomalies,
    isApproximate: parsedServings.isApproximate,
    isBasisMismatch,
    method: 'serving_net_weight_arithmetic',
    ruleCitation: ruleProfile?.citation || 'Net Quantity Consistency'
  };
}

/**
 * Formats structured text proof for logging, cards, or reports.
 */
export function formatPackQuantityProof(result) {
  if (!result) return '';
  return [
    'PACK QUANTITY CONSISTENCY PROOF',
    `Formula: Expected Pack Weight = Servings per Container × Serving Size`,
    `Calculation: ${result.formula || 'N/A'}`,
    `Expected Mass: ${result.expectedPackMassG} g`,
    `Declared Mass: ${result.declaredPackMassG} g`,
    `Difference: ${result.absoluteDifferenceG} g (${result.percentDifference}%)`,
    `Outcome: ${result.verdict || result.status?.toUpperCase()}`,
    result.explanation ? `Note: ${result.explanation}` : ''
  ].filter(Boolean).join('\n');
}
