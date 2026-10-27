/**
 * PackSignal — Phase 6A: Watching Sugar Persona Unit Tests
 * Asserts verification of "No Added Sugar" claim against FDA 21 CFR 101.60(c)(2),
 * preservation of lab nutrition facts, and rejection of fabricated nutrient calculations.
 *
 * (tests/sugar-persona.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateSugarPersona } from '../lib/shopper/experience-engine.mjs';

test('Watching Sugar Persona — Added Sugars & Claim Compliance', async (t) => {
  const sugarPersona = evaluateSugarPersona({
    findings: [{ id: 'f-sugar-01', ruleId: 'rule-sugar-claim' }]
  });

  await t.test('1. Highlights actual "No Added Sugar" claim text and formulation evidence', () => {
    assert.match(sugarPersona.verdict.statement, /Added-sugar claims|No Added Sugar/i);
    assert.match(sugarPersona.verdict.statement, /honey/i);
    assert.ok(sugarPersona.verdict.sourceEvidenceRefs.some((r) => r.includes('NO ADDED SUGAR')));
    assert.ok(sugarPersona.verdict.sourceEvidenceRefs.some((r) => r.includes('honey 1%')));
  });

  await t.test('2. Cites FDA 21 CFR 101.60(c)(2) governing nutrient content claims for sugar', () => {
    assert.ok(sugarPersona.verdict.ruleIds.includes('FDA-21-CFR-101-60-C-2'));
  });

  await t.test('3. Distinguishes lab formulation grams from visual estimates', () => {
    assert.equal(sugarPersona.nutritionMetrics.totalSugarsGrams, 7);
    assert.equal(sugarPersona.nutritionMetrics.addedSugarsGrams, 2);
    assert.ok(sugarPersona.verdict.limitations.some((l) => l.includes('formulation')));
  });

  await t.test('4. Provides reviewer workflow actions to inspect formulation and claim', () => {
    const actionIds = sugarPersona.workflowActions.map((a) => a.id);
    assert.ok(actionIds.includes('act-inspect-claim'));
    assert.ok(actionIds.includes('act-view-formula'));
    assert.ok(actionIds.includes('act-ask-rd'));
  });
});
