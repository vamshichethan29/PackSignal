import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule } from '../lib/rules/rule-evaluator.mjs';
import { loadMarketPack } from '../lib/rules/market-pack-loader.mjs';

describe('Phase 3 — US Food Label Rules: Allergens & Added Sugar Claim', () => {

  const pack = loadMarketPack('us', { launchDate: '2026-10-16' });

  test('1. Major allergen disclosure: Declared nuts in ingredients are not flagged as missing', () => {
    const allergenRule = pack.effectiveRules.find(r => r.ruleId === 'US-ALLERG-001');
    const facts = [
      { field: 'ingredient.list', value: 'INGREDIENTS: Wholegrain Oats, Almonds, Pecans, Walnuts, Honey.' }
    ];

    const res = evaluateRule(allergenRule, facts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'PASS');
    assert.ok(res.observed.includes('almond'));
    assert.ok(res.observed.includes('pecan'));
    assert.ok(res.observed.includes('walnut'));
  });

  test('2. Tree nut species: Requires specific species name, rejects generic "tree nuts"', () => {
    const speciesRule = pack.effectiveRules.find(r => r.ruleId === 'US-ALLERG-002');

    const specificFacts = [{ field: 'ingredient.list', value: 'INGREDIENTS: Oats, Almonds, Pecans.' }];
    const passRes = evaluateRule(speciesRule, specificFacts, pack.referenceData, { market: 'US' });
    assert.equal(passRes.status, 'PASS');

    const genericFacts = [{ field: 'ingredient.list', value: 'INGREDIENTS: Oats, Tree Nuts.' }];
    const failRes = evaluateRule(speciesRule, genericFacts, pack.referenceData, { market: 'US' });
    assert.equal(failRes.status, 'ISSUE');
    assert.ok(failRes.observed.includes('Generic term "Tree Nuts"'));
  });

  test('3. Precautionary advisory: Intentional ingredients in "May Contain" flags NEEDS_REVIEW', () => {
    const advRule = pack.effectiveRules.find(r => r.ruleId === 'US-ALLERG-003');
    const overlappingFacts = [
      { field: 'ingredient.list', value: 'INGREDIENTS: Oats, Almonds, Pecans, Walnuts.' },
      { field: 'claims.allergen_advisory', value: 'ALLERGEN INFORMATION: May Contain Almonds, May Contain Pecans.' }
    ];

    const res = evaluateRule(advRule, overlappingFacts, pack.referenceData, { market: 'US' });
    assert.equal(res.status, 'NEEDS_REVIEW');
    assert.ok(res.observed.includes('almond'));
    assert.ok(res.reviewQuestion);
  });

  test('4. "No Added Sugar" claim: Disqualified when honey or cane sugar are present in recipe', () => {
    const claimRule = pack.effectiveRules.find(r => r.ruleId === 'US-CLAIM-001');
    const sweetenerFacts = [
      { field: 'claims.dietary.no_added_sugar', value: 'NO ADDED SUGAR' },
      { field: 'ingredient.list', value: 'INGREDIENTS: Oats, Honey (1%), Coconut Sugar, Crystallized Ginger (cane sugar).' },
      { field: 'nutrition.sugars.added', value: '0g' }
    ];

    const res = evaluateRule(claimRule, sweetenerFacts, pack.referenceData, { market: 'US' });
    assert.equal(res.status, 'ISSUE');
    assert.ok(res.observed.includes('honey'));
    assert.ok(res.observed.includes('coconut sugar'));
    assert.ok(res.reviewQuestion);
  });
});
