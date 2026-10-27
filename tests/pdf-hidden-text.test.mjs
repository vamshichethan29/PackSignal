import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPdfPreflight } from '../lib/preflight-engine.mjs';
import { classifyFinding } from '../lib/finding-department-classifier.mjs';
import { generateClarificationMessage } from '../lib/clarification-message.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

test('Hidden PDF Text - Preflight finding generation', async (t) => {
  const mockReview = {
    id: 'rev_hidden_test_1',
    name: 'Dancing Fish Granola',
    documents: [
      {
        id: 'art1',
        role: 'artwork',
        name: 'DancingFish_Granola_Berry_US_Carton.pdf',
        pages: [
          {
            number: 1,
            text: 'US Nutrition Facts\nCalories 166',
            lines: [
              { text: 'US Nutrition Facts', box: [0.1, 0.1, 0.4, 0.15], kind: 'normal' },
              { text: 'Calories 166', box: [0.1, 0.16, 0.4, 0.20], kind: 'normal' }
            ],
            hiddenLines: [
              {
                text: 'Typical Values per 100g',
                box: [0.5, 0.5, 0.8, 0.55],
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
                  box: [0.48, 0.48, 0.82, 0.7]
                }
              },
              {
                text: 'Energy 1868kJ / 445kcal',
                box: [0.5, 0.56, 0.8, 0.60],
                kind: 'hidden',
                page: 1,
                visibility: {
                  state: 'confirmed_hidden',
                  reason: 'opaque_later_painted_shape',
                  paintSequence: 230,
                  coveringSequence: 241,
                  coveredRatio: 0.99,
                  method: 'native_pdf_paint_order'
                },
                occluder: {
                  type: 'filled_path',
                  fill: 'white',
                  opacity: 1.0,
                  seqno: 241,
                  box: [0.48, 0.48, 0.82, 0.7]
                }
              }
            ]
          }
        ]
      }
    ],
    findings: []
  };

  const preflightResult = await runPdfPreflight(mockReview);
  assert.ok(preflightResult.findings, 'Should return preflight findings');

  const hiddenFinding = preflightResult.findings.find(f =>
    f.id?.startsWith('pdf-preflight:hidden-text') || f.method === 'native_pdf_paint_order'
  );

  assert.ok(hiddenFinding, 'Should synthesize a pdf-preflight:hidden-text finding');
  assert.equal(hiddenFinding.status, 'review');
  assert.equal(hiddenFinding.severity, 'minor');
  assert.equal(hiddenFinding.method, 'native_pdf_paint_order');
  assert.ok(hiddenFinding.title.includes('hidden native text'));
  assert.ok(hiddenFinding.explanation.includes('2 declaration(s)'));
  assert.ok(hiddenFinding.explanation.includes('Typical Values per 100g'));

  // Department classification: must route to prepress
  const dept = classifyFinding(hiddenFinding);
  assert.equal(dept.primaryDepartment, 'prepress', 'Hidden native text finding must be assigned to prepress');

  // Clarification Message generation
  const msg = generateClarificationMessage({ finding: hiddenFinding, department: 'Prepress / Production' });
  assert.ok(typeof msg === 'string', 'Message should be a string');
  assert.ok(msg.includes('Hi Prepress Team'), 'Clarification message should address Prepress Team');
  assert.ok(msg.includes('Typical Values per 100g'), 'Clarification message should quote hidden text');
  assert.ok(msg.includes('white') && msg.includes('241'), 'Clarification message should mention occluder');

  // HTML Report generation
  mockReview.findings.push(hiddenFinding);
  const html = await createHtmlReport(mockReview, '/tmp');
  assert.ok(html.includes('PDF Visibility &amp; Opaque Overlay Preflight'), 'Report must include visibility section');
  assert.ok(html.includes('Typical Values per 100g'), 'Report must include hidden text quote');
  assert.ok(html.includes('CONFIRMED_HIDDEN'), 'Report must label state CONFIRMED_HIDDEN');
});
