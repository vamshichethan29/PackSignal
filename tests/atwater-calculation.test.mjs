import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAtwater,
  ATWATER_CALCULATION_METHODS,
  NUTRITION_BASIS_TYPES,
  NUTRITION_PRECISION,
  roundFdaCalories,
  fdaCalorieUnderlyingInterval,
  formatAtwaterProof
} from '../lib/nutrition/atwater.mjs';

test('Case 1: 15 × 9 + 66 × 4 + 34 × 4 = 535 kcal exactly', () => {
  const result = calculateAtwater({
    fatGrams: 15,
    carbohydrateGrams: 66,
    proteinGrams: 34
  });

  assert.equal(result.fatCalories, 135);
  assert.equal(result.carbohydrateCalories, 264);
  assert.equal(result.proteinCalories, 136);
  assert.equal(result.totalCalories, 535);
  assert.equal(result.unroundedTotalCalories, 535);
  assert.equal(result.formula, '(15g × 9) + (66g × 4) + (34g × 4) = 535 kcal');
});

test('Case 2: Difference from declared 166 kcal is 369 kcal', () => {
  const result = calculateAtwater({
    fatGrams: 15,
    carbohydrateGrams: 66,
    proteinGrams: 34,
    declaredCalories: 166
  });

  assert.equal(result.declaredCalories, 166);
  assert.equal(result.estimatedCalories, 535);
  assert.equal(result.differenceKcal, 369);
  assert.equal(result.passes, false);
  assert.equal(result.status, 'review');
  assert.equal(result.verdict, 'REVIEW');
  assert.ok(result.percentDifference > 50);
});

test('Case 6, 7, 8: Missing fat, carbohydrate, or protein produces UNABLE', () => {
  const noFat = calculateAtwater({ carbohydrateGrams: 20, proteinGrams: 10 });
  assert.equal(noFat.status, 'unable');
  assert.deepEqual(noFat.missingInputs, ['fat']);

  const noCarb = calculateAtwater({ fatGrams: 5, proteinGrams: 10 });
  assert.equal(noCarb.status, 'unable');
  assert.deepEqual(noCarb.missingInputs, ['carbohydrate']);

  const noProt = calculateAtwater({ fatGrams: 5, carbohydrateGrams: 20 });
  assert.equal(noProt.status, 'unable');
  assert.deepEqual(noProt.missingInputs, ['protein']);
});

test('Case 9: Missing declared calories still calculates estimated energy', () => {
  const res = calculateAtwater({ fatGrams: 10, carbohydrateGrams: 20, proteinGrams: 10 });
  assert.equal(res.status, 'match');
  assert.equal(res.declaredCalories, null);
  assert.equal(res.totalCalories, 10 * 9 + 20 * 4 + 10 * 4); // 90 + 80 + 40 = 210
});

test('Case 10: Negative macronutrients are rejected', () => {
  const res = calculateAtwater({ fatGrams: -5, carbohydrateGrams: 20, proteinGrams: 10 });
  assert.equal(res.status, 'unable');
  assert.match(res.reason, /cannot be negative/i);
});

test('Case 11: Decimal macronutrients are accurately computed without intermediate rounding', () => {
  const res = calculateAtwater({
    fatGrams: 2.5,
    carbohydrateGrams: 12.25,
    proteinGrams: 4.75
  });
  // 2.5 * 9 = 22.5
  // 12.25 * 4 = 49
  // 4.75 * 4 = 19
  // Total = 90.5 kcal
  assert.equal(res.fatCalories, 22.5);
  assert.equal(res.carbohydrateCalories, 49);
  assert.equal(res.proteinCalories, 19);
  assert.equal(res.totalCalories, 90.5);
});

