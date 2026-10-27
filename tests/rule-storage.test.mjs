import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Storage Mandate: Compiles refrigeration condition', () => {
  const rule = compilePackagingRule('After opening, keep refrigerated.');
  assert.equal(rule.type, 'STORAGE_INSTRUCTION_MANDATE');
  assert.equal(rule.parameters.storageState, 'REFRIGERATED');
});

test('Storage Mandate: Compiles freezing condition without conflating with refrigeration', () => {
  const rule = compilePackagingRule('Must keep frozen until use.');
  assert.equal(rule.type, 'STORAGE_INSTRUCTION_MANDATE');
  assert.equal(rule.parameters.storageState, 'FROZEN');
  assert.equal(rule.parameters.requiredStatement, 'Keep frozen until use.');
});

test('Storage Mandate: Compiles cool dry place condition', () => {
  const rule = compilePackagingRule('Must store in a cool, dry place away from direct sunlight.');
  assert.equal(rule.type, 'STORAGE_INSTRUCTION_MANDATE');
  assert.equal(rule.parameters.storageState, 'DRY');
  assert.equal(rule.parameters.requiredStatement, 'Store in a cool, dry place.');
});

test('Storage Mandate: Valid instruction present on artwork produces MATCH', () => {
  const rule = compilePackagingRule({
    id: 'RULE-STOR-01',
    ruleText: 'Must keep refrigerated.',
    storageState: 'REFRIGERATED',
    requiredWording: 'Keep Refrigerated',
  });
  const res = executeCompiledRule(rule, {
    artworkText: 'Keep Refrigerated at all times. Best before 30 days.',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'STORAGE_INSTRUCTION_VERIFIED');
});

test('Storage Mandate: Missing required instruction produces ISSUE', () => {
  const rule = compilePackagingRule({
    id: 'RULE-STOR-02',
    ruleText: 'Must keep refrigerated.',
    storageState: 'REFRIGERATED',
    requiredWording: 'Keep Refrigerated',
  });
  const res = executeCompiledRule(rule, {
    artworkText: 'Store in ambient pantry. Dancing Fish Granola.',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'STORAGE_INSTRUCTION_MISSING');
});

test('Storage Mandate: Detects thermal contradiction between refrigerated spec and frozen label', () => {
  const rule = compilePackagingRule({
    id: 'RULE-STOR-03',
    ruleText: 'Refrigerated goods must bear Keep Refrigerated statement.',
    storageState: 'REFRIGERATED',
    requiredWording: 'Keep Refrigerated',
  });
  const res = executeCompiledRule(rule, {
    artworkText: 'Keep Frozen until use at -18°C.', // Contradictory thermal regime
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'STORAGE_STATE_CONTRADICTION');
  assert.ok(res.explanation.includes('conflicting thermal regime'));
});
