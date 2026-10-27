import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule, SUPPORTED_RULE_TYPES } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Rule Compiler: Recognizes all 17 supported rule types', () => {
  assert.ok(SUPPORTED_RULE_TYPES.length >= 17);
  assert.ok(SUPPORTED_RULE_TYPES.includes('BARCODE_GTIN_MATCH'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('STATUTORY_SYMBOL_PRESENCE'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('MULTILINGUAL_PAIR_REQUIREMENT'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('MANUFACTURER_ADDRESS_DECLARATION'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('STORAGE_INSTRUCTION_MANDATE'));
  assert.ok(SUPPORTED_RULE_TYPES.includes('NUTRIENT_CONTENT_CLAIM_LIMIT'));
});

test('1. BARCODE_GTIN_MATCH: Verifies GTIN check digit and product identity', () => {
  // Case A: Valid match (120000000043 has verified Mod-10 check digit 3)
  const compiled = compilePackagingRule({
    id: 'RULE-GTIN-01',
    ruleText: 'The printed barcode GTIN must match the approved specification 120000000043.',
  });
  assert.equal(compiled.type, 'BARCODE_GTIN_MATCH');

  const matchRes = executeCompiledRule(compiled, {
    barcode: '120000000043',
    facts: [{ field: 'gtin', value: '120000000043' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(matchRes.status, 'match');
  assert.equal(matchRes.verdict, 'BARCODE_GTIN_VERIFIED');

  // Case B: Mismatch
  const mismatchRes = executeCompiledRule(compiled, {
    barcode: '036000291452',
    facts: [{ field: 'gtin', value: '120000000043' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(mismatchRes.status, 'issue');
  assert.equal(mismatchRes.verdict, 'BARCODE_GTIN_MISMATCH');

  // Case C: Invalid check digit in specification
  const badCheckRes = executeCompiledRule(compiled, {
    barcode: '120000000043',
    facts: [{ field: 'gtin', value: '120000000049' }], // Invalid check digit
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(badCheckRes.status, 'issue');
  assert.equal(badCheckRes.verdict, 'GTIN_CHECK_DIGIT_INVALID');
});

test('2. STATUTORY_SYMBOL_PRESENCE: Distinguishes mandatory statutory symbols from voluntary claims', () => {
  // Case A: Statutory symbol present
  const compiledStatutory = compilePackagingRule({
    id: 'RULE-SYM-01',
    ruleText: 'Packaging must display the statutory Green Dot symbol for vegetarian products.',
  });
  assert.equal(compiledStatutory.type, 'STATUTORY_SYMBOL_PRESENCE');

  const statRes = executeCompiledRule(compiledStatutory, {
    artworkText: 'Product contains Green Dot veg mark and natural grains.',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(statRes.status, 'match');
  assert.equal(statRes.verdict, 'SYMBOL_PRESENCE_CONFIRMED');

  // Case B: Voluntary claim without verified certificate -> REVIEW
  const compiledVoluntary = compilePackagingRule({
    id: 'RULE-VOL-01',
    type: 'STATUTORY_SYMBOL_PRESENCE',
    symbolType: 'VOLUNTARY_CERTIFICATION',
    symbolName: 'Certified Vegan',
  });
  const volRes = executeCompiledRule(compiledVoluntary, {
    artworkText: '100% Certified Vegan Oat Granola.',
    facts: [], // No certification document
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(volRes.status, 'review');
  assert.equal(volRes.verdict, 'VOLUNTARY_CERTIFICATE_UNVERIFIED');
});

test('3. MULTILINGUAL_PAIR_REQUIREMENT: Enforces parallel language declarations and handles exemptions', () => {
  const compiled = compilePackagingRule({
    id: 'RULE-BILINGUAL-01',
    ruleText: 'Common name must appear in parallel English and French on Canadian retail packaging.',
    primaryLanguage: 'English',
    secondaryLanguage: 'French',
    primaryPhrase: 'Rolled Oats Granola',
    secondaryPhrase: 'Granola aux flocons d’avoine',
  });
  assert.equal(compiled.type, 'MULTILINGUAL_PAIR_REQUIREMENT');

  // Case A: Both present -> MATCH
  const passRes = executeCompiledRule(compiled, {
    artworkText: 'Dancing Fish Rolled Oats Granola | Granola aux flocons d’avoine | Net 500g',
    facts: [
      { field: 'common_name_en', value: 'Rolled Oats Granola' },
      { field: 'common_name_fr', value: 'Granola aux flocons d’avoine' },
    ],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(passRes.status, 'match');
  assert.equal(passRes.verdict, 'MULTILINGUAL_PAIR_VERIFIED');

  // Case B: French missing from artwork -> ISSUE
  const failRes = executeCompiledRule(compiled, {
    artworkText: 'Dancing Fish Rolled Oats Granola only in English.',
    facts: [
      { field: 'common_name_en', value: 'Rolled Oats Granola' },
      { field: 'common_name_fr', value: 'Granola aux flocons d’avoine' },
    ],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(failRes.status, 'issue');
  assert.equal(failRes.verdict, 'MULTILINGUAL_PAIR_INCOMPLETE');

  // Case C: Exemption applies -> MATCH (EXEMPT)
  const exemptCompiled = { ...compiled, exemptionStatus: 'EXEMPT', exemptionReason: 'Single-language local market' };
  const exemptRes = executeCompiledRule(exemptCompiled, {
    artworkText: 'English only',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(exemptRes.status, 'match');
  assert.equal(exemptRes.verdict, 'EXEMPT_FROM_MULTILINGUAL_PAIR');
});

test('4. MANUFACTURER_ADDRESS_DECLARATION: Evaluates 21 CFR 101.5 and telephone directory exemption', () => {
  const compiled = compilePackagingRule({
    id: 'RULE-ADDR-01',
    ruleText: 'The label must declare the manufacturer name, street address, city, state and ZIP under 21 CFR 101.5.',
  });
  assert.equal(compiled.type, 'MANUFACTURER_ADDRESS_DECLARATION');

  // Case A: Complete address
  const fullRes = executeCompiledRule(compiled, {
    artworkText: 'Manufactured by Dancing Fish Foods LLC, 100 Waterfront Way, Seattle, WA 98101',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(fullRes.status, 'match');
  assert.equal(fullRes.verdict, 'ADDRESS_DECLARATION_COMPLETE');

  // Case B: Telephone directory exemption (street omitted)
  const exemptCompiled = { ...compiled, telephoneDirectoryExemption: true };
  const dirRes = executeCompiledRule(exemptCompiled, {
    artworkText: 'Manufactured by Dancing Fish Foods LLC, Seattle, WA 98101',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(dirRes.status, 'match');
  assert.equal(dirRes.verdict, 'ADDRESS_DECLARATION_COMPLETE');
  assert.ok(dirRes.explanation.includes('Telephone directory'));
});

test('5. STORAGE_INSTRUCTION_MANDATE: Detects thermal regime contradictions', () => {
  const compiledRefrig = compilePackagingRule({
    id: 'RULE-STORAGE-01',
    ruleText: 'Must declare storage statement "Keep Refrigerated" for perishable goods.',
    storageState: 'REFRIGERATED',
    requiredWording: 'Keep Refrigerated',
  });
  assert.equal(compiledRefrig.type, 'STORAGE_INSTRUCTION_MANDATE');

  // Case A: Correct instruction
  const passRes = executeCompiledRule(compiledRefrig, {
    artworkText: 'Perishable item. Keep Refrigerated at 4°C. Shake well.',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(passRes.status, 'match');
  assert.equal(passRes.verdict, 'STORAGE_INSTRUCTION_VERIFIED');

  // Case B: Contradiction: Artwork says "Keep Frozen" for refrigerated rule -> ISSUE
  const conflictRes = executeCompiledRule(compiledRefrig, {
    artworkText: 'Store frozen at -18°C. Do not thaw.',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(conflictRes.status, 'issue');
  assert.equal(conflictRes.verdict, 'STORAGE_STATE_CONTRADICTION');
});

test('6. NUTRIENT_CONTENT_CLAIM_LIMIT: Evaluates US Low Sodium (21 CFR 101.61) with mathematical proof', () => {
  const compiledSodium = compilePackagingRule({
    id: 'RULE-SODIUM-01',
    ruleText: 'Low Sodium claim permitted only if sodium content is 140 mg or less per RACC.',
    claimType: 'LOW_SODIUM',
    threshold: 140,
    unit: 'mg',
    nutrient: 'sodium',
  });
  assert.equal(compiledSodium.type, 'NUTRIENT_CONTENT_CLAIM_LIMIT');

  // Case A: Compliant (80 mg <= 140 mg)
  const passRes = executeCompiledRule(compiledSodium, {
    facts: [{ field: 'nutrition.sodium', value: '80' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(passRes.status, 'match');
  assert.equal(passRes.verdict, 'NUTRIENT_CLAIM_PERMISSIBLE');
  assert.ok(passRes.explanation.includes('Mathematical proof'));

  // Case B: Exceeded (210 mg > 140 mg)
  const failRes = executeCompiledRule(compiledSodium, {
    facts: [{ field: 'nutrition.sodium', value: '210' }],
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(failRes.status, 'issue');
  assert.equal(failRes.verdict, 'NUTRIENT_CLAIM_EXCEEDED');
  assert.ok(failRes.explanation.includes('Misbranding violation'));
  assert.ok(failRes.observed.includes('Difference: 70.0 mg'));
});
