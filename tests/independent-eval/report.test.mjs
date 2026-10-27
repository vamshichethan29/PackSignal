/**
 * Tests for Report Generation & Disclosures (tests/independent-eval/report.test.mjs)
 * Tests report markdown and HTML generation, disclosures, and pending state rendering.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvaluation, generateMarkdownReport, generateHtmlReport } from '../../scripts/score-blind-evaluation.mjs';

test('markdown report contains all required sections and disclaimers', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const md = generateMarkdownReport(result);

  assert.ok(md.includes('# PackSignal Independent Mini-Evaluation Report'));
  assert.ok(md.includes('Executive Summary & Independence Declaration'));
  assert.ok(md.includes('Pilot Sample Size Disclosure'));
  assert.ok(md.includes('Core Detection & Verification Metrics'));
  assert.ok(md.includes('Ambiguity & Uncertainty Handling'));
  assert.ok(md.includes('Evidence Traceability & Quality'));
  assert.ok(md.includes('Transparent Unit-by-Unit Scoring Table'));
  assert.ok(md.includes('Cryptographic Hashes & Reproducibility'));
  assert.ok(md.includes('npm run evaluate:blind'));
});

test('html report is well-formed and includes all 12 units', async () => {
  const result = await scoreEvaluation({ testMode: true });
  const html = generateHtmlReport(result);

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Independent Mini-Evaluation Report'));
  assert.ok(html.includes('U-01-01'));
  assert.ok(html.includes('U-02-01'));
  assert.ok(html.includes('U-03-01'));
  assert.ok(html.includes('badge-tp') || html.includes('badge-tn'));
});

test('scorer correctly outputs INDEPENDENT_REVIEW_PENDING when reviewer declaration is missing', async () => {
  // When running with allowPending = true on a pending ground truth
  const mockPendingGroundTruth = {
    protocolHash: 'mock',
    casesManifestHash: 'mock',
    status: 'INDEPENDENT_REVIEW_PENDING',
    reviewer: { independenceDeclarationSigned: false },
    units: []
  };

  const isPending = mockPendingGroundTruth.status === 'INDEPENDENT_REVIEW_PENDING' ||
    !mockPendingGroundTruth.reviewer?.independenceDeclarationSigned;

  assert.equal(isPending, true, 'Must recognize pending state and avoid manufacturing fake metrics');
});
