import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIngredientClaimConflicts,
  simulateDecisionScenario,
  compareDecisionScenarios
} from '../lib/decision-ripple.mjs';

function createMockDancingFishReview() {
  return {
    id: 'mock-df-review',
    findings: [
      {
        id: 'DF-02',
        title: 'Ingredient Listing vs Specification',
        status: 'review',
        field: 'ingredients',
        observed: 'Crisp Rice, Honey (1%), Coconut Sugar, Ginger with Cane Sugar',
        expected: 'Honey (9%), Coconut Sugar, Crisp Rice, Ginger with Cane Sugar',
        evidence: [
          { role: 'artwork', quote: 'Honey (1%)', location: 'Back Panel' },
          { role: 'source', quote: 'Honey (9%)', location: 'Specification Sheet, cell B26' }
        ]
      },
      {
        id: 'DF-04',
        title: 'No Added Sugar Claim Substantiation',
        status: 'review',
        field: 'claims.no_added_sugar',
        observed: 'NO ADDED SUGAR',
        expected: '21 CFR 101.60(c): No added sugars or ingredients containing added sugars',
        evidence: [
          { role: 'artwork', quote: 'NO ADDED SUGAR', location: 'Top Flap' }
        ]
      },
      {
        id: 'DF-05',
        title: 'Dietary Suitability: Vegan Claim vs Honey Ingredient',
        status: 'review',
        field: 'claims.vegan',
        observed: 'Suitable for Vegans.',
        expected: 'Product contains honey (animal-derived ingredient)',
        evidence: [
          { role: 'artwork', quote: 'Suitable for Vegans.', location: 'Back Panel' }
        ]
      },
      {
        id: 'DF-06',
        title: 'Tree Nut Allergen Disclosure',
        status: 'review',
        field: 'allergens.tree_nuts',
        observed: 'Contains: Almonds, Pecans, Walnuts',
        expected: 'Contains: Almonds, Pecans, Walnuts',
        evidence: [
          { role: 'artwork', quote: 'Contains: Almonds, Pecans, Walnuts', location: 'Back Panel' }
        ]
      },
      {
        id: 'DF-09',
        title: 'Added Sugars Declaration',
        status: 'review',
        field: 'nutrition.added_sugars',
        observed: '0g Added Sugars',
        expected: 'Contains Honey and Coconut Sugar; 0g requires verification'
      },
      {
        id: 'DF-11',
        title: 'Cholesterol Declaration Investigation',
        status: 'review',
        field: 'nutrition.cholesterol',
        observed: '45mg Cholesterol',
        expected: 'Plant-based granola formulation expected 0mg'
      }
    ],
    facts: [
      { field: 'ingredients', value: 'Honey (9%), Coconut Sugar, Crisp Rice' }
    ]
  };
}

