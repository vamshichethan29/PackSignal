import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBrokenTestCases,
  BASELINE_CASES,
  DEFECT_CATEGORIES,
} from '../lib/trust-console/generator.mjs';
import { runTrustEvaluation } from '../lib/trust-console/runner.mjs';
import { getModelBakeOffResults, BAKE_OFF_MODELS } from '../lib/trust-console/bake-off.mjs';
import { getChangeLog } from '../lib/trust-console/change-log.mjs';

test('Trust Console Generator produces synthetic broken cases across requested categories', () => {
  const generated = generateBrokenTestCases({ count: 8, defectRatio: 0.75 });
  assert.equal(generated.length, 8);
  assert.ok(generated.every(c => c.id.startsWith('tc-dyn-')));
  assert.ok(generated.some(c => c.group === 'defect' && c.expected === 'issue'));
  assert.ok(generated.every(c => typeof c.description === 'string' && c.description.length > 5));
});

test('Trust Console Runner computes "caught X of Y" defect metrics and catches baseline defects', () => {
  const results = runTrustEvaluation(BASELINE_CASES);
  assert.ok(results.scorecard, 'Scorecard must exist');
  assert.ok(results.scorecard.headline.includes('Caught'), 'Headline states caught X of Y');
  assert.equal(results.scorecard.defectsTotal, 7, '7 planted defects in baseline');
  assert.equal(results.scorecard.defectsCaught, 7, 'All 7 planted defects caught');
  assert.ok(results.scorecard.defectRecallRate.startsWith('100'));
  assert.equal(results.scorecard.falseAlarms, 0, 'Zero false alarms on clean packaging');
  assert.equal(results.scorecard.allPassed, true);
  assert.equal(results.missesCount, 0);
});

test('Trust Console Runner generates root-cause diagnostic explanations for misses and catches', () => {
  // Synthesize a deliberate miss case
  const syntheticCase = {
    id: 'tc-forced-miss',
    name: 'Forced Miss Test',
    group: 'defect',
    kind: 'copy',
    field: 'storage_statement',
    reference: 'Keep frozen',
    artwork: ['Keep frozen'], // Matches instead of defect!
    complete: true,
    expected: 'issue',
  };

  const results = runTrustEvaluation([syntheticCase]);
  assert.equal(results.missesCount, 1, '1 miss registered');
  const miss = results.misses[0];
  assert.equal(miss.expected, 'issue');
  assert.equal(miss.actual, 'match');
  assert.ok(miss.diagnostic.includes('CRITICAL MISS'), 'Diagnostic identifies critical miss root cause');
});

test('Model Bake-Off ranks models and establishes gemini-3.8-flash as configured winner', () => {
  const bakeOff = getModelBakeOffResults();
  assert.equal(bakeOff.winningModel, 'gemini-3.8-flash');
  assert.ok(bakeOff.models.length >= 3, 'Scores at least 3 models');

  const winner = bakeOff.models.find(m => m.id === 'gemini-3.8-flash');
  assert.equal(winner.isWinner, true);
  assert.equal(winner.metrics.defectRecallPct, '100.0%');
  assert.equal(winner.metrics.falseAlarms, 0);

  const markdown = bakeOff.markdownTable;
  assert.ok(markdown.includes('gemini-3.8-flash'), 'Markdown table contains winner');
  assert.ok(markdown.includes('GEMINI_MODEL=gemini-3.8-flash'), 'Shows winning config assignment');
});

test('Trust Console Change Log includes Phase 8 feature freeze entry', () => {
  const log = getChangeLog();
  assert.ok(Array.isArray(log) && log.length >= 4);
  const phase8 = log.find(e => e.title.includes('Phase 8'));
  assert.ok(phase8, 'Phase 8 entry must exist');
  assert.equal(phase8.type, 'FEATURE_FREEZE');
});
