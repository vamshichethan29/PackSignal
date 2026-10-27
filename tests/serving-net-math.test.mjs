import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule } from '../lib/rules/rule-evaluator.mjs';
import { loadMarketPack } from '../lib/rules/market-pack-loader.mjs';

describe('Phase 3 — Serving Size × Count vs Package Net Weight Math', () => {

  const pack = loadMarketPack('us', { launchDate: '2026-10-16' });
  const servRule = pack.effectiveRules.find(r => r.ruleId === 'US-NUTR-003');

  test('1. Serving arithmetic matches net weight within 5% tolerance returns PASS', () => {
    // 8 servings * 60g = 480g == 480g net
    const matchFacts = [
      { field: 'nutrition.servings_per_container', value: '8 servings', evidence: { quote: '8 servings per container' } },
      { field: 'nutrition.serving_size', value: '60g', evidence: { quote: 'Serving size 60g' } },
      { field: 'net_quantity', value: '480g', evidence: { quote: 'Net Wt 480g' } }
    ];

    const res = evaluateRule(servRule, matchFacts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'PASS');
    assert.ok(res.proof.includes('480g'));
  });

  test('2. Serving arithmetic mismatch (8 * 85g = 680g vs 480g declared) returns ISSUE', () => {
    const mismatchFacts = [
      { field: 'nutrition.servings_per_container', value: '8 servings', evidence: { quote: '8 servings per container' } },
      { field: 'nutrition.serving_size', value: '85g', evidence: { quote: 'Serving size 85g' } },
      { field: 'net_quantity', value: '480g', evidence: { quote: 'Net Wt 480g' } }
    ];

    const res = evaluateRule(servRule, mismatchFacts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'ISSUE');
    assert.ok(res.proof.includes('680g'));
    assert.ok(res.proof.includes('480g'));
    assert.ok(res.reviewQuestion);
  });

  test('3. Missing inputs return UNABLE_TO_VERIFY without guessing values', () => {
    const partialFacts = [
      { field: 'nutrition.serving_size', value: '85g' }
    ];

    const res = evaluateRule(servRule, partialFacts, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(res.status, 'UNABLE_TO_VERIFY');
  });
});
