/**
 * PackSignal Cross-Market Nutrition Engine (lib/regulatory/nutrition.mjs)
 * Transparent unit conversions, dual energy math (kJ and kcal), sodium-to-salt calculation,
 * and jurisdiction-specific reference values (US FDA 2016 DV, EU 1169 Reference Intakes, FSSAI RDA).
 */

export const US_FDA_DAILY_VALUES = {
  totalFat: { name: 'Total Fat', value: 78, unit: 'g', citation: '21 CFR 101.9(c)(9)' },
  saturatedFat: { name: 'Saturated Fat', value: 20, unit: 'g', citation: '21 CFR 101.9(c)(9)' },
  cholesterol: { name: 'Cholesterol', value: 300, unit: 'mg', citation: '21 CFR 101.9(c)(9)' },
  sodium: { name: 'Sodium', value: 2300, unit: 'mg', citation: '21 CFR 101.9(c)(9)' },
  totalCarbohydrate: { name: 'Total Carbohydrate', value: 275, unit: 'g', citation: '21 CFR 101.9(c)(9)' },
  dietaryFiber: { name: 'Dietary Fiber', value: 28, unit: 'g', citation: '21 CFR 101.9(c)(9)' },
  addedSugars: { name: 'Added Sugars', value: 50, unit: 'g', citation: '21 CFR 101.9(c)(9)' },
  protein: { name: 'Protein', value: 50, unit: 'g', citation: '21 CFR 101.9(c)(7)' },
  vitaminD: { name: 'Vitamin D', value: 20, unit: 'mcg', citation: '21 CFR 101.9(c)(8)(iv)' },
  calcium: { name: 'Calcium', value: 1300, unit: 'mg', citation: '21 CFR 101.9(c)(8)(iv)' },
  iron: { name: 'Iron', value: 18, unit: 'mg', citation: '21 CFR 101.9(c)(8)(iv)' },
  potassium: { name: 'Potassium', value: 4700, unit: 'mg', citation: '21 CFR 101.9(c)(8)(iv)' },
};

