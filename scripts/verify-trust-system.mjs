#!/usr/bin/env node
/**
 * PackSignal Phase 8 Trust System Verification (scripts/verify-trust-system.mjs)
 * Comprehensive verification of evaluation schema, generator, runner, matcher,
 * metrics, failure analysis, model bake-off, and feature-freeze release gates.
 */

import assert from 'node:assert';
import { generateEvaluationSuite } from '../lib/evaluation/fixture-generator.mjs';
import { checkGroundTruthProtection, validateFixtureIntegrity } from '../lib/evaluation/truth-validator.mjs';
import { runEvaluationSuite } from '../lib/evaluation/runner.mjs';
import { matchCaseOutcome } from '../lib/evaluation/case-matcher.mjs';
import { computeEvaluationMetrics } from '../lib/evaluation/metrics.mjs';
import { diagnoseCaseFailure, FAILURE_CATEGORIES } from '../lib/evaluation/failure-analysis.mjs';
import { executeModelBakeOff } from '../lib/evaluation/model-bakeoff.mjs';
import { evaluateReleaseGates } from '../lib/evaluation/release-gates.mjs';
import { compareEvaluationRuns } from '../lib/evaluation/benchmark-store.mjs';

console.log('[Phase 8 Verification] Starting 10-point Trust System Verification...');

// Test 1: Seeded Reproducibility
console.log('  1. Verifying seeded generator reproducibility...');
const suiteA = generateEvaluationSuite({ seed: 42, count: 5 });
const suiteB = generateEvaluationSuite({ seed: 42, count: 5 });
const suiteC = generateEvaluationSuite({ seed: 99, count: 5 });
assert.strictEqual(suiteA[0].caseId, suiteB[0].caseId, 'Identical seeds must yield identical case IDs');
assert.strictEqual(suiteA[0].expectedOutcome, suiteB[0].expectedOutcome, 'Identical seeds must yield identical outcomes');
assert.notStrictEqual(suiteA[0].mutationSeed, suiteC[0].mutationSeed, 'Different seeds must yield different mutation seeds');

// Test 2: Fixture Integrity & Hash Verification
console.log('  2. Verifying fixture integrity and mutation differences...');
for (const c of suiteA) {
  const check = validateFixtureIntegrity(c);
  assert.strictEqual(check.valid, true, `Generated case ${c.caseId} must be valid: ${check.reasons.join('; ')}`);
}

// Test 3: Ground Truth Protection
console.log('  3. Verifying ground truth protection (no answer key leakage)...');
const cleanInput = { documents: [], options: {} };
assert.strictEqual(checkGroundTruthProtection(cleanInput).leaked, false);
const leakedInput = { documents: [], goldenAnswers: { defect: true } };
assert.strictEqual(checkGroundTruthProtection(leakedInput).leaked, true);

// Test 4: Strict Outcome Matching
console.log('  4. Verifying strict case matching...');
const dummyDefectCase = {
  caseId: 'test-case-01',
  expectedOutcome: 'issue',
  expectedField: 'net_quantity',
  expectedRuleId: 'rules:EVAL-QTY',
};
// Exact match
const matchResult1 = matchCaseOutcome(dummyDefectCase, {
  findings: [{ status: 'issue', field: 'net_quantity', observed: '14 fl oz', explanation: 'Mismatch' }],
});
assert.strictEqual(matchResult1.classification, 'CORRECT_DETECTION');

// Wrong field (should NOT count as catch)
const matchResult2 = matchCaseOutcome(dummyDefectCase, {
  findings: [{ status: 'issue', field: 'storage_statement', observed: 'Ambient', explanation: 'Storage issue' }],
});
assert.strictEqual(matchResult2.classification, 'WRONG_ERROR_TYPE');

// Test 5: Standard Metric Computation
console.log('  5. Verifying Precision / Recall / F1 calculations...');
const mockOutcomes = [
  { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'CORRECT_DETECTION' }, elapsedMs: 1 },
  { evalCase: { expectedOutcome: 'issue' }, matchedResult: { classification: 'MISSED_DEFECT' }, elapsedMs: 1 },
  { evalCase: { expectedOutcome: 'match' }, matchedResult: { classification: 'TRUE_NEGATIVE' }, elapsedMs: 1 },
  { evalCase: { expectedOutcome: 'match' }, matchedResult: { classification: 'FALSE_POSITIVE' }, elapsedMs: 1 },
];
const computed = computeEvaluationMetrics(mockOutcomes);
assert.strictEqual(computed.counts.tp, 1);
assert.strictEqual(computed.counts.fn, 1);
assert.strictEqual(computed.counts.tn, 1);
assert.strictEqual(computed.counts.fp, 1);
// Precision: 1 / (1 + 1) = 50.0%
assert.strictEqual(computed.metrics.precision, '50.0%');
// Recall: 1 / (1 + 1) = 50.0%
assert.strictEqual(computed.metrics.recall, '50.0%');
// F1: 50.0%
assert.strictEqual(computed.metrics.f1Score, '50.0%');

// Test 6: Root Cause Diagnostics
console.log('  6. Verifying failure analysis diagnostics...');
const diag = diagnoseCaseFailure(
  { caseId: 'qty-01', expectedOutcome: 'issue', category: 'quantity', expectedField: 'net_quantity' },
  { classification: 'MISSED_DEFECT', matched: false, finding: { status: 'match' } }
);
assert.strictEqual(diag.failureCategory, FAILURE_CATEGORIES.UNIT_NORMALIZATION_FAILURE);

// Test 7: Full Suite Execution
console.log('  7. Executing full evaluation suite runner...');
const runResult = runEvaluationSuite(null, { seed: 42 });
assert.ok(runResult.totalCases >= 20, 'Suite must have at least 20 cases');
assert.ok(runResult.scoreboard.caughtX > 0, 'Must catch planted defects');
console.log(`     ${runResult.scoreboard.headline}`);

// Test 8: Run Comparator
console.log('  8. Verifying run comparator differential analysis...');
const comp = compareEvaluationRuns(runResult, runResult);
assert.strictEqual(comp.sharedCasesCount, runResult.totalCases);
assert.strictEqual(comp.regressionsCount, 0);

// Test 9: Model Bake-Off & Leaderboard
console.log('  9. Verifying 3-Model Bake-off and selection policy...');
const bakeOff = executeModelBakeOff({ seed: 42 });
assert.strictEqual(bakeOff.leaderboard.length, 3, 'Must evaluate 3 candidates');
assert.strictEqual(bakeOff.winningModel, 'gemini-3.8-flash');

// Test 10: Release Gates
console.log('  10. Evaluating Phase 8 feature-freeze release gates...');
const gates = evaluateReleaseGates();
console.log(`     Overall Decision: ${gates.overallDecision} (${gates.passedCount}/${gates.totalGates} gates passed)`);
assert.strictEqual(gates.allPassed, true, 'All feature-freeze release gates must pass');

console.log('='.repeat(70));
console.log(' ALL 10 PHASE 8 VERIFICATION TARGETS PASSED WITH MAXIMUM FIDELITY.');
console.log('='.repeat(70));
