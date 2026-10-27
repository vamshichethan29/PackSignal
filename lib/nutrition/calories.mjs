/**
 * PackSignal Atwater Calorie Plausibility Engine (lib/nutrition/calories.mjs)
 * Implements deterministic 4-4-9 macronutrient screening with transparent statutory disclaimers.
 */

import { convertUnits } from './units.mjs';
import {
  calculateAtwater,
  normalizeNutritionBasis,
  checkMassBalance,
  roundFdaCalories,
  formatAtwaterProof,
  ATWATER_CALCULATION_METHODS,
  NUTRITION_BASIS_TYPES,
  NUTRITION_PRECISION
} from './atwater.mjs';

export {
  calculateAtwater,
  normalizeNutritionBasis,
  checkMassBalance,
  roundFdaCalories,
  formatAtwaterProof,
  ATWATER_CALCULATION_METHODS,
  NUTRITION_BASIS_TYPES,
  NUTRITION_PRECISION
};

export function screenCaloriePlausibility({
  calories,
  caloriesDeclared,
  caloriesUnit = 'kcal',
  totalFat,
  totalFatGrams,
  totalFatUnit = 'g',
  totalCarb,
  totalCarbGrams,
  totalCarbUnit = 'g',
  protein,
  proteinGrams,
  proteinUnit = 'g',
  dietaryFiber = null,
  dietaryFiberUnit = 'g',
  servingBasis = 'PER_SERVING',
  servingGrams = null,
  tolerance = 0.20,
  toleranceRatio,
  calculationMethod = ATWATER_CALCULATION_METHODS.GENERAL_ATWATER_4_4_9,
  specificFactors = null,
  fiberAdjustments = null,
  polyols = null
}) {
  const calRaw = calories ?? caloriesDeclared;
  const fatRaw = totalFat ?? totalFatGrams;
  const carbRaw = totalCarb ?? totalCarbGrams;
  const protRaw = protein ?? proteinGrams;
  const tol = toleranceRatio ?? tolerance ?? 0.20;

  const missing = [];
  if (calRaw == null) missing.push('calories');
  if (fatRaw == null) missing.push('total_fat');
  if (carbRaw == null) missing.push('total_carbohydrate');
  if (protRaw == null) missing.push('protein');

  if (missing.length > 0) {
    return {
      status: 'unable',
      reason: `Missing required nutrient values for calorie screening: ${missing.join(', ')}`,
      missing
    };
  }

  // Convert macronutrients to grams
  const fatConv = convertUnits(fatRaw, totalFatUnit, 'g');
  const carbConv = convertUnits(carbRaw, totalCarbUnit, 'g');
  const protConv = convertUnits(protRaw, proteinUnit, 'g');
  const calConv = convertUnits(calRaw, caloriesUnit, 'kcal');

  if (!fatConv.ok || !carbConv.ok || !protConv.ok || !calConv.ok) {
    return {
      status: 'unable',
      reason: 'Incompatible or invalid units during macronutrient conversion to grams/kcal.'
    };
  }

  const fatG = fatConv.value;
  const carbG = carbConv.value;
  const protG = protConv.value;
  const declaredKcal = calConv.value;

  const atwaterRes = calculateAtwater({
    fatGrams: fatG,
    carbohydrateGrams: carbG,
    proteinGrams: protG,
    declaredCalories: declaredKcal,
    basis: servingBasis,
    calculationMethod,
    specificFactors,
    fiberAdjustments,
    polyols,
    tolerance: tol
  });

  const massBalanceRes = checkMassBalance({
    fatGrams: fatG,
    carbohydrateGrams: carbG,
    proteinGrams: protG,
    basis: servingBasis,
    servingSizeGrams: servingGrams
  });

  const fatKcal = atwaterRes.fatCalories;
  const carbKcal = atwaterRes.carbohydrateCalories;
  const protKcal = atwaterRes.proteinCalories;
  const estimatedKcal = atwaterRes.totalCalories;
  const diff = atwaterRes.differenceKcal ?? 0;
  const percentDiff = atwaterRes.percentDifference ?? 0;
  const passes = atwaterRes.passesScreening;

  const proof = {
    proofId: `proof:calories:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    checkId: 'calories:atwater',
    formulaId: 'ATWATER_4_4_9_CALORIE_SCREEN',
    formulaVersion: '1.0',
    inputValues: { calories: declaredKcal, totalFat: fatG, totalCarb: carbG, protein: protG },
    inputUnits: { calories: 'kcal', totalFat: 'g', totalCarb: 'g', protein: 'g' },
    unroundedResult: atwaterRes.unroundedTotalCalories,
    displayedExpectedResult: `${estimatedKcal} kcal`,
    printedResult: `${declaredKcal} kcal`,
    comparisonOutcome: passes ? 'MATCH' : 'REVIEW',
    proofSteps: atwaterRes.proofSteps,
    limitations: atwaterRes.limitations
  };

  return {
    status: passes ? 'match' : 'review',
    declaredCalories: declaredKcal,
    caloriesDeclared: declaredKcal,
    estimatedCalories: estimatedKcal,
    differenceKcal: Number(diff.toFixed(1)),
    calorieDifference: Number(diff.toFixed(1)),
    percentDifference: percentDiff,
    tolerancePercent: Math.round(tol * 100),
    passes,
    macronutrients: {
      fat: { amount: fatG, unit: 'g', factor: atwaterRes.macronutrients.fat.factor, subtotalKcal: fatKcal, grams: fatG },
      carbohydrate: { amount: carbG, unit: 'g', factor: atwaterRes.macronutrients.carbohydrate.factor, subtotalKcal: carbKcal, grams: carbG },
      protein: { amount: protG, unit: 'g', factor: atwaterRes.macronutrients.protein.factor, subtotalKcal: protKcal, grams: protG }
    },
    formula: atwaterRes.formula,
    explanation: passes
      ? `Declared calories (${declaredKcal} kcal) align within ${percentDiff}% of standard 4-4-9 estimate (${estimatedKcal} kcal).`
      : `Declared calories (${declaredKcal} kcal) diverges significantly by ${percentDiff}% from 4-4-9 estimate (${estimatedKcal} kcal). Recommend technical review of digestible carbs, insoluble fiber deductions, or Atwater specific factors.`,
    limitations: atwaterRes.limitations.join(' '),
    atwater: atwaterRes,
    massBalance: massBalanceRes,
    proof
  };
}
