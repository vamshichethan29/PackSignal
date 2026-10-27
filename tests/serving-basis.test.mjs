import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePackQuantityConsistency,
  parseServingSize,
  SERVING_SIZE_PREPARATION_BASIS
} from '../lib/pack-quantity-consistency.mjs';

test('Case 18: Prepared-food serving size recognized from label text', () => {
  const prepared = parseServingSize('85 g prepared with milk');
  assert.equal(prepared.amount, 85);
  assert.equal(prepared.unit, 'g');
  assert.equal(prepared.basis, SERVING_SIZE_PREPARATION_BASIS.AS_PREPARED);

  const dry = parseServingSize('85 g dry mix');
  assert.equal(dry.amount, 85);
  assert.equal(dry.basis, SERVING_SIZE_PREPARATION_BASIS.DRY_PRODUCT);

  const cooked = parseServingSize('100 g after cooking');
  assert.equal(cooked.amount, 100);
  assert.equal(cooked.basis, SERVING_SIZE_PREPARATION_BASIS.COOKED_PRODUCT);

  const drained = parseServingSize('120 g drained');
  assert.equal(drained.amount, 120);
  assert.equal(drained.basis, SERVING_SIZE_PREPARATION_BASIS.DRAINED_PRODUCT);
});

test('Case 19: Dry vs cooked/prepared basis mismatch routes to REVIEW, not automated failure', () => {
  // 85 g prepared cereal with milk:
  // Cannot be directly multiplied against dry cereal box net weight (e.g. 480 g)
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 g prepared with milk',
    netQuantity: '480 g'
  });

  assert.equal(result.isBasisMismatch, true);
  assert.equal(result.status, 'review');
  assert.equal(result.ruleEvaluationOutcome, 'REVIEW');
  assert.equal(result.screeningOutcome, 'REVIEW_BASIS_MISMATCH');
  assert.ok(result.explanation.includes('prepared/cooked basis'));
  assert.ok(result.limitations.some(l => l.includes('Preparation basis mismatch')));
});

test('Case 19b: As-packaged dry cereal cleanly matches dry net weight', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '60 g dry mix',
    netQuantity: '480 g'
  });

  assert.equal(result.isBasisMismatch, false);
  assert.equal(result.status, 'match');
  assert.equal(result.ruleEvaluationOutcome, 'MATCH');
});
