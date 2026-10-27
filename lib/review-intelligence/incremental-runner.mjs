/**
 * PackSignal Review Intelligence — Incremental Selective Recomputation Runner
 * (lib/review-intelligence/incremental-runner.mjs)
 *
 * Implements true selective re-evaluation:
 * Identifies changed source facts, computes dependency closure, re-executes
 * only affected check evaluators, preserves unaffected findings, and marks
 * affected reviewer decisions stale (REVALIDATION_REQUIRED).
 */

import { analyzeChangeImpact } from './impact-analyzer.mjs';

/**
 * Re-executes only affected evaluators for a modified review.
 * @param {Object} params
 * @param {Object} params.previousReview - Complete prior review snapshot
 * @param {Object} params.updatedInputs - Updated documents/facts
 * @param {Function} [params.evaluatorRegistry] - Optional mapping of checkId/type to evaluator function
 * @param {Object} [params.options] - Execution options (e.g. invocation counter callback)
 * @returns {Object} Incremental recomputation result
 */
export async function runIncrementalRecomputation({
  previousReview = {},
  updatedInputs = {},
  evaluatorRegistry = {},
  options = {}
}) {
  const invocationCounters = {
    totalEvaluatorsRegistered: Object.keys(evaluatorRegistry).length,
    evaluatorsInvoked: 0,
    invokedCheckIds: [],
    preservedCheckIds: []
  };

  // 1. Analyze change impact to find affected check IDs and findings
  const impact = analyzeChangeImpact(previousReview, updatedInputs);

  const affectedFindingIds = new Set(impact.affectedFindingIds || []);
  const affectedCheckIds = new Set(impact.affectedCheckIds || []);

  const previousFindings = previousReview.findings || [];
  const updatedFindings = [];

  // 2. Process each finding: recompute if affected, preserve if unaffected
  for (const finding of previousFindings) {
    const isAffected = affectedFindingIds.has(finding.id) || 
      (finding.check && affectedCheckIds.has(finding.check));

    if (isAffected) {
      invocationCounters.evaluatorsInvoked++;
      invocationCounters.invokedCheckIds.push(finding.id);

      const evaluator = evaluatorRegistry[finding.id] || 
        (finding.check ? evaluatorRegistry[finding.check] : null);

      if (typeof evaluator === 'function') {
        const recomputed = await evaluator(finding, updatedInputs, previousReview);
        if (options.onEvaluatorInvoked) {
          options.onEvaluatorInvoked(finding.id, recomputed);
        }
        updatedFindings.push({
          ...finding,
          ...recomputed,
          recomputedAt: new Date().toISOString()
        });
      } else {
        // Fallback: update status to review if source changed without dedicated evaluator
        updatedFindings.push({
          ...finding,
          status: 'review',
          recomputationReason: 'Source dependency changed; requires re-evaluation',
          recomputedAt: new Date().toISOString()
        });
      }
    } else {
      // Unaffected finding is strictly preserved
      invocationCounters.preservedCheckIds.push(finding.id);
      updatedFindings.push({ ...finding });
    }
  }

  // 3. Mark affected reviewer decisions as REVALIDATION_REQUIRED
  const updatedDecisions = { ...(previousReview.decisions || {}) };
  for (const decisionId of impact.affectedDecisionIds || []) {
    if (updatedDecisions[decisionId]) {
      updatedDecisions[decisionId] = {
        ...updatedDecisions[decisionId],
        stale: true,
        revalidationRequired: true,
        staleReason: 'Dependent source fact was modified',
        staleAt: new Date().toISOString()
      };
    }
  }

  // 4. Recompute summary counts
  const counts = {
    issue: updatedFindings.filter(f => f.status === 'issue').length,
    review: updatedFindings.filter(f => f.status === 'review').length,
    match: updatedFindings.filter(f => f.status === 'match').length,
    unable: updatedFindings.filter(f => f.status === 'unable').length,
    total: updatedFindings.length
  };

  return {
    impact,
    findings: updatedFindings,
    decisions: updatedDecisions,
    counts,
    invocationCounters,
    selectiveExecutionVerified: invocationCounters.evaluatorsInvoked === affectedFindingIds.size
  };
}
