import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Multilingual Pair: Both English and French present produces MATCH', () => {
  const rule = compilePackagingRule({
    id: 'RULE-MULTI-01',
    ruleText: 'Common name must appear in parallel English and French on Canadian retail packaging.',
    primaryLanguage: 'English',
    secondaryLanguage: 'French',
    primaryPhrase: 'Rolled Oats Granola',
    secondaryPhrase: 'Granola aux flocons d’avoine',
  });
  assert.equal(rule.type, 'MULTILINGUAL_PAIR_REQUIREMENT');

  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish Rolled Oats Granola | Granola aux flocons d’avoine | Net 500g',
    facts: [
      { field: 'common_name_en', value: 'Rolled Oats Granola' },
      { field: 'common_name_fr', value: 'Granola aux flocons d’avoine' },
    ],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'MULTILINGUAL_PAIR_VERIFIED');
});

test('Multilingual Pair: Missing French declaration produces ISSUE', () => {
  const rule = compilePackagingRule({
    id: 'RULE-MULTI-02',
    ruleText: 'Common name must appear in parallel English and French on packaging.',
    primaryLanguage: 'English',
    secondaryLanguage: 'French',
    primaryPhrase: 'Rolled Oats Granola',
    secondaryPhrase: 'Granola aux flocons d’avoine',
  });

  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish Rolled Oats Granola (All Natural)',
    facts: [
      { field: 'common_name_en', value: 'Rolled Oats Granola' },
      { field: 'common_name_fr', value: 'Granola aux flocons d’avoine' },
    ],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'MULTILINGUAL_PAIR_INCOMPLETE');
  assert.ok(res.observed.includes('French: MISSING'));
});

test('Multilingual Pair: Missing English declaration produces ISSUE', () => {
  const rule = compilePackagingRule({
    id: 'RULE-MULTI-03',
    ruleText: 'Common name must appear in parallel English and French on packaging.',
    primaryLanguage: 'English',
    secondaryLanguage: 'French',
    primaryPhrase: 'Rolled Oats Granola',
    secondaryPhrase: 'Granola aux flocons d’avoine',
  });

  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish Granola aux flocons d’avoine',
    facts: [
      { field: 'common_name_en', value: 'Rolled Oats Granola' },
      { field: 'common_name_fr', value: 'Granola aux flocons d’avoine' },
    ],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'MULTILINGUAL_PAIR_INCOMPLETE');
  assert.ok(res.observed.includes('English: MISSING'));
});

test('Multilingual Pair: Missing approved translation specification requires review', () => {
  const rule = compilePackagingRule({
    id: 'RULE-MULTI-04',
    ruleText: 'Common name must appear in parallel English and French.',
    primaryLanguage: 'English',
    secondaryLanguage: 'French',
  });

  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish Rolled Oats Granola',
    facts: [], // No approved French translation string in facts
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'review');
  assert.equal(res.verdict, 'MULTILINGUAL_SPECIFICATION_INCOMPLETE');
});

test('Multilingual Pair: Market exemption applied returns MATCH without false non-compliance', () => {
  const rule = compilePackagingRule({
    id: 'RULE-MULTI-05',
    ruleText: 'Common name parallel bilingual requirement (exempt in single-language market).',
    exemptionStatus: 'EXEMPT',
    exemptionReason: 'Local test market exemption',
  });

  const res = executeCompiledRule(rule, {
    artworkText: 'Dancing Fish Rolled Oats Granola (English Only)',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'EXEMPT_FROM_MULTILINGUAL_PAIR');
});

test('Multilingual Pair: EU market is not globally forced to French', () => {
  const deRule = compilePackagingRule({
    id: 'RULE-MULTI-DE',
    ruleText: 'German and English parallel declaration for DACH region packaging.',
    primaryLanguage: 'German',
    secondaryLanguage: 'English',
    primaryPhrase: 'Haferflocken Granola',
    secondaryPhrase: 'Rolled Oats Granola',
  });
  assert.equal(deRule.primaryLanguage, 'German');
  assert.equal(deRule.secondaryLanguage, 'English');
});
