import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateDecisionScenario
} from '../lib/decision-ripple.mjs';

test('Decision Source Authority: Rigorous regulatory & scientific boundary tests', async (t) => {
  const review = {
    id: 'test-source-auth',
    findings: [
      {
        id: 'DF-01',
        title: 'Source Document Authority Status',
        status: 'review',
        field: 'source.status',
        observed: 'Content Sheet: Draft / In Review (cell E3)',
        expected: 'Approved Product Master'
      },
      {
        id: 'DF-02',
        title: 'Honey Percentage Discrepancy',
        status: 'review',
        field: 'ingredients.honey_pct',
        observed: 'Artwork declares 1% honey',
        expected: 'Source sheet declares 9% honey (B26)'
      },
      {
        id: 'DF-05',
        title: 'Dietary Suitability: Vegan Claim vs Honey',
        status: 'review',
        field: 'claims.vegan',
        observed: 'Suitable for Vegans. (No Certified Vegan logo on PDF artwork)',
        expected: 'Product contains Honey'
      },
      {
        id: 'DF-06',
        title: 'FALCPA Allergen Declaration',
        status: 'review',
        field: 'allergens.falcpa',
        observed: 'Contains: Almonds, Pecans, Walnuts',
        expected: 'Contains: Almonds, Pecans, Walnuts'
      },
      {
        id: 'DF-09',
        title: 'Nutrition Facts Energy and Sugars',
        status: 'review',
        field: 'nutrition.energy_sugars',
        observed: 'Calories: 210, Total Sugars: 12g, Added Sugars: 0g',
        expected: 'Lab chemical analysis or Atwater recipe calculation'
      }
    ]
  };

  await t.test('Step 25 Requirement 4: Draft source status is preserved and not assumed approved', () => {
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');
    assert.ok(
      scenario.limitations.some(l => l.includes('Draft / In Review status')),
      'Simulation must explicitly state that content sheet draft status is preserved'
    );
  });

  await t.test('Step 25 Requirement 12: Conflicting honey percentages (9% vs 1%) remain unresolved', () => {
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');
    const ingCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-02');
    assert.ok(ingCheck);
    assert.equal(ingCheck.impactState, 'SOURCE_APPROVAL_REQUIRED');
    assert.ok(ingCheck.reason.includes('9% vs 1%') || ingCheck.reason.includes('discrepancy'));
  });

  await t.test('Step 25 Requirement 14: Missing quantitative inputs prevent fabricated nutrition recalculation', () => {
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');
    const nutCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-09');
    assert.ok(nutCheck);
    assert.equal(nutCheck.impactState, 'RECALCULATION_REQUIRED');
    // Ensure no numbers like "Calories: 195" were guessed
    assert.equal(nutCheck.predictedConsequence.includes('Calories:'), false);
    assert.ok(nutCheck.predictedConsequence.includes('RECALCULATION REQUIRED'));
  });

  await t.test('Step 25 Requirement 17 & 18: Vegan certification requires certifier authorization and logo evidence', () => {
    const scenario = simulateDecisionScenario(review, 'REMOVE_HONEY');
    const veganCheck = scenario.impactedChecks.find(c => c.checkId === 'DF-05');
    assert.ok(veganCheck);
    assert.equal(veganCheck.impactState, 'CERTIFICATION_REVIEW_REQUIRED');
    assert.ok(veganCheck.requiredNextAction.includes('certifier') || veganCheck.requiredNextAction.includes('authorization'));
  });

  await t.test('Step 25 Requirement 20: Honey is not classified as an FDA FALCPA major allergen', () => {
    const scenarioA = simulateDecisionScenario(review, 'KEEP_HONEY');
    const scenarioB = simulateDecisionScenario(review, 'REMOVE_HONEY');

    const checkA = scenarioA.unaffectedChecks.find(c => c.checkId === 'DF-06');
    const checkB = scenarioB.unaffectedChecks.find(c => c.checkId === 'DF-06');

    assert.ok(checkA, 'Option A keeps FALCPA allergens unaffected');
    assert.ok(checkB, 'Option B keeps FALCPA allergens unaffected');
    assert.ok(checkB.reason.includes('Honey is not an FDA FALCPA major food allergen'));
  });

  await t.test('Step 25 Requirement 35: Simulation impact states differ from verified review engine verdicts', () => {
    const scenario = simulateDecisionScenario(review, 'KEEP_HONEY');
    for (const check of scenario.impactedChecks) {
      assert.notEqual(check.impactState, 'PASS');
      assert.notEqual(check.impactState, 'MATCH');
    }
  });
});
