/**
 * lib/nutrition/atwater.mjs
 * 
 * PackSignal Advanced Atwater Calorie Verification Engine
 * Implements:
 * 1. 9/4/4 Mathematical Proof (Fat x 9 + Carb x 4 + Protein x 4)
 * 2. Serving Basis Normalization (e.g., 100g <-> serving size)
 * 3. Macronutrient Mass-Balance Validation (sum of macros vs basis mass)
 * 4. Regulatory Calculation Modes under FDA 21 CFR 101.9(c)(1)(i)
 * 5. FDA Calorie Label Rounding (<=50: 5 kcal, >50: 10 kcal increments)
 * 6. Evidence-backed Structured Mathematical Proofs
 */

import { convertUnits } from './units.mjs';

export const ATWATER_CALCULATION_METHODS = {
  GENERAL_ATWATER_4_4_9: 'GENERAL_ATWATER_4_4_9',
  SPECIFIC_ATWATER: 'SPECIFIC_ATWATER',
  FIBER_POLYOL_ADJUSTED: 'FIBER_POLYOL_ADJUSTED',
  OTHER_AUTHORIZED_METHOD: 'OTHER_AUTHORIZED_METHOD',
  UNDETERMINED: 'UNDETERMINED'
};

export const NUTRITION_BASIS_TYPES = {
  PER_SERVING: 'PER_SERVING',
  PER_100G: 'PER_100G',
  PER_100ML: 'PER_100ML',
  PER_PACKAGE: 'PER_PACKAGE',
  PER_PORTION: 'PER_PORTION',
  UNKNOWN: 'UNKNOWN'
};

export const NUTRITION_PRECISION = {
  UNROUNDED_APPROVED_DATA: 'UNROUNDED_APPROVED_DATA',
  ROUNDED_LABEL_VALUES: 'ROUNDED_LABEL_VALUES',
  UNKNOWN_PRECISION: 'UNKNOWN_PRECISION'
};

/**
 * Normalizes basis string to standard canonical basis enum
 */
export function normalizeBasisType(basis) {
  if (!basis) return NUTRITION_BASIS_TYPES.UNKNOWN;
  const s = String(basis).toUpperCase().replace(/[\s-]+/g, '_');
  if (s.includes('100G') || s.includes('100_G')) return NUTRITION_BASIS_TYPES.PER_100G;
  if (s.includes('100ML') || s.includes('100_ML')) return NUTRITION_BASIS_TYPES.PER_100ML;
  if (s.includes('SERVING')) return NUTRITION_BASIS_TYPES.PER_SERVING;
  if (s.includes('PACKAGE') || s.includes('CONTAINER') || s.includes('PACK')) return NUTRITION_BASIS_TYPES.PER_PACKAGE;
  if (s.includes('PORTION') || s.includes('UNIT') || s.includes('PIECE')) return NUTRITION_BASIS_TYPES.PER_PORTION;
  return NUTRITION_BASIS_TYPES.UNKNOWN;
}

/**
 * FDA 21 CFR 101.9(c)(1) Calorie Label Rounding
 * - Calories < 5: 0 kcal (or "less than 5")
 * - Calories <= 50: nearest 5-calorie increment
 * - Calories > 50: nearest 10-calorie increment
 */
export function roundFdaCalories(unroundedKcal) {
  const n = Number(unroundedKcal);
  if (!Number.isFinite(n) || n < 5) return 0;
  if (n <= 50) return Math.round(n / 5) * 5;
  return Math.round(n / 10) * 10;
}

/**
 * Returns the acceptable continuous unrounded interval for a declared rounded calorie value
 */
export function fdaCalorieUnderlyingInterval(declaredRounded) {
  const d = Number(declaredRounded);
  if (!Number.isFinite(d)) return [0, 0];
  if (d === 0) return [0, 5];
  if (d <= 50) return [Math.max(0, d - 2.5), d + 2.5];
  return [Math.max(0, d - 5), d + 5];
}

