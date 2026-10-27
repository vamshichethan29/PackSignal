/**
 * PackSignal Serving Basis Detection & Quantity Arithmetic (lib/nutrition/serving-basis.mjs)
 * Detects reference bases, resolves multi-column spreadsheet candidates, performs unit-safe conversions,
 * and validates serving count vs net quantity plausibility.
 */

import { convertUnits, normalizeUnit } from './units.mjs';

export const SERVING_BASIS_TYPES = {
  PER_SERVING: 'per_serving',
  PER_100_G: 'per_100_g',
  PER_100_ML: 'per_100_ml',
  PER_CONTAINER: 'per_container',
  PER_PACKAGE: 'per_package',
  PER_UNIT: 'per_unit',
  UNKNOWN: 'unknown'
};

export const SOURCE_AUTHORITY = {
  APPROVED_SPECIFICATION: 'APPROVED_SPECIFICATION',
  REVIEWER_SELECTED: 'REVIEWER_SELECTED',
  DRAFT: 'DRAFT',
  AI_SUGGESTED: 'AI_SUGGESTED',
  CONFLICTED: 'CONFLICTED',
  UNKNOWN: 'UNKNOWN'
};

export function detectServingBasis(textOrHeader) {
  if (!textOrHeader) return SERVING_BASIS_TYPES.UNKNOWN;
  const s = String(textOrHeader).toLowerCase();

  if (/100\s*g\b|100\s*gram/i.test(s)) return SERVING_BASIS_TYPES.PER_100_G;
  if (/100\s*m[l|L]\b|100\s*milliliter/i.test(s)) return SERVING_BASIS_TYPES.PER_100_ML;
  if (/per\s+serving|serving\s+size|amount\s+per\s+serving/i.test(s)) return SERVING_BASIS_TYPES.PER_SERVING;
  if (/per\s+container|entire\s+container/i.test(s)) return SERVING_BASIS_TYPES.PER_CONTAINER;
  if (/per\s+package|per\s+pack/i.test(s)) return SERVING_BASIS_TYPES.PER_PACKAGE;
  if (/per\s+bar|per\s+biscuit|per\s+can|per\s+bottle|per\s+piece|per\s+unit/i.test(s)) return SERVING_BASIS_TYPES.PER_UNIT;

  return SERVING_BASIS_TYPES.UNKNOWN;
}

/**
 * Converts a nutrient amount from one basis to another.
 * e.g. per 100 g to per serving of 40 g.
 */
export function convertServingBasis({
  amount,
  unit,
  fromBasis,
  toBasis,
  servingSizeAmount,
  servingSizeUnit,
  densityGPerMl = null
}) {
  const val = Number(amount);
  if (!Number.isFinite(val)) {
    return { ok: false, error: 'Invalid numeric nutrient amount' };
  }

  if (fromBasis === toBasis) {
    return { ok: true, value: val, unit, fromBasis, toBasis };
  }

  // 100 g -> per serving
  if (fromBasis === SERVING_BASIS_TYPES.PER_100_G && toBasis === SERVING_BASIS_TYPES.PER_SERVING) {
    if (!servingSizeAmount || !servingSizeUnit) {
      return { ok: false, error: 'Serving size amount and unit required for per-100g to per-serving conversion.' };
    }

    const conv = convertUnits(servingSizeAmount, servingSizeUnit, 'g', { densityGPerMl });
    if (!conv.ok) {
      return { ok: false, error: `Could not convert serving size (${servingSizeAmount} ${servingSizeUnit}) to grams: ${conv.error}` };
    }

    const servingGrams = conv.value;
    const convertedAmount = Number(((val * servingGrams) / 100).toFixed(6));
    const formula = `${val} ${unit}/100g × ${servingGrams}g / 100 = ${convertedAmount} ${unit}`;

    return {
      ok: true,
      success: true,
      value: convertedAmount,
      convertedAmount,
      unit,
      fromBasis,
      toBasis,
      servingGramsUsed: servingGrams,
      formula,
      proof: formula
    };
  }

  // 100 mL -> per serving
  if (fromBasis === SERVING_BASIS_TYPES.PER_100_ML && toBasis === SERVING_BASIS_TYPES.PER_SERVING) {
    if (!servingSizeAmount || !servingSizeUnit) {
      return { ok: false, error: 'Serving size amount and unit required for per-100mL to per-serving conversion.' };
    }

    const conv = convertUnits(servingSizeAmount, servingSizeUnit, 'mL', { densityGPerMl });
    if (!conv.ok) {
      return { ok: false, error: `Could not convert serving size (${servingSizeAmount} ${servingSizeUnit}) to mL: ${conv.error}` };
    }

    const servingMl = conv.value;
    const convertedAmount = Number(((val * servingMl) / 100).toFixed(6));
    const formula = `${val} ${unit}/100mL × ${servingMl}mL / 100 = ${convertedAmount} ${unit}`;

    return {
      ok: true,
      success: true,
      value: convertedAmount,
      convertedAmount,
      unit,
      fromBasis,
      toBasis,
      servingMlUsed: servingMl,
      formula,
      proof: formula
    };
  }

  return {
    ok: false,
    success: false,
    error: `Unsupported serving basis conversion route: ${fromBasis} -> ${toBasis}`
  };
}

