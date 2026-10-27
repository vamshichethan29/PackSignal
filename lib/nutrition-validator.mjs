/**
 * PackSignal Nutrition & Daily Value Validator (Phase 2)
 * 
 * Implements deterministic FDA 2016 %DV calculations, Atwater calorie screening,
 * serving-size checks, nutrient consistency, unit conversions, multi-panel mapping,
 * and mathematical proofs.
 * 
 * Applicable Standard: US FDA 21 CFR 101.9 (2016 Revision).
 */

export {
  validateNutrition,
  NUTRITION_VALIDATOR_VERSION,
  NUTRITION_RULE_PACK_VERSION
} from './nutrition/index.mjs';

export {
  normalizeNutrientId,
  getNutrientDefinition,
  NUTRIENTS
} from './nutrition/nutrient-registry.mjs';

export {
  convertUnits,
  areUnitsCompatible,
  validateConversion
} from './nutrition/units.mjs';

export {
  roundNutrientValue,
  roundDailyValuePercent,
  compatibleUnderlyingInterval
} from './nutrition/rounding.mjs';

export {
  calculateDailyValue,
  FDA_2016_DAILY_VALUES as FDA_DAILY_VALUES_REGISTRY
} from './nutrition/daily-values.mjs';

export {
  screenCaloriePlausibility,
  calculateAtwater,
  normalizeNutritionBasis,
  checkMassBalance,
  roundFdaCalories,
  formatAtwaterProof,
  ATWATER_CALCULATION_METHODS,
  NUTRITION_BASIS_TYPES
} from './nutrition/calories.mjs';

export {
  screenSugarsVersusCarbohydrates,
  screenAddedSugarsVersusTotalSugars,
  screenSaturatedFatVersusTotalFat
} from './nutrition/consistency.mjs';

export {
  convertServingBasis,
  screenServingQuantityPlausibility
} from './nutrition/serving-basis.mjs';

export {
  createCalculationProof,
  formatProofAsText
} from './nutrition/proof.mjs';

