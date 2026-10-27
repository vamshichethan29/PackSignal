import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMarketRulePack, validateRuleRecord } from '../lib/rulesets/loader.mjs';

test('loadMarketRulePack loads and validates US FDA ruleset', async () => {
  const pack = await loadMarketRulePack('us');
  assert.equal(pack.market, 'us');
  assert.ok(pack.rulesCount >= 5, 'US rule pack must contain core FDA rules');

  const netQtyRule = pack.rules.find(r => r.id === 'US-001');
  assert.ok(netQtyRule);
  assert.equal(netQtyRule.checkType, 'QUANTITY_EQUIVALENCE');
  assert.equal(netQtyRule.legalStatus, 'IN_FORCE');

  const dvRule = pack.rules.find(r => r.id === 'US-005');
  assert.ok(dvRule);
  assert.equal(dvRule.checkType, 'NUTRIENT_DV');
});

test('validateRuleRecord rejects unknown or malicious rule records', () => {
  assert.throws(() => {
    validateRuleRecord({
      id: 'BAD-01',
      version: '1.0',
      market: 'us',
      regulator: 'FDA',
      productScope: 'food',
      sourceCitation: 'none',
      checkType: 'UNSAFE_EVAL_SCRIPT', // invalid type
      parameters: {},
    });
  }, /specifies unknown or unsupported checkType/i);
});