/**
 * Core Atwater 9/4/4 Calculation Engine
 * 
 * Formula:
 * Fat contribution = Fat (g) * 9
 * Carbohydrate contribution = Carbohydrate (g) * 4
 * Protein contribution = Protein (g) * 4
 * Total = sum of contributions
 * 
 * @param {Object} params
 * @param {number} params.fatGrams
 * @param {number} params.carbohydrateGrams
 * @param {number} params.proteinGrams
 * @param {number} [params.declaredCalories]
 * @param {string} [params.basis='PER_SERVING']
 * @param {string} [params.calculationMethod='GENERAL_ATWATER_4_4_9']
 * @param {Object} [params.specificFactors] - e.g. { fat: 8.37, carb: 3.87, protein: 3.47 }
 * @param {Object} [params.fiberAdjustments] - e.g. { insolubleFiberGrams: 2.0 }
 * @param {Object} [params.polyols] - e.g. { sugarAlcoholGrams: 5.0, polyolFactor: 2.0 }
 * @param {string} [params.precision='ROUNDED_LABEL_VALUES']
 * @returns {Object} Comprehensive calculation proof and audit result
 */
export function calculateAtwater({
  fatGrams,
  carbohydrateGrams,
  proteinGrams,
  declaredCalories = null,
  basis = NUTRITION_BASIS_TYPES.PER_SERVING,
  calculationMethod = ATWATER_CALCULATION_METHODS.GENERAL_ATWATER_4_4_9,
  specificFactors = null,
  fiberAdjustments = null,
  polyols = null,
  precision = NUTRITION_PRECISION.ROUNDED_LABEL_VALUES,
  tolerance = 0.20
} = {}) {
  const canonicalBasis = normalizeBasisType(basis);
  const limitations = [];
  const proofSteps = [];

  // Input validation
  const missingInputs = [];
  if (fatGrams === undefined || fatGrams === null) missingInputs.push('fat');
  if (carbohydrateGrams === undefined || carbohydrateGrams === null) missingInputs.push('carbohydrate');
  if (proteinGrams === undefined || proteinGrams === null) missingInputs.push('protein');

  if (missingInputs.length > 0) {
    return {
      status: 'unable',
      verdict: 'UNABLE',
      passes: false,
      reason: `Missing required macronutrients for calorie calculation: ${missingInputs.join(', ')}`,
      missingInputs,
      limitations: ['Calculation blocked: essential macronutrient amounts not supplied.']
    };
  }

  const fat = Number(fatGrams);
  const carb = Number(carbohydrateGrams);
  const prot = Number(proteinGrams);

  if (!Number.isFinite(fat) || !Number.isFinite(carb) || !Number.isFinite(prot)) {
    return {
      status: 'unable',
      verdict: 'UNABLE',
      passes: false,
      reason: 'Macronutrient values must be valid numbers.',
      limitations: ['Non-numeric or NaN values encountered in macronutrients.']
    };
  }

  if (fat < 0 || carb < 0 || prot < 0) {
    return {
      status: 'unable',
      verdict: 'UNABLE',
      passes: false,
      reason: 'Macronutrient values cannot be negative.',
      limitations: ['Negative macronutrient values rejected as physical impossibilities.']
    };
  }

  // Method factor determination
  let fatFactor = 9;
  let carbFactor = 4;
  let protFactor = 4;
  let effectiveMethod = calculationMethod;

  if (calculationMethod === ATWATER_CALCULATION_METHODS.SPECIFIC_ATWATER) {
    if (specificFactors && specificFactors.fat && specificFactors.carb && specificFactors.protein) {
      fatFactor = Number(specificFactors.fat);
      carbFactor = Number(specificFactors.carb);
      protFactor = Number(specificFactors.protein);
      proofSteps.push(`Applied food-specific Atwater factors: Fat ${fatFactor}, Carb ${carbFactor}, Protein ${protFactor} (USDA Handbook 74 / 21 CFR 101.9(c)(1)(i)(A)).`);
    } else {
      effectiveMethod = ATWATER_CALCULATION_METHODS.GENERAL_ATWATER_4_4_9;
      limitations.push('Specific Atwater parameters not supplied; fell back to general 9/4/4 screening factors (21 CFR 101.9(c)(1)(i)(B)).');
    }
  }

  // Adjustments for fiber or polyols if method requested
  let netCarbGrams = carb;
  let fiberDeductionKcal = 0;
  let polyolKcal = 0;

  if (calculationMethod === ATWATER_CALCULATION_METHODS.FIBER_POLYOL_ADJUSTED) {
    if (fiberAdjustments && Number.isFinite(fiberAdjustments.insolubleFiberGrams)) {
      const insFiber = Math.max(0, Number(fiberAdjustments.insolubleFiberGrams));
      netCarbGrams = Math.max(0, carb - insFiber);
      fiberDeductionKcal = Number((insFiber * carbFactor).toFixed(2));
      proofSteps.push(`Subtracted ${insFiber} g insoluble dietary fiber from total carbohydrate (${carb} g -> ${netCarbGrams} g, -${fiberDeductionKcal} kcal) under 21 CFR 101.9(c)(1)(i)(C).`);
    } else if (fiberAdjustments && Number.isFinite(fiberAdjustments.totalFiberGrams)) {
      limitations.push('Only total dietary fiber was available; insoluble fraction could not be determined without formulation breakdown.');
    }

    if (polyols && Number.isFinite(polyols.sugarAlcoholGrams) && Number.isFinite(polyols.polyolFactor)) {
      const pG = Number(polyols.sugarAlcoholGrams);
      const pF = Number(polyols.polyolFactor);
      polyolKcal = Number((pG * pF).toFixed(2));
      proofSteps.push(`Added sugar alcohol contribution: ${pG} g x ${pF} kcal/g = ${polyolKcal} kcal (21 CFR 101.9(c)(1)(i)(E)).`);
    }
  }

  // Primary Exact Contributions
  const fatCalories = Number((fat * fatFactor).toFixed(4));
  const carbohydrateCalories = Number((netCarbGrams * carbFactor).toFixed(4));
  const proteinCalories = Number((prot * protFactor).toFixed(4));
  const unroundedTotalCalories = Number((fatCalories + carbohydrateCalories + proteinCalories + polyolKcal).toFixed(4));
  const totalCalories = Number(unroundedTotalCalories.toFixed(1));
  const fdaRoundedExpectedCalories = roundFdaCalories(unroundedTotalCalories);

  proofSteps.push(`Fat: ${fat} g × ${fatFactor} = ${fatCalories.toFixed(1)} kcal`);
  proofSteps.push(`Carbohydrate: ${netCarbGrams} g × ${carbFactor} = ${carbohydrateCalories.toFixed(1)} kcal`);
  proofSteps.push(`Protein: ${prot} g × ${protFactor} = ${proteinCalories.toFixed(1)} kcal`);
  proofSteps.push(`Unrounded Calculated Total: ${unroundedTotalCalories.toFixed(2)} kcal`);
  proofSteps.push(`FDA Rounded Expected (21 CFR 101.9): ${fdaRoundedExpectedCalories} kcal`);

  limitations.push('General 9/4/4 is a screening heuristic. Under 21 CFR 101.9(c)(1)(i), food-specific Atwater factors, insoluble fiber deductions, or polyol energy factors may lawfully alter label calories.');

  // Comparison with declared calories if provided
  let declared = null;
  let difference = null;
  let percentDifference = null;
  let passesScreening = null;
  let status = 'match';
  let verdict = 'MATCH';
  let explanation = '';

  if (declaredCalories !== null && declaredCalories !== undefined) {
    declared = Number(declaredCalories);
    if (!Number.isFinite(declared)) {
      return {
        status: 'unable',
        verdict: 'UNABLE',
        passes: false,
        reason: 'Declared calories must be a valid number.',
        limitations
      };
    }

    difference = Number(Math.abs(declared - unroundedTotalCalories).toFixed(2));
    const denom = Math.max(declared, unroundedTotalCalories, 1);
    percentDifference = Number(((difference / denom) * 100).toFixed(1));

    // Tolerance screen: 20% screening heuristic
    passesScreening = (difference / denom) <= tolerance;

    // FDA Rounding comparison: check if declared falls within interval of calculated
    const [minUnderlying, maxUnderlying] = fdaCalorieUnderlyingInterval(declared);
    const withinRoundingInterval = unroundedTotalCalories >= minUnderlying && unroundedTotalCalories <= maxUnderlying;

    if (withinRoundingInterval) {
      status = 'match';
      verdict = 'MATCH';
      explanation = `Declared calories (${declared} kcal) exactly matches calculated energy (${totalCalories} kcal, rounded ${fdaRoundedExpectedCalories} kcal) within statutory FDA rounding intervals (21 CFR 101.9(c)(1)).`;
    } else if (passesScreening) {
      status = 'match';
      verdict = 'MATCH';
      explanation = `Declared calories (${declared} kcal) aligns within internal 20% screening tolerance of general Atwater estimate (${totalCalories} kcal, ${percentDifference}% diff).`;
    } else {
      // Divergence: Notice requirement:
      // "Do not classify a finding as a regulatory ISSUE using only a general 9/4/4 screening estimate and an arbitrary percentage tolerance."
      // Therefore, screening divergence yields 'review', not 'issue'!
      status = 'review';
      verdict = 'REVIEW';
      explanation = `Declared calories (${declared} kcal) differs by ${difference} kcal (${percentDifference}%) from 9/4/4 macronutrient calculation (${totalCalories} kcal). Confirm approved formulation, unrounded analytical values, or applicable food-specific factors (21 CFR 101.9(c)(1)(i)).`;
    }
  } else {
    explanation = `Calculated 9/4/4 energy estimate: ${totalCalories} kcal (FDA rounded: ${fdaRoundedExpectedCalories} kcal).`;
  }

  return {
    status,
    verdict,
    passes: passesScreening ?? true,
    passesScreening: passesScreening ?? true,
    declaredCalories: declared,
    unroundedTotalCalories,
    estimatedCalories: totalCalories,
    totalCalories,
    fdaRoundedExpectedCalories,
    difference,
    differenceKcal: difference,
    calorieDifference: difference,
    percentDifference,
    tolerancePercent: Math.round(tolerance * 100),
    fatCalories: Number(fatCalories.toFixed(2)),
    carbohydrateCalories: Number(carbohydrateCalories.toFixed(2)),
    proteinCalories: Number(proteinCalories.toFixed(2)),
    macronutrients: {
      fat: { grams: fat, factor: fatFactor, subtotalKcal: Number(fatCalories.toFixed(2)) },
      carbohydrate: { grams: carb, netGrams: netCarbGrams, factor: carbFactor, subtotalKcal: Number(carbohydrateCalories.toFixed(2)) },
      protein: { grams: prot, factor: protFactor, subtotalKcal: Number(proteinCalories.toFixed(2)) }
    },
    basis: canonicalBasis,
    method: effectiveMethod,
    precision,
    proofSteps,
    formula: `(${fat}g × ${fatFactor}) + (${netCarbGrams}g × ${carbFactor}) + (${prot}g × ${protFactor}) = ${totalCalories} kcal`,
    explanation,
    limitations
  };
}

