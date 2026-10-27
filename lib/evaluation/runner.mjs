/**
 * PackSignal Evaluation Suite Runner (lib/evaluation/runner.mjs)
 * Phase 8: Executes controlled test cases against the deterministic engine and AI pipeline,
 * strictly protects ground truth from leakage, matches findings, and computes trust metrics.
 */

import { performance } from 'node:perf_hooks';
import { analyze, compareRevisions } from '../engine.mjs';
import { matchCaseOutcome } from './case-matcher.mjs';
import { computeEvaluationMetrics } from './metrics.mjs';
import { diagnoseCaseFailure } from './failure-analysis.mjs';
import { validateFixtureIntegrity } from './truth-validator.mjs';
import { generateEvaluationSuite } from './fixture-generator.mjs';

/**
 * Builds an isolated review input structure for a test case without leaking ground truth.
 */
export function buildIsolatedReviewInput(testCase, artworkLines = testCase.artwork) {
  const field = testCase.expectedField || testCase.field || 'storage_statement';
  const comparison = testCase.kind === 'quantity' ? 'quantity_equivalence' : testCase.kind === 'uncompiled' ? 'uncompiled' : 'exact_copy';
  const expected = field.startsWith('nutrition.') ? null : testCase.reference;

  // Evaluation rule given to the engine (the specification requirement)
  const rule = {
    id: testCase.expectedRuleId || `EVAL-${testCase.caseId}`,
    title: `Statutory Check · ${field}`,
    field,
    comparison,
    text: `Verify that ${field} on artwork matches approved specification reference.`,
    literal_expected: expected ?? null,
    citation: testCase.statutoryRule || '21 CFR §101',
    authority: 'Food and Drug Administration (FDA)'
  };

  const rulesDoc = {
    id: 'rules-doc',
    name: 'statutory-rules.json',
    role: 'rules',
    text: rule.text,
    lines: [],
    pages: [],
    cells: [],
    data: { rules: [rule] }
  };

  const sourceDocuments = [];
  const references = testCase.references || (testCase.reference ? [testCase.reference] : []);
  if (testCase.kind !== 'missing-reference') {
    references.forEach((value, index) => {
      const product = {};
      const nutrition = {};
      if (field.startsWith('nutrition.')) {
        nutrition[field.slice(10)] = Number.parseFloat(value) || value;
      } else if (value !== undefined) {
        product[field] = value;
      }
      sourceDocuments.push({
        id: `spec-${index}`,
        name: `approved-specification-${index + 1}.json`,
        role: 'spec',
        text: `${field}: ${value ?? ''}`,
        lines: [],
        pages: [],
        cells: [],
        data: { status: 'APPROVED', product, nutrition }
      });
    });
  }

  const lines = (artworkLines || []).map((text, idx) => ({
    text,
    page: 1,
    line: idx + 1,
    box: [0.1, 0.08 + idx * 0.07, 0.82, 0.12 + idx * 0.07]
  }));

  const artworkDoc = {
    id: 'artwork-doc',
    name: 'packaging-artwork.pdf',
    role: 'artwork',
    text: lines.map(line => line.text).join('\n'),
    lines,
    pages: [{ number: 1, width: 1200, height: 860, image: 'page.png', method: 'pdf_text' }],
    cells: [],
    data: null
  };

  const options = {
    completeArtwork: testCase.complete !== false,
    netQuantityConfirmed: testCase.netConfirmed !== false,
    nutritionBasisConfirmed: testCase.nutritionConfirmed !== false,
  };

  return {
    id: `eval-run-${testCase.caseId}`,
    documents: [artworkDoc, ...sourceDocuments, rulesDoc],
    options,
    decisions: {},
    audit: []
  };
}

/**
 * Runs evaluation on a suite of cases.
 *
 * @param {Array<Object>} [cases]
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Callback for streaming progress
 * @param {string} [options.category] - Filter by mutation category
 * @param {string} [options.caseId] - Run single case
 * @param {string} [options.mode='deterministic'] - 'deterministic' | 'full' | 'ai'
 * @param {string} [options.modelId='deterministic-local-engine']
 * @returns {Object} Complete evaluation scorecard and diagnostic results
 */
