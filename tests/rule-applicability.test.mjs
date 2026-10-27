import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAtomicCondition, evaluateConditionTree, evaluateRuleApplicability } from '../lib/rules/rule-applicability.mjs';

describe('Phase 3 — Typed Rule Applicability Engine', () => {

  test('1. Atomic condition equals and notEquals evaluation', () => {
    const ctx = { market: 'US', category: 'granola' };
    assert.equal(evaluateAtomicCondition({ field: 'market', operator: 'equals', value: 'US' }, ctx).status, 'SATISFIED');
    assert.equal(evaluateAtomicCondition({ field: 'market', operator: 'equals', value: 'EU' }, ctx).status, 'FAILED');
    assert.equal(evaluateAtomicCondition({ field: 'market', operator: 'notEquals', value: 'EU' }, ctx).status, 'SATISFIED');
  });

  test('2. Atomic condition in, notIn, and numeric comparison evaluation', () => {
    const ctx = { net_weight: 480, category: 'granola' };
    assert.equal(evaluateAtomicCondition({ field: 'category', operator: 'in', value: ['granola', 'cereal'] }, ctx).status, 'SATISFIED');
    assert.equal(evaluateAtomicCondition({ field: 'category', operator: 'notIn', value: ['dairy', 'meat'] }, ctx).status, 'SATISFIED');
    assert.equal(evaluateAtomicCondition({ field: 'net_weight', operator: 'greaterThan', value: 400 }, ctx).status, 'SATISFIED');
    assert.equal(evaluateAtomicCondition({ field: 'net_weight', operator: 'lessThan', value: 300 }, ctx).status, 'FAILED');
  });

  test('3. Compound "all" and "any" condition trees', () => {
    const ctx = { market: 'US', product: { category: 'granola' }, net_weight: 480 };
    const allCond = {
      all: [
        { field: 'market', operator: 'equals', value: 'US' },
        { field: 'product.category', operator: 'equals', value: 'granola' }
      ]
    };
    assert.equal(evaluateConditionTree(allCond, ctx).status, 'APPLIES');

    const anyCond = {
      any: [
        { field: 'product.category', operator: 'equals', value: 'beverage' },
        { field: 'net_weight', operator: 'greaterThan', value: 400 }
      ]
    };
    assert.equal(evaluateConditionTree(anyCond, ctx).status, 'APPLIES');
  });

  test('4. Missing context fields yield APPLICABILITY_UNKNOWN rather than automatic failure', () => {
    const ctx = { market: 'US' };
    const rule = {
      appliesIf: {
        all: [
          { field: 'market', operator: 'equals', value: 'US' },
          { field: 'product.sub_category', operator: 'equals', value: 'clusters' }
        ]
      }
    };
    const res = evaluateRuleApplicability(rule, ctx);
    assert.equal(res.status, 'APPLICABILITY_UNKNOWN');
    assert.ok(res.reason.includes('missing from product facts'));
  });

  test('5. Inapplicable rule returns DOES_NOT_APPLY without producing a violation issue', () => {
    const ctx = { market: 'US', product: { category: 'beverage' } };
    const rule = {
      appliesIf: {
        all: [
          { field: 'product.category', operator: 'in', value: ['granola', 'cereal'] }
        ]
      }
    };
    const res = evaluateRuleApplicability(rule, ctx);
    assert.equal(res.status, 'DOES_NOT_APPLY');
  });
});
