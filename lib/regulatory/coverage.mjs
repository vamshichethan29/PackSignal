/**
 * PackSignal Regulatory Coverage Ledger (lib/regulatory/coverage.mjs)
 * Implements Phase 24: "How Much Did We Actually Check?"
 * Transparently distinguishes executed rules, manual review rules,
 * blocked rules, unsupported rules, and not-applicable exemptions.
 */

export function computeRuleCoverageLedger(rules = [], findings = [], facts = []) {
  const totalCandidates = rules.length;
  let verifiedQuotations = 0;
  let approvedRules = 0;
  let appliedRules = 0;
  let manualReviewRules = 0;
  let blockedRules = 0;
  let unsupportedRules = 0;
  let notApplicableRules = 0;
  let rulesWithLocatedEvidence = 0;
  let rulesWithoutLocatedEvidence = 0;

  for (const rule of rules) {
    if (rule.quoteVerified || rule.trustState?.sourceVerification === 'VERIFIED_QUOTATION') {
      verifiedQuotations++;
    }
    if (rule.approved || rule.trustState?.reviewerAuthorization === 'APPROVED') {
      approvedRules++;
    }
    if (rule.applicability === 'not_applicable' || rule.trustState?.execution === 'NOT_APPLICABLE' || rule.notApplicable) {
      notApplicableRules++;
      continue;
    }
    if (rule.trustState?.execution === 'UNSUPPORTED' || rule.comparison === 'uncompiled' || rule.unsupported || rule.verdict === 'unsupported') {
      unsupportedRules++;
      continue;
    }
    if (rule.blockers?.length || rule.trustState?.execution === 'NOT_APPLIED' || rule.blocked || rule.verdict === 'unable' || rule.executionState === 'blocked') {
      blockedRules++;
      continue;
    }
    if (rule.manualReview || rule.verdict === 'review' || rule.trustState?.execution === 'NEEDS_MANUAL_REVIEW') {
      manualReviewRules++;
    } else {
      appliedRules++;
    }

    // Check artwork evidence linkage
    const linkedFinding = findings.find(f => f.rule?.id === rule.ruleId || f.rule?.id === rule.id);
    const hasArtworkBox = (Array.isArray(rule.evidenceBox) && rule.evidenceBox.length > 0) ||
      linkedFinding?.evidence?.some(e => e.role === 'artwork' && e.page && Array.isArray(e.box));

    if (hasArtworkBox) {
      rulesWithLocatedEvidence++;
    } else {
      rulesWithoutLocatedEvidence++;
    }
  }

  return {
    totalCandidateRequirements: totalCandidates,
    verifiedSourceQuotations: verifiedQuotations,
    approvedRules,
    appliedRules,
    manualReviewRules,
    blockedRules,
    unsupportedRules,
    notApplicableRules,
    rulesWithLocatedEvidence,
    rulesWithoutLocatedEvidence,
    counts: {
      total: totalCandidates,
      executed: appliedRules,
      manual: manualReviewRules,
      blocked: blockedRules,
      unsupported: unsupportedRules,
      exempt: notApplicableRules,
    },
    coverageSummary: `Executed: ${appliedRules} · Manual Review: ${manualReviewRules} · Blocked: ${blockedRules} · Unsupported: ${unsupportedRules} · Exempt: ${notApplicableRules} (out of ${totalCandidates} total rules)`,
    disclaimer: 'Coverage metrics measure technical execution of defined rules. Technical check completion does not constitute an official FDA compliance certificate or print release authorization.',
  };
}

export const buildRuleCoverageLedger = computeRuleCoverageLedger;

