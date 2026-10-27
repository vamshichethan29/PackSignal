import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPdfPreflight } from '../../lib/preflight/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..', '..');
const fixturesDir = join(root, 'tests', 'fixtures', 'pdf-preflight');

test('PVP-003: passes text whose estimated height meets screening threshold', () => {
  const pdfPath = join(fixturesDir, '15_height_above_threshold.pdf');
  const review = {
    id: 'test-typo-above',
    documents: [{ id: 'doc-15', name: '15_height_above_threshold.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, {
    artworkPath: pdfPath,
    textHeightThresholdMm: 1.6,
    thresholdOrigin: 'company_rule',
    companyRuleId: 'BRAND-TYPO-16MM',
  });

  const typoChecks = res.checks.filter(c => c.checkId === 'PVP-003');
  assert.ok(typoChecks.length > 0);
  assert.equal(typoChecks[0].screeningOutcome, 'NO_CONCERN_DETECTED');
  assert.equal(typoChecks[0].thresholdOrigin, 'company_rule');
  assert.equal(typoChecks[0].sourceRuleId, 'BRAND-TYPO-16MM');
  assert.ok(typoChecks[0].title.includes('Meets Screening Threshold'));
});

test('PVP-003: flags SCREENING_WARNING when estimated height is below threshold', () => {
  const pdfPath = join(fixturesDir, '16_height_below_threshold.pdf');
  const review = {
    id: 'test-typo-below',
    documents: [{ id: 'doc-16', name: '16_height_below_threshold.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, {
    artworkPath: pdfPath,
    textHeightThresholdMm: 1.6,
    thresholdOrigin: 'reviewer_defined',
  });

  const typoChecks = res.checks.filter(c => c.checkId === 'PVP-003');
  const smallText = typoChecks.find(c => c.screeningOutcome === 'SCREENING_WARNING');
  assert.ok(smallText, 'Must flag text below threshold');
  assert.ok(smallText.title.includes('Below Configured Threshold'));
  assert.ok(smallText.explanation.includes('below the configured screening threshold'));
  assert.ok(smallText.limitations.includes('does NOT represent a true measured font x-height'));
});
