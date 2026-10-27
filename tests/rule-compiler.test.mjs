import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compilePackagingRule,
  compileRuleRequirement,
  SUPPORTED_RULE_TYPES,
  COMPILE_STATUS,
  RULE_REGISTRY,
} from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Rule Compiler: All 17 supported packaging rule families present in registry', () => {
  assert.ok(SUPPORTED_RULE_TYPES.length >= 17);
  assert.ok(SUPPORTED_RULE_TYPES.includes('BARCODE_GTIN_MATCH'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('STATUTORY_SYMBOL_PRESENCE'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('MULTILINGUAL_PAIR_REQUIREMENT'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('MANUFACTURER_ADDRESS_DECLARATION'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('STORAGE_INSTRUCTION_MANDATE'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('NUTRIENT_CONTENT_CLAIM_LIMIT'));

  assert.ok(RULE_REGISTRY.BARCODE_GTIN_MATCH);
  assert.ok(RULE_REGISTRY.STATUTORY_SYMBOL_PRESENCE);
  assert.ok(RULE_REGISTRY.MULTILINGUAL_PAIR_REQUIREMENT);
  assert.ok(RULE_REGISTRY.MANUFACTURER_ADDRESS_DECLARATION);
  assert.ok(RULE_REGISTRY.STORAGE_INSTRUCTION_MANDATE);
  assert.ok(RULE_REGISTRY.NUTRIENT_CONTENT_CLAIM_LIMIT);
});

test('Rule Compiler: Baseline rule types continue to compile deterministically', () => {
  const reqText = compilePackagingRule('All packages must state "Dancing Fish Granola"');
  assert.equal(reqText.type, 'REQUIRED_EXACT_TEXT');
  assert.equal(reqText.targetPhrase, 'Dancing Fish Granola');
  assert.equal(reqText.isCompiled, true);

  const forbidText = compilePackagingRule('Packaging must not use "Chemical Preservatives"');
  assert.equal(forbidText.type, 'FORBIDDEN_EXACT_TEXT');
  assert.equal(forbidText.targetPhrase, 'Chemical Preservatives');

  const minNum = compilePackagingRule('Dietary fiber must be at least 5 g');
  assert.equal(minNum.type, 'NUMERIC_MINIMUM');
  assert.equal(minNum.threshold, 5);

  const qty = compilePackagingRule('Declared net weight must match dual unit contents');
  assert.equal(qty.type, 'QUANTITY_EQUIVALENCE');
});

test('Rule Compiler: Each of the 6 new rule families compiles into typed parameters', () => {
  // 1. GTIN
  const gtin = compilePackagingRule('Printed barcode identifier must match approved master GTIN 012000000043');
  assert.equal(gtin.type, 'BARCODE_GTIN_MATCH');
  assert.equal(gtin.parameters.expectedGtin, '012000000043');
  assert.equal(gtin.evaluatorId, 'barcode_identifier_match');

  // 2. Symbol
  const sym = compilePackagingRule('Package must display the prescribed vegetarian symbol on the front panel.');
  assert.equal(sym.type, 'STATUTORY_SYMBOL_PRESENCE');
  assert.equal(sym.parameters.symbolId, 'FSSAI_VEGETARIAN');
  assert.equal(sym.parameters.requiredColor, 'green');

  // 3. Multilingual
  const multi = compilePackagingRule('Common name and ingredients require parallel English and French on Canadian retail packaging.');
  assert.equal(multi.type, 'MULTILINGUAL_PAIR_REQUIREMENT');
  assert.deepEqual(multi.parameters.languages, ['en', 'fr']);
  assert.ok(multi.parameters.requiredFields.includes('common_name'));

  // 4. Manufacturer Address
  const addr = compilePackagingRule('Distributed by Dancing Fish Brands, San Francisco, CA 94105. Business declaration required under 21 CFR 101.5.');
  assert.equal(addr.type, 'MANUFACTURER_ADDRESS_DECLARATION');
  assert.equal(addr.parameters.requiredEntityRole, 'distributor');
  assert.ok(addr.parameters.requiredFields.includes('city'));

  // 5. Storage
  const stor = compilePackagingRule('Must keep refrigerated after opening.');
  assert.equal(stor.type, 'STORAGE_INSTRUCTION_MANDATE');
  assert.equal(stor.parameters.storageState, 'REFRIGERATED');

  // 6. Nutrient Claim
  const claim = compilePackagingRule('Low sodium claim permitted: sodium content must not exceed 140 mg per RACC.');
  assert.equal(claim.type, 'NUTRIENT_CONTENT_CLAIM_LIMIT');
  assert.equal(claim.parameters.claimType, 'LOW_SODIUM');
  assert.equal(claim.parameters.threshold, 140);
  assert.equal(claim.parameters.unit, 'mg');
});

test('Rule Compiler: Rule source quotation remains exact character-sequence', () => {
  const quote = 'The printed barcode GTIN must match the approved specification 120000000043.';
  const compiled = compilePackagingRule({
    id: 'RULE-GTIN-EXACT',
    sourceDocumentId: 'DOC-SPEC-99',
    sourceQuotation: quote,
    ruleText: quote,
  });

  assert.equal(compiled.sourceQuotation, quote);
  assert.equal(compiled.sourceDocumentId, 'DOC-SPEC-99');
});

test('Rule Compiler: Multiline and wrapped PDF rule text parses correctly without syntax errors', () => {
  const multiline = `
    Common name and ingredients
    must appear in parallel
    English and French on packaging.
  `;
  const compiled = compilePackagingRule(multiline);
  assert.equal(compiled.type, 'MULTILINGUAL_PAIR_REQUIREMENT');
  assert.equal(compiled.isCompiled, true);
});

test('Rule Compiler: Negated text does not compile into mandatory requirements', () => {
  const negated = compilePackagingRule('Do not require a vegan certification logo on packaging.');
  assert.equal(negated.type, 'MANUAL_REVIEW');
  assert.equal(negated.isCompiled, false);
  assert.equal(negated.status, 'EXEMPTION_OR_VOLUNTARY');
});

test('Rule Compiler: Non-binding proposed rules do not execute as binding mandates', () => {
  const proposed = compilePackagingRule('Barcode verification will be considered in a future revision under review.');
  assert.equal(proposed.type, 'MANUAL_REVIEW');
  assert.equal(proposed.isCompiled, false);
  assert.equal(proposed.status, 'PROPOSED_NONBINDING');
});

test('Rule Compiler: Unverified source or unapproved rule requires review and does not fail artwork', () => {
  const rule = compilePackagingRule('All packages must state "Certified Organic"');
  const res = executeCompiledRule(rule, {
    artworkText: 'Regular Oats Granola',
    trustState: { reviewerAuthorization: 'PROPOSED' }, // Unapproved
  });

  assert.equal(res.status, 'review');
  assert.equal(res.verdict, 'not_applicable');
  assert.ok(res.reason.includes('not approved'));
});

test('Rule Compiler: Unambiguous manual review cases stay manual review without silent hallucinations', () => {
  const prose = compilePackagingRule('Artwork should convey a warm and artisan aesthetic suitable for morning breakfasts.');
  assert.equal(prose.type, 'MANUAL_REVIEW');
  assert.equal(prose.isCompiled, false);
  assert.equal(prose.compileStatus, COMPILE_STATUS.MANUAL_REVIEW);
});
