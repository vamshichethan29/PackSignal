import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateBarcodeCheckDigit } from '../lib/gtin.mjs';
import { evaluateRule } from '../lib/rules/rule-evaluator.mjs';
import { loadMarketPack } from '../lib/rules/market-pack-loader.mjs';

describe('Phase 3 — Barcode Modulo 10 Integrity Verification', () => {

  const pack = loadMarketPack('us', { launchDate: '2026-10-16' });
  const barcRule = pack.effectiveRules.find(r => r.ruleId === 'US-BARC-001');

  test('1. Valid UPC-A barcode (1 20000 00003 6) passes modulo 10 verification', () => {
    const res = validateBarcodeCheckDigit('1 20000 00003 6');
    assert.equal(res.valid, true);
    assert.equal(res.calculatedCheckDigit, 6);
    assert.equal(res.observedCheckDigit, 6);
  });

  test('2. Altered check digit fails verification (1 20000 00003 7 -> invalid)', () => {
    const res = validateBarcodeCheckDigit('1 20000 00003 7');
    assert.equal(res.valid, false);
    assert.equal(res.calculatedCheckDigit, 6);
    assert.equal(res.observedCheckDigit, 7);
  });

  test('3. Rule evaluator verifies valid barcode and records limitation proof', () => {
    const validFacts = [{ field: 'barcode.value', value: '1 20000 00003 6' }];
    const res = evaluateRule(barcRule, validFacts, pack.referenceData, { market: 'US' });
    assert.equal(res.status, 'PASS');
    assert.ok(res.proof.includes('does not verify symbol print quality or GS1 company assignment'));
  });

  test('4. Rule evaluator flags invalid barcode as ISSUE', () => {
    const badFacts = [{ field: 'barcode.value', value: '1 20000 00003 9' }];
    const res = evaluateRule(barcRule, badFacts, pack.referenceData, { market: 'US' });
    assert.equal(res.status, 'ISSUE');
    assert.ok(res.proof.includes('Modulo 10 check digit error'));
  });
});
