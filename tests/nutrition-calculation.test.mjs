import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule } from '../lib/rules/rule-evaluator.mjs';
import { loadMarketPack } from '../lib/rules/market-pack-loader.mjs';

describe('Phase 3 — Nutrition Calorie Math & Atwater Plausibility', () => {

  const pack = loadMarketPack('us', { launchDate: '2026-10-16' });
  const calRule = pack.effectiveRules.find(r => r.ruleId === 'US-NUTR-004');

  test('1. Calorie plausibility match within 20% screening heuristic returns PASS', () => {
    // 10g fat (90), 20g carb (80), 5g protein (20) = 190 kcal. Declared: 200 kcal (~5% diff)
    const matchingFacts = [
      { field: 'nutrition.calories', value: '200', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Calories 200' } },
      { field: 'nutrition.fat.total', value: '10g', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Total Fat 10g' } },
      { field: 'nutrition.carbohydrate.total', value: '20g', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Total Carbohydrate 20g' } },
      { field: 'nutrition.protein', value: '5g', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Protein 5g' } }
    ];

    const res = evaluateRule(calRule, matchingFacts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'PASS');
    assert.ok(res.proof.includes('190 kcal'));
  });

  test('2. Calorie plausibility mismatch (>20%) routes to NEEDS_REVIEW / screening result', () => {
    // Declared: 166 kcal vs 535 calculated
    const mismatchFacts = [
      { field: 'nutrition.calories', value: '166', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Calories 166' } },
      { field: 'nutrition.fat.total', value: '15g', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Total Fat 15g' } },
      { field: 'nutrition.carbohydrate.total', value: '66g', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Total Carbohydrate 66g' } },
      { field: 'nutrition.protein', value: '34g', normalizedValue: { basis: 'per_serving' }, evidence: { quote: 'Protein 34g' } }
    ];

    const res = evaluateRule(calRule, mismatchFacts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'NEEDS_REVIEW');
    assert.ok(res.proof.includes('535 kcal'));
    assert.ok(res.proof.includes('insoluble fiber deductions may lawfully explain'));
  });

  test('3. Rejects combining mismatched measurement bases (per 100g vs per serving)', () => {
    const mixedBasisFacts = [
      { field: 'nutrition.calories', value: '166', normalizedValue: { basis: 'per_serving' } },
      { field: 'nutrition.fat.total', value: '15g', normalizedValue: { basis: 'per_100g' } },
      { field: 'nutrition.carbohydrate.total', value: '66g', normalizedValue: { basis: 'per_serving' } }
    ];

    const res = evaluateRule(calRule, mixedBasisFacts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'NEEDS_REVIEW');
    assert.ok(res.observed.includes('differs from carbohydrate basis'));
  });
});
