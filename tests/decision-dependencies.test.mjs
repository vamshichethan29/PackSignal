import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECISION_DEPENDENCY_GRAPH,
  validateNoInvalidCycles,
  findDownstreamImpacts,
  getAffectedDepartments,
  isCheckAffectedByNode
} from '../lib/decision-dependencies.mjs';

test('Decision Dependencies Graph: Canonical structure and cycle validation', async (t) => {
  await t.test('Canonical graph contains all required formulation, artwork, nutrition, allergen, and review nodes', () => {
    const requiredNodes = [
      'FORMULATION.HONEY',
      'FORMULATION.COCONUT_SUGAR',
      'FORMULATION.CANE_SUGAR',
      'FORMULATION.TOTAL_BATCH_MASS',
      'ARTWORK.INGREDIENTS',
      'ARTWORK.VEGAN_CLAIM',
      'ARTWORK.NO_ADDED_SUGAR_CLAIM',
      'ARTWORK.ADDED_SUGARS_LABEL',
      'NUTRITION.CALORIES',
      'NUTRITION.TOTAL_SUGARS',
      'NUTRITION.ADDED_SUGARS',
      'NUTRITION.CARBOHYDRATES',
      'NUTRITION.CHOLESTEROL',
      'ALLERGENS.TREE_NUTS',
      'CERTIFICATION.VEGAN',
      'REVIEW.LEGAL',
      'REVIEW.RND',
      'REVIEW.BRAND',
      'REVIEW.PREPRESS'
    ];

    for (const node of requiredNodes) {
      assert.ok(DECISION_DEPENDENCY_GRAPH[node], `Dependency graph must include canonical node ${node}`);
      assert.ok(Array.isArray(DECISION_DEPENDENCY_GRAPH[node].dependencies), `${node} dependencies must be an array`);
      assert.ok(Array.isArray(DECISION_DEPENDENCY_GRAPH[node].dependents), `${node} dependents must be an array`);
    }
  });

  await t.test('Step 25 Requirement 23: Dependency graph has no invalid cycles', () => {
    const cycleResult = validateNoInvalidCycles(DECISION_DEPENDENCY_GRAPH);
    assert.equal(cycleResult.valid, true, `Cycle check failed: ${cycleResult.cycle?.join(' -> ')}`);
  });

  await t.test('Honey formulation node maps to expected downstream consequences', () => {
    const impacts = findDownstreamImpacts('FORMULATION.HONEY');
    assert.ok(impacts.includes('ARTWORK.INGREDIENTS'), 'Honey affects artwork ingredients');
    assert.ok(impacts.includes('ARTWORK.NO_ADDED_SUGAR_CLAIM'), 'Honey affects no added sugar claim');
    assert.ok(impacts.includes('ARTWORK.VEGAN_CLAIM'), 'Honey affects vegan claim');
    assert.ok(impacts.includes('NUTRITION.TOTAL_SUGARS'), 'Honey affects total sugars');
    assert.ok(impacts.includes('NUTRITION.ADDED_SUGARS'), 'Honey affects added sugars');
    assert.ok(impacts.includes('REVIEW.RND'), 'Honey changes require R&D review');
    assert.ok(impacts.includes('REVIEW.BRAND'), 'Honey changes require Brand review');
    assert.ok(impacts.includes('REVIEW.LEGAL'), 'Honey changes require Legal review');
  });

  await t.test('Step 25 Requirement 20 & 21: Allergen tree nuts node remains independent of Honey formulation', () => {
    const honeyImpacts = findDownstreamImpacts('FORMULATION.HONEY');
    assert.equal(
      honeyImpacts.includes('ALLERGENS.TREE_NUTS'),
      false,
      'Honey removal must not alter tree nut allergen disclosure obligations'
    );

    const affected = isCheckAffectedByNode('DF-06', 'FORMULATION.HONEY');
    assert.equal(affected, false, 'Tree nut check DF-06 must not be affected by honey formulation change');
  });

  await t.test('Affected departments helper correctly extracts responsible teams', () => {
    const brandDepartments = getAffectedDepartments(['ARTWORK.VEGAN_CLAIM', 'REVIEW.BRAND']);
    assert.ok(brandDepartments.includes('Brand & Marketing'));

    const honeyDownstream = findDownstreamImpacts('FORMULATION.HONEY');
    const rndDepartments = getAffectedDepartments(honeyDownstream);
    assert.ok(rndDepartments.includes('R&D & Food Science'));
    assert.ok(rndDepartments.includes('Brand & Marketing'));
  });
});
