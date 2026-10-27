import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';
import {
  verifyDailyValue,
  screenAtwaterCalories,
  verifyServingSizeArithmetic
} from '../lib/nutrition-validator.mjs';

test('DF-08: Total Fat Daily Value (%DV) arithmetic proof evaluates correctly', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });
  const fatCheck = suite.checks.find(c => c.canonicalId === 'DF-08');

  assert.ok(fatCheck);
  assert.equal(fatCheck.sourceCell, 'C48');
  assert.equal(fatCheck.observedValue, '2.2% DV');
  assert.match(fatCheck.calculationProof, /19\.23%/);
  assert.match(fatCheck.calculationProof, /78g/);
  assert.equal(fatCheck.status, 'issue');

  // Verify pure math
  const pureDv = verifyDailyValue('totalFat', 15, '2.2%');
  assert.equal(pureDv.status, 'issue');
  assert.equal(pureDv.computedPercent, 19);
});

test('DF-09: Vitamin D Daily Value (%DV) arithmetic proof evaluates correctly', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });
  const vitDCheck = suite.checks.find(c => c.canonicalId === 'DF-09');

  assert.ok(vitDCheck);
  assert.equal(vitDCheck.sourceCell, 'C58');
  assert.equal(vitDCheck.observedValue, '12% DV');
  assert.match(vitDCheck.calculationProof, /445%/);
  assert.match(vitDCheck.calculationProof, /20mcg/);
  assert.equal(vitDCheck.status, 'issue');

  // Verify pure math
  const pureDv = verifyDailyValue('vitaminD', 89, '12%');
  assert.equal(pureDv.status, 'issue');
  assert.equal(pureDv.computedPercent, 445);
});

test('DF-10: Atwater 9/4/4 calorie consistency checks basis before issuing review finding', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });
  const atwaterCheck = suite.checks.find(c => c.canonicalId === 'DF-10');

  assert.ok(atwaterCheck);
  assert.equal(atwaterCheck.status, 'review'); // Plausibility review, not definitive defect
  assert.equal(atwaterCheck.findingStatus, 'CALORIE_PLAUSIBILITY_REVIEW');
  assert.match(atwaterCheck.calculationProof, /535 kcal/);
  assert.equal(atwaterCheck.observedValue, '166 kcal');

  // Pure validator
  const atwater = screenAtwaterCalories(15, 66, 34, 166);
  assert.equal(atwater.estimatedCalories, 535);
  assert.equal(atwater.calorieDifference, 369);
  assert.equal(atwater.status, 'review');
});

test('DF-11: Serving size x serving count vs declared pack mass arithmetic', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });
  const servingCheck = suite.checks.find(c => c.canonicalId === 'DF-11');

  assert.ok(servingCheck);
  assert.equal(servingCheck.status, 'issue');
  assert.equal(servingCheck.sourceCell, 'B34, B35, B36');
  assert.match(servingCheck.calculationProof, /480g \/ 8 servings = 60g\/serving/);

  // Pure validator
  const serving = verifyServingSizeArithmetic(480, 8, '85');
  assert.equal(serving.totalProductGrams, 680);
  assert.equal(serving.declaredNetWeightGrams, 480);
  assert.equal(serving.differenceGrams, 200);
});

test('DF-06 & DF-07: Carbohydrate and Sodium source comparisons preserve exact cells and values', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const carbs = suite.checks.find(c => c.canonicalId === 'DF-06');
  assert.ok(carbs);
  assert.equal(carbs.sourceCell, 'B53');
  assert.equal(carbs.expectedValue, '15g');
  assert.equal(carbs.observedValue, '66g');

  const sodium = suite.checks.find(c => c.canonicalId === 'DF-07');
  assert.ok(sodium);
  assert.equal(sodium.sourceCell, 'B52');
  assert.equal(sodium.expectedValue, '25mg');
  assert.equal(sodium.observedValue, '23mg');
});