export function runEvaluationSuite(cases = null, options = {}) {
  const startedAt = performance.now();
  const suiteCases = cases && cases.length ? cases : generateEvaluationSuite({ count: 21, seed: options.seed || 42 });

  let filtered = suiteCases;
  if (options.category && options.category !== 'all') {
    filtered = filtered.filter(c => c.category === options.category);
  }
  if (options.caseId) {
    filtered = filtered.filter(c => c.caseId === options.caseId);
  }

  const caseOutcomes = [];
  const diagnostics = [];
  let totalAnalysisMs = 0;

  for (let i = 0; i < filtered.length; i++) {
    const testCase = filtered[i];

    if (typeof options.onProgress === 'function') {
      options.onProgress({
        current: i + 1,
        total: filtered.length,
        caseId: testCase.caseId,
        category: testCase.category,
        percent: Math.round(((i + 1) / filtered.length) * 100),
        stage: 'ANALYZING',
      });
    }

    // Step 1: Pre-evaluation fixture integrity check
    const integrity = validateFixtureIntegrity(testCase);
    if (!integrity.valid) {
      caseOutcomes.push({
        evalCase: testCase,
        matchedResult: {
          classification: 'INVALID_FIXTURE',
          matched: false,
          finding: null,
          reason: integrity.reasons.join('; '),
        },
        elapsedMs: 0,
      });
      continue;
    }

    // Step 2: Build isolated review and run analysis
    const t0 = performance.now();
    let reviewResult = null;

    try {
      if (testCase.kind === 'revision') {
        const before = analyze(buildIsolatedReviewInput(testCase, testCase.before));
        const after = analyze(buildIsolatedReviewInput(testCase, testCase.after));
        const revision = compareRevisions(
          { id: 'before', findings: before.findings },
          { id: 'after', findings: after.findings }
        );
        const changeFinding = revision.changes.find(c => c.change === 'new_issue') || revision.changes[0];
        reviewResult = {
          findings: [{
            status: changeFinding?.change === 'new_issue' ? 'issue' : 'match',
            explanation: changeFinding?.summary || 'Revision comparison',
            field: testCase.expectedField,
            observed: changeFinding?.summary,
          }],
        };
      } else {
        const review = buildIsolatedReviewInput(testCase);
        reviewResult = analyze(review);
      }
    } catch (err) {
      reviewResult = { error: err };
    }

    const elapsedMs = Number((performance.now() - t0).toFixed(2));
    totalAnalysisMs += elapsedMs;

    // Step 3: Match outcome strictly
    const matched = matchCaseOutcome(testCase, reviewResult);

    // Step 4: Root cause diagnosis
    const diag = diagnoseCaseFailure(testCase, matched, reviewResult);

    caseOutcomes.push({
      evalCase: testCase,
      matchedResult: matched,
      elapsedMs,
      finding: matched.finding,
      diagnostic: diag,
    });

    diagnostics.push(diag);
  }

  // Step 5: Compute metrics
  const metrics = computeEvaluationMetrics(caseOutcomes);
  const wallClockMs = Number((performance.now() - startedAt).toFixed(2));

  // Category breakdown
  const categoryMap = {};
  for (const item of caseOutcomes) {
    const cat = item.evalCase.category || 'general';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { total: 0, caught: 0, misses: 0, cleanPassed: 0, falseAlarms: 0 };
    }
    categoryMap[cat].total++;
    const cls = item.matchedResult.classification;
    if (cls === 'CORRECT_DETECTION') categoryMap[cat].caught++;
    else if (cls === 'MISSED_DEFECT' || cls === 'INCORRECT_ABSTENTION') categoryMap[cat].misses++;
    else if (cls === 'TRUE_NEGATIVE') categoryMap[cat].cleanPassed++;
    else if (cls === 'FALSE_POSITIVE') categoryMap[cat].falseAlarms++;
  }

  const misses = caseOutcomes.filter(o => !o.matchedResult.matched && o.matchedResult.classification !== 'INVALID_FIXTURE');

  return {
    runId: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    suiteVersion: '1.0.0-freeze',
    mode: options.mode || 'deterministic',
    modelId: options.modelId || 'deterministic-local-engine',
    totalCases: filtered.length,
    wallClockMs,
    avgLatencyMs: metrics.metrics.avgLatencyMs,
    scoreboard: {
      headline: metrics.caughtHeadline,
      caughtX: metrics.caughtX,
      attemptedY: metrics.attemptedY,
      detectionRate: metrics.detectionRate,
      precision: metrics.metrics.precision,
      recall: metrics.metrics.recall,
      f1Score: metrics.metrics.f1Score,
      falsePositiveRate: metrics.metrics.falsePositiveRate,
      cleanAccuracy: metrics.metrics.cleanAccuracy,
      safeAbstentionRate: metrics.metrics.safeAbstentionRate,
      evidenceValidityRate: metrics.metrics.evidenceValidityRate,
    },
    counts: metrics.counts,
    categories: categoryMap,
    missesCount: misses.length,
    misses: misses.map(m => m.diagnostic),
    outcomes: caseOutcomes.map(o => ({
      caseId: o.evalCase.caseId,
      name: o.evalCase.name,
      category: o.evalCase.category,
      expected: o.evalCase.expectedOutcome,
      actual: o.matchedResult.finding?.status || 'missing',
      classification: o.matchedResult.classification,
      pass: o.matchedResult.matched,
      elapsedMs: o.elapsedMs,
      observed: o.matchedResult.finding?.observed || null,
      explanation: o.matchedResult.finding?.explanation || '',
      diagnostic: o.diagnostic.diagnosticExplanation,
      failureCategory: o.diagnostic.failureCategory,
    })),
  };
}