export const EU_1169_REFERENCE_INTAKES = {
  energyKj: { name: 'Energy (kJ)', value: 8400, unit: 'kJ', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  energyKcal: { name: 'Energy (kcal)', value: 2000, unit: 'kcal', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  totalFat: { name: 'Total Fat', value: 70, unit: 'g', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  saturates: { name: 'Saturates', value: 20, unit: 'g', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  carbohydrate: { name: 'Carbohydrate', value: 260, unit: 'g', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  sugars: { name: 'Sugars', value: 90, unit: 'g', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  protein: { name: 'Protein', value: 50, unit: 'g', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
  salt: { name: 'Salt', value: 6, unit: 'g', citation: 'Regulation (EU) No 1169/2011, Annex XIII, Part B' },
};

export const FSSAI_RDA_VALUES = {
  energyKcal: { name: 'Energy', value: 2000, unit: 'kcal', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
  protein: { name: 'Protein', value: 54, unit: 'g', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
  totalFat: { name: 'Total Fat', value: 67, unit: 'g', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
  saturatedFat: { name: 'Saturated Fat', value: 22, unit: 'g', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
  transFat: { name: 'Trans Fat', value: 2, unit: 'g', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
  addedSugars: { name: 'Added Sugars', value: 50, unit: 'g', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
  sodium: { name: 'Sodium', value: 2000, unit: 'mg', citation: 'FSSAI (Labelling and Display) Reg 2020, Schedule II' },
};

/**
 * 1 kcal = 4.184 kJ
 */
export function kcalToKj(kcal) {
  if (kcal == null || isNaN(kcal)) return null;
  return Math.round(Number(kcal) * 4.184);
}

export function kjToKcal(kj) {
  if (kj == null || isNaN(kj)) return null;
  return Math.round(Number(kj) / 4.184);
}

/**
 * EU Salt to Sodium conversion: Salt = Sodium (g) * 2.5
 */
export function sodiumMgToSaltG(sodiumMg) {
  if (sodiumMg == null || isNaN(sodiumMg)) return null;
  const sodiumG = Number(sodiumMg) / 1000;
  return Number((sodiumG * 2.5).toFixed(2));
}

export function saltGToSodiumMg(saltG) {
  if (saltG == null || isNaN(saltG)) return null;
  const sodiumG = Number(saltG) / 2.5;
  return Math.round(sodiumG * 1000);
}

/**
 * Converts value from per-serving basis to per-100g basis.
 * Requires verified serving size in grams or mL.
 */
export function convertServingToPer100(value, servingGrams) {
  if (value == null || isNaN(value)) return null;
  if (!servingGrams || isNaN(servingGrams) || Number(servingGrams) <= 0) {
    return {
      possible: false,
      reason: 'Serving size in grams or mL is required for per-100 conversion without guessing density.',
    };
  }
  const ratio = 100 / Number(servingGrams);
  const result = Number(value) * ratio;
  return {
    possible: true,
    value: Number(result.toFixed(2)),
    ratio: Number(ratio.toFixed(4)),
    formula: `${value} × (100 / ${servingGrams}) = ${result.toFixed(2)}`,
  };
}

/**
 * Verifies mathematical relationship between declared kJ and kcal in EU declarations.
 * Under Regulation 1169/2011, 1 kcal = 4.184 kJ. Permissible ratio tolerance is ~4.0 - 4.3.
 */
export function verifyEuDualEnergy(kjVal, kcalVal) {
  if (kjVal == null || kcalVal == null || isNaN(kjVal) || isNaN(kcalVal)) {
    return { valid: false, reason: 'Both kJ and kcal values must be numerical for dual energy verification.' };
  }
  const kj = Number(kjVal);
  const kcal = Number(kcalVal);
  if (kcal <= 0 || kj <= 0) {
    return { valid: false, reason: 'Energy values must be positive numbers.' };
  }
  const expectedKj = Math.round(kcal * 4.184);
  const ratio = kj / kcal;
  const isConsistent = (ratio >= 3.9 && ratio <= 4.4);

  return {
    valid: isConsistent,
    ratio: Number(ratio.toFixed(2)),
    expectedKj,
    declaredKj: kj,
    declaredKcal: kcal,
    delta: Math.abs(kj - expectedKj),
    explanation: isConsistent
      ? `Energy values (${kj} kJ / ${kcal} kcal) are mathematically consistent (ratio ${ratio.toFixed(2)} vs statutory 4.184).`
      : `Discrepancy in dual energy declaration: ${kcal} kcal equates to approximately ${expectedKj} kJ, but ${kj} kJ is declared (ratio ${ratio.toFixed(2)}).`,
  };
}

/**
 * Calculates % Daily Value for US FDA nutrients.
 */
export function computeUsFdaDailyValue(nutrientKey, amount) {
  const ref = US_FDA_DAILY_VALUES[nutrientKey] || US_FDA_DAILY_VALUES[Object.keys(US_FDA_DAILY_VALUES).find(k => k.toLowerCase() === String(nutrientKey).toLowerCase())];
  if (!ref || amount == null || isNaN(amount)) return null;
  const rawPct = (Number(amount) / ref.value) * 100;
  const roundedPct = Math.round(rawPct);
  return {
    nutrient: ref.name,
    amount: Number(amount),
    unit: ref.unit,
    standardValue: ref.value,
    referenceDailyValue: ref.value,
    rawPercent: Number(rawPct.toFixed(2)),
    expectedPercent: roundedPct,
    percentDailyValue: roundedPct,
    citation: ref.citation,
    formula: `${amount} ${ref.unit} / ${ref.value} ${ref.unit} = ${rawPct.toFixed(1)}% (rounded ${roundedPct}%)`,
  };
}

/**
 * Calculates % RDA under FSSAI (Labelling and Display) Regulations 2020.
 */
export function computeFssaiRdaPercent(nutrientKey, amount) {
  const ref = FSSAI_RDA_VALUES[nutrientKey] || FSSAI_RDA_VALUES[Object.keys(FSSAI_RDA_VALUES).find(k => k.toLowerCase() === String(nutrientKey).toLowerCase())];
  if (!ref || amount == null || isNaN(amount)) return null;
  const rawPct = (Number(amount) / ref.value) * 100;
  const roundedPct = Math.round(rawPct);
  return {
    nutrient: ref.name,
    amount: Number(amount),
    unit: ref.unit,
    standardValue: ref.value,
    rdaValue: ref.value,
    rawPercent: Number(rawPct.toFixed(2)),
    expectedPercent: roundedPct,
    percentRDA: roundedPct,
    citation: ref.citation,
    formula: `${amount} ${ref.unit} / ${ref.value} ${ref.unit} = ${rawPct.toFixed(1)}% (rounded ${roundedPct}%)`,
  };
}

/**
 * Transparent unit and reference-basis conversion.
 */
export function convertNutritionBasis(value, fromBasis, toBasis, servingSizeGrams) {
  if (value == null || isNaN(value)) return { convertedValue: null, limitation: 'Invalid numeric input' };
  if (fromBasis === toBasis) return { convertedValue: Number(value), conversionFactor: 1 };

  if (fromBasis === 'per_serving' && (toBasis === 'per_100g' || toBasis === 'per_100ml')) {
    if (!servingSizeGrams || isNaN(servingSizeGrams) || Number(servingSizeGrams) <= 0) {
      return {
        convertedValue: null,
        limitation: 'Cannot convert per-serving to per-100 without verified serving size in grams or mL.',
      };
    }
    const factor = 100 / Number(servingSizeGrams);
    const converted = Number(value) * factor;
    return {
      originalValue: Number(value),
      originalBasis: fromBasis,
      conversionFactor: factor,
      expectedBasis: toBasis,
      convertedValue: Number(converted.toFixed(2)),
      formula: `${value} × (100 / ${servingSizeGrams}) = ${converted.toFixed(2)}`,
    };
  }

  if ((fromBasis === 'per_100g' || fromBasis === 'per_100ml') && toBasis === 'per_serving') {
    if (!servingSizeGrams || isNaN(servingSizeGrams) || Number(servingSizeGrams) <= 0) {
      return {
        convertedValue: null,
        limitation: 'Cannot convert per-100 to per-serving without verified serving size.',
      };
    }
    const factor = Number(servingSizeGrams) / 100;
    const converted = Number(value) * factor;
    return {
      originalValue: Number(value),
      originalBasis: fromBasis,
      conversionFactor: factor,
      expectedBasis: toBasis,
      convertedValue: Number(converted.toFixed(2)),
      formula: `${value} × (${servingSizeGrams} / 100) = ${converted.toFixed(2)}`,
    };
  }

  return {
    convertedValue: null,
    limitation: `Direct conversion between ${fromBasis} and ${toBasis} requires specific product density and specification.`,
  };
}

/**
 * Atwater 4-4-9 Calorie Plausibility Screening.
 * Under 21 CFR 101.9(c)(1), general factors of 4 kcal/g protein, 4 kcal/g carb, 9 kcal/g fat
 * are standard screening factors. FDA 21 CFR 101.9(g) allows a 20% compliance tolerance.
 */
export function evaluateAtwaterScreen(fatG, carbG, proteinG, declaredCalories, tolerance = 0.20) {
  if (typeof fatG === 'object' && fatG !== null) {
    const obj = fatG;
    fatG = obj.totalFatG ?? obj.fatG ?? obj.fat;
    carbG = obj.totalCarbG ?? obj.carbG ?? obj.carbohydrates;
    proteinG = obj.proteinG ?? obj.protein;
    declaredCalories = obj.printedCalories ?? obj.declaredCalories ?? obj.calories;
    tolerance = obj.tolerance ?? 0.20;
  }

  if (fatG == null || carbG == null || proteinG == null || declaredCalories == null ||
      isNaN(fatG) || isNaN(carbG) || isNaN(proteinG) || isNaN(declaredCalories)) {
    return {
      status: 'unable',
      verdict: 'INSUFFICIENT_INPUT',
      passes: false,
      withinTolerance: false,
      reason: 'Fat, carbohydrate, protein, and declared calories must all be supplied numerical values for Atwater screening.',
    };
  }

  const f = Number(fatG);
  const c = Number(carbG);
  const p = Number(proteinG);
  const declared = Number(declaredCalories);

  if (declared <= 0) {
    return {
      status: 'unable',
      verdict: 'INSUFFICIENT_INPUT',
      passes: false,
      withinTolerance: false,
      reason: 'Declared calories must be greater than zero.',
    };
  }

  const estimated = (f * 9) + (c * 4) + (p * 4);
  const diff = Math.abs(declared - estimated);
  const percentDiff = diff / declared;
  const passes = percentDiff <= tolerance;

  const formula = `(${f}g fat × 9) + (${c}g carb × 4) + (${p}g protein × 4) = ${estimated.toFixed(1)} kcal`;

  return {
    status: passes ? 'match' : 'review',
    verdict: passes ? 'MATH_MATCH' : 'MATH_MISMATCH',
    passes,
    withinTolerance: passes,
    estimatedCalories: Number(estimated.toFixed(1)),
    estimatedEnergyKcal: Number(estimated.toFixed(1)),
    declaredCalories: declared,
    differenceCalories: Number(diff.toFixed(1)),
    percentDifference: Number((percentDiff * 100).toFixed(1)),
    tolerancePercent: tolerance * 100,
    formula,
    citation: '21 CFR 101.9(c)(1) General Atwater factors (4-4-9)',
    explanation: passes
      ? `Declared ${declared} kcal reconciles with the 4-4-9 screening estimate (${estimated.toFixed(1)} kcal, ${(percentDiff * 100).toFixed(1)}% delta) within the statutory ${tolerance * 100}% tolerance.`
      : `Calorie discrepancy: Declared ${declared} kcal diverges from the 4-4-9 screening estimate (${estimated.toFixed(1)} kcal) by ${(percentDiff * 100).toFixed(1)}%, exceeding the ${tolerance * 100}% screening threshold.`,
  };
}

/**
 * 21 CFR 101.9 Mandatory FDA Nutrient Rounding Rules.
 */
export function calculateFdaRounding(nutrientKey, rawAmount) {
  if (rawAmount == null || isNaN(rawAmount)) return null;
  const amount = Number(rawAmount);
  const key = String(nutrientKey || '').toLowerCase();

  if (key === 'calories' || key === 'energy_kcal') {
    if (amount < 5) return 0;
    if (amount <= 50) return Math.round(amount / 5) * 5;
    return Math.round(amount / 10) * 10;
  }

  if (['totalfat', 'total_fat', 'fat', 'saturatedfat', 'saturated_fat', 'saturates'].includes(key)) {
    if (amount < 0.5) return 0;
    if (amount < 5) return Number((Math.round(amount * 2) / 2).toFixed(1));
    return Math.round(amount);
  }

  if (['transfat', 'trans_fat'].includes(key)) {
    if (amount < 0.5) return 0;
    return Number((Math.round(amount * 2) / 2).toFixed(1));
  }

  if (['cholesterol'].includes(key)) {
    if (amount < 2) return 0;
    if (amount <= 5) return 'less than 5 mg';
    return Math.round(amount / 5) * 5;
  }

  if (['sodium'].includes(key)) {
    if (amount < 5) return 0;
    if (amount <= 140) return Math.round(amount / 5) * 5;
    return Math.round(amount / 10) * 10;
  }

  if (['totalcarbohydrate', 'total_carbohydrate', 'carbohydrate', 'dietaryfiber', 'dietary_fiber', 'fiber', 'sugars', 'totalsugars', 'added_sugars', 'addedsugars', 'protein'].includes(key)) {
    if (amount < 0.5) return 0;
    if (amount < 1) return 1;
    return Math.round(amount);
  }

  return Math.round(amount);
}

/**
 * Servings per container plausibility check:
 * Expected Servings ≈ Net Quantity / Serving Size.
 */
export function evaluateServingPlausibility(servingSizeGramsOrMl, servingsPerContainer, declaredNetQty, tolerance = 0.08) {
  if (servingSizeGramsOrMl == null || servingsPerContainer == null || declaredNetQty == null ||
      isNaN(servingSizeGramsOrMl) || isNaN(servingsPerContainer) || isNaN(declaredNetQty)) {
    return {
      verdict: 'INSUFFICIENT_INPUT',
      passes: false,
      reason: 'Serving size, servings per container, and net quantity must all be numerical values.',
    };
  }

  const sSize = Number(servingSizeGramsOrMl);
  const sCount = Number(servingsPerContainer);
  const net = Number(declaredNetQty);

  if (sSize <= 0 || sCount <= 0 || net <= 0) {
    return {
      verdict: 'INSUFFICIENT_INPUT',
      passes: false,
      reason: 'Quantities must be greater than zero.',
    };
  }

  const calculatedProduct = sSize * sCount;
  const diff = Math.abs(calculatedProduct - net);
  const percentDiff = diff / net;
  const passes = percentDiff <= tolerance;

  return {
    verdict: passes ? 'MATH_MATCH' : 'MATH_MISMATCH',
    passes,
    calculatedTotal: Number(calculatedProduct.toFixed(2)),
    declaredNetQty: net,
    difference: Number(diff.toFixed(2)),
    percentDifference: Number((percentDiff * 100).toFixed(1)),
    formula: `${sCount} servings × ${sSize} = ${calculatedProduct.toFixed(1)} vs declared ${net}`,
    explanation: passes
      ? `Declared servings per container (${sCount}) × serving size (${sSize}) = ${calculatedProduct.toFixed(1)}, reconciling with declared net contents (${net}) within ${(percentDiff * 100).toFixed(1)}%.`
      : `Serving math mismatch: Declared servings (${sCount}) × serving size (${sSize}) yields ${calculatedProduct.toFixed(1)}, conflicting with declared net contents (${net}) by ${(percentDiff * 100).toFixed(1)}%.`,
  };
}

/**
 * Complete % Daily Value Check with Verdict Categorization.
 */
export function evaluateDailyValueCheck({
  nutrient,
  nutrientKey,
  printedAmount,
  sourceAmount,
  printedDvPct,
  printedDvPercent,
  servingBasis,
  basis = 'per_serving',
}) {
  const effectiveBasis = servingBasis || basis;
  if (effectiveBasis === 'UNKNOWN_OR_MIXED') {
    return {
      status: 'INSUFFICIENT_INPUT',
      verdict: 'INSUFFICIENT_INPUT',
      reason: 'Serving basis unresolved (mixed columns detected). Cannot calculate definitive Daily Value.',
      explanation: 'Serving basis unresolved. Check blocked pending reviewer confirmation.',
    };
  }

  const effectiveNutrient = nutrientKey || nutrient;
  const effectiveDvPct = printedDvPct ?? printedDvPercent;
  const amountToUse = printedAmount ?? sourceAmount;

  if (amountToUse == null || isNaN(amountToUse)) {
    return {
      status: 'INSUFFICIENT_INPUT',
      verdict: 'INSUFFICIENT_INPUT',
      reason: 'Nutrient amount missing or non-numerical.',
      explanation: 'Nutrient amount missing or non-numerical.',
    };
  }

  const dvMeta = computeUsFdaDailyValue(effectiveNutrient, amountToUse);
  if (!dvMeta) {
    return {
      status: 'RULE_NOT_APPLICABLE',
      verdict: 'RULE_NOT_APPLICABLE',
      reason: `No official US FDA Daily Value established for '${effectiveNutrient}'.`,
      explanation: `No official US FDA Daily Value established for '${effectiveNutrient}'.`,
    };
  }

  if (effectiveDvPct == null || isNaN(effectiveDvPct)) {
    return {
      status: 'ROUNDING_REVIEW',
      verdict: 'ROUNDING_REVIEW',
      expectedDvPercent: dvMeta.expectedPercent,
      calculatedDvPercent: dvMeta.expectedPercent,
      rawPercent: dvMeta.rawPercent,
      reason: `Artwork does not declare a numerical %DV for ${dvMeta.nutrient}. Expected: ${dvMeta.expectedPercent}%.`,
      explanation: `Artwork does not declare a numerical %DV for ${dvMeta.nutrient}. Expected: ${dvMeta.expectedPercent}%.`,
      dvMeta,
    };
  }

  const declaredPct = Number(effectiveDvPct);
  const matches = Math.abs(declaredPct - dvMeta.expectedPercent) <= 0;
  const withinTolerance = Math.abs(declaredPct - dvMeta.expectedPercent) <= 1;

  if (matches) {
    return {
      status: 'MATH_MATCH',
      verdict: 'MATH_MATCH',
      declaredDvPercent: declaredPct,
      expectedDvPercent: dvMeta.expectedPercent,
      calculatedDvPercent: dvMeta.expectedPercent,
      dvMeta,
      explanation: `${dvMeta.nutrient} declared at ${declaredPct}% DV matches expected ${dvMeta.expectedPercent}% DV (${dvMeta.formula}).`,
    };
  }

  if (withinTolerance) {
    return {
      status: 'ROUNDING_REVIEW',
      verdict: 'ROUNDING_REVIEW',
      declaredDvPercent: declaredPct,
      expectedDvPercent: dvMeta.expectedPercent,
      calculatedDvPercent: dvMeta.expectedPercent,
      dvMeta,
      explanation: `${dvMeta.nutrient} declared at ${declaredPct}% DV differs by 1% from standard rounded ${dvMeta.expectedPercent}% DV (${dvMeta.formula}). Review applicable 21 CFR 101.9 rounding convention.`,
    };
  }

  return {
    status: 'MATH_MISMATCH',
    verdict: 'MATH_MISMATCH',
    declaredDvPercent: declaredPct,
    expectedDvPercent: dvMeta.expectedPercent,
    calculatedDvPercent: dvMeta.expectedPercent,
    dvMeta,
    explanation: `${dvMeta.nutrient} declared at ${declaredPct}% DV conflicts with calculated ${dvMeta.expectedPercent}% DV (${dvMeta.formula}).`,
  };
}

