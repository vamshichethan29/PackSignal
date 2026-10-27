/**
 * Tests for lib/regulatory/nutrition.mjs
 * Cross-market nutrition calculations, Daily Values, Reference Intakes, and RDA conversions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  US_FDA_DAILY_VALUES,
  EU_1169_REFERENCE_INTAKES,
  FSSAI_RDA_VALUES,
  computeUsFdaDailyValue,
  computeFssaiRdaPercent,
  verifyEuDualEnergy,
  sodiumMgToSaltG,
  saltGToSodiumMg,
  convertNutritionBasis,
} from '../../lib/regulatory/nutrition.mjs';

test('1. US FDA Daily Value calculations use statutory reference standards', () => {
  // Added sugars: standard is 50g
  const addedSugars = computeUsFdaDailyValue('addedSugars', 10);
  assert.equal(addedSugars.referenceDailyValue, 50);
  assert.equal(addedSugars.percentDailyValue, 20); // 10 / 50 * 100 = 20%
  assert.equal(addedSugars.unit, 'g');

  // Total fat: standard is 78g
  const fat = computeUsFdaDailyValue('totalFat', 7.8);
  assert.equal(fat.referenceDailyValue, 78);
  assert.equal(fat.percentDailyValue, 10);

  // Sodium: standard is 2300mg
  const sodium = computeUsFdaDailyValue('sodium', 460);
  assert.equal(sodium.referenceDailyValue, 2300);
  assert.equal(sodium.percentDailyValue, 20);
});

test('2. US FDA Daily Value does not assume 2000 kcal universal divisor', () => {
  // Nutrient-specific reference values exist for calcium (1300mg), potassium (4700mg), etc.
  const calcium = computeUsFdaDailyValue('calcium', 260);
  assert.equal(calcium.referenceDailyValue, 1300);
  assert.equal(calcium.percentDailyValue, 20);
});

test('3. EU Dual Energy unit verification requires both kJ and kcal with ~4.184 ratio', () => {
  // Typical energy: 1868 kJ / 445 kcal -> ratio 1868 / 445 = 4.197 (within 5% tolerance)
  const validDual = verifyEuDualEnergy(1868, 445);
  assert.equal(validDual.valid, true);

  // Energy missing kJ
  const missingKj = verifyEuDualEnergy(null, 445);
  assert.equal(missingKj.valid, false);

  // Energy missing kcal
  const missingKcal = verifyEuDualEnergy(1868, null);
  assert.equal(missingKcal.valid, false);

  // Wrong thermodynamic ratio (e.g., 500 kJ and 500 kcal)
  const bogusDual = verifyEuDualEnergy(500, 500);
  assert.equal(bogusDual.valid, false);
});

test('4. EU Salt vs Sodium statutory conversion: Salt = Sodium * 2.5', () => {
  // 400 mg sodium = 0.4 g sodium * 2.5 = 1.0 g salt
  const salt = sodiumMgToSaltG(400);
  assert.equal(salt, 1.0);

  // Reverse conversion: 1.0 g salt = 400 mg sodium
  const sodium = saltGToSodiumMg(1.0);
  assert.equal(sodium, 400);
});

test('5. India FSSAI %RDA calculations use FSSAI 2020 schedule standards', () => {
  // Added sugars RDA is 50g
  const sugarsRda = computeFssaiRdaPercent('addedSugars', 12.5);
  assert.equal(sugarsRda.rdaValue, 50);
  assert.equal(sugarsRda.percentRDA, 25);

  // Saturated fat RDA is 22g
  const satFatRda = computeFssaiRdaPercent('saturatedFat', 4.4);
  assert.equal(satFatRda.rdaValue, 22);
  assert.equal(satFatRda.percentRDA, 20);
});

test('6. Nutrition basis conversion handles per-serving to per-100g when serving size is supplied', () => {
  const converted = convertNutritionBasis(5, 'per_serving', 'per_100g', 25); // 5g in 25g serving -> 20g in 100g
  assert.equal(converted.convertedValue, 20);

  // Refuses conversion without serving size
  const refused = convertNutritionBasis(5, 'per_serving', 'per_100g', null);
  assert.equal(refused.convertedValue, null);
  assert.match(refused.limitation, /Cannot convert/);
});
