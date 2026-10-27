import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReleaseGates, RELEASE_GATES } from '../lib/evaluation/release-gates.mjs';

test('evaluateReleaseGates assesses all 11 feature-freeze gates and passes when criteria are met', () => {
  const audit = evaluateReleaseGates();

  assert.equal(audit.totalGates, 11, 'Must evaluate exactly 11 architectural gates');
  assert.equal(audit.allPassed, true, `All gates must pass. Failed: ${audit.failedGates.map(g => g.name).join(', ')}`);
  assert.equal(audit.overallDecision, 'READY_FOR_FREEZE');

  for (const gate of audit.gateResults) {
    assert.equal(gate.status, 'PASS', `Gate ${gate.id} must PASS`);
    assert.ok(typeof gate.observed === 'string' && gate.observed.length > 0);
    assert.ok(typeof gate.evidence === 'string' && gate.evidence.length > 0);
  }
});

test('Release gate definitions have mandatory thresholds declared', () => {
  assert.equal(RELEASE_GATES.length, 11);
  assert.ok(RELEASE_GATES.every(g => typeof g.id === 'string' && g.id.startsWith('GATE-')));
  assert.ok(RELEASE_GATES.every(g => typeof g.condition === 'string' && g.condition.length > 10));
});
