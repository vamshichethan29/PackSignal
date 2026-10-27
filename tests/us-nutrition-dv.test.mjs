import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { roundStatutoryDailyValue, evaluateRule } from '../lib/rules/rule-evaluator.mjs';
import { loadMarketPack } from '../lib/rules/market-pack-loader.mjs';

describe('Phase 3 — US FDA Nutrition % Daily Value Checks', () => {

  const pack = loadMarketPack('us', { launchDate: '2026-10-16' });

  test('1. Reference Daily Values loaded from pack data without hardcoding in core engine', () => {
    const dvs = pack.referenceData.dailyValues.dailyValues;
    assert.equal(dvs.total_fat.referenceValue, 78);
    assert.equal(dvs.saturated_fat.referenceValue, 20);
    assert.equal(dvs.cholesterol.referenceValue, 300);
    assert.equal(dvs.sodium.referenceValue, 2300);
    assert.equal(dvs.total_carbohydrate.referenceValue, 275);
    assert.equal(dvs.dietary_fiber.referenceValue, 28);
    assert.equal(dvs.added_sugars.referenceValue, 50);
    assert.equal(dvs.vitamin_d.referenceValue, 20);
  });

  test('2. Total Sugars has NO Daily Value under US regulations', () => {
    const noDvList = pack.referenceData.dailyValues.noDailyValueNutrients;
    assert.ok(noDvList.includes('total_sugars'), 'Total Sugars must be listed as having no Daily Value');
  });

  test('3. Evaluates Total Fat %DV correctly and flags discrepancy', () => {
    const fatRule = pack.effectiveRules.find(r => r.ruleId === 'US-NUTR-005');
    assert.ok(fatRule);

    // Correct fact (15g with 19% DV)
    const validFatFact = [{
      field: 'nutrition.fat.total',
      value: '15g',
      evidence: { quote: 'Total Fat 15g 19%' }
    }];
    const validRes = evaluateRule(fatRule, validFatFact, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(validRes.status, 'PASS');

    // Mismatched carton fact (15g with 2.2% DV)
    const mismatchedFatFact = [{
      field: 'nutrition.fat.total',
      value: '15g',
      evidence: { quote: 'Total Fat 15g 2.2%' }
    }];
    const mismatchRes = evaluateRule(fatRule, mismatchedFatFact, pack.referenceData, { market: 'US', product: { category: 'granola' } });
    assert.equal(mismatchRes.status, 'ISSUE');
    assert.ok(mismatchRes.proof.includes('Discrepancy'));
  });

  test('4. Tiered rounding for Vitamin D (under 10% to nearest 2%, 10-50% to nearest 5%)', () => {
    assert.deepEqual(roundStatutoryDailyValue(12.3, 'VITAMIN_MINERAL_TIERED'), [10]);
    assert.deepEqual(roundStatutoryDailyValue(14.0, 'VITAMIN_MINERAL_TIERED'), [15]);
    assert.deepEqual(roundStatutoryDailyValue(7.1, 'VITAMIN_MINERAL_TIERED'), [8]);
    assert.deepEqual(roundStatutoryDailyValue(1.2, 'VITAMIN_MINERAL_TIERED'), [0, 2]);
  });
});