// Backward-compatible FDA 2016 Daily Reference Values (DRV) and Reference Daily Intakes (RDI) for adults & children >= 4 years
export const FDA_2016_DAILY_VALUES = {
  totalFat: { name: 'Total Fat', standardValue: 78, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  saturatedFat: { name: 'Saturated Fat', standardValue: 20, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  cholesterol: { name: 'Cholesterol', standardValue: 300, unit: 'mg', cfr: '21 CFR 101.9(c)(9)' },
  sodium: { name: 'Sodium', standardValue: 2300, unit: 'mg', cfr: '21 CFR 101.9(c)(9)' },
  totalCarbohydrate: { name: 'Total Carbohydrate', standardValue: 275, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  dietaryFiber: { name: 'Dietary Fiber', standardValue: 28, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  addedSugars: { name: 'Added Sugars', standardValue: 50, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  protein: { name: 'Protein', standardValue: 50, unit: 'g', cfr: '21 CFR 101.9(c)(7)' },
  vitaminD: { name: 'Vitamin D', standardValue: 20, unit: 'mcg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  calcium: { name: 'Calcium', standardValue: 1300, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  iron: { name: 'Iron', standardValue: 18, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  potassium: { name: 'Potassium', standardValue: 4700, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' }
};

/**
 * Calculates deterministic % Daily Value under FDA 21 CFR 101.9.
 * (Backward-compatible helper)
 */
export function calculateDailyValuePercent(nutrientKey, declaredAmount) {
  const ref = FDA_2016_DAILY_VALUES[nutrientKey];
  if (!ref || declaredAmount == null || isNaN(declaredAmount)) {
    return null;
  }

  const rawPercent = (declaredAmount / ref.standardValue) * 100;
  let roundedPercent = Math.round(rawPercent);
  if (rawPercent < 1.0 && rawPercent > 0) {
    roundedPercent = Math.round(rawPercent * 10) / 10;
  }

  return {
    nutrient: ref.name,
    nutrientKey,
    declaredAmount,
    referenceStandard: ref.standardValue,
    referenceUnit: ref.unit,
    standardCfr: ref.cfr,
    rawPercent: Number(rawPercent.toFixed(2)),
    computedPercent: roundedPercent,
    calculationFormula: `${declaredAmount} ${ref.unit} / ${ref.standardValue} ${ref.unit} = ${rawPercent.toFixed(1)}%`
  };
}

/**
 * Validates declared %DV on packaging artwork against computed FDA 2016 Daily Value.
 * (Backward-compatible helper)
 */
export function verifyDailyValue(nutrientKey, declaredAmount, printedPercent) {
  const dv = calculateDailyValuePercent(nutrientKey, declaredAmount);
  if (!dv) return null;

  const printed = typeof printedPercent === 'string'
    ? parseFloat(printedPercent.replace(/[^0-9.]/g, ''))
    : printedPercent;

  if (isNaN(printed)) {
    return {
      ...dv,
      printedPercent: null,
      status: 'unable',
      discrepancy: 'Printed %DV could not be parsed as a numeric value.'
    };
  }

  const diff = Math.abs(printed - dv.computedPercent);
  const isMatch = diff <= 1.0;

  return {
    ...dv,
    printedPercent: printed,
    difference: Number((printed - dv.computedPercent).toFixed(1)),
    status: isMatch ? 'match' : 'issue',
    findingStatus: isMatch ? 'VERIFIED_CALCULATION' : 'DV_CALCULATION_DISCREPANCY',
    proof: `${dv.nutrient}: printed ${printed}% DV vs computed ${dv.computedPercent}% DV (${dv.calculationFormula})`
  };
}

/**
 * Atwater Calorie Plausibility Screening.
 * (Backward-compatible helper)
 */
export function screenAtwaterCalories(fatGrams, carbGrams, proteinGrams, declaredCalories) {
  if (fatGrams == null || carbGrams == null || proteinGrams == null) {
    return {
      status: 'unable',
      reason: 'Fat, carbohydrate, or protein amounts are missing for calorie screening.'
    };
  }

  const fatKcal = fatGrams * 9;
  const carbKcal = carbGrams * 4;
  const proteinKcal = proteinGrams * 4;
  const estimatedTotalKcal = fatKcal + carbKcal + proteinKcal;

  const declared = parseFloat(declaredCalories);
  const difference = isNaN(declared) ? null : estimatedTotalKcal - declared;
  const percentDiff = isNaN(declared) || declared === 0 ? null : Math.abs(difference / declared) * 100;

  const isSignificantDivergence = percentDiff !== null && percentDiff > 20;

  return {
    declaredCalories: declared,
    macronutrients: {
      fat: { grams: fatGrams, kcalPerGram: 9, subtotalKcal: fatKcal },
      carbohydrate: { grams: carbGrams, kcalPerGram: 4, subtotalKcal: carbKcal },
      protein: { grams: proteinGrams, kcalPerGram: 4, subtotalKcal: proteinKcal }
    },
    estimatedCalories: estimatedTotalKcal,
    calorieDifference: difference,
    percentDifference: percentDiff ? Number(percentDiff.toFixed(1)) : null,
    formula: `(${fatGrams}g × 9) + (${carbGrams}g × 4) + (${proteinGrams}g × 4) = ${estimatedTotalKcal} kcal`,
    status: isSignificantDivergence ? 'review' : 'match',
    findingStatus: isSignificantDivergence ? 'CALORIE_PLAUSIBILITY_REVIEW' : 'CALORIES_PLAUSIBLE',
    explanation: isSignificantDivergence
      ? `Declared calories (${declared} kcal) diverge significantly from standard 4-4-9 macronutrient calculation (${estimatedTotalKcal} kcal). Recommend technical review of digestible carbs, fiber deductions, or Atwater specific factors.`
      : `Declared calories (${declared} kcal) align within plausible tolerance of macronutrient sum (${estimatedTotalKcal} kcal).`,
    limitations: 'General 4-4-9 factors are a screening heuristic. Food-specific factors (e.g. USDA Handbook 74) or dietary fiber deductions may lawfully alter final label calories.'
  };
}

/**
 * Serving Size and Pack Geometry Arithmetic.
 * (Backward-compatible helper)
 */
export function verifyServingSizeArithmetic(netWeightGrams, servingsPerContainer, declaredServingText) {
  if (!netWeightGrams || !servingsPerContainer) {
    return null;
  }

  const calculatedServingGrams = netWeightGrams / servingsPerContainer;
  const hasUnit = /[a-zA-Z]/.test(declaredServingText || '');
  const declaredNumberMatch = (declaredServingText || '').match(/(\d+(?:\.\d+)?)/);
  const declaredNumber = declaredNumberMatch ? parseFloat(declaredNumberMatch[1]) : null;

  const issues = [];
  if (declaredServingText && !hasUnit) {
    issues.push('Declared serving size lacks a unit of measurement (e.g. "g" or household measure).');
  }

  if (declaredNumber !== null && Math.abs(declaredNumber - calculatedServingGrams) > 2) {
    issues.push(`Calculated serving (${netWeightGrams}g / ${servingsPerContainer} servings = ${calculatedServingGrams}g) does not equal declared serving value (${declaredNumber}).`);
  }

  const totalProductGrams = declaredNumber !== null ? Number((declaredNumber * servingsPerContainer).toFixed(1)) : null;
  const declaredNetWeightGrams = netWeightGrams;
  const differenceGrams = totalProductGrams !== null ? Number((totalProductGrams - netWeightGrams).toFixed(1)) : null;

  return {
    netWeightGrams,
    servingsPerContainer,
    calculatedServingGrams: Number(calculatedServingGrams.toFixed(1)),
    declaredServingText,
    declaredNumber,
    hasUnit,
    totalProductGrams,
    declaredNetWeightGrams,
    differenceGrams,
    issues,
    status: issues.length > 0 ? 'review' : 'match',
    formula: `${netWeightGrams}g / ${servingsPerContainer} servings = ${calculatedServingGrams}g/serving`
  };
}

/**
 * Internal Nutrient Consistency.
 * (Backward-compatible helper)
 */
export function verifyCarbohydrateSugarConsistency(carbohydrateGrams, totalSugarsGrams) {
  if (carbohydrateGrams == null || totalSugarsGrams == null) return null;

  if (totalSugarsGrams > carbohydrateGrams) {
    return {
      status: 'issue',
      findingStatus: 'SUGARS_EXCEED_CARBOHYDRATES',
      carbohydrateGrams,
      totalSugarsGrams,
      explanation: `Total Sugars (${totalSugarsGrams}g) exceeds Total Carbohydrate (${carbohydrateGrams}g), which is an arithmetic impossibility since sugars are a chemical subset of carbohydrates.`
    };
  }

  return {
    status: 'match',
    carbohydrateGrams,
    totalSugarsGrams
  };
}
