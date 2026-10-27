/**
 * PackSignal US Regulatory Preflight — Check US-005: Percent Daily Value Arithmetic
 * Legal Basis: 21 CFR 101.9(c)(8), 21 CFR 101.9(c)(9)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsDailyValueCheck, roundFdaPercentDailyValue } from '../../lib/regulatory/us/daily-values.mjs';
import { FDA_DAILY_VALUES_ADULT } from '../../lib/regulatory/us/references.mjs';

test('US-005: FDA Daily Value reference table contains correct statutory reference amounts', () => {
  assert.equal(FDA_DAILY_VALUES_ADULT.sodium.amount, 2300);
  assert.equal(FDA_DAILY_VALUES_ADULT.total_fat.amount, 78);
  assert.equal(FDA_DAILY_VALUES_ADULT.saturated_fat.amount, 20);
  assert.equal(FDA_DAILY_VALUES_ADULT.cholesterol.amount, 300);
  assert.equal(FDA_DAILY_VALUES_ADULT.total_carbohydrate.amount, 275);
  assert.equal(FDA_DAILY_VALUES_ADULT.dietary_fiber.amount, 28);
  assert.equal(FDA_DAILY_VALUES_ADULT.added_sugars.amount, 50);
  assert.equal(FDA_DAILY_VALUES_ADULT.vitamin_d.amount, 20);
  assert.equal(FDA_DAILY_VALUES_ADULT.calcium.amount, 1300);
  assert.equal(FDA_DAILY_VALUES_ADULT.iron.amount, 18);
  assert.equal(FDA_DAILY_VALUES_ADULT.potassium.amount, 4700);
});

test('US-005: FDA rounding rules properly handled (<=10 nearest 1%, <=50 nearest 2%, >50 nearest 5%)', () => {
  assert.equal(roundFdaPercentDailyValue(0.4), 0);
  assert.equal(roundFdaPercentDailyValue(7.2), 7);
  assert.equal(roundFdaPercentDailyValue(15.4), 16); // nearest 2%
  assert.equal(roundFdaPercentDailyValue(17.8), 18); // nearest 2%
  assert.equal(roundFdaPercentDailyValue(62.3), 60); // nearest 5%
  assert.equal(roundFdaPercentDailyValue(64.1), 65); // nearest 5%
});

test('US-005: Correct sodium %DV calculation matches statutory standard', () => {
  // 230 mg / 2300 mg = 10%
  const res = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 230,
    unit: 'mg',
    declaredDvPercent: 10,
    nutritionBasis: 'per_serving',
  });
  assert.equal(res.checkId, 'US-005');
  assert.equal(res.findingStatus, 'match');
  assert.equal(res.checkVerdict, 'MATH_MATCH');
  assert.match(res.calculation, /230 mg \/ 2300 mg/i);
});

test('US-005: Incorrect sodium %DV flags MATH_MISMATCH issue', () => {
  // 230 mg / 2300 mg = 10%, but printed is 18% (exceeds rounding tolerance)
  const res = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 230,
    unit: 'mg',
    declaredDvPercent: 18,
    nutritionBasis: 'per_serving',
  });
  assert.equal(res.checkId, 'US-005');
  assert.equal(res.findingStatus, 'issue');
  assert.equal(res.checkVerdict, 'MATH_MISMATCH');
  assert.match(res.explanation, /Statutory Calculation Discrepancy under 21 CFR 101.9/i);
});

test('US-005: Slight rounding difference (within 2%) routes to REVIEW, not automated issue', () => {
  // 363 mg / 2300 mg = 15.78% -> FDA standard rounded 16%, but printed is 18% (diff = 2)
  const res = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 363,
    unit: 'mg',
    declaredDvPercent: 18,
    nutritionBasis: 'per_serving',
  });
  assert.equal(res.checkId, 'US-005');
  assert.equal(res.findingStatus, 'review');
  assert.equal(res.checkVerdict, 'ROUNDING_REVIEW');
  assert.match(res.explanation, /Rounding convention review/i);
});

test('US-005: Unresolved serving basis routes to REVIEW to prevent false mathematical error', () => {
  const res = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 230,
    unit: 'mg',
    declaredDvPercent: 10,
    nutritionBasis: 'unresolved',
  });
  assert.equal(res.checkId, 'US-005');
  assert.equal(res.findingStatus, 'review');
  assert.equal(res.checkVerdict, 'INSUFFICIENT_INPUT');
  assert.match(res.explanation, /Serving basis unresolved/i);
});

test('US-005: Nutrient with no established %DV (e.g. Trans Fat) returns not applicable', () => {
  const res = executeUsDailyValueCheck({
    nutrientKey: 'trans_fat',
    declaredAmount: 0,
    unit: 'g',
  });
  assert.equal(res.checkId, 'US-005');
  assert.equal(res.applicability, 'not_applicable');
  assert.match(res.explanation, /No established FDA Daily Value/i);
});
