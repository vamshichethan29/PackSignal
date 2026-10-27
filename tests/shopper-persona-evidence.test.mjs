import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFindingRelevantToPersona,
  getFindingPersonaMapping
} from '../lib/shopper-personas.mjs';

test('Shopper Persona Evidence, Regulatory Distinctions & Guardrails (Upgrade #42)', async (t) => {
  await t.test('1. Nut Allergy: Distinguishes intentional tree nuts from advisory statement', () => {
    const intentionalNutFinding = {
      id: 'DF-02',
      title: 'Declared Tree Nut Ingredients (Almonds, Pecans, Walnuts)',
      observed: 'Almonds, Pecans, Walnuts declared in ingredient statement',
      expected: 'Recipe tree nuts present',
      rule: { field: 'allergen_declaration' },
      status: 'match'
    };

    const advisoryFinding = {
      id: 'DF-03',
      title: 'Precautionary Allergen Statement (May Contain)',
      observed: 'May Contain tree nuts statement on Back Panel',
      expected: 'Voluntary advisory wording evaluation',
      rule: { field: 'precautionary_allergen' },
      status: 'review'
    };

    const intentionalMap = getFindingPersonaMapping(intentionalNutFinding, 'nut-allergy');
    const advisoryMap = getFindingPersonaMapping(advisoryFinding, 'nut-allergy');

    assert.equal(intentionalMap?.relevanceType, 'INTENTIONAL_INGREDIENT');
    assert.equal(advisoryMap?.relevanceType, 'UNCERTAINTY');
    assert.ok(advisoryMap?.consumerExplanation.whyItMatters.includes('accidental equipment cross-contact'));
  });

  await t.test('2. Nut Allergy: Proper ingredient naming does not trigger false undeclared allergen violation', () => {
    const declaredAllergen = {
      id: 'DF-02',
      title: 'Tree Nut Ingredients Declared by Common Name',
      observed: 'Ingredients: Rolled Oats, Almonds, Pecans, Walnuts, Honey...',
      status: 'match',
      rule: { field: 'allergen_declaration' }
    };

    assert.equal(declaredAllergen.status, 'match', 'Declared allergens have MATCH status, not false ISSUE');
    const mapping = getFindingPersonaMapping(declaredAllergen, 'nut-allergy');
    assert.doesNotMatch(mapping.consumerExplanation.whyItMatters, /undeclared allergen/i);
    assert.doesNotMatch(mapping.consumerExplanation.whyItMatters, /safe for consumption/i);
  });

  await t.test('3. Vegan: Identifies real honey and does not fabricate Certified Vegan trademark', () => {
    const veganClaimFinding = {
      id: 'DF-05',
      title: 'Dietary Suitability / Vegan Marketing Claim vs Honey',
      observed: 'Artwork says: "DIETARY INFORMATION: Suitable for Vegans."',
      expected: 'Specification declares Honey (1% on artwork, 9% in draft sheet B26)',
      rule: { field: 'claims.vegan' },
      status: 'issue'
    };

    const mapping = getFindingPersonaMapping(veganClaimFinding, 'vegan');
    assert.ok(mapping.consumerExplanation.shopperSees.includes('Suitable for Vegans'));
    assert.ok(mapping.consumerExplanation.sourceDataSays.includes('Honey'));
    assert.doesNotMatch(mapping.consumerExplanation.shopperSees, /Certified Vegan Logo/i, 'No fabricated Certified Vegan logo');
  });

  await t.test('4. Vegan: Cholesterol declaration remains a separate lab/nutrition question', () => {
    const cholesterolFinding = {
      id: 'DF-10',
      title: 'Nutrition Facts Cholesterol Declaration Verification',
      observed: '45mg Cholesterol (15% DV)',
      expected: 'Plant ingredients have negligible cholesterol (<2mg)',
      rule: { field: 'nutrition.cholesterol' },
      status: 'review'
    };

    const mapping = getFindingPersonaMapping(cholesterolFinding, 'vegan');
    assert.ok(mapping, 'Relevant to Vegan Shopper as an investigative anomaly');
    assert.ok(mapping.consumerExplanation.uncertainty.includes('lab assay verification is required'));
    assert.doesNotMatch(mapping.consumerExplanation.whyItMatters, /proves animal fat/i);
  });

  await t.test('5. Sugar Watcher: Evaluates "No Added Sugar" and "0g Added Sugars" separately', () => {
    const noAddedSugarClaim = {
      id: 'DF-04',
      title: 'Nutrient Content Claim: No Added Sugar',
      observed: 'Top flap reads "NO ADDED SUGAR"',
      expected: '21 CFR 101.60(c)(2) criteria: no added nutritive sweeteners',
      rule: { field: 'claims.sugar' },
      status: 'issue'
    };

    const nutritionAddedSugars = {
      id: 'DF-09',
      title: 'Nutrition Facts Added Sugars Declaration',
      observed: '0g Added Sugars printed in Nutrition Facts panel',
      expected: '21 CFR 101.9(c)(6)(iii) rounding rules (<0.5g rounds to 0g)',
      rule: { field: 'nutrition.added_sugars' },
      status: 'review'
    };

    const claimMapping = getFindingPersonaMapping(noAddedSugarClaim, 'sugar-watcher');
    const nutritionMapping = getFindingPersonaMapping(nutritionAddedSugars, 'sugar-watcher');

    assert.equal(claimMapping?.relevanceType, 'DIRECT_CONFLICT');
    assert.equal(nutritionMapping?.relevanceType, 'NUTRITION_ROUNDING');
    assert.ok(claimMapping?.consumerExplanation.whyItMatters.includes('21 CFR 101.60(c)(2)'));
  });

  await t.test('6. Sugar Watcher: Does not guess added sugar grams without approved formulation data', () => {
    const sugarFinding = {
      id: 'DF-04',
      title: 'Sugar Claim vs Ingredients',
      observed: 'NO ADDED SUGAR',
      rule: { field: 'claims.sugar' },
      status: 'issue'
    };

    const mapping = getFindingPersonaMapping(sugarFinding, 'sugar-watcher');
    assert.ok(mapping.limitations.includes('Quantitative verification requires approved formulation data'));
  });

  await t.test('7. Preserves Draft / In Review source authority for spreadsheet cells', () => {
    const honeyFinding = {
      id: 'DF-05',
      title: 'Vegan Claim vs Honey',
      rule: { field: 'claims.vegan' },
      status: 'issue'
    };

    const mapping = getFindingPersonaMapping(honeyFinding, 'vegan');
    assert.ok(mapping.consumerExplanation.uncertainty.includes('Draft / In Review'));
  });
});
