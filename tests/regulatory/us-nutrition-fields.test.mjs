/**
 * PackSignal US Regulatory Preflight — Check US-004: Nutrition Facts Required Fields
 * Legal Basis: 21 CFR 101.9
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsNutritionFieldsCheck } from '../../lib/regulatory/us/nutrition-fields.mjs';

test('US-004: Standard vertical panel contains all mandatory 21 CFR 101.9 fields', () => {
  const fullPanel = `
    Nutrition Facts
    10 servings per container
    Serving size 1/2 cup (55g)
    Calories 210
    Total Fat 4.5g
    Saturated Fat 0.5g
    Trans Fat 0g
    Cholesterol 0mg
    Sodium 140mg
    Total Carbohydrate 38g
    Dietary Fiber 5g
    Total Sugars 12g
    Includes 7g Added Sugars
    Protein 5g
    Vitamin D 0mcg
    Calcium 40mg
    Iron 1.8mg
    Potassium 180mg
  `;
  const res = executeUsNutritionFieldsCheck({
    artworkText: fullPanel,
    formatType: 'standard',
  });
  assert.equal(res.checkId, 'US-004');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /satisfies 21 CFR 101.9/i);
});

test('US-004: Verified missing mandatory field (Trans Fat) flags statutory ISSUE', () => {
  const panelWithoutTransFat = `
    Nutrition Facts
    1 serving per container
    Serving size 1 can (355mL)
    Calories 140
    Total Fat 0g
    Saturated Fat 0g
    Cholesterol 0mg
    Sodium 35mg
    Total Carbohydrate 35g
    Dietary Fiber 0g
    Total Sugars 33g
    Includes 33g Added Sugars
    Protein 0g
    Vitamin D 0mcg
    Calcium 0mg
    Iron 0mg
    Potassium 0mg
  `; // Missing Trans Fat
  const res = executeUsNutritionFieldsCheck({
    artworkText: panelWithoutTransFat,
    formatType: 'standard',
    coverageConfirmed: true,
  });
  assert.equal(res.checkId, 'US-004');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Statutory Violation under 21 CFR 101.9.*Trans Fat/i);
});

test('US-004: Missing mandatory Added Sugars sub-row flags ISSUE', () => {
  const panelWithoutAddedSugars = `
    Nutrition Facts
    8 servings per container
    Serving size 30g
    Calories 130
    Total Fat 2g
    Saturated Fat 0g
    Trans Fat 0g
    Cholesterol 0mg
    Sodium 100mg
    Total Carbohydrate 25g
    Dietary Fiber 2g
    Total Sugars 10g
    Protein 3g
    Vitamin D 0mcg
    Calcium 20mg
    Iron 1mg
    Potassium 100mg
  `; // Missing Includes Added Sugars
  const res = executeUsNutritionFieldsCheck({
    artworkText: panelWithoutAddedSugars,
    formatType: 'standard',
    coverageConfirmed: true,
  });
  assert.equal(res.checkId, 'US-004');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Statutory Violation under 21 CFR 101.9.*Added Sugars/i);
});

test('US-004: Alternative format (simplified) requires human applicability review, not auto-fail', () => {
  const res = executeUsNutritionFieldsCheck({
    artworkText: 'Nutrition Facts\nCalories 0\nTotal Fat 0g\nSodium 0mg\nTotal Carb 0g\nProtein 0g',
    formatType: 'simplified',
  });
  assert.equal(res.checkId, 'US-004');
  assert.equal(res.findingStatus, 'review');
  assert.equal(res.applicability, 'undetermined');
  assert.match(res.explanation, /Alternative nutrition panel format specified \(simplified\)/i);
});

test('US-004: Unconfirmed coverage with missing fields returns REVIEW rather than definitive issue', () => {
  const res = executeUsNutritionFieldsCheck({
    artworkText: 'Nutrition Facts\nCalories 150\nTotal Fat 3g',
    formatType: 'standard',
    coverageConfirmed: false,
  });
  assert.equal(res.checkId, 'US-004');
  assert.equal(res.findingStatus, 'review');
  assert.match(res.explanation, /Nutrition panel field coverage review/i);
});
