import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPdfPreflight } from '../lib/preflight-engine.mjs';
import { classifyFinding } from '../lib/finding-department-classifier.mjs';
import { sealReview, verifyPortableSealProof, reviewSealProof } from '../lib/audit-signature.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

test('PDF Visibility Engine - Full Integration & Audit Integrity', async (t) => {
  // 1. Synthetic packaging document with dual nutrition tables:
  // Visible US Nutrition Facts, Hidden Obsolete EU Table
  const sampleReview = {
    id: 'rev_vis_engine_1',
    name: 'PackSignal Granola Artwork Review',
    market: 'us',
    engine: 'PackSignal Core 2026',
    createdAt: new Date().toISOString(),
    documents: [
      {
        id: 'artwork_doc_1',
        role: 'artwork',
        name: 'Granola_Berry_US_Carton.pdf',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        pages: [
          {
            number: 1,
            // ONLY VISIBLE TEXT in page.text
            text: 'Granola Berry Crunch\nNutrition Facts\n8 servings per container\nServing size 2/3 cup (55g)\nCalories 230\nTotal Fat 8g\nTotal Carbohydrate 37g\nProtein 5g\nNet Wt 14 oz (396g)',
            lines: [
              { text: 'Granola Berry Crunch', box: [0.1, 0.1, 0.5, 0.15], kind: 'normal' },
              { text: 'Nutrition Facts', box: [0.1, 0.2, 0.4, 0.25], kind: 'normal' },
              { text: '8 servings per container', box: [0.1, 0.26, 0.4, 0.3], kind: 'normal' },
              { text: 'Calories 230', box: [0.1, 0.31, 0.4, 0.35], kind: 'normal' },
              { text: 'Net Wt 14 oz (396g)', box: [0.1, 0.8, 0.4, 0.85], kind: 'normal' }
            ],
            // CONFIRMED HIDDEN LINES preserved in hiddenLines
            hiddenLines: [
              {
                text: 'Typical Values per 100g',
                box: [0.6, 0.2, 0.9, 0.25],
                kind: 'hidden',
                page: 1,
                visibility: {
                  state: 'confirmed_hidden',
                  reason: 'opaque_later_painted_shape',
                  paintSequence: 226,
                  coveringSequence: 241,
                  coveredRatio: 0.99,
                  method: 'native_pdf_paint_order'
                },
                occluder: {
                  type: 'filled_path',
                  fill: 'white',
                  opacity: 1.0,
                  seqno: 241,
                  box: [0.58, 0.18, 0.92, 0.55]
                }
              },
              {
                text: 'Energy 1868kJ / 445kcal',
                box: [0.6, 0.26, 0.9, 0.30],
                kind: 'hidden',
                page: 1,
                visibility: {
                  state: 'confirmed_hidden',
                  reason: 'opaque_later_painted_shape',
                  paintSequence: 228,
                  coveringSequence: 241,
                  coveredRatio: 0.99,
                  method: 'native_pdf_paint_order'
                },
                occluder: {
                  type: 'filled_path',
                  fill: 'white',
                  opacity: 1.0,
                  seqno: 241,
                  box: [0.58, 0.18, 0.92, 0.55]
                }
              }
            ]
          }
        ]
      }
    ],
    findings: [],
    counts: { issue: 0, review: 1, unable: 0, match: 2 },
    coverage: { limits: ['Supplied artwork PDF inspected for native vector paint order.'] }
  };

  // Run PDF Preflight
  const preflight = await runPdfPreflight(sampleReview);
  assert.ok(preflight.findings.length > 0);

  const hiddenFinding = preflight.findings.find(f => f.method === 'native_pdf_paint_order');
  assert.ok(hiddenFinding, 'Must identify hidden text finding');
  assert.equal(hiddenFinding.status, 'review');

  // Verify department routing
  const dept = classifyFinding(hiddenFinding);
  assert.equal(dept.primaryDepartment, 'prepress');

  // Append finding and sign report with cryptographic seal
  sampleReview.findings.push(hiddenFinding);
  const tempDir = await mkdtemp(join(tmpdir(), 'seal-test-'));
  sampleReview.signature = await sealReview(sampleReview, tempDir);
  assert.ok(sampleReview.signature.signature, 'Report must be digitally signed');

  // Verify signature verification works
  const proof = { ...reviewSealProof(sampleReview), ...sampleReview.signature };
  const verification = verifyPortableSealProof(proof);
  assert.equal(verification.valid, true, 'Cryptographic seal must be valid and intact');
  await rm(tempDir, { recursive: true, force: true });

  // Verify HTML report renders cleanly
  const html = await createHtmlReport(sampleReview, '/tmp');
  assert.ok(html.includes('PDF Visibility &amp; Opaque Overlay Preflight'));
  assert.ok(html.includes('Typical Values per 100g'));
  assert.ok(html.includes('white'));
  assert.ok(html.includes('CONFIRMED_HIDDEN'));
});