/**
 * Serving Size Normalization
 * Converts nutrient values between basis systems (e.g. per 100 g -> per serving).
 * 
 * Example:
 * 535 kcal per 100 g normalized to 31 g serving:
 * 535 * 31 / 100 = 165.85 kcal (~166 kcal).
 */
export function normalizeNutritionBasis({
  nutrientValues = {},
  sourceBasis,
  targetBasis = NUTRITION_BASIS_TYPES.PER_SERVING,
  servingSize,
  servingSizeUnit = 'g',
  densityGPerMl = null
} = {}) {
  const src = normalizeBasisType(sourceBasis);
  const tgt = normalizeBasisType(targetBasis);

  if (src === NUTRITION_BASIS_TYPES.UNKNOWN || tgt === NUTRITION_BASIS_TYPES.UNKNOWN) {
    return {
      ok: false,
      error: 'Cannot normalize nutrition values: source or target measurement basis is UNKNOWN.',
      normalizedValues: null
    };
  }

  if (src === tgt) {
    return {
      ok: true,
      factor: 1.0,
      sourceBasis: src,
      targetBasis: tgt,
      normalizedValues: { ...nutrientValues }
    };
  }

  if (src === NUTRITION_BASIS_TYPES.PER_100G && tgt === NUTRITION_BASIS_TYPES.PER_SERVING) {
    const sSize = Number(servingSize);
    if (!Number.isFinite(sSize) || sSize <= 0) {
      return {
        ok: false,
        error: 'Serving size in grams is required for per-100g to per-serving normalization.',
        normalizedValues: null
      };
    }

    const ratio = sSize / 100;
    const normalized = {};
    const formulas = {};

    for (const [key, val] of Object.entries(nutrientValues)) {
      if (val === null || val === undefined) continue;
      const n = Number(val);
      if (Number.isFinite(n)) {
        const converted = Number((n * ratio).toFixed(4));
        normalized[key] = converted;
        formulas[key] = `${n} / 100g × ${sSize}g = ${converted}`;
      } else {
        normalized[key] = val;
      }
    }

    return {
      ok: true,
      ratio,
      factor: ratio,
      servingGramsUsed: sSize,
      sourceBasis: src,
      targetBasis: tgt,
      normalizedValues: normalized,
      formulas,
      explanation: `Normalized values from per 100 g to per serving of ${sSize} ${servingSizeUnit} (scaling factor ${ratio}).`
    };
  }

  if (src === NUTRITION_BASIS_TYPES.PER_SERVING && tgt === NUTRITION_BASIS_TYPES.PER_100G) {
    const sSize = Number(servingSize);
    if (!Number.isFinite(sSize) || sSize <= 0) {
      return {
        ok: false,
        error: 'Serving size in grams is required for per-serving to per-100g normalization.',
        normalizedValues: null
      };
    }

    const ratio = 100 / sSize;
    const normalized = {};
    for (const [key, val] of Object.entries(nutrientValues)) {
      if (val === null || val === undefined) continue;
      const n = Number(val);
      normalized[key] = Number.isFinite(n) ? Number((n * ratio).toFixed(4)) : val;
    }

    return {
      ok: true,
      ratio,
      factor: ratio,
      servingGramsUsed: sSize,
      sourceBasis: src,
      targetBasis: tgt,
      normalizedValues: normalized,
      explanation: `Normalized values from per serving (${sSize} ${servingSizeUnit}) to per 100 g (scaling factor ${ratio.toFixed(4)}).`
    };
  }

  return {
    ok: false,
    error: `Unsupported basis normalization route: ${src} -> ${tgt}`,
    normalizedValues: null
  };
}

