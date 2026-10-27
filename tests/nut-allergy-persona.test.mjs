/**
 * PackSignal — Phase 6A: Nut Allergy Persona Unit Tests
 * Asserts distinction between intentional ingredients and precautionary advisory,
 * verifies lack of false undeclared-allergen claims, and enforces non-medical safety boundaries.
 *
 * (tests/nut-allergy-persona.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateNutAllergyPersona } from '../lib/shopper/experience-engine.mjs';

test('Nut Allergy Persona — Intentional vs Advisory Clarity', async (t) => {
  const nutPersona = evaluateNutAllergyPersona({
    findings: [{ id: 'f-allergen-01', ruleId: 'rule-allergen-tree-nuts' }]
  });

  await t.test('1. Separates intentional tree nut ingredient from precautionary advisory', () => {
    const intentional = nutPersona.evidenceItems.find((e) => e.type === 'INTENTIONAL_INGREDIENT');
    const advisory = nutPersona.evidenceItems.find((e) => e.type === 'PRECAUTIONARY_ADVISORY');

    assert.ok(intentional, 'Has intentional ingredient item');
    assert.ok(advisory, 'Has precautionary advisory item');
    assert.equal(intentional.sourceText, 'almonds');
    assert.equal(advisory.sourceText, 'MAY CONTAIN TREE NUTS.');
  });

  await t.test('2. Does not falsely claim declared almonds are undeclared', () => {
    const intentional = nutPersona.evidenceItems.find((e) => e.type === 'INTENTIONAL_INGREDIENT');
    assert.equal(intentional.status, 'DECLARED_CORRECTLY');
    assert.doesNotMatch(nutPersona.verdict.statement.toLowerCase(), /undeclared almonds/);
  });

  await t.test('3. Scopes advisory concern to consumer clarity and species-level distinction', () => {
    assert.match(nutPersona.verdict.statement, /species-level distinction|adequate.*distinction/i);
    assert.equal(nutPersona.assessmentStatus, 'POTENTIAL_CONFUSION');
  });

  await t.test('4. Does NOT promise or guarantee medical product safety', () => {
    assert.doesNotMatch(nutPersona.verdict.statement.toLowerCase(), /safe for consumption|guaranteed safe/);
    assert.ok(nutPersona.verdict.limitations.some((l) => l.toLowerCase().includes('safety')));
  });

  await t.test('5. Exposes standard review workflows without modifying sources', () => {
    const actionIds = nutPersona.workflowActions.map((a) => a.id);
    assert.ok(actionIds.includes('act-ask-legal'));
    assert.ok(actionIds.includes('act-ask-rd'));
    assert.ok(actionIds.includes('act-req-wording'));
  });
});
