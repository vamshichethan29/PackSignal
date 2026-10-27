import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyDailyValue,
  calculateDailyValuePercent,
  screenAtwaterCalories,
  verifyServingSizeArithmetic,
  verifyCarbohydrateSugarConsistency
} from '../lib/nutrition-validator.mjs';

test('Daily Value calculator applies FDA 2016 DRV standards deterministically', () => {
  // Total Fat: 15g / 78g = 19.2% -> 19%
  const fat = calculateDailyValuePercent('totalFat', 15);
  assert.equal(fat.computedPercent, 19);
  assert.equal(fat.referenceStandard, 78);

  // Saturated Fat: 5g / 20g = 25%
  const satFat = calculateDailyValuePercent('saturatedFat', 5);
  assert.equal(satFat.computedPercent, 25);
  assert.equal(satFat.referenceStandard, 20);

  // Cholesterol: 45mg / 300mg = 15%
  const chol = calculateDailyValuePercent('cholesterol', 45);
  assert.equal(chol.computedPercent, 15);
  assert.equal(chol.referenceStandard, 300);

  // Sodium: 23mg / 2300mg = 1%
  const sod = calculateDailyValuePercent('sodium', 23);
  assert.equal(sod.computedPercent, 1);
  assert.equal(sod.referenceStandard, 2300);

  // Total Carbohydrate: 66g / 275g = 24%
  const carb = calculateDailyValuePercent('totalCarbohydrate', 66);
  assert.equal(carb.computedPercent, 24);
  assert.equal(carb.referenceStandard, 275);

  // Dietary Fiber: 3g / 28g = 10.7% -> 11%
  const fiber = calculateDailyValuePercent('dietaryFiber', 3);
  assert.equal(fiber.computedPercent, 11);
  assert.equal(fiber.referenceStandard, 28);

  // Vitamin D: 89mcg / 20mcg = 445%
  const vitD = calculateDailyValuePercent('vitaminD', 89);
  assert.equal(vitD.computedPercent, 445);
  assert.equal(vitD.referenceStandard, 20);

  // Calcium: 206mg / 1300mg = 15.8% -> 16%
  const cal = calculateDailyValuePercent('calcium', 206);
  assert.equal(cal.computedPercent, 16);
  assert.equal(cal.referenceStandard, 1300);

  // Iron: 5mg / 18mg = 27.8% -> 28%
  const iron = calculateDailyValuePercent('iron', 5);
  assert.equal(iron.computedPercent, 28);
  assert.equal(iron.referenceStandard, 18);

  // Potassium: 23mg / 4700mg = 0.49% -> 0.5%
  const pot = calculateDailyValuePercent('potassium', 23);
  assert.equal(pot.computedPercent, 0.5);
  assert.equal(pot.referenceStandard, 4700);
});

test('Daily Value verifier flags discrepancies against declared artwork values', () => {
  const fatCheck = verifyDailyValue('totalFat', 15, '2.2%');
  assert.equal(fatCheck.status, 'issue');
  assert.equal(fatCheck.printedPercent, 2.2);
  assert.equal(fatCheck.computedPercent, 19);

  const sodiumCheck = verifyDailyValue('sodium', 23, '12%');
  assert.equal(sodiumCheck.status, 'issue');
  assert.equal(sodiumCheck.printedPercent, 12);
  assert.equal(sodiumCheck.computedPercent, 1);
});

test('Atwater calorie screening calculates 4-4-9 estimate and flags plausibility review', () => {
  const atwater = screenAtwaterCalories(15, 66, 34, 166);
  assert.equal(atwater.estimatedCalories, 535);
  assert.equal(atwater.declaredCalories, 166);
  assert.equal(atwater.status, 'review');
  assert.equal(atwater.findingStatus, 'CALORIE_PLAUSIBILITY_REVIEW');
  assert.match(atwater.limitations, /screening heuristic/i);
});

test('Serving size arithmetic flags missing unit and net weight / servings discrepancy', () => {
  const serving = verifyServingSizeArithmetic(480, 8, '85');
  assert.equal(serving.calculatedServingGrams, 60);
  assert.equal(serving.hasUnit, false);
  assert.equal(serving.status, 'review');
  assert.ok(serving.issues.length >= 2);
});

test('Carbohydrate vs total sugars consistency checks detect internal formula defects', () => {
  const defect = verifyCarbohydrateSugarConsistency(15, 18);
  assert.equal(defect.status, 'issue');
  assert.equal(defect.findingStatus, 'SUGARS_EXCEED_CARBOHYDRATES');

  const valid = verifyCarbohydrateSugarConsistency(66, 18);
  assert.equal(valid.status, 'match');
});
