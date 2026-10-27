/**
 * PackSignal Rule Coverage Ledger (lib/rulebook/coverage.mjs)
 * Implements Step 12: Tracks all rules (compiled, uncompiled, proposed, blocked)
 * and computes honest, real-data coverage metrics.
 */

import {
  SOURCE_VERIFICATION,
  AUTHORIZATION_STATUS,
  APPLICABILITY_STATUS,
  EXECUTION_STATUS,
  EVALUATION_METHOD,
} from './schema.mjs';

/**
 * Builds the complete rule coverage ledger from considered rules and execution records.
 */
export function buildRuleCoverageLedger(rules = [], executionLedger = null) {
  const coverageItems = [];

  let totalRules = 0;
  let verifiedQuotations = 0;
  let unverifiedRules = 0;
  let proposedRules = 0;
  let authorizedRules = 0;
  let applicableRules = 0;
  let supportedChecks = 0;
  let actuallyExecutedRules = 0;
  let blockedRules = 0;
  let manualReviewRules = 0;
  let notApplicableRules = 0;
  let uncompiledRules = 0;

  for (const rule of rules) {
    totalRules++;
    const execRecord = executionLedger ? executionLedger.getRecordForRule(rule.id) : null;

    // Source verification count
    const isQuoteVerified = rule.source?.verificationStatus === SOURCE_VERIFICATION.VERIFIED;
    if (isQuoteVerified) {
      verifiedQuotations++;
    } else {
      unverifiedRules++;
    }

    // Authorization count
    const isAuthorized = rule.authorization?.status === AUTHORIZATION_STATUS.APPROVED;
    if (isAuthorized) {
      authorizedRules++;
    } else if (rule.authorization?.status === AUTHORIZATION_STATUS.PROPOSED) {
      proposedRules++;
    }

    // Applicability count
    const isApplicable = rule.applicability?.status === APPLICABILITY_STATUS.APPLICABLE;
    if (isApplicable) {
      applicableRules++;
    } else if (rule.applicability?.status === APPLICABILITY_STATUS.NOT_APPLICABLE) {
      notApplicableRules++;
    }

    // Compilation / Evaluator Support
    const isCompiled = rule.interpretation?.isCompiled ?? (rule.interpretation?.checkType !== 'MANUAL_REVIEW');
    if (isCompiled) {
      supportedChecks++;
    } else {
      uncompiledRules++;
    }

    // Execution status
    const execStatus = execRecord?.executionStatus || rule.execution?.status || EXECUTION_STATUS.NOT_APPLIED;
    if (execStatus === EXECUTION_STATUS.APPLIED) {
      actuallyExecutedRules++;
    } else if (execStatus === EXECUTION_STATUS.BLOCKED) {
      blockedRules++;
    } else if (execStatus === EXECUTION_STATUS.MANUAL_REVIEW_PENDING || rule.execution?.evaluationMethod === EVALUATION_METHOD.HUMAN_REVIEW) {
      manualReviewRules++;
    }

    coverageItems.push({
      ruleId: rule.id,
      title: rule.title,
      sourceDocument: rule.source?.documentName || 'Unknown Document',
      sourceQuotation: rule.source?.originalQuote || rule.text || '',
      quotationVerification: rule.source?.verificationStatus || SOURCE_VERIFICATION.UNVERIFIED,
      authorizationState: rule.authorization?.status || AUTHORIZATION_STATUS.PROPOSED,
      applicability: rule.applicability?.status || APPLICABILITY_STATUS.UNDETERMINED,
      checkType: rule.interpretation?.checkType || 'REQUIRED_PHRASE',
      evaluationMethod: execRecord?.evaluationMethod || rule.execution?.evaluationMethod || EVALUATION_METHOD.DETERMINISTIC,
      executionState: execStatus,
      executedAt: execRecord?.completedAt || rule.execution?.executedAt || null,
      result: execRecord?.result || rule.execution?.result || null,
      observed: execRecord?.observed || rule.execution?.observed || null,
      expected: execRecord?.expected || rule.execution?.expected || null,
      explanation: execRecord?.explanation || rule.execution?.explanation || '',
      blockers: execRecord?.blockers || rule.execution?.blockers || [],
      limitations: execRecord?.limitations || rule.execution?.limitations || [],
      artworkEvidence: rule.evidence?.artworkEvidence || null,
      artworkPage: rule.evidence?.artworkPage ?? null,
      artworkBox: rule.evidence?.artworkBox || null,
      hasPreciseCoordinates: rule.evidence?.hasPreciseCoordinates || false,
      findingIds: execRecord?.findingIds || rule.execution?.findingIds || [],
      reviewerDecision: rule.authorization?.authorizedBy ? `${rule.authorization.status} by ${rule.authorization.authorizedBy}` : null,
    });
  }

  return {
    metrics: {
      totalRules,
      verifiedQuotations,
      unverifiedRules,
      proposedRules,
      authorizedRules,
      applicableRules,
      supportedChecks,
      actuallyExecutedRules,
      blockedRules,
      manualReviewRules,
      notApplicableRules,
      uncompiledRules,
    },
    items: coverageItems,
  };
}
