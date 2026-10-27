import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPdfPreflight } from '../../lib/preflight/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..', '..');
const fixturesDir = join(root, 'tests', 'fixtures', 'pdf-preflight');

test('PVP-002: detects drawing sequence occlusion by later opaque rectangle', () => {
  const pdfPath = join(fixturesDir, '04_covered_opaque_rect.pdf');
  const review = {
    id: 'test-overlap-opaque',
    documents: [{ id: 'doc-4', name: '04_covered_opaque_rect.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const overlapChecks = res.checks.filter(c => c.checkId === 'PVP-002');
  const occ = overlapChecks.find(c => c.title.includes('Potential Occlusion'));
  assert.ok(occ, 'Must detect potential occlusion from drawing order');
  assert.equal(occ.screeningOutcome, 'SCREENING_WARNING');
  assert.ok(occ.explanation.includes('Drawing operation'));
});

test('PVP-002: evaluates semi-transparent overlay as REVIEW_REQUIRED', () => {
  const pdfPath = join(fixturesDir, '05_semi_transparent_overlay.pdf');
  const review = {
    id: 'test-overlap-tint',
    documents: [{ id: 'doc-5', name: '05_semi_transparent_overlay.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const overlapChecks = res.checks.filter(c => c.checkId === 'PVP-002');
  const tint = overlapChecks.find(c => c.title.includes('Semi-Transparent'));
  assert.ok(tint, 'Must detect semi-transparent overlay');
  assert.equal(tint.screeningOutcome, 'REVIEW_REQUIRED');
});

test('PVP-002: detects colliding independent text spans as SCREENING_WARNING', () => {
  const pdfPath = join(fixturesDir, '07_text_collision.pdf');
  const review = {
    id: 'test-overlap-collision',
    documents: [{ id: 'doc-7', name: '07_text_collision.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const overlapChecks = res.checks.filter(c => c.checkId === 'PVP-002');
  const col = overlapChecks.find(c => c.title.includes('Text Collision'));
  assert.ok(col, 'Must detect text collision');
  assert.equal(col.screeningOutcome, 'SCREENING_WARNING');
});

test('PVP-002: suppresses false positives for intentional multi-pass bolding', () => {
  const pdfPath = join(fixturesDir, '08_duplicate_stroke_fill.pdf');
  const review = {
    id: 'test-overlap-duplicate',
    documents: [{ id: 'doc-8', name: '08_duplicate_stroke_fill.pdf', role: 'artwork', path: pdfPath }],
  };

  const res = runPdfPreflight(review, { artworkPath: pdfPath });
  const overlapChecks = res.checks.filter(c => c.checkId === 'PVP-002');
  const col = overlapChecks.find(c => c.title.includes('Text Collision'));
  assert.equal(col, undefined, 'Must suppress collision warning for intentional duplicate pass');
});
