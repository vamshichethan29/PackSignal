/**
 * PackSignal Evaluation Metrics Calculator (lib/evaluation/metrics.mjs)
 * Phase 8: Rigorous metrics calculation implementing standard Precision, Recall, F1,
 * "Caught X of Y", and Trust Quality metrics with transparent zero-denominator handling.
 */

import { OUTCOME_CATEGORIES, EXPECTED_OUTCOMES } from './case-schema.mjs';

/**
 * Calculates precision, recall, F1, and trust scoreboard metrics from case results.
 *
 * @param {Array<Object>} caseOutcomes - Array of { evalCase, matchedResult, elapsedMs }
 * @returns {Object} Metric summary and breakdown
 */
export function computeEvaluationMetrics(caseOutcomes = []) {
  const eligibleCases = caseOutcomes.filter(
    item => item.matchedResult.classification !== OUTCOME_CATEGORIES.INVALID_FIXTURE
  );

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  let correctAbstentions = 0;
  let ambiguousTotal = 0;
  let unverifiableTotal = 0;
  let correctUnverifiable = 0;
  let evidenceValidCount = 0;
  let totalLatencyMs = 0;

  // Defect cases denominator Y and numerator X
  let brokenCasesAttempted = 0;
  let brokenCasesCaught = 0;
  let cleanCasesTotal = 0;

  for (const item of eligibleCases) {
    const classification = item.matchedResult.classification;
    const expected = item.evalCase.expectedOutcome;
    totalLatencyMs += item.elapsedMs || 0;

    // Check if this was an eligible defect case
    if (expected === EXPECTED_OUTCOMES.ISSUE) {
      brokenCasesAttempted++;
      if (classification === OUTCOME_CATEGORIES.CORRECT_DETECTION) {
        tp++;
        brokenCasesCaught++;
        evidenceValidCount++;
      } else {
        fn++;
      }
    } else if (expected === EXPECTED_OUTCOMES.MATCH) {
      cleanCasesTotal++;
      if (classification === OUTCOME_CATEGORIES.TRUE_NEGATIVE) {
        tn++;
      } else if (classification === OUTCOME_CATEGORIES.FALSE_POSITIVE) {
        fp++;
      }
    } else if (expected === EXPECTED_OUTCOMES.REVIEW) {
      ambiguousTotal++;
      if (classification === OUTCOME_CATEGORIES.CORRECT_ABSTENTION) {
        correctAbstentions++;
      }
    } else if (expected === EXPECTED_OUTCOMES.UNABLE) {
      unverifiableTotal++;
      if (classification === OUTCOME_CATEGORIES.CORRECT_ABSTENTION) {
        correctUnverifiable++;
      }
    }
  }

  // Precision = TP / (TP + FP)
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : null;

  // Recall = TP / (TP + FN)
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : null;

  // F1 = 2 * (P * R) / (P + R)
  const f1 = (precision !== null && recall !== null && (precision + recall) > 0)
    ? (2 * precision * recall) / (precision + recall)
    : null;

  // Specificity = TN / (TN + FP)
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : null;

  // False Positive Rate = FP / (FP + TN)
  const falsePositiveRate = (fp + tn) > 0 ? fp / (fp + tn) : null;

  // Safe Abstention Rate = correct / ambiguous
  const safeAbstentionRate = ambiguousTotal > 0 ? correctAbstentions / ambiguousTotal : null;

  // Evidence validity rate for caught defects
  const evidenceValidityRate = brokenCasesCaught > 0 ? evidenceValidCount / brokenCasesCaught : null;

  const avgLatencyMs = eligibleCases.length > 0
    ? Number((totalLatencyMs / eligibleCases.length).toFixed(2))
    : 0;

  const formatPct = val => val === null ? 'N/A' : `${(val * 100).toFixed(1)}%`;

  return {
    caughtHeadline: `CAUGHT ${brokenCasesCaught} OF ${brokenCasesAttempted} DELIBERATELY BROKEN TEST CASES`,
    caughtX: brokenCasesCaught,
    attemptedY: brokenCasesAttempted,
    detectionRate: brokenCasesAttempted > 0 ? Number(((brokenCasesCaught / brokenCasesAttempted) * 100).toFixed(1)) : 0,
    counts: {
      tp,
      fp,
      fn,
      tn,
      correctAbstentions,
      ambiguousTotal,
      unverifiableTotal,
      cleanCasesTotal,
      totalEligible: eligibleCases.length,
      invalidFixturesExcluded: caseOutcomes.length - eligibleCases.length,
    },
    metrics: {
      precision: formatPct(precision),
      recall: formatPct(recall),
      f1Score: formatPct(f1),
      specificity: formatPct(specificity),
      falsePositiveRate: formatPct(falsePositiveRate),
      cleanAccuracy: cleanCasesTotal > 0 ? formatPct(tn / cleanCasesTotal) : 'N/A',
      safeAbstentionRate: formatPct(safeAbstentionRate),
      evidenceValidityRate: formatPct(evidenceValidityRate),
      avgLatencyMs,
      totalLatencyMs: Number(totalLatencyMs.toFixed(2)),
    },
    raw: {
      precision,
      recall,
      f1,
      specificity,
      falsePositiveRate,
      safeAbstentionRate,
      evidenceValidityRate,
    },
  };
}