test('Case 17: Specific Atwater factors supported only with valid parameters', () => {
  const withParams = calculateAtwater({
    fatGrams: 10,
    carbohydrateGrams: 20,
    proteinGrams: 10,
    calculationMethod: ATWATER_CALCULATION_METHODS.SPECIFIC_ATWATER,
    specificFactors: { fat: 8.37, carb: 3.87, protein: 3.47 }
  });
  assert.equal(withParams.method, ATWATER_CALCULATION_METHODS.SPECIFIC_ATWATER);
  assert.equal(withParams.macronutrients.fat.factor, 8.37);
  assert.equal(withParams.totalCalories, Number((10 * 8.37 + 20 * 3.87 + 10 * 3.47).toFixed(1)));

  // Fallback when missing specific factors
  const missingParams = calculateAtwater({
    fatGrams: 10,
    carbohydrateGrams: 20,
    proteinGrams: 10,
    calculationMethod: ATWATER_CALCULATION_METHODS.SPECIFIC_ATWATER
  });
  assert.equal(missingParams.method, ATWATER_CALCULATION_METHODS.GENERAL_ATWATER_4_4_9);
  assert.ok(missingParams.limitations.some(l => l.includes('fell back to general')));
});

test('Case 18: Insoluble dietary fiber adjustment subtracts calories under 21 CFR 101.9(c)(1)(i)(C)', () => {
  const res = calculateAtwater({
    fatGrams: 10,
    carbohydrateGrams: 25,
    proteinGrams: 10,
    calculationMethod: ATWATER_CALCULATION_METHODS.FIBER_POLYOL_ADJUSTED,
    fiberAdjustments: { insolubleFiberGrams: 5 }
  });
  // Net carb = 25 - 5 = 20g
  // Fat: 90, Carb: 80, Prot: 40 -> Total: 210 kcal
  assert.equal(res.macronutrients.carbohydrate.netGrams, 20);
  assert.equal(res.carbohydrateCalories, 80);
  assert.equal(res.totalCalories, 210);
});

test('Case 19: Sugar-alcohol (polyol) energy factor added under 21 CFR 101.9(c)(1)(i)(E)', () => {
  const res = calculateAtwater({
    fatGrams: 5,
    carbohydrateGrams: 10,
    proteinGrams: 5,
    calculationMethod: ATWATER_CALCULATION_METHODS.FIBER_POLYOL_ADJUSTED,
    polyols: { sugarAlcoholGrams: 5, polyolFactor: 2.0 } // e.g. maltitol
  });
  // 5*9=45, 10*4=40, 5*4=20 -> 105 + (5*2=10) = 115 kcal
  assert.equal(res.totalCalories, 115);
});

test('Case 20: FDA calorie rounding increments (<= 50: 5 kcal, > 50: 10 kcal)', () => {
  assert.equal(roundFdaCalories(4), 0);
  assert.equal(roundFdaCalories(8), 10);
  assert.equal(roundFdaCalories(23), 25);
  assert.equal(roundFdaCalories(48), 50);
  assert.equal(roundFdaCalories(52), 50);
  assert.equal(roundFdaCalories(56), 60);
  assert.equal(roundFdaCalories(164), 160);
  assert.equal(roundFdaCalories(166), 170);
});

test('Case 21: Continuous underlying interval distinguishes rounded label from unrounded values', () => {
  const [min50, max50] = fdaCalorieUnderlyingInterval(50);
  assert.equal(min50, 47.5);
  assert.equal(max50, 52.5);

  const [min170, max170] = fdaCalorieUnderlyingInterval(170);
  assert.equal(min170, 165);
  assert.equal(max170, 175);
});

test('Case 22: Divergence between general Atwater screening and declared calories yields REVIEW, not statutory ISSUE', () => {
  const res = calculateAtwater({
    fatGrams: 15,
    carbohydrateGrams: 66,
    proteinGrams: 34,
    declaredCalories: 166
  });
  assert.equal(res.status, 'review');
  assert.notEqual(res.status, 'issue');
  assert.match(res.explanation, /confirm approved formulation/i);
});

test('Case 26: Math proof formatting contains structured formulas and steps', () => {
  const res = calculateAtwater({
    fatGrams: 15,
    carbohydrateGrams: 66,
    proteinGrams: 34,
    declaredCalories: 166
  });
  const proofText = formatAtwaterProof(res);
  assert.match(proofText, /CALORIE CONSISTENCY CHECK/);
  assert.match(proofText, /15 g × 9 = 135 kcal/);
  assert.match(proofText, /66 g × 4 = 264 kcal/);
  assert.match(proofText, /34 g × 4 = 136 kcal/);
  assert.match(proofText, /Calculated Energy: 535 kcal/);
  assert.match(proofText, /Declared: 166 kcal/);
  assert.match(proofText, /Numerical Difference: 369 kcal/);
});
