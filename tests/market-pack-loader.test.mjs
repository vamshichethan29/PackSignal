import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadMarketPack, evaluateRuleDateStatus } from '../lib/rules/market-pack-loader.mjs';
import { validateMarketPack, validateRuleRecord } from '../lib/rules/rule-schema-validator.mjs';

describe('Phase 3 — Market Pack Loader & Schema Validation', () => {

  test('1. Loads US market pack correctly with manifest and reference datasets', () => {
    const packRes = loadMarketPack('us', { launchDate: '2026-10-16' });
    assert.equal(packRes.market, 'US');
    assert.ok(packRes.pack, 'Pack object must be loaded');
    assert.ok(packRes.allRules.length >= 18, `Expected ~20 rules, got ${packRes.allRules.length}`);
    assert.ok(packRes.referenceData.dailyValues, 'Must contain daily values reference data');
    assert.ok(packRes.referenceData.allergens, 'Must contain allergens reference data');
    assert.ok(packRes.referenceData.claims, 'Must contain claims reference data');
    assert.ok(packRes.referenceData.calorieMethods, 'Must contain calorie methods');
  });

  test('2. Validates canonical market pack schema and rejects malformed pack', () => {
    const validRes = validateMarketPack({
      packId: 'TEST-PACK',
      market: 'US',
      regulator: 'FDA',
      version: '1.0',
      publishedAt: '2020-01-01',
      effectiveFrom: '2020-01-01',
      rules: []
    });
    assert.equal(validRes.valid, true);

    const invalidRes = validateMarketPack({
      packId: 'INCOMPLETE-PACK'
    });
    assert.equal(invalidRes.valid, false);
    assert.ok(invalidRes.errors.length > 0);
  });

  test('3. Validates individual rule schema and detects missing source quote or URL', () => {
    const validRule = {
      ruleId: 'RULE-001',
      title: 'Test Rule',
      market: 'US',
      sourceLaw: '21 CFR 101.3',
      legalProvision: '21 CFR 101.3(a)',
      officialSourceUrl: 'https://www.ecfr.gov/current/title-21',
      sourceQuote: 'Sample quote',
      rulePackVersion: '2026.1',
      effectiveFrom: '2020-01-01',
      appliesIf: {},
      evaluatorType: 'STATEMENT_EXISTS',
      severity: 'HIGH',
      responsibleDepartment: 'Regulatory & Legal'
    };
    assert.equal(validateRuleRecord(validRule).valid, true);

    const missingQuoteRule = { ...validRule, sourceQuote: '' };
    assert.equal(validateRuleRecord(missingQuoteRule).valid, false);
    assert.ok(validateRuleRecord(missingQuoteRule).errors.some(e => e.includes('sourceQuote')));
  });

  test('4. Unknown market code throws predictable error', () => {
    assert.throws(() => {
      loadMarketPack('antarctica');
    }, /Market pack directory not found/);
  });

  test('5. Loads India market pack correctly with manifest, schema validation, and ~20 rules', () => {
    const inPack = loadMarketPack('in', { launchDate: '2026-10-18' });
    assert.equal(inPack.market, 'IN');
    assert.ok(inPack.allRules.length >= 18 && inPack.allRules.length <= 25, `Expected ~20 rules, got ${inPack.allRules.length}`);
    assert.ok(inPack.referenceData.dailyValues, 'Must contain ICMR-NIN RDA values');
    assert.ok(inPack.referenceData.symbols, 'Must contain FSSAI symbols');
    assert.ok(inPack.referenceData.questionTemplates.length >= 3, 'Must contain question templates');
    
    // Verify mandatory schema fields across all India rules
    for (const rule of inPack.allRules) {
      assert.ok(rule.ruleId, `Rule missing ruleId: ${JSON.stringify(rule)}`);
      assert.ok(rule.title, `Rule missing title: ${rule.ruleId}`);
      assert.ok(rule.sourceLaw, `Rule missing sourceLaw: ${rule.ruleId}`);
      assert.ok(rule.legalProvision, `Rule missing legalProvision: ${rule.ruleId}`);
      assert.ok(rule.officialSourceUrl, `Rule missing officialSourceUrl: ${rule.ruleId}`);
      assert.ok(rule.sourceQuote, `Rule missing sourceQuote: ${rule.ruleId}`);
      assert.ok(rule.effectiveFrom, `Rule missing effectiveFrom: ${rule.ruleId}`);
      assert.ok(rule.responsibleDepartment, `Rule missing responsibleDepartment: ${rule.ruleId}`);
    }
  });

  test('6. Discovers installed market packs dynamically from filesystem', async () => {
    const { discoverInstalledMarkets } = await import('../lib/rules/market-pack-loader.mjs');
    const markets = discoverInstalledMarkets();
    assert.ok(Array.isArray(markets));
    assert.ok(markets.some(m => m.code === 'in'), 'Must discover India pack');
    assert.ok(markets.some(m => m.code === 'us'), 'Must discover US pack');
  });
});

