import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseServingsCount,
  parseServingSize,
  parseNetWeight,
  evaluatePackQuantityConsistency,
  formatPackQuantityProof,
  SERVING_BASIS_TYPES
} from '../lib/pack-quantity-consistency.mjs';

test('Case 1: 8 × 85 g = 680 g pure mass multiplication', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: { value: 85, unit: 'g' },
    netQuantity: { value: 480, unit: 'g' }
  });

  assert.equal(result.expectedPackMassG, 680);
  assert.equal(result.declaredPackMassG, 480);
});

test('Case 2: 680 g - 480 g = 200 g difference', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: { value: 85, unit: 'g' },
    netQuantity: { value: 480, unit: 'g' }
  });

  assert.equal(result.differenceG, 200);
  assert.equal(result.absoluteDifferenceG, 200);
  assert.equal(result.status, 'issue');
  assert.equal(result.ruleEvaluationOutcome, 'ISSUE');
});

test('Case 3: Difference percentage relative to declared is approximately 41.7%', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: { value: 85, unit: 'g' },
    netQuantity: { value: 480, unit: 'g' }
  });

  // 200 / 480 * 100 = 41.66666...%
  assert.ok(Math.abs(result.percentDifference - 41.66666666666667) < 1e-6);
  assert.equal(result.percentDifferenceFormatted, '41.7%');
});

test('Case 4: Equal implied and declared mass handled (MATCH)', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: { value: 60, unit: 'g' },
    netQuantity: { value: 480, unit: 'g' }
  });

  assert.equal(result.expectedPackMassG, 480);
  assert.equal(result.declaredPackMassG, 480);
  assert.equal(result.differenceG, 0);
  assert.equal(result.percentDifference, 0);
  assert.equal(result.status, 'match');
  assert.equal(result.ruleEvaluationOutcome, 'MATCH');
});

test('Case 5: Decimal serving counts supported (e.g. 2.5 × 100 g = 250 g)', () => {
  const parsed = parseServingsCount('2.5 servings');
  assert.equal(parsed.value, 2.5);
  assert.equal(parsed.isApproximate, false);

  const result = evaluatePackQuantityConsistency({
    servings: '2.5 servings',
    servingSize: '100 g',
    netQuantity: '250 g'
  });

  assert.equal(result.expectedPackMassG, 250);
  assert.equal(result.declaredPackMassG, 250);
  assert.equal(result.status, 'match');
});

test('Case 11: Missing serving count handled safely', () => {
  const result = evaluatePackQuantityConsistency({
    servings: null,
    servingSize: '85 g',
    netQuantity: '480 g'
  });

  assert.equal(result.status, 'unable');
  assert.equal(result.ruleEvaluationOutcome, 'UNABLE');
  assert.ok(result.blockers.some(b => b.includes('Serving count')));
});

test('Case 12: Missing serving size handled safely', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: null,
    netQuantity: '480 g'
  });

  assert.equal(result.status, 'unable');
  assert.equal(result.ruleEvaluationOutcome, 'UNABLE');
  assert.ok(result.blockers.some(b => b.includes('Serving size')));
});

test('Case 13: Missing net weight handled safely', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 g',
    netQuantity: null
  });

  assert.equal(result.status, 'unable');
  assert.equal(result.ruleEvaluationOutcome, 'UNABLE');
  assert.ok(result.blockers.some(b => b.includes('Declared net weight')));
});

test('Case 14: Negative input rejected', () => {
  const negServings = evaluatePackQuantityConsistency({
    servings: -8,
    servingSize: '85 g',
    netQuantity: '480 g'
  });
  assert.equal(negServings.status, 'unable');
  assert.ok(negServings.blockers.some(b => b.includes('positive')));

  const negWeight = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 g',
    netQuantity: -480
  });
  assert.equal(negWeight.status, 'unable');
  assert.ok(negWeight.blockers.some(b => b.includes('positive')));
});

test('Case 15: Zero net quantity handled safely without division by zero', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 g',
    netQuantity: 0
  });

  assert.equal(result.status, 'unable');
  assert.ok(result.blockers.some(b => b.includes('positive')));
  assert.equal(result.percentDifference, null);
});

