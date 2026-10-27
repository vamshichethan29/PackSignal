import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRuleQuotation } from '../lib/rulebook/quote-verifier.mjs';
import { processRulebookExtraction } from '../lib/rulebook/extractor.mjs';
import { RULE_APPROVAL_STATUSES } from '../lib/contracts/review-contract.mjs';

test('Wave 1C: verifyRuleQuotation succeeds for verbatim exact match', () => {
  const source = 'The principal display panel of a food in package form shall bear a declaration of net quantity.';
  const quote = 'bear a declaration of net quantity';
  const result = verifyRuleQuotation({ candidateQuote: quote, sourceDocumentText: source });
  assert.equal(result.verified, true);
  assert.equal(result.matchType, 'EXACT_VERBATIM');
});

test('Wave 1C: verifyRuleQuotation handles multiline wrapped text with whitespace normalization', () => {
  const source = 'Ingredients required to be declared\nshall be listed by common or usual name\nin descending order of predominance.';
  const quote = 'Ingredients required to be declared shall be listed by common or usual name in descending order of predominance.';
  const result = verifyRuleQuotation({ candidateQuote: quote, sourceDocumentText: source });
  assert.equal(result.verified, true);
  assert.equal(result.matchType, 'WHITESPACE_NORMALIZED_MULTILINE');
});

test('Wave 1C: verifyRuleQuotation rejects invented hallucinated quotations', () => {
  const source = 'Nutrition Facts: 200 Calories per serving.';
  const quote = 'All cereal packages must be printed in purple ink.';
  const result = verifyRuleQuotation({ candidateQuote: quote, sourceDocumentText: source });
  assert.equal(result.verified, false);
  assert.ok(result.reason.includes('Potential AI hallucination rejected'));
});

test('Wave 1C: processRulebookExtraction marks candidate rules as PROPOSED and verifies quotes', async () => {
  const sourceText = '21 CFR §101.4: Ingredients must be listed in descending order of predominance by weight.';
  const aiMock = async () => [
    {
      ruleId: 'RULE-101.4',
      citation: '21 CFR §101.4',
      exactQuotation: 'Ingredients must be listed in descending order of predominance by weight.',
      section: 'Ingredients declaration',
      checkType: 'INGREDIENT_COMPARISON',
    },
    {
      ruleId: 'RULE-FAKE',
      citation: 'Fake Reg 99',
      exactQuotation: 'Invented text not in document.',
      checkType: 'REQUIRED_PHRASE',
    }
  ];

  const rules = await processRulebookExtraction({
    sourceText,
    sourceHash: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    aiProposerFn: aiMock,
  });

  assert.equal(rules.length, 2);
  const realRule = rules.find(r => r.ruleId === 'RULE-101.4');
  const fakeRule = rules.find(r => r.ruleId === 'RULE-FAKE');

  assert.equal(realRule.quoteVerification, 'verified');
  assert.equal(realRule.approvalStatus, RULE_APPROVAL_STATUSES.PROPOSED);

  assert.equal(fakeRule.quoteVerification, 'unverified');
  assert.equal(fakeRule.approvalStatus, RULE_APPROVAL_STATUSES.PROPOSED);
});
