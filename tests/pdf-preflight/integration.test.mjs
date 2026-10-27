import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPdfPreflight } from '../../lib/preflight/index.mjs';
import { createHtmlReport } from '../../lib/html-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..', '..');
const fixturesDir = join(root, 'tests', 'fixtures', 'pdf-preflight');
const samplePdf = join(root, 'samples', 'organizer', 'DancingFish_Granola_Berry_US_Carton.pdf');

test('Integration: PDF preflight on real packaging artwork PDF', async () => {
  const review = {
    id: 'test-df-preflight',
    name: 'Dancing Fish Granola Berry Crunch Preflight',
    documents: [
      { id: 'art-df', name: 'DancingFish_Granola_Berry_US_Carton.pdf', role: 'artwork', path: samplePdf }
    ],
    findings: [],
    options: { completeArtwork: true }
  };

  const res = runPdfPreflight(review, {
    artworkPath: samplePdf,
    textHeightThresholdMm: 1.6,
    cutClearanceMm: 2.0,
    creaseClearanceMm: 1.5,
  });

  assert.equal(res.schema, 'packsignal-pdf-preflight/v1');
  assert.ok(res.checks.length > 50, `Expected > 50 checks, got ${res.checks.length}`);
  assert.ok(res.findings.length > 0, 'Expected findings to be generated');

  // Verify coverage summary
  assert.ok(res.coverage.totalSpansInspected > 100);
  assert.ok(res.coverage.dielineSegmentsInspected > 0);
  assert.equal(res.coverage.parser, 'PyMuPDF (fitz)');

  // Verify finding properties
  const sampleFinding = res.findings[0];
  assert.ok(sampleFinding.id);
  assert.ok(sampleFinding.key.startsWith('pdf-preflight:'));
  assert.ok(sampleFinding.title.startsWith('[PREPRESS SCREENING]'));
  assert.ok(sampleFinding.evidence[0].box);
  assert.equal(sampleFinding.method, 'pdf_preflight_screening');

  // Verify report generation includes PDF preflight section
  review.pdfPreflight = res;
  review.findings = res.findings;
  const html = await createHtmlReport(review);
  assert.ok(html.includes('PDF Visibility &amp; Typography Preflight Screening'));
  assert.ok(html.includes('Prepress Screening Disclaimer'));
  assert.ok(html.includes('PREPRESS SCREENING'));
});
