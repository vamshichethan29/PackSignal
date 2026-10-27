import test from 'node:test';
import assert from 'node:assert/strict';

import { compilePackagingRule } from '../lib/rules/rule-compiler.mjs';
import { executeCompiledRule } from '../lib/rules/runtime.mjs';

test('Manufacturer Address: Full 21 CFR 101.5 address declaration produces MATCH', () => {
  const rule = compilePackagingRule('Business declaration: Name and address of manufacturer or distributor required under 21 CFR 101.5.');
  assert.equal(rule.type, 'MANUFACTURER_ADDRESS_DECLARATION');

  const res = executeCompiledRule(rule, {
    artworkText: 'Manufactured by Dancing Fish Inc., 123 Ocean Street, San Francisco, CA 94105.',
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'ADDRESS_DECLARATION_COMPLETE');
});

test('Manufacturer Address: Telephone directory exemption permits street omission under 21 CFR 101.5(d)', () => {
  const rule = compilePackagingRule({
    id: 'RULE-ADDR-DIR',
    ruleText: 'Business declaration required. Telephone directory listing exception active for street address.',
    telephoneDirectoryExemption: true,
  });

  const res = executeCompiledRule(rule, {
    artworkText: 'Distributed by Dancing Fish Brands, San Francisco, CA 94105.', // No street address
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'ADDRESS_DECLARATION_COMPLETE');
  assert.ok(res.explanation.includes('Telephone directory street exemption applied'));
});

test('Manufacturer Address: Missing business name produces ISSUE', () => {
  const rule = compilePackagingRule('Business declaration: Name and address required under 21 CFR 101.5.');
  const res = executeCompiledRule(rule, {
    artworkText: '123 Ocean Street, San Francisco, CA 94105.', // Missing business name
    trustState: { reviewerAuthorization: 'APPROVED' },
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'MANUFACTURER_DECLARATION_MISSING');
});

test('Manufacturer Address: Distributor entity role supported', () => {
  const rule = compilePackagingRule('Distributed by Dancing Fish Foods LLC. Address declaration required under 21 CFR 101.5.');
  assert.equal(rule.parameters.requiredEntityRole, 'distributor');
});
