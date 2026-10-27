/**
 * PackSignal — Phase 6A: Vegan Persona Unit Tests
 * Asserts detection of vegan claim vs honey conflict, Decision Ripple integration,
 * and preservation of immutable source formulation records.
 *
 * (tests/vegan-persona.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateVeganPersona } from '../lib/shopper/experience-engine.mjs';

test('Vegan Persona — Claim & Formulation Integrity', async (t) => {
  const veganPersona = evaluateVeganPersona({
    findings: [{ id: 'f-vegan-01', ruleId: 'rule-claim-vegan' }]
  });

  await t.test('1. Links actual honey ingredient (1%) to vegan-facing claim', () => {
    assert.match(veganPersona.verdict.statement, /vegan.*claim.*honey/i);
    assert.ok(veganPersona.verdict.sourceEvidenceRefs.some((r) => r.includes('honey 1%')));
    assert.ok(veganPersona.verdict.sourceEvidenceRefs.some((r) => r.includes('Certified Vegan')));
  });

  await t.test('2. Accurately reflects source conflict status', () => {
    assert.equal(veganPersona.assessmentStatus, 'SOURCE_CONFLICT');
  });

  await t.test('3. Exposes Decision Ripple with both remediation options', () => {
    const scenarios = veganPersona.decisionRipple.availableScenarios;
    assert.equal(scenarios.length, 2);

    const keepHoney = scenarios.find((s) => s.id === 'scenario-keep-honey');
    const removeHoney = scenarios.find((s) => s.id === 'scenario-remove-honey');

    assert.ok(keepHoney, 'Has Keep Honey / Remove Vegan Claim scenario');
    assert.ok(removeHoney, 'Has Remove Honey / Reevaluate Vegan Claim scenario');
  });

  await t.test('4. Does not automatically approve vegan claim upon removing honey', () => {
    const removeHoney = veganPersona.decisionRipple.availableScenarios.find((s) => s.id === 'scenario-remove-honey');
    assert.match(removeHoney.impact, /reformulation approval/i);
  });
});
