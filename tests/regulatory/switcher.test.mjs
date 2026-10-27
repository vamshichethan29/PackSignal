/**
 * PackSignal Multi-Jurisdiction Regulatory Switcher Test Suite (tests/regulatory/switcher.test.mjs)
 * Tests instant switching, caching, Target vs Preview mode, Market Worklist,
 * effective-date invalidation, CV symbol linking, and report integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJurisdiction, evaluateAllMarkets, clearEvaluationCache } from '../../lib/regulatory/evaluator.mjs';
import { createHtmlReport } from '../../lib/html-report.mjs';

function createMockReview(customText = '') {
  return {
    id: 'test-switcher-rev-1',
    name: 'Dancing Fish Berry Crunch Granola',
    createdAt: '2026-10-24T12:00:00Z',
    documents: [
      {
        id: 'doc-art-1',
        role: 'artwork',
        name: 'DancingFish_Granola_Carton.pdf',
        sha256: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
        text: customText || [
          'Dancing Fish Berry Crunch Granola',
          'Nutrition Facts',
          'Serving size 55g',
          'Calories 210',
          'Includes 12g Added Sugars',
          'Sodium 140mg 6%',
          'Ingredients: Rolled oats, cane sugar, berries, sesame oil.',
          'Contains: Sesame.',
          'Net Wt 16 oz (454 g)',
          'Manufactured by Dancing Fish Foods, Seattle, WA 98101',
        ].join('\n'),
        pages: [
          { number: 1, method: 'pdf_text', image: 'page-1.png' }
        ],
      },
      {
        id: 'doc-spec-1',
        role: 'spec',
        name: 'DancingFish_Content_Sheet.xlsx',
        sha256: 'b2c3d4e5f6a17890123456789012345678901234567890123456789012345678',
      }
    ],
    findings: [],
    counts: { issue: 0, review: 0, match: 0, unable: 0 },
    options: {},
    audit: [],
  };
}

test('1. Instant Switcher: Switching between USA, EU, and India preserves files and runs deterministic checks', () => {
  clearEvaluationCache();
  const review = createMockReview();

  // Evaluate USA
  const usRes = evaluateJurisdiction(review, 'us', { effectiveDate: '2026-10-23' });
  assert.equal(usRes.jurisdiction, 'us');
  assert.ok(usRes.findings.length > 0);
  const usPanel = usRes.findings.find(f => f.key.includes('PANEL'));
  assert.equal(usPanel.status, 'match');

  // Switch to EU without modifying review files
  const euRes = evaluateJurisdiction(review, 'eu', { effectiveDate: '2026-10-23' });
  assert.equal(euRes.jurisdiction, 'eu');
  assert.ok(euRes.findings.length > 0);
  // US artwork has "Serving size 55g" but lacks mandatory "per 100g" EU declaration
  const euBasis = euRes.findings.find(f => f.key.includes('BASIS'));
  assert.equal(euBasis.status, 'issue');
  assert.match(euBasis.expected, /Article 32\(2\)/);

  // Switch to India without modifying review files
  const inRes = evaluateJurisdiction(review, 'india', { effectiveDate: '2026-10-23' });
  assert.equal(inRes.jurisdiction, 'india');
  assert.ok(inRes.findings.length > 0);
  // US artwork lacks statutory Indian veg/non-veg mark
  const inVeg = inRes.findings.find(f => f.key.includes('VEG-MARK'));
  assert.equal(inVeg.status, 'issue');
  assert.match(inVeg.explanation, /green circle in square or brown triangle in square/);
});

test('2. Caching: Repeated jurisdiction evaluation uses cached results for zero-latency response', () => {
  clearEvaluationCache();
  const review = createMockReview();

  const eval1 = evaluateJurisdiction(review, 'us', { effectiveDate: '2026-10-23' });
  const eval2 = evaluateJurisdiction(review, 'us', { effectiveDate: '2026-10-23' });
  assert.strictEqual(eval1, eval2, 'Second evaluation should return identical cached object reference');
});

test('3. Cache Invalidation: Changing effective date invalidates cache and updates future provisions', () => {
  clearEvaluationCache();
  const review = createMockReview();

  // In Oct 2026, FSSAI First Amendment 2026 is future_requirement
  const oct2026 = evaluateJurisdiction(review, 'india', { effectiveDate: '2026-10-23' });
  const fopnlOct = oct2026.findings.find(f => f.key.includes('FOPNL'));
  assert.equal(fopnlOct.applicability, 'future_requirement');

  // In July 2027, the same rule becomes active law
  const jul2027 = evaluateJurisdiction(review, 'india', { effectiveDate: '2027-07-01' });
  assert.notStrictEqual(oct2026, jul2027);
  const fopnlJul = jul2027.findings.find(f => f.key.includes('FOPNL'));
  assert.equal(fopnlJul.applicability, 'applicable');
});

test('4. Modes: Target Market Review vs Cross-Market What-If Preview', () => {
  clearEvaluationCache();
  const review = createMockReview();

  // Target Mode: Evaluated as target market product -> per-serving without per-100 is an issue (non-compliance)
  const targetEu = evaluateJurisdiction(review, 'eu', { mode: 'target', effectiveDate: '2026-10-23' });
  const targetBasis = targetEu.findings.find(f => f.key.includes('BASIS'));
  assert.equal(targetBasis.status, 'issue');
  assert.equal(targetEu.mode, 'target');

  // Preview Mode: What-if preview for artwork designed for another market -> discrepancy marked for adaptation, not illegal
  const previewEu = evaluateJurisdiction(review, 'eu', { mode: 'preview', effectiveDate: '2026-10-23' });
  const previewBasis = previewEu.findings.find(f => f.key.includes('BASIS'));
  assert.equal(previewBasis.status, 'review');
  assert.match(previewBasis.title, /Adaptation for European Union/);
  assert.match(previewBasis.explanation, /Cross-Market What-If/);
  assert.equal(previewBasis.applicability, 'preview_adaptation');
  assert.equal(previewEu.counts.issue, 0, 'In preview mode, defects are not labeled as illegal product failures');
});

test('5. Market Readiness Worklist: Generates structured action items and exportable designer handoff', () => {
  clearEvaluationCache();
  const review = createMockReview();

  const euEval = evaluateJurisdiction(review, 'eu', { mode: 'target', effectiveDate: '2026-10-23' });
  assert.ok(euEval.worklist);
  assert.ok(Array.isArray(euEval.worklist.satisfied));
  assert.ok(Array.isArray(euEval.worklist.discrepancies));
  assert.ok(Array.isArray(euEval.worklist.humanVerificationNeeded));
  assert.ok(typeof euEval.worklist.designerHandoff === 'string');

  // Verify designer handoff contains markdown sections and disclaimer
  assert.match(euEval.worklist.designerHandoff, /# PackSignal Prepress Regulatory Handoff/);
  assert.match(euEval.worklist.designerHandoff, /Required Artwork Actions/);
  assert.match(euEval.worklist.designerHandoff, /Regulatory Notice:/);
});

test('6. Computer Vision Symbol Candidate: Links detected symbol candidates to India FSSAI findings', () => {
  clearEvaluationCache();
  const review = createMockReview();
  // Attach simulated CV detected symbol from lib/regulatory-symbols.py
  review.regulatorySymbols = [
    {
      symbol_type: 'fssai_veg',
      shape: 'circle',
      page: 1,
      box: [0.12, 0.45, 0.22, 0.55],
      confidence: 0.94,
    }
  ];

  const inEval = evaluateJurisdiction(review, 'india', { effectiveDate: '2026-10-23' });
  const vegFinding = inEval.findings.find(f => f.key.includes('VEG-MARK'));
  assert.equal(vegFinding.status, 'match');
  assert.match(vegFinding.observed, /Vegetarian symbol/);
  assert.deepEqual(vegFinding.evidence[0].box, [0.12, 0.45, 0.22, 0.55]);
});

test('7. Report Integration: HTML report includes regulatory review section and disclaimer', async () => {
  const review = createMockReview();
  review.regulatory = evaluateJurisdiction(review, 'us', { effectiveDate: '2026-10-23' });
  review.regulatoryComparison = evaluateAllMarkets(review, { effectiveDate: '2026-10-23' });

  const html = await createHtmlReport(review, '/tmp');
  assert.match(html, /Multi-Jurisdiction Regulatory Review/);
  assert.match(html, /US Food and Drug Administration \(FDA\)/);
  assert.match(html, /Cross-Market Comparison Matrix \(USA vs\. EU vs\. India\)/);
  assert.match(html, /PackSignal is an automated quality inspection and discrepancy detection aid/);
});