test('Case 16: "About 8 servings" is not treated as exact mathematical declaration', () => {
  const parsed = parseServingsCount('About 8 servings');
  assert.equal(parsed.value, 8);
  assert.equal(parsed.qualifier, 'APPROXIMATE');
  assert.equal(parsed.isApproximate, true);

  const result = evaluatePackQuantityConsistency({
    servings: 'About 8 servings',
    servingSize: '85 g',
    netQuantity: '480 g'
  });

  // Since serving count is approximate, it cannot be a definitive statutory ISSUE
  assert.equal(result.status, 'review');
  assert.equal(result.screeningOutcome, 'REVIEW_APPROXIMATE_COUNT');
  assert.ok(result.assumptions.some(a => /approximate/i.test(a)));
});

test('Case 17: Precision and intermediate rounding policy applied without premature truncation', () => {
  // Test intermediate precision: 7 * 33.3333333333 g vs 233.3333333333 g
  const result = evaluatePackQuantityConsistency({
    servings: 7,
    servingSize: { value: 33.333333333333336, unit: 'g' },
    netQuantity: { value: 233.33333333333334, unit: 'g' }
  });

  assert.equal(result.status, 'match');
  assert.ok(result.percentDifference < 0.001);
});

test('Case 20: Product variants and different SKUs are kept isolated', () => {
  const result = evaluatePackQuantityConsistency({
    servings: { value: 8, productVariant: 'SKU-A' },
    servingSize: { value: 85, unit: 'g', productVariant: 'SKU-B' },
    netQuantity: { value: 480, unit: 'g', productVariant: 'SKU-A' }
  });

  assert.equal(result.status, 'review');
  assert.ok(result.blockers.some(b => b.includes('Cross-SKU') || b.includes('SKU-A') || b.includes('SKU-B')));
});

test('Case 21: Different artwork revisions are not mixed', () => {
  const result = evaluatePackQuantityConsistency({
    servings: { value: 8, artworkVersion: 'V1' },
    servingSize: { value: 85, unit: 'g', artworkVersion: 'V2' },
    netQuantity: { value: 480, unit: 'g', artworkVersion: 'V1' }
  });

  assert.equal(result.status, 'review');
  assert.ok(result.blockers.some(b => b.includes('version') || b.includes('revision')));
});

test('Case 22: Conflicting source values produce REVIEW', () => {
  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 g',
    netQuantity: '480 g',
    productContext: {
      conflictingCandidates: [
        { label: 'Spec A', netWeight: '480 g' },
        { label: 'Spec B', netWeight: '680 g' }
      ]
    }
  });

  assert.equal(result.status, 'review');
  assert.ok(result.blockers.some(b => b.includes('Conflicting')));
});

test('Case 23: Draft source status is preserved in evidence and context', () => {
  const result = evaluatePackQuantityConsistency({
    servings: { value: 8, sourceStatus: 'Draft' },
    servingSize: { value: 85, unit: 'g', sourceStatus: 'In Review' },
    netQuantity: { value: 480, unit: 'g', sourceStatus: 'Approved' }
  });

  assert.ok(result.inputEvidence.servings.sourceStatus === 'Draft');
  assert.ok(result.assumptions.some(a => a.includes('Draft') || a.includes('In Review')));
});

test('Case 24: OCR decimal and character ambiguity is flagged for human review', () => {
  const result = evaluatePackQuantityConsistency({
    servings: { value: 8, originalText: 'B servings' }, // B vs 8
    servingSize: '85 g',
    netQuantity: '480 g'
  });

  assert.equal(result.status, 'review');
  assert.ok(result.anomalies.some(a => a.field === 'servings'));
});

test('Case 25: Net weight not confused with gross weight', () => {
  const parsedGross = parseNetWeight('Gross Weight 550 g (Net 480 g)');
  assert.equal(parsedGross.value, 480);
  assert.equal(parsedGross.isGrossWeight, false);

  const purelyGross = parseNetWeight('Gross Weight 550 g');
  assert.equal(purelyGross.isGrossWeight, true);

  const result = evaluatePackQuantityConsistency({
    servings: 8,
    servingSize: '85 g',
    netQuantity: purelyGross
  });

  assert.equal(result.status, 'review');
  assert.ok(result.blockers.some(b => b.includes('gross weight') || b.includes('tare')));
});
