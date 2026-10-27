/**
 * @file phase8-trust-console-freeze.test.mjs
 * 
 * Test suite for Phase 8 — Trust Console and Self-Test (Feature Freeze)
 * 
 * Done when:
 * 1. The suite runs from the screen and shows "caught X of Y" with each miss explained.
 * 2. Generator makes broken test cases with planted discrepancies.
 * 3. Model bake-off scores 2-3 models with latency, cost, and defect recall.
 * 4. The bake-off table is in the README.md.
 * 5. The winning model (gemini-3.8-flash) is set in config.
 * 6. Change log contains the Phase 8 feature freeze record.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateBrokenTestCases,
  BASELINE_CASES,
  DEFECT_CATEGORIES
} from '../lib/trust-console/generator.mjs';
import { runTrustEvaluation } from '../lib/trust-console/runner.mjs';
import { getModelBakeOffResults, BAKE_OFF_MODELS } from '../lib/trust-console/bake-off.mjs';
import { getChangeLog } from '../lib/trust-console/change-log.mjs';

test('1. Generator creates broken test cases with planted discrepancies across categories', () => {
  const generated = generateBrokenTestCases({ count: 10, defectRatio: 1.0 });
  assert.equal(generated.length, 10, 'Generates requested count');
  
  const defects = generated.filter(c => c.group === 'defect');
  assert.equal(defects.length, 10, 'Generates all defect cases when ratio is 1.0');
  assert.ok(defects.every(d => d.expected === 'issue'), 'Defects expect issue detection');

  // Verify categories
  const categories = new Set(generated.map(c => c.category));
  assert.ok(categories.size > 0);
});

test('2. Trust Console Runner computes "caught X of Y" defect metrics and catches baseline defects', () => {
  const results = runTrustEvaluation(BASELINE_CASES);
  assert.ok(results.scorecard, 'Scorecard exists');
  assert.equal(results.scorecard.defectsTotal, 7, 'Total planted defects in baseline is 7');
  assert.equal(results.scorecard.defectsCaught, 7, 'All 7 planted defects caught');
  assert.ok(results.scorecard.headline.toLowerCase().includes('caught 7 of 7'), 'Headline states caught X of Y');
  assert.equal(results.scorecard.falseAlarms, 0, 'Zero false alarms on clean packaging');
  assert.ok(results.scorecard.defectRecallRate.startsWith('100'));
  assert.equal(results.missesCount, 0, 'Zero misses in baseline run');
});

test('3. Misses are explained with root-cause diagnostic explanations', () => {
  const missedCase = {
    id: 'tc-test-miss',
    name: 'Uncaught Allergen Discrepancy',
    group: 'defect',
    kind: 'allergen',
    field: 'allergen_statement',
    reference: 'Contains: Almonds.',
    artwork: ['Contains: Almonds.'], // Matches instead of flagging discrepancy!
    complete: true,
    expected: 'issue'
  };

  const results = runTrustEvaluation([missedCase]);
  assert.equal(results.missesCount, 1, '1 miss registered');

  const miss = results.misses[0];
  assert.equal(miss.id, 'tc-test-miss');
  assert.equal(miss.expected, 'issue');
  assert.equal(miss.actual, 'match');
  assert.ok(miss.diagnostic, 'Must provide detailed diagnostic');
  assert.ok(miss.diagnostic.includes('CRITICAL MISS') || miss.diagnostic.includes('mismatch'));
});

test('4. Model Bake-Off scores competing models and designates gemini-3.8-flash as winner', () => {
  const bakeOff = getModelBakeOffResults();
  assert.ok(bakeOff.models.length >= 3, 'Evaluates at least 3 models');
  assert.equal(bakeOff.winningModel, 'gemini-3.8-flash');

  const winner = bakeOff.models.find(m => m.id === 'gemini-3.8-flash');
  assert.ok(winner, 'Winning model must be in the list');
  assert.equal(winner.isWinner, true);
  assert.equal(winner.metrics.defectRecallPct, '100.0%');
  assert.equal(winner.metrics.falseAlarms, 0);

  // Markdown table formatting
  assert.ok(bakeOff.markdownTable.includes('| Model / Engine |'));
  assert.ok(bakeOff.markdownTable.includes('gemini-3.8-flash'));
  assert.ok(bakeOff.markdownTable.includes('WINNER (Set in config)'));
});

test('5. Model Bake-Off table is embedded in README.md', () => {
  const readmePath = join(process.cwd(), 'README.md');
  assert.ok(existsSync(readmePath), 'README.md must exist');
  const readme = readFileSync(readmePath, 'utf8');

  assert.ok(readme.includes('Model Bake-Off'), 'README.md must contain Model Bake-Off section');
  assert.ok(readme.includes('gemini-3.8-flash'), 'README.md must list gemini-3.8-flash');
  assert.ok(readme.includes('GEMINI_MODEL=gemini-3.8-flash'), 'README.md must document winning config');
});

test('6. Winning model is configured across environment and server defaults', () => {
  const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
  assert.ok(envExample.includes('GEMINI_MODEL=gemini-3.8-flash'), '.env.example must set gemini-3.8-flash');

  const serverJs = readFileSync(join(process.cwd(), 'server.mjs'), 'utf8');
  assert.ok(serverJs.includes("'gemini-3.8-flash'"), 'server.mjs must default to gemini-3.8-flash');
});

test('7. Trust Console Change Log records Phase 8 Feature Freeze', () => {
  const log = getChangeLog();
  assert.ok(Array.isArray(log) && log.length >= 4);

  const phase8 = log.find(e => e.title.includes('Phase 8'));
  assert.ok(phase8, 'Phase 8 feature freeze entry must exist');
  assert.equal(phase8.type, 'FEATURE_FREEZE');
  assert.ok(phase8.summary.toLowerCase().includes('trust shown as numbers'));
});
