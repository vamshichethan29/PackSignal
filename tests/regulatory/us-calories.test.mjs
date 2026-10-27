/**
 * PackSignal US Regulatory Preflight — Check US-006: Calorie & Macronutrient Sanity
 * Legal Basis: 21 CFR 101.9(c)(1)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsCalorieSanityCheck } from '../../lib/regulatory/us/calorie-sanity.mjs';

test('US-006: Declared calories within 20% general Atwater screening tolerance matches', () => {
  // Fat 2.5g (22.5 kcal), Carb 22g (88 kcal), Protein 3g (12 kcal) -> 122.5 kcal. Declared: 120 Calories.
  const res = executeUsCalorieSanityCheck({
    declaredCalories: 120,
    fatGrams: 2.5,
    carbGrams: 22,
    proteinGrams: 3,
  });
  assert.equal(res.checkId, 'US-006');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /plausible under general Atwater screening/i);
});

test('US-006: Discrepancy > 20% routes to REVIEW with regulatory caveats (not fake fail)', () => {
  // Fat 12g (108 kcal), Carb 30g (120 kcal), Protein 8g (32 kcal) -> 260 kcal. Declared: 160 Calories (38% diff).
  const res = executeUsCalorieSanityCheck({
    declaredCalories: 160,
    fatGrams: 12,
    carbGrams: 30,
    proteinGrams: 8,
  });
  assert.equal(res.checkId, 'US-006');
  assert.equal(res.findingStatus, 'review');
  assert.match(res.explanation, /Calorie plausibility review.*21 CFR 101.9\(c\)\(1\) permits multiple calculation methods/i);
});

test('US-006: Explanations provide complete transparency into calculations and legal caveats', () => {
  const res = executeUsCalorieSanityCheck({
    declaredCalories: 200,
    fatGrams: 5,
    carbGrams: 30,
    proteinGrams: 5,
  });
  assert.ok(res.calculation);
  assert.match(res.calculation, /5g fat × 9/);
  assert.match(res.calculation, /30g carb × 4/);
  assert.match(res.calculation, /5g protein × 4/);
});

test('US-006: Missing macronutrient inputs returns UNABLE without guessing values', () => {
  const res = executeUsCalorieSanityCheck({
    declaredCalories: 150,
    fatGrams: null,
    carbGrams: 25,
    proteinGrams: null,
  });
  assert.equal(res.checkId, 'US-006');
  assert.equal(res.findingStatus, 'unable');
  assert.match(res.explanation, /requires declared calories, total fat, total carbohydrate, and protein/i);
});
