/**
 * PackSignal Trust Console Test Runner & Diagnostic Evaluator (lib/trust-console/runner.mjs)
 * Phase 8: Executes evaluation suites, computes scoreboard metrics ("caught X of Y"),
 * and produces detailed root-cause diagnostic explanations for every miss or deviation.
 */

import { performance } from 'node:perf_hooks';
import { analyze, compareRevisions } from '../engine.mjs';
import { BASELINE_CASES } from './generator.mjs';

function buildSyntheticReview(testCase, artworkLines = testCase.artwork) {
  const field = testCase.field || 'storage_statement';
  const comparison = testCase.kind === 'quantity' ? 'quantity_equivalence' : testCase.kind === 'uncompiled' ? 'uncompiled' : 'exact_copy';
  const expected = field.startsWith('nutrition.') ? null : testCase.reference;
  const rule = {
    id: `EVAL-${testCase.id || '01'}`,
    title: `Evaluation · ${testCase.id}`,
    field,
    comparison,
    text: `Compare the ${field} with the supplied specification reference.`,
    literal_expected: expected ?? null,
    citation: testCase.statutoryRule || '21 CFR §101',
    authority: 'Food and Drug Administration (FDA)'
  };
  const rules = {
    id: 'rules',
    name: 'evaluation-rules.json',
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
        name: `approved-spec-${index + 1}.json`,
        role: 'spec',
        text: `${field}: ${value ?? ''}`,
        lines: [],
        pages: [],
        cells: [],
        data: { status: 'APPROVED', product, nutrition }
      });
    });
  }

  const lines = (artworkLines || []).map((text, index) => ({
    text,
    page: 1,
    line: index + 1,
    box: [0.1, 0.08 + index * 0.07, 0.82, 0.12 + index * 0.07]
  }));

  const artwork = {
    id: 'art',
    name: 'synthetic-artwork.pdf',
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
    nutritionBasisConfirmed: testCase.nutritionConfirmed !== false
  };

  return {
    id: `eval-${testCase.id}`,
    documents: [artwork, ...sourceDocuments, rules],
    options,
    decisions: {},
    audit: []
  };
}

/**
 * Diagnoses why a test case failed or deviated from expectation.
 */
function explainOutcome(testCase, actual, finding) {
  if (actual === testCase.expected) {
    if (actual === 'issue') {
      return `Successfully caught planted defect: ${testCase.description || 'Discrepancy verified against reference'}.`;
    }
    if (actual === 'match') {
      return `Verified clean packaging match without false alarm: ${testCase.description || 'Matches specification'}.`;
    }
    if (actual === 'review') {
      return `Correctly abstained on ambiguous or conflicting sources: ${testCase.description || 'Routed to human reviewer'}.`;
    }
    return `Safely handled incomplete extractions as unable: ${testCase.description || 'No false claim of compliance'}.`;
  }

  // Root-cause diagnosis for misses:
  if (testCase.expected === 'issue' && actual === 'match') {
    return `CRITICAL MISS: Expected defect detection, but engine evaluated as clean match. Probable normalization loophole or fuzzy match over-permissiveness.`;
  }
  if (testCase.expected === 'issue' && actual === 'unable') {
    return `MISSED DEFECT (Abstained as Unable): Engine lacked confirmed panel completeness or readable text bounding box for ${testCase.field}. In production, check panel crop quality.`;
  }
  if (testCase.expected === 'issue' && actual === 'review') {
    return `PARTIAL MISS (Routed to Review): Planted defect was flagged for human review rather than automatic rejection because reference authority was unconfirmed.`;
  }
  if (testCase.expected === 'match' && actual === 'issue') {
    return `FALSE ALARM: Clean packaging falsely flagged as defect. Observed: "${finding?.observed}", Expected: "${finding?.expected}". Check whitespace or unit math tolerance.`;
  }
  return `Outcome mismatch: Expected "${testCase.expected}", got "${actual}". Explanation: ${finding?.explanation || 'No detailed diagnostic available'}.`;
}

/**
 * Runs the self-test evaluation suite.
 *
 * @param {Array<Object>} [testCases]
 * @param {Object} [options]
 * @returns {Object} Scorecard results, metrics, and diagnostics
 */