/**
 * Nutrition Mass-Balance Validation
 * 
 * Verifies that the sum of macronutrients (Fat + Carbohydrate + Protein)
 * does not exceed the total physical mass of the declared basis.
 * 
 * E.g., for a 100 g basis:
 * 15g Fat + 66g Carbs + 34g Protein = 115g > 100g -> Mass balance violation!
 * 
 * Possible root causes:
 * - OCR decimal loss (e.g. 6.6g read as 66g)
 * - Multi-column transcription error
 * - Different product variant
 * - Basis mismatch (e.g. 100g values placed in per-serving slot)
 * - Duplicated carbohydrate subcomponents (adding sugars to total carb)
 */
export function checkMassBalance({
  fatGrams,
  carbohydrateGrams,
  proteinGrams,
  basis = NUTRITION_BASIS_TYPES.PER_SERVING,
  basisMassGrams = null,
  servingSizeGrams = null,
  toleranceGrams = 1.0
} = {}) {
  const fat = Number(fatGrams) || 0;
  const carb = Number(carbohydrateGrams) || 0;
  const prot = Number(proteinGrams) || 0;

  const totalMacroGrams = Number((fat + carb + prot).toFixed(2));
  const canonicalBasis = normalizeBasisType(basis);

  let expectedMaxGrams = basisMassGrams;
  if (!expectedMaxGrams) {
    if (canonicalBasis === NUTRITION_BASIS_TYPES.PER_100G) {
      expectedMaxGrams = 100;
    } else if (canonicalBasis === NUTRITION_BASIS_TYPES.PER_SERVING && servingSizeGrams) {
      expectedMaxGrams = Number(servingSizeGrams);
    } else if (totalMacroGrams > 100 && !servingSizeGrams) {
      expectedMaxGrams = 100;
    }
  }

  if (!expectedMaxGrams || expectedMaxGrams <= 0) {
    return {
      status: 'unable',
      passes: true,
      totalMacroGrams,
      reason: 'Physical basis mass unknown; mass balance plausibility screen skipped.'
    };
  }

  const exceeds = totalMacroGrams > (expectedMaxGrams + toleranceGrams);
  const excessGrams = exceeds ? Number((totalMacroGrams - expectedMaxGrams).toFixed(2)) : 0;

  const potentialCauses = [];
  if (exceeds) {
    potentialCauses.push('OCR decimal omission in one or more macronutrient lines (e.g. 66 g instead of 6.6 g).');
    potentialCauses.push('Basis mismatch: per-100g formulation values entered under a smaller per-serving heading.');
    potentialCauses.push('Multi-column transcription conflict between different package sizes or variants.');
    potentialCauses.push('Carbohydrate subcomponents (e.g. dietary fiber or sugars) inadvertently summed with total carbohydrates.');
  }

  return {
    status: exceeds ? 'review' : 'match',
    passes: !exceeds,
    totalMacroGrams,
    expectedMaxGrams,
    excessGrams,
    potentialCauses,
    explanation: exceeds
      ? `Macronutrient mass sum (${totalMacroGrams} g = ${fat}g Fat + ${carb}g Carb + ${prot}g Protein) exceeds declared basis mass (${expectedMaxGrams} g) by ${excessGrams} g. This indicates potential OCR decimal loss, basis column confusion, or transcription error.`
      : `Macronutrient mass sum (${totalMacroGrams} g) is plausible within declared basis mass (${expectedMaxGrams} g).`
  };
}

