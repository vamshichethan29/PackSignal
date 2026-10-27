/**
 * @file regulatory-diff.test.mjs
 * 
 * PackSignal — Date A vs Date B Regulatory Comparison Tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRegulatoryDates } from '../lib/regulatory/rule-diff.mjs';

test('1. Comparing 2026-10-25 vs 2027-06-30 produces NO newly applicable rules in India', () => {
  const diff = compareRegulatoryDates({
    dateA: '2026-10-25',
    dateB: '2027-06-30',
    market: 'india',
    productCategory: 'food'
  });

  assert.equal(diff.summary.newlyApplicableCount, 0);
  assert.equal(diff.newlyApplicable.length, 0);
  assert.ok(diff.narrative.includes('No verified applicable rule changes'));
});

test('2. Comparing 2026-10-25 vs 2027-07-01 activates the FSSAI 2026 1st Amendment', () => {
  const diff = compareRegulatoryDates({
    dateA: '2026-10-25',
    dateB: '2027-07-01',
    market: 'india',
    productCategory: 'food'
  });

  assert.ok(diff.summary.newlyApplicableCount >= 1);
  const fssaiAmend = diff.newlyApplicable.find(r => r.ruleId === 'FSSAI-LDR-2026-AMEND-BOLD-RDA');
  assert.ok(fssaiAmend, 'FSSAI 2026 Amendment must be newly applicable');
  assert.ok(diff.affectedCheckTypes.includes('NUTRITION_TYPOGRAPHY_BOLD_RDA'));
  assert.ok(diff.narrative.includes('FSSAI 2026 First Amendment'));
});

test('3. Comparing 2027-07-01 vs 2028-01-01 activates Company PCR Standard', () => {
  const diff = compareRegulatoryDates({
    dateA: '2027-07-01',
    dateB: '2028-01-01',
    market: 'india',
    productCategory: 'food'
  });

  const pcrRule = diff.newlyApplicable.find(r => r.ruleId === 'COMPANY-SUSTAINABLE-PACK-2028');
  assert.ok(pcrRule, 'Company PCR Standard takes effect on 2028-01-01');
  assert.ok(diff.affectedCheckTypes.includes('PCR_RECYCLE_BADGE'));
});

test('4. Proposed initiatives remain proposed across both Date A and Date B', () => {
  const diff = compareRegulatoryDates({
    dateA: '2026-10-25',
    dateB: '2028-12-31',
    market: 'india',
    productCategory: 'food'
  });

  assert.ok(diff.proposed.length >= 1);
  assert.ok(diff.proposed.some(p => p.ruleId === 'FSSAI-DRAFT-FOPNL-INR-STAR'));
  // Never counted as newly applicable binding rules!
  assert.equal(diff.newlyApplicable.some(r => r.ruleId === 'FSSAI-DRAFT-FOPNL-INR-STAR'), false);
});