export function runTrustEvaluation(testCases = BASELINE_CASES, options = {}) {
  const started = performance.now();
  const cases = Array.isArray(testCases) && testCases.length ? testCases : BASELINE_CASES;

  const outcomes = [];
  let totalAnalysisMs = 0;

  for (const testCase of cases) {
    const t0 = performance.now();
    let actual, finding = null;

    if (testCase.kind === 'revision') {
      const before = analyze(buildSyntheticReview(testCase, testCase.before));
      const after = analyze(buildSyntheticReview(testCase, testCase.after));
      const revision = compareRevisions(
        { id: 'before', findings: before.findings },
        { id: 'after', findings: after.findings }
      );
      actual = revision.changes.find(change => change.change === 'new_issue')?.change || revision.changes[0]?.change || 'unchanged';
    } else {
      const reviewResult = analyze(buildSyntheticReview(testCase));
      finding = reviewResult.findings.find(item => item.rule?.id === `rules:EVAL-${testCase.id || '01'}`) || reviewResult.findings[0];
      actual = finding?.status || 'missing';
    }

    const elapsedMs = Number((performance.now() - t0).toFixed(2));
    totalAnalysisMs += elapsedMs;

    const pass = actual === testCase.expected;
    const diagnostic = explainOutcome(testCase, actual, finding);

    outcomes.push({
      id: testCase.id,
      name: testCase.name || testCase.id,
      group: testCase.group,
      category: testCase.category || 'general',
      severity: testCase.severity || 'medium',
      statutoryRule: testCase.statutoryRule || '21 CFR §101',
      expected: testCase.expected,
      actual,
      pass,
      elapsedMs,
      observed: finding?.observed || null,
      reference: testCase.reference || finding?.expected || null,
      explanation: finding?.explanation || '',
      diagnostic,
    });
  }

  // Calculate Metrics
  const defectCases = outcomes.filter(o => o.group === 'defect');
  const cleanCases = outcomes.filter(o => o.group === 'clean');
  const ambiguousCases = outcomes.filter(o => o.group === 'ambiguous');
  const unreadableCases = outcomes.filter(o => o.group === 'unreadable');

  const defectsTotal = defectCases.length;
  const defectsCaught = defectCases.filter(o => o.actual === 'issue').length;
  const defectRecallPct = defectsTotal > 0 ? Number(((defectsCaught / defectsTotal) * 100).toFixed(1)) : 100.0;

  const falseAlarms = cleanCases.filter(o => o.actual === 'issue').length;
  const cleanPassRate = cleanCases.length > 0 ? Number((((cleanCases.length - falseAlarms) / cleanCases.length) * 100).toFixed(1)) : 100.0;

  const safeAbstentions = ambiguousCases.filter(o => o.actual === 'review').length;
  const safeAbstentionRate = ambiguousCases.length > 0 ? Number(((safeAbstentions / ambiguousCases.length) * 100).toFixed(1)) : 100.0;

  const unreadableHandled = unreadableCases.filter(o => o.actual === 'unable').length;
  const unreadableRate = unreadableCases.length > 0 ? Number(((unreadableHandled / unreadableCases.length) * 100).toFixed(1)) : 100.0;

  const truePositives = defectsCaught;
  const falsePositives = falseAlarms;
  const precision = (truePositives + falsePositives) > 0
    ? Number(((truePositives / (truePositives + falsePositives)) * 100).toFixed(1))
    : 100.0;

  const f1 = (precision + defectRecallPct) > 0
    ? Number(((2 * precision * defectRecallPct) / (precision + defectRecallPct)).toFixed(1))
    : 0;

  const totalTimeMs = Number((performance.now() - started).toFixed(2));
  const avgLatencyMs = Number((totalAnalysisMs / cases.length).toFixed(2));

  const misses = outcomes.filter(o => !o.pass);

  return {
    timestamp: new Date().toISOString(),
    totalCases: cases.length,
    scorecard: {
      headline: `Caught ${defectsCaught} of ${defectsTotal} Planted Defects`,
      defectsTotal,
      defectsCaught,
      defectRecallRate: `${defectRecallPct}%`,
      falseAlarms,
      falseAlarmRate: `${((falseAlarms / (cleanCases.length || 1)) * 100).toFixed(1)}%`,
      precision: `${precision}%`,
      f1Score: `${f1}%`,
      cleanPassRate: `${cleanPassRate}%`,
      safeAbstentions: `${safeAbstentions} / ${ambiguousCases.length}`,
      safeAbstentionRate: `${safeAbstentionRate}%`,
      unreadableHandled: `${unreadableHandled} / ${unreadableCases.length}`,
      avgLatencyMs,
      totalTimeMs,
      passedTests: outcomes.filter(o => o.pass).length,
      totalTests: outcomes.length,
      allPassed: misses.length === 0,
    },
    missesCount: misses.length,
    misses: misses.map(m => ({
      id: m.id,
      name: m.name,
      category: m.category,
      expected: m.expected,
      actual: m.actual,
      statutoryRule: m.statutoryRule,
      diagnostic: m.diagnostic,
    })),
    outcomes,
  };
}
