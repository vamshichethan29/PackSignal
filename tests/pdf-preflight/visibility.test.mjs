import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPdfPreflight } from '../../lib/preflight/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..', '..');
const fixturesDir = join(root, 'tests', 'fixtures', 'pdf-preflight');

test('PVP-001: normal visible text produces NO_CONCERN_DETECTED', () => {
  const pdfPath = join(fixturesDir, '01_normal_visible.pdf');
  const review = {
    id: 'test-vis-normal',
    documents: [{ id: 'doc-1', name: '01_normal_visible.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  assert.equal(res.schema, 'packsignal-pdf-preflight/v1');
  const visChecks = res.checks.filter(c => c.checkId === 'PVP-001');
  assert.ok(visChecks.length > 0);
  assert.equal(visChecks[0].screeningOutcome, 'NO_CONCERN_DETECTED');
  assert.equal(visChecks[0].technicalState, 'NATIVE_VISIBLE_CANDIDATE');
});

test('PVP-001: detects non-rendering mode 3 as SCREENING_WARNING', () => {
  const pdfPath = join(fixturesDir, '02_non_rendering_mode3.pdf');
  const review = {
    id: 'test-vis-mode3',
    documents: [{ id: 'doc-2', name: '02_non_rendering_mode3.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const visChecks = res.checks.filter(c => c.checkId === 'PVP-001');
  const tr3 = visChecks.find(c => c.technicalState === 'PDF_NONRENDERING_TEXT');
  assert.ok(tr3, 'Must detect PDF_NONRENDERING_TEXT');
  assert.equal(tr3.screeningOutcome, 'SCREENING_WARNING');
  assert.ok(tr3.title.includes('Tr 3') || tr3.title.includes('Non-Rendering'));
  assert.ok(tr3.explanation.includes('mode 3'));
});

test('PVP-001: detects zero opacity text as SCREENING_WARNING', () => {
  const pdfPath = join(fixturesDir, '03_zero_opacity.pdf');
  const review = {
    id: 'test-vis-opacity',
    documents: [{ id: 'doc-3', name: '03_zero_opacity.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const visChecks = res.checks.filter(c => c.checkId === 'PVP-001');
  const zeroOp = visChecks.find(c => c.title.includes('Zero Opacity'));
  assert.ok(zeroOp, 'Must detect zero opacity');
  assert.equal(zeroOp.screeningOutcome, 'SCREENING_WARNING');
});
