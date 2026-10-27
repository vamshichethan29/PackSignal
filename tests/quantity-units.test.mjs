import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePackQuantityConsistency,
  parseServingSize,
  parseNetWeight
} from '../lib/pack-quantity-consistency.mjs';

test('Case 6: Compatible mass units normalized to grams internally', () => {
  // 50,000 mg = 50 g
  const result = evaluatePackQuantityConsistency({
    servings: 4,
    servingSize: '50000 mg',
    netQuantity: '200 g'
  });

  assert.equal(result.servingSizeGrams, 50);
  assert.equal(result.expectedPackMassG, 200);
  assert.equal(result.declaredPackMassG, 200);
  assert.equal(result.status, 'match');
});

test('Case 7: kg to g conversion and mixed kg/g units', () => {
  // Example from prompt:
  // Serving size: 0.085 kg (= 85 g)
  // Servings: 8
  // Expected: 680 g
  // Net weight: 0.48 kg (= 480 g)
  // Declared: 480 g
  // Difference: 200 g
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '0.085 kg',
    netQuantity: '0.48 kg'
  });

  assert.equal(result.servingSizeGrams, 85);
  assert.equal(result.expectedPackMassG, 680);
  assert.equal(result.declaredPackMassG, 480);
  assert.equal(result.differenceG, 200);
  assert.equal(result.absoluteDifferenceG, 200);
  assert.ok(Math.abs(result.percentDifference - 41.66666666666667) < 1e-4);
  assert.equal(result.status, 'issue');
});

test('Case 8: oz and lb to g conversion with precise conversion factors', () => {
  // 1 lb = 453.59237 g
  // 4 servings × 4 oz (113.398 g) = 16 oz = 1 lb = 453.59 g
  const result = evaluatePackQuantityConsistency({
    servings: 4,
    servingSize: '4 oz',
    netQuantity: '1 lb'
  });

  assert.ok(Math.abs(result.expectedPackMassG - 453.59) < 0.1);
  assert.ok(Math.abs(result.declaredPackMassG - 453.59) < 0.1);
  assert.equal(result.status, 'match');
});

test('Case 9: Fluid ounces not confused with mass ounces', () => {
  // 16 fl oz (fluid ounce = volume) vs 480 g (mass)
  const parsedNet = parseNetWeight('16 fl oz');
  assert.equal(parsedNet.isFluidOunce, true);
  assert.equal(parsedNet.unit, 'fl oz');

  const result = evaluatePackQuantityConsistency({
    servings: 2,
    servingSize: '8 oz', // mass ounce
    netQuantity: '16 fl oz' // volume
  });

  // Without density, cross-dimensional volume vs mass comparison is blocked
  assert.equal(result.status, 'unable');
  assert.equal(result.ruleEvaluationOutcome, 'UNABLE');
  assert.ok(result.blockers.some(b => b.includes('Mass') || b.includes('volume') || b.includes('density')));
});

test('Case 10: mL vs g comparison blocked without verified product density', () => {
  // 8 × 85 mL vs 480 g without density
  const resultNoDensity = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 ml',
    netQuantity: '480 g'
  });

  assert.equal(resultNoDensity.status, 'unable');
  assert.ok(resultNoDensity.blockers.some(b => b.includes('density')));

  // With verified density (e.g. syrup density = 1.32 g/mL):
  // 8 × 85 mL = 680 mL × 1.32 g/mL = 897.6 g
  const resultWithDensity = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 ml',
    netQuantity: '480 g',
    densityGPerMl: 1.32
  });

  assert.equal(resultWithDensity.status, 'issue');
  assert.ok(resultWithDensity.expectedPackMassG > 800);
});
