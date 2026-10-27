import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNutritionBasis,
  checkMassBalance,
  NUTRITION_BASIS_TYPES
} from '../lib/nutrition/atwater.mjs';

test('Case 3: 535 kcal per 100 g normalized to 31 g serving = 165.85 kcal', () => {
  const res = normalizeNutritionBasis({
    nutrientValues: { calories: 535 },
    sourceBasis: NUTRITION_BASIS_TYPES.PER_100G,
    targetBasis: NUTRITION_BASIS_TYPES.PER_SERVING,
    servingSize: 31,
    servingSizeUnit: 'g'
  });

  assert.equal(res.ok, true);
  assert.equal(res.normalizedValues.calories, 165.85);
  // Approximately 166 kcal before FDA rounding
  assert.equal(Math.round(res.normalizedValues.calories), 166);
});

test('Case 4: Macronutrients normalized across basis systems', () => {
  const macrosPer100g = {
    fat: 15,
    carbohydrate: 66,
    protein: 34
  };

  const normalized = normalizeNutritionBasis({
    nutrientValues: macrosPer100g,
    sourceBasis: NUTRITION_BASIS_TYPES.PER_100G,
    targetBasis: NUTRITION_BASIS_TYPES.PER_SERVING,
    servingSize: 31
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.normalizedValues.fat, 4.65);
  assert.equal(normalized.normalizedValues.carbohydrate, 20.46);
  assert.equal(normalized.normalizedValues.protein, 10.54);
});

test('Case 5: Unknown basis blocks definitive comparison', () => {
  const res = normalizeNutritionBasis({
    nutrientValues: { calories: 500 },
    sourceBasis: NUTRITION_BASIS_TYPES.UNKNOWN,
    targetBasis: NUTRITION_BASIS_TYPES.PER_SERVING,
    servingSize: 30
  });

  assert.equal(res.ok, false);
  assert.match(res.error, /UNKNOWN/i);
});

test('Case 12: Missing serving size grams prevents per-100g conversion', () => {
  const res = normalizeNutritionBasis({
    nutrientValues: { calories: 500 },
    sourceBasis: NUTRITION_BASIS_TYPES.PER_100G,
    targetBasis: NUTRITION_BASIS_TYPES.PER_SERVING,
    servingSize: null
  });

  assert.equal(res.ok, false);
  assert.match(res.error, /Serving size in grams is required/i);
});

test('Case 15: OCR decimal-loss detection via mass-balance screen', () => {
  // If OCR reads 6.6g carbs as 66g on a 30g serving:
  const mb = checkMassBalance({
    fatGrams: 2.0,
    carbohydrateGrams: 66.0, // OCR read 6.6 without decimal
    proteinGrams: 3.0,
    basis: NUTRITION_BASIS_TYPES.PER_SERVING,
    servingSizeGrams: 30.0
  });

  assert.equal(mb.passes, false);
  assert.equal(mb.status, 'review');
  assert.ok(mb.excessGrams > 40);
  assert.ok(mb.potentialCauses.some(c => c.includes('OCR decimal omission')));
});

test('Case 16: Mass-balance plausibility check passes when macros <= basis mass', () => {
  const cleanMb = checkMassBalance({
    fatGrams: 8.0,
    carbohydrateGrams: 30.0,
    proteinGrams: 5.0,
    basis: NUTRITION_BASIS_TYPES.PER_SERVING,
    servingSizeGrams: 50.0
  });

  assert.equal(cleanMb.passes, true);
  assert.equal(cleanMb.status, 'match');
  assert.equal(cleanMb.totalMacroGrams, 43.0);
});

test('Case 16b: 100g basis mass balance fails when 15 + 66 + 34 = 115g > 100g', () => {
  const mb100 = checkMassBalance({
    fatGrams: 15,
    carbohydrateGrams: 66,
    proteinGrams: 34,
    basis: NUTRITION_BASIS_TYPES.PER_100G
  });

  assert.equal(mb100.passes, false);
  assert.equal(mb100.totalMacroGrams, 115);
  assert.equal(mb100.excessGrams, 15);
});
