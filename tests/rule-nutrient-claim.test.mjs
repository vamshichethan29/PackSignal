import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Nutrient Claim: US Low Sodium (21 CFR 101.61) compiles with 140 mg threshold', () => {
  const rule = compilePackagingRule('Low sodium claim limit: must not exceed 140 mg per RACC.');
  assert.equal(rule.type, 'NUTRIENT_CONTENT_CLAIM_LIMIT');
  assert.equal(rule.parameters.claimType, 'LOW_SODIUM');
  assert.equal(rule.parameters.threshold, 140);
  assert.equal(rule.parameters.unit, 'mg');
  assert.equal(rule.parameters.nutrient, 'sodium');
});

test('Nutrient Claim: Very Low Sodium compiles with 35 mg threshold', () => {
  const rule = compilePackagingRule('Very low sodium claim: maximum 35 mg per RACC.');
  assert.equal(rule.type, 'NUTRIENT_CONTENT_CLAIM_LIMIT');
  assert.equal(rule.parameters.claimType, 'VERY_LOW_SODIUM');
  assert.equal(rule.parameters.threshold, 35);
});

test('Nutrient Claim: Sodium Free compiles with 5 mg threshold', () => {
  const rule = compilePackagingRule('Sodium free claim allowed if sodium is less than 5 mg.');
  assert.equal(rule.type, 'NUTRIENT_CONTENT_CLAIM_LIMIT');
  assert.equal(rule.parameters.claimType, 'SODIUM_FREE');
  assert.equal(rule.parameters.threshold, 5);
});

test('Nutrient Claim: Compliant value (80 mg <= 140 mg) produces MATCH with mathematical proof', () => {
  const rule = compilePackagingRule({
    id: 'RULE-CLAIM-01',
    ruleText: 'Low sodium claim limit: must not exceed 140 mg per RACC.',
    claimType: 'LOW_SODIUM',
    threshold: 140,
    unit: 'mg',
    nutrient: 'sodium',
  });

  const res = executeCompiledRule(rule, {
    facts: [{ field: 'nutrition.sodium', value: '80' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'NUTRIENT_CLAIM_PERMISSIBLE');
  assert.ok(res.explanation.includes('Mathematical proof'));
  assert.equal(res.calculationProof.compliant, true);
  assert.equal(res.calculationProof.observedValue, 80);
});

test('Nutrient Claim: Exceeded value (220 mg > 140 mg) produces ISSUE with misbranding citation', () => {
  const rule = compilePackagingRule({
    id: 'RULE-CLAIM-02',
    ruleText: 'Low sodium claim limit: must not exceed 140 mg per RACC.',
    claimType: 'LOW_SODIUM',
    threshold: 140,
    unit: 'mg',
    nutrient: 'sodium',
  });

  const res = executeCompiledRule(rule, {
    facts: [{ field: 'nutrition.sodium', value: '220' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'NUTRIENT_CLAIM_EXCEEDED');
  assert.ok(res.explanation.includes('Misbranding violation'));
  assert.equal(res.calculationProof.compliant, false);
});

test('Nutrient Claim: Missing sodium fact returns UNABLE preventing false compliance claim', () => {
  const rule = compilePackagingRule({
    id: 'RULE-CLAIM-03',
    ruleText: 'Low sodium claim limit: must not exceed 140 mg per RACC.',
    claimType: 'LOW_SODIUM',
    threshold: 140,
    unit: 'mg',
    nutrient: 'sodium',
  });

  const res = executeCompiledRule(rule, {
    facts: [], // No sodium fact
    artworkText: 'Dancing Fish Low Sodium Granola',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'unable');
  assert.equal(res.verdict, 'NUTRIENT_DATA_UNAVAILABLE');
});

test('Nutrient Claim: Small RACC condition enforces 50g measurement basis', () => {
  const rule = compilePackagingRule('Low sodium claim for small RACC food: maximum 140 mg per 50 g.');
  assert.equal(rule.type, 'NUTRIENT_CONTENT_CLAIM_LIMIT');
  assert.equal(rule.parameters.measurementBasis, '50g');
});