/**
 * Formats structured mathematical proof into an explainable text summary
 */
export function formatAtwaterProof(result) {
  if (!result) return 'No Atwater calculation available.';
  const lines = [
    '========================================',
    'CALORIE CONSISTENCY CHECK (9/4/4 ATWATER)',
    '========================================',
    `Declared: ${result.declaredCalories ?? 'Not declared'} kcal`,
    `Fat: ${result.macronutrients?.fat?.grams ?? 0} g × ${result.macronutrients?.fat?.factor ?? 9} = ${result.fatCalories} kcal`,
    `Carbohydrates: ${result.macronutrients?.carbohydrate?.netGrams ?? result.macronutrients?.carbohydrate?.grams ?? 0} g × ${result.macronutrients?.carbohydrate?.factor ?? 4} = ${result.carbohydrateCalories} kcal`,
    `Protein: ${result.macronutrients?.protein?.grams ?? 0} g × ${result.macronutrients?.protein?.factor ?? 4} = ${result.proteinCalories} kcal`,
    '----------------------------------------',
    `Calculated Energy: ${result.estimatedCalories} kcal`,
    `FDA Rounded (21 CFR 101.9): ${result.fdaRoundedExpectedCalories} kcal`,
    `Numerical Difference: ${result.differenceKcal ?? 0} kcal (${result.percentDifference ?? 0}%)`,
    `Calculation Basis: ${result.basis}`,
    `Calculation Method: ${result.method}`,
    `Verification Status: ${result.verdict}`,
    `Explanation: ${result.explanation}`
  ];

  if (result.limitations?.length) {
    lines.push('Limitations:');
    for (const lim of result.limitations) {
      lines.push(` - ${lim}`);
    }
  }

  return lines.join('\n');
}
