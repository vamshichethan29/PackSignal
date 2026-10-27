/**
 * @file temporal-rules.test.mjs
 * 
 * PackSignal — Regulatory Time Machine & Temporal Rules Test Suite
 * Tests exact date boundaries, FSSAI 2027 cutover, FOPNL non-binding status,
 * MoCRA cosmetics category gating, withdrawal/superseded handling, and determinism.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRulesAtDate,
  VERIFIED_TEMPORAL_RULES,
  TEMPORAL_STATUS,
  REGULATORY_LIFECYCLE,
  REQUIREMENT_TYPE,
  normalizeDate
} from '../lib/regulatory/temporal-rules.mjs';

test('1. Rule begins on exact effective date (2027-07-01 for FSSAI Amendment)', () => {
  const result = evaluateRulesAtDate({
    launchDate: '2027-07-01',
    market: 'india',
    productCategory: 'food'
  });

  const rule = result.evaluatedRules.find(r => r.rule.ruleId === 'FSSAI-LDR-2026-AMEND-BOLD-RDA');
  assert.ok(rule, 'FSSAI 2026 amendment rule must be evaluated');
  assert.equal(rule.status, TEMPORAL_STATUS.CONFIRMED_FUTURE_REQUIREMENT);
  assert.equal(rule.isActiveOnLaunchDate, true);
  assert.equal(rule.rule.effectiveDate, '2027-07-01');
});

test('2. Day before effective date (2027-06-30) does NOT activate rule', () => {
  const result = evaluateRulesAtDate({
    launchDate: '2027-06-30',
    market: 'india',
    productCategory: 'food'
  });

  const rule = result.evaluatedRules.find(r => r.rule.ruleId === 'FSSAI-LDR-2026-AMEND-BOLD-RDA');
  assert.ok(rule);
  assert.equal(rule.status, TEMPORAL_STATUS.NOT_YET_EFFECTIVE);
  assert.equal(rule.isActiveOnLaunchDate, false);
  assert.equal(result.categorized.confirmedFutureRequirements.some(r => r.ruleId === 'FSSAI-LDR-2026-AMEND-BOLD-RDA'), false);
});

test('3. Day after effective date (2027-07-02) activates rule', () => {
  const result = evaluateRulesAtDate({
    launchDate: '2027-07-02',
    market: 'india',
    productCategory: 'food'
  });

  const rule = result.evaluatedRules.find(r => r.rule.ruleId === 'FSSAI-LDR-2026-AMEND-BOLD-RDA');
  assert.ok(rule);
  assert.equal(rule.isActiveOnLaunchDate, true);
  assert.equal(rule.status, TEMPORAL_STATUS.CONFIRMED_FUTURE_REQUIREMENT);
});

test('4. Proposed rule (FSSAI FOPNL INR) NEVER becomes binding by date alone (even in 2028)', () => {
  const result2026 = evaluateRulesAtDate({
    launchDate: '2026-10-25',
    market: 'india',
    productCategory: 'food'
  });
  const result2028 = evaluateRulesAtDate({
    launchDate: '2028-12-31',
    market: 'india',
    productCategory: 'food'
  });

  const fopnl2026 = result2026.evaluatedRules.find(r => r.rule.ruleId === 'FSSAI-DRAFT-FOPNL-INR-STAR');
  const fopnl2028 = result2028.evaluatedRules.find(r => r.rule.ruleId === 'FSSAI-DRAFT-FOPNL-INR-STAR');

  assert.ok(fopnl2026);
  assert.ok(fopnl2028);

  assert.equal(fopnl2026.status, TEMPORAL_STATUS.PROPOSED_NONBINDING);
  assert.equal(fopnl2028.status, TEMPORAL_STATUS.PROPOSED_NONBINDING);
  assert.equal(fopnl2026.isBinding, false);
  assert.equal(fopnl2028.isBinding, false);
  assert.equal(fopnl2028.isActiveOnLaunchDate, false);
});

test('5. Draft rule with no effective date remains PROPOSED_NONBINDING', () => {
  const result = evaluateRulesAtDate({
    launchDate: '2027-08-01',
    market: 'india',
    productCategory: 'food'
  });

  const fopnl = result.categorized.proposedInitiatives.find(r => r.ruleId === 'FSSAI-DRAFT-FOPNL-INR-STAR');
  assert.ok(fopnl);
  assert.equal(fopnl.effectiveDate, null);
  assert.equal(fopnl.legalStatus, REGULATORY_LIFECYCLE.DRAFT);
});

test('6. Withdrawn/repealed rule is excluded on or after its withdrawal date', () => {
  const result = evaluateRulesAtDate({
    launchDate: '2026-10-25',
    market: 'india',
    productCategory: 'food'
  });

  const superseded = result.categorized.supersededOrWithdrawn.find(r => r.ruleId === 'FSSAI-P&L-2011-SUPERSEDED-NUTRITION');
  assert.ok(superseded, 'Repealed 2011 rule must be classified under superseded/withdrawn');
  assert.equal(result.categorized.applicableNow.some(r => r.ruleId === 'FSSAI-P&L-2011-SUPERSEDED-NUTRITION'), false);
});

test('7. Product-category applicability: Cosmetics rules (MoCRA) do NOT apply to Food/Granola', () => {
  const foodResult = evaluateRulesAtDate({
    launchDate: '2026-10-25',
    market: 'us',
    productCategory: 'food'
  });

  const mocraInFood = foodResult.categorized.applicableNow.filter(r => r.ruleId.startsWith('FDA-MOCRA'));
  assert.equal(mocraInFood.length, 0, 'No MoCRA cosmetics rules may apply to food/granola');

  const excluded = foodResult.categorized.notApplicable.filter(r => r.ruleId.startsWith('FDA-MOCRA'));
  assert.ok(excluded.length >= 3, 'MoCRA rules must be listed under notApplicable due to category gating');
});

test('8. Product-category applicability: Cosmetics rules DO apply to Cosmetic products', () => {
  const cosmeticResult = evaluateRulesAtDate({
    launchDate: '2026-10-25',
    market: 'us',
    productCategory: 'cosmetic'
  });

  const mocraInCosmetic = cosmeticResult.categorized.applicableNow.filter(r => r.ruleId.startsWith('FDA-MOCRA'));
  assert.ok(mocraInCosmetic.length >= 2, 'Active MoCRA rules must apply to cosmetic products');
  assert.ok(mocraInCosmetic.some(r => r.ruleId === 'FDA-MOCRA-2022-ADVERSE-EVENT-CONTACT'));
});

test('9. Food rules do NOT apply to cosmetic category', () => {
  const cosmeticResult = evaluateRulesAtDate({
    launchDate: '2026-10-25',
    market: 'us',
    productCategory: 'cosmetic'
  });

  const foodInCosmetic = cosmeticResult.categorized.applicableNow.filter(r => r.ruleId === 'FDA-21CFR101.9-NUTRITION');
  assert.equal(foodInCosmetic.length, 0, 'FDA 21 CFR 101.9 food nutrition facts rule cannot apply to cosmetics');
});

test('10. MoCRA distinguishes artwork checks from organizational obligations', () => {
  const contactRule = VERIFIED_TEMPORAL_RULES.find(r => r.ruleId === 'FDA-MOCRA-2022-ADVERSE-EVENT-CONTACT');
  const facilityRule = VERIFIED_TEMPORAL_RULES.find(r => r.ruleId === 'FDA-MOCRA-2022-FACILITY-REGISTRATION');

  assert.equal(contactRule.requirementType, REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK);
  assert.equal(facilityRule.requirementType, REQUIREMENT_TYPE.ORGANIZATIONAL_OBLIGATION);
});

test('11. Unsupported evaluator flag is preserved and reported', () => {
  const result = evaluateRulesAtDate({
    launchDate: '2026-10-25',
    market: 'india',
    productCategory: 'food'
  });

  const fopnl = VERIFIED_TEMPORAL_RULES.find(r => r.ruleId === 'FSSAI-DRAFT-FOPNL-INR-STAR');
  assert.equal(fopnl.evaluatorSupported, false);
});

test('12. Official source quotations, citations, and URLs are preserved intact', () => {
  const fssaiAmend = VERIFIED_TEMPORAL_RULES.find(r => r.ruleId === 'FSSAI-LDR-2026-AMEND-BOLD-RDA');
  assert.ok(fssaiAmend.officialSourceUrl.includes('fssai.gov.in'));
  assert.ok(fssaiAmend.originalQuotation.includes('percentage (%) contribution to RDA'));
  assert.ok(fssaiAmend.originalSource.includes('First Amendment Regulations, 2026'));
});

test('13. Date normalization handles valid dates, rejects invalid strings, and supports leap year', () => {
  assert.equal(normalizeDate('2028-02-29'), '2028-02-29', '2028 leap day must be valid');
  assert.equal(normalizeDate('2027-07-01'), '2027-07-01');
  assert.equal(normalizeDate('not-a-date'), null);
  assert.equal(normalizeDate('2027-13-45'), null);
  assert.equal(normalizeDate(''), null);
});

test('14. Determinism: same date, market, and category produce identical snapshot hash', () => {
  const run1 = evaluateRulesAtDate({ launchDate: '2027-07-01', market: 'india', productCategory: 'food' });
  const run2 = evaluateRulesAtDate({ launchDate: '2027-07-01', market: 'india', productCategory: 'food' });

  assert.equal(run1.snapshotId, run2.snapshotId);
  assert.equal(run1.summaryCounts.applicableNow, run2.summaryCounts.applicableNow);
  assert.equal(run1.summaryCounts.confirmedFuture, run2.summaryCounts.confirmedFuture);
});
