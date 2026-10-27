import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';
import { evaluateDancingFishSuite } from '../scripts/evaluate-dancing-fish.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

test('16-check registry and expected results answer key are versioned and structurally valid', () => {
  const regPath = resolve(REPO_ROOT, 'samples/organizer/evaluation/dancing-fish-16-checks.json');
  const keyPath = resolve(REPO_ROOT, 'samples/organizer/evaluation/dancing-fish-expected-results.json');

  assert.ok(existsSync(regPath), 'Registry file must exist');
  assert.ok(existsSync(keyPath), 'Expected results answer key file must exist');

  const registry = JSON.parse(readFileSync(regPath, 'utf8'));
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));

  assert.equal(registry.checks.length, 17); // 16 candidate checks + 1 positive control (P01)
  assert.ok(registry.checks.some(c => c.checkId === 'P01'));
  assert.equal(key.checks.length, 17); // 16 checks + 1 positive control (P01)
});

test('getDancingFish16Checks evaluates all 16 candidate checks plus positive control without hardcoding', () => {
  const suite = getDancingFish16Checks();

  assert.equal(suite.summary.total, 16);
  assert.equal(suite.summary.evaluated, 16);
  assert.equal(suite.summary.positiveControls.total, 1);
  assert.equal(suite.summary.positiveControls.passed, 1);

  // Verify all canonical IDs DF-01 through DF-16 are present
  for (let i = 1; i <= 16; i++) {
    const id = `DF-${String(i).padStart(2, '0')}`;
    const check = suite.checks.find(c => c.canonicalId === id);
    assert.ok(check, `Canonical check ${id} must be evaluated in Dancing Fish suite`);
    assert.ok(check.department, `Check ${id} must have assigned department`);
    assert.ok(check.calculationProof, `Check ${id} must preserve proof or calculation evidence`);
  }

  // Positive control P01
  assert.ok(suite.positiveControl);
  assert.equal(suite.positiveControl.canonicalId, 'P01');
  assert.equal(suite.positiveControl.status, 'match');
  assert.equal(suite.positiveControl.isPositiveControl, true);
});

test('Dancing Fish evaluation runner executes and matches 100% of confirmed and provisional expectations', async () => {
  const report = await evaluateDancingFishSuite({ silent: true });

  assert.equal(report.overallPass, true);
  assert.equal(report.metrics.confirmedChecks.missed, 0);
  assert.equal(report.metrics.positiveControls.failed, 0);
  assert.ok(report.metrics.provisionalChecks.surfaced >= 4);
});
