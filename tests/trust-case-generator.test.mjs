import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEvaluationSuite, BASELINE_FIXTURES } from '../lib/evaluation/fixture-generator.mjs';
import { validateFixtureIntegrity } from '../lib/evaluation/truth-validator.mjs';

test('Seeded generator produces identical cases for identical seeds', () => {
  const run1 = generateEvaluationSuite({ seed: 777, count: 6 });
  const run2 = generateEvaluationSuite({ seed: 777, count: 6 });

  assert.equal(run1.length, 6);
  assert.equal(run2.length, 6);

  for (let i = 0; i < 6; i++) {
    assert.equal(run1[i].caseId, run2[i].caseId);
    assert.equal(run1[i].expectedOutcome, run2[i].expectedOutcome);
    assert.equal(run1[i].expectedField, run2[i].expectedField);
    assert.equal(run1[i].mutationSeed, run2[i].mutationSeed);
  }
});

test('Different seeds produce different case IDs and mutation parameters', () => {
  const runA = generateEvaluationSuite({ seed: 101, count: 5 });
  const runB = generateEvaluationSuite({ seed: 202, count: 5 });

  assert.notEqual(runA[0].mutationSeed, runB[0].mutationSeed);
});

test('Baseline original fixtures remain unchanged after generating suites', () => {
  const baselineBefore = JSON.stringify(BASELINE_FIXTURES[0]);
  generateEvaluationSuite({ seed: 42, count: 20 });
  const baselineAfter = JSON.stringify(BASELINE_FIXTURES[0]);

  assert.equal(baselineBefore, baselineAfter, 'Original fixture cannot be mutated');
});

test('Fixture integrity validation validates hashes and catches invalid mutations', () => {
  const suite = generateEvaluationSuite({ seed: 42, count: 10 });
  for (const c of suite) {
    const res = validateFixtureIntegrity(c);
    assert.equal(res.valid, true, `Case ${c.caseId} must be valid: ${res.reasons.join('; ')}`);
  }

  // Corrupted fixture with identical hashes for planted defect
  const corruptedCase = {
    caseId: 'corrupted-01',
    expectedOutcome: 'issue',
    metadata: {
      mutationManifest: {
        originalHash: 'abcd1234',
        generatedHash: 'abcd1234', // identical!
      },
    },
  };
  const check = validateFixtureIntegrity(corruptedCase);
  assert.equal(check.valid, false);
  assert.ok(check.reasons.some(r => r.includes('identical to original')));
});
