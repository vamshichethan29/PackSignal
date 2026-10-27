import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPdfPreflight } from '../../lib/preflight/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..', '..');
const fixturesDir = join(root, 'tests', 'fixtures', 'pdf-preflight');

test('PVP-004: detects text near trusted PDF TrimBox cut boundary', () => {
  const pdfPath = join(fixturesDir, '18_text_near_trim.pdf');
  const review = {
    id: 'test-trim-near',
    documents: [{ id: 'doc-18', name: '18_text_near_trim.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, {
    artworkPath: pdfPath,
    cutClearanceMm: 2.0,
    thresholdOrigin: 'reviewer_defined',
  });

  const clearChecks = res.checks.filter(c => c.checkId === 'PVP-004');
  const nearCut = clearChecks.find(c => c.screeningOutcome === 'SCREENING_WARNING');
  assert.ok(nearCut, 'Must detect text near cut boundary');
  assert.ok(nearCut.title.includes('Near Cut Line') || nearCut.title.includes('Crosses Cut Line'));
  assert.ok(nearCut.explanation.includes('cut-clearance margin'));
});

test('PVP-004: fails safe with UNABLE_TO_EVALUATE when trim geometry is unavailable', () => {
  const pdfPath = join(fixturesDir, '25_no_trim_info.pdf');
  const review = {
    id: 'test-trim-none',
    documents: [{ id: 'doc-25', name: '25_no_trim_info.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const clearChecks = res.checks.filter(c => c.checkId === 'PVP-004');
  assert.ok(clearChecks.length > 0);
  const unavail = clearChecks.find(c => c.measurement === 'TRIM_GEOMETRY_UNAVAILABLE');
  assert.ok(unavail, 'Must return TRIM_GEOMETRY_UNAVAILABLE');
  assert.equal(unavail.screeningOutcome, 'UNABLE_TO_EVALUATE');
  assert.ok(unavail.explanation.includes('does not invent trim boundaries from generic PDF page edges'));
});