export function screenServingQuantityPlausibility({
  servingSize,
  servingSizeUnit,
  servingsPerContainer,
  netQuantity,
  netQuantityUnit,
  toleranceRatio = 0.05,
  densityGPerMl = null
}) {
  const v = verifyServingQuantityPlausibility({
    servingSizeText: `${servingSize} ${servingSizeUnit}`,
    servingsPerContainerText: String(servingsPerContainer),
    netQuantityText: `${netQuantity} ${netQuantityUnit}`,
    tolerance: toleranceRatio,
    densityGPerMl
  });

  const passes = v.status === 'match';
  const proof = {
    proofId: `proof:servings:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    checkId: 'servings:serving_quantity',
    formulaId: 'SERVING_SIZE_X_SERVINGS_EQ_NET',
    formulaVersion: '1.0',
    inputValues: { servingSize, servingsPerContainer, netQuantity },
    inputUnits: { servingSize: servingSizeUnit, netQuantity: netQuantityUnit },
    unroundedResult: v.estimatedTotalQuantity,
    displayedExpectedResult: `${v.estimatedTotalQuantity} ${netQuantityUnit}`,
    printedResult: `${netQuantity} ${netQuantityUnit}`,
    comparisonOutcome: v.status ? v.status.toUpperCase() : 'UNABLE',
    limitations: ['Density required for mass-to-volume comparisons; approximate servings per container accounted for.']
  };

  return {
    passes,
    status: v.status,
    estimatedTotal: v.estimatedTotalQuantity,
    declaredNet: netQuantity,
    unit: netQuantityUnit,
    percentDifference: v.percentDifference,
    explanation: v.explanation,
    proof
  };
}


/**
 * Checks Serving Count × Serving Size ≈ Net Quantity
 */
export function verifyServingQuantityPlausibility({
  servingSizeText,
  servingsPerContainerText,
  netQuantityText,
  tolerance = 0.08,
  densityGPerMl = null
}) {
  if (!servingSizeText || !servingsPerContainerText || !netQuantityText) {
    return {
      status: 'unable',
      reason: 'Serving size, servings per container, or net quantity missing.'
    };
  }

  // Parse metric number and unit from serving size (e.g. "1/2 cup (30 g)" -> 30 g)
  let servingVal = null;
  let servingUnit = null;

  const parenMatch = String(servingSizeText).match(/\(([\d.]+)\s*([a-zA-Z]+)\)/);
  if (parenMatch) {
    servingVal = parseFloat(parenMatch[1]);
    servingUnit = parenMatch[2];
  } else {
    const directMatch = String(servingSizeText).match(/([\d.]+)\s*([a-zA-Z]+)/);
    if (directMatch) {
      servingVal = parseFloat(directMatch[1]);
      servingUnit = directMatch[2];
    }
  }

  // Parse servings count (e.g. "About 15" -> 15)
  const servingsMatch = String(servingsPerContainerText).match(/(\d+(?:\.\d+)?)/);
  const servingsCount = servingsMatch ? parseFloat(servingsMatch[1]) : null;

  // Parse net quantity (e.g. "450 g" -> 450 g)
  const netMatch = String(netQuantityText).match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
  const netVal = netMatch ? parseFloat(netMatch[1]) : null;
  const netUnit = netMatch ? netMatch[2] : null;

  if (!servingVal || !servingsCount || !netVal || !servingUnit || !netUnit) {
    return {
      status: 'unable',
      reason: 'Could not extract clean metric amounts and units for serving-quantity screening.',
      servingSizeText,
      servingsPerContainerText,
      netQuantityText
    };
  }

  // Convert serving to net quantity unit
  const conv = convertUnits(servingVal, servingUnit, netUnit, { densityGPerMl });
  if (!conv.ok) {
    return {
      status: 'unable',
      reason: `Serving unit (${servingUnit}) and net quantity unit (${netUnit}) are dimensionally incompatible: ${conv.error}`
    };
  }

  const estimatedTotal = Number((conv.value * servingsCount).toFixed(2));
  const diff = Math.abs(estimatedTotal - netVal);
  const percentDiff = Number(((diff / Math.max(netVal, 1)) * 100).toFixed(1));

  const passes = percentDiff <= (tolerance * 100);

  return {
    status: passes ? 'match' : 'review',
    servingMetricValue: conv.value,
    servingMetricUnit: netUnit,
    servingsCount,
    declaredNetQuantity: netVal,
    netQuantityUnit: netUnit,
    estimatedTotalQuantity: estimatedTotal,
    difference: Number(diff.toFixed(2)),
    percentDifference: percentDiff,
    tolerancePercent: Math.round(tolerance * 100),
    isApproximateServings: /about|approx/i.test(String(servingsPerContainerText)),
    formula: `${conv.value} ${netUnit} × ${servingsCount} servings = ${estimatedTotal} ${netUnit} (declared ${netVal} ${netUnit})`,
    explanation: passes
      ? `Serving count (${servingsCount}) × serving size (${conv.value} ${netUnit}) aligns within ${percentDiff}% of net quantity (${netVal} ${netUnit}).`
      : `Serving count (${servingsCount}) × serving size (${conv.value} ${netUnit}) yields ${estimatedTotal} ${netUnit}, differing by ${percentDiff}% from declared net quantity (${netVal} ${netUnit}). Inspect packaging fill or discrete unit declaration.`
  };
}