test('Decision Ripple: Conflict detection and simulation branches', async (t) => {
  await t.test('Step 25 Requirement 1: Honey/vegan conflict detected with actual ingredient and claim evidence', () => {
    const review = createMockDancingFishReview();
    const conflicts = detectIngredientClaimConflicts(review);
    assert.equal(conflicts.length, 1);
    const c = conflicts[0];
    assert.equal(c.conflictType, 'INGREDIENT_VS_CLAIM');
    assert.ok(c.ingredientEvidence.quote.includes('Honey'));
    assert.ok(c.claimEvidence.quote.includes('Vegan'));
    assert.equal(c.options.length, 2);
  });

  await t.test('Step 25 Requirement 2: Missing vegan claim does not create the conflict', () => {
    const review = createMockDancingFishReview();
    review.findings = review.findings.filter(f => f.id !== 'DF-05');
    const conflicts = detectIngredientClaimConflicts(review);
    assert.equal(conflicts.length, 0);
  });

  await t.test('Step 25 Requirement 3: Missing honey evidence does not create a definitive conflict', () => {
    const review = createMockDancingFishReview();
    review.findings = review.findings.map(f => {
      if (f.id === 'DF-02') {
        return { ...f, observed: 'Crisp Rice, Coconut Sugar', expected: 'Crisp Rice, Coconut Sugar', evidence: [] };
      }
      if (f.id === 'DF-05') {
        return { ...f, title: 'Dietary Suitability: Vegan Claim', expected: 'Approved plant-based claim' };
      }
      return f;
    });
    review.facts = [{ field: 'ingredients', value: 'Crisp Rice, Coconut Sugar' }];
    const conflicts = detectIngredientClaimConflicts(review);
    assert.equal(conflicts.length, 0);
  });

  await t.test('Step 25 Requirements 5, 6, 7, 8, 9: OPTION A (Keep Honey) consequences', () => {
    const review = createMockDancingFishReview();
    const scenario = simulateDecisionScenario(review, 'KEEP_HONEY');

    assert.equal(scenario.previewOnly, true, 'Preview only flag must be true');
    assert.equal(scenario.selectedOption, 'KEEP_HONEY');

    // 5. Proposes vegan claim removal
    const veganChange = scenario.proposedChanges.find(c => c.field === 'ARTWORK.VEGAN_CLAIM');
    assert.ok(veganChange, 'Must propose artwork removal of vegan claim');
    assert.equal(veganChange.action, 'REMOVE_OR_REVISE');

    // 6. Formula unchanged
    assert.equal(scenario.proposedChanges.some(c => c.field === 'FORMULATION.HONEY'), false, 'Formula must not be altered');

    // 7. Nutrition unchanged
    assert.equal(scenario.impactedChecks.some(c => c.checkId === 'DF-09' && c.impactState === 'RECALCULATION_REQUIRED'), false);

    // 8. No Added Sugar remains conflicted
    const sugarCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-04');
    assert.ok(sugarCheck, 'No added sugar check must be evaluated');
    assert.equal(sugarCheck.impactState, 'STILL_CONFLICTED');
    assert.ok(sugarCheck.reason.includes('Coconut sugar'));

    // 9. Tree-nut allergens unaffected
    const nutCheck = scenario.unaffectedChecks.find(c => c.checkId === 'DF-06');
    assert.ok(nutCheck, 'Tree-nut allergen check must be in unaffectedChecks');
  });

  await t.test('Step 25 Requirements 10, 11, 12, 13, 14, 15, 16, 17, 18, 19: OPTION B (Remove Honey) consequences', () => {
    const review = createMockDancingFishReview();
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');

    assert.equal(scenario.previewOnly, true);
    assert.equal(scenario.selectedOption, 'REMOVE_HONEY');

    // 10. Creates formulation proposal
    const formChange = scenario.proposedChanges.find(c => c.field === 'FORMULATION.HONEY');
    assert.ok(formChange, 'Must propose formulation change');
    assert.equal(formChange.action, 'REFORMULATE_REMOVE');

    // 11. Does not invent replacement
    assert.ok(scenario.limitations.some(l => l.includes('Replacement ingredient or batch yield adjustment not assumed')));

    // 12. Conflicting honey percentages remain unresolved
    const ingCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-02');
    assert.ok(ingCheck);
    assert.equal(ingCheck.impactState, 'SOURCE_APPROVAL_REQUIRED');

    // 13 & 14. Nutrition values invalidated / recalculation required without fabricated numbers
    const nutCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-09');
    assert.ok(nutCheck);
    assert.equal(nutCheck.impactState, 'RECALCULATION_REQUIRED');
    assert.ok(scenario.limitations.some(l => l.includes('Quantitative nutrition numbers not fabricated')));

    // 15 & 16. Coconut sugar & cane sugar in ginger still affect sugar claim
    const sugarCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-04');
    assert.ok(sugarCheck);
    assert.equal(sugarCheck.impactState, 'STILL_CONFLICTED');
    assert.ok(sugarCheck.reason.includes('Coconut sugar') || sugarCheck.reason.includes('Cane sugar'));

    // 17 & 18. Vegan claim requires substantiation, not automatically certified
    const veganCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-05');
    assert.ok(veganCheck);
    assert.equal(veganCheck.impactState, 'CERTIFICATION_REVIEW_REQUIRED');

    // 19. Cholesterol observation stays reviewable
    const cholCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-11');
    assert.ok(cholCheck);
    assert.equal(cholCheck.impactState, 'SOURCE_APPROVAL_REQUIRED');

    // 20 & 21. Tree nut allergens remain unaffected
    const nutCheckUnaffected = scenario.unaffectedChecks.find(c => c.checkId === 'DF-06');
    assert.ok(nutCheckUnaffected);
  });

  await t.test('Step 25 Requirement 34: Scenario comparison returns real trade-offs and differences', () => {
    const review = createMockDancingFishReview();
    const comparison = compareDecisionScenarios(review);
    assert.ok(comparison.optionA, 'Must include Option A');
    assert.ok(comparison.optionB, 'Must include Option B');
    assert.ok(Array.isArray(comparison.comparisonMatrix), 'Must include comparison matrix');

    const formulaRow = comparison.comparisonMatrix.find(r => r.dimension === 'Product Formulation');
    assert.ok(formulaRow);
    assert.equal(formulaRow.optionA, 'Unchanged');
    assert.ok(formulaRow.optionB.includes('Reformulation'));
  });

  await t.test('Step 25 Requirement 36: No predicted MATCH is persisted as verified', () => {
    const review = createMockDancingFishReview();
    const scenarioA = simulateDecisionScenario(review, 'KEEP_HONEY');
    const scenarioB = simulateDecisionScenario(review, 'REMOVE_HONEY');

    for (const check of [...scenarioA.impactedChecks, ...scenarioB.impactedChecks]) {
      assert.notEqual(check.impactState, 'MATCH', 'Simulation must never output a verified MATCH status');
    }
  });
});
