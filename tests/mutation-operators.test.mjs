/**
 * PackSignal Mutation Operators Unit Tests (tests/mutation-operators.test.mjs)
 * Phase 27: Verifies all 31 mutation operators across 5 families and 5 clean controls.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_MUTATION_OPERATORS,
  ALL_CLEAN_CONTROLS,
  mutateA1_removeAllergen,
  mutateB1_changeGtinDataDigit,
  mutateC1_alterDeclaredCalories,
  mutateD1_changeNetQuantity,
  mutateE1_opaqueOccluderOverMandatoryCopy,
  getCleanControlA,
  getCleanControlB,
} from '../lib/benchmark/mutation-operators.mjs';
import {
  BASELINE_FAMILY_A,
  getBaselineFixture,
} from '../lib/benchmark/benchmark-fixtures.mjs';

test('1. Baseline fixtures are immutable and protected against in-place modification', () => {
  const base1 = getBaselineFixture('family-a-allergens');
  const base2 = getBaselineFixture('family-a-allergens');

  assert.deepEqual(base1, base2);
  // Modify a property in copy 1
  base1.productName = 'Tampered Product';
  // Copy 2 must remain untampered
  assert.equal(base2.productName, 'Mountain Trail Organic Granola');
});

test('2. Mutation operators do not mutate original baseline fixture in-place', () => {
  const originalLineCount = BASELINE_FAMILY_A.artworkLines.length;
  const { review, manifest } = mutateA1_removeAllergen();

  assert.ok(manifest.mutationId === 'A1');
  assert.equal(BASELINE_FAMILY_A.artworkLines.length, originalLineCount);
  assert.ok(review.documents[0].lines.length < originalLineCount);
});

test('3. Exactly 31 mutation operators are registered and executable', () => {
  assert.equal(ALL_MUTATION_OPERATORS.length, 31);
  ALL_MUTATION_OPERATORS.forEach((op, idx) => {
    assert.equal(typeof op, 'function', `Operator at index ${idx} must be a function`);
    const { review, manifest } = op(20261025);
    assert.ok(manifest.mutationId, `Operator ${idx} must provide mutationId`);
    assert.ok(manifest.family, `Operator ${idx} must provide family`);
    assert.ok(manifest.targetField, `Operator ${idx} must provide targetField`);
    assert.ok(manifest.expectedEffect, `Operator ${idx} must provide expectedEffect`);
    assert.ok(review && Array.isArray(review.documents), `Operator ${idx} must return valid review`);
  });
});

test('4. Exactly 5 clean controls are registered and produce clean reviews', () => {
  assert.equal(ALL_CLEAN_CONTROLS.length, 5);
  ALL_CLEAN_CONTROLS.forEach((ctrlGen, idx) => {
    const { review, manifest } = ctrlGen();
    assert.equal(manifest.isCleanControl, true);
    assert.ok(manifest.mutationId.startsWith('CTRL-'));
    assert.ok(review && review.documents.length >= 3);
  });
});

test('5. Mutation manifests are accurate and link to proper target fields', () => {
  const a1 = mutateA1_removeAllergen();
  assert.equal(a1.manifest.targetField, 'allergen_statement');

  const b1 = mutateB1_changeGtinDataDigit();
  assert.equal(b1.manifest.targetField, 'gtin');

  const c1 = mutateC1_alterDeclaredCalories();
  assert.equal(c1.manifest.targetField, 'nutrition.energy_kcal');

  const d1 = mutateD1_changeNetQuantity();
  assert.equal(d1.manifest.targetField, 'net_quantity');

  const e1 = mutateE1_opaqueOccluderOverMandatoryCopy();
  assert.equal(e1.manifest.targetField, 'product_name');
});

test('6. Repeated execution with same seed produces identical mutations', () => {
  const run1 = mutateB1_changeGtinDataDigit(20261025);
  const run2 = mutateB1_changeGtinDataDigit(20261025);

  assert.deepEqual(run1.manifest, run2.manifest);
  assert.deepEqual(run1.review.documents[0].text, run2.review.documents[0].text);
});
