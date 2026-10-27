import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Symbol Presence: Compiles statutory vegetarian symbol requirement', () => {
  const rule = compilePackagingRule('All applicable vegetarian food packages must display the prescribed vegetarian symbol.');
  assert.equal(rule.type, 'STATUTORY_SYMBOL_PRESENCE');
  assert.equal(rule.parameters.symbolId, 'FSSAI_VEGETARIAN');
  assert.equal(rule.parameters.requiredColor, 'green');
  assert.equal(rule.parameters.requiredShape, 'circle_in_square');
  assert.equal(rule.parameters.category, 'STATUTORY_SYMBOL');
});

test('Symbol Presence: Compiles non-vegetarian symbol requirement', () => {
  const rule = compilePackagingRule('Packaging must display the prescribed non-vegetarian brown triangle symbol.');
  assert.equal(rule.type, 'STATUTORY_SYMBOL_PRESENCE');
  assert.equal(rule.parameters.symbolId, 'FSSAI_NONVEG');
  assert.equal(rule.parameters.requiredColor, 'brown');
  assert.equal(rule.parameters.requiredShape, 'triangle_in_square');
});

test('Symbol Presence: Distinguishes voluntary certification marks from statutory mandates', () => {
  const rule = compilePackagingRule({
    id: 'RULE-VOL-01',
    ruleText: 'Voluntary certification symbol: Certified Vegan',
    symbolType: 'VOLUNTARY_CERTIFICATION',
    symbolName: 'Certified Vegan',
  });
  assert.equal(rule.type, 'STATUTORY_SYMBOL_PRESENCE');
  assert.equal(rule.symbolType, 'VOLUNTARY_CERTIFICATION');
});

test('Symbol Presence: Voluntary certification without certificate document requires review', () => {
  const rule = compilePackagingRule({
    id: 'RULE-VOL-02',
    type: 'STATUTORY_SYMBOL_PRESENCE',
    symbolType: 'VOLUNTARY_CERTIFICATION',
    symbolName: 'Certified Organic',
  });
  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish 100% Certified Organic Granola',
    facts: [], // No certificate document in facts
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'review');
  assert.equal(res.verdict, 'VOLUNTARY_CERTIFICATE_UNVERIFIED');
});

test('Symbol Presence: Voluntary certification with verified certificate passes', () => {
  const rule = compilePackagingRule({
    id: 'RULE-VOL-03',
    type: 'STATUTORY_SYMBOL_PRESENCE',
    symbolType: 'VOLUNTARY_CERTIFICATION',
    symbolName: 'Certified Organic',
  });
  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish 100% Certified Organic Granola',
    facts: [{ field: 'certification', value: 'USDA Certified Organic C0123984' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'SYMBOL_PRESENCE_CONFIRMED');
});

test('Symbol Presence: Missing statutory symbol produces ISSUE', () => {
  const rule = compilePackagingRule('Packaging must bear the prescribed vegetarian symbol.');
  const res = executeCompiledRule(rule, {
    artworkText: '100% Whole Grain Granola with Almonds',
    symbols: [],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'MANDATORY_SYMBOL_MISSING');
});

test('Symbol Presence: Permissive voluntary wording does not compile into mandatory rule', () => {
  const permissive = compilePackagingRule('Organic logo may be used if certified.');
  assert.equal(permissive.type, 'MANUAL_REVIEW');
  assert.equal(permissive.isCompiled, false);
  assert.equal(permissive.status, 'EXEMPTION_OR_VOLUNTARY');
});

test('Symbol Presence: Negative wording does not compile into mandatory presence check', () => {
  const negative = compilePackagingRule('Do not require a vegan certification logo on this SKU.');
  assert.equal(negative.type, 'MANUAL_REVIEW');
  assert.equal(negative.isCompiled, false);
});
