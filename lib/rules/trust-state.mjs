/**
 * PackSignal Rulebook Trust State Engine (lib/rules/trust-state.mjs)
 * Implements Phase 11: Tracks the three orthogonal dimensions of rule validity:
 * 1. Source Verification
 * 2. Reviewer Authorization
 * 3. Execution Status
 */

export const SOURCE_VERIFICATION_STATES = {
  VERIFIED_QUOTATION: 'VERIFIED_QUOTATION',
  QUOTATION_NOT_VERIFIED: 'QUOTATION_NOT_VERIFIED',
  CONFLICTING_SOURCE: 'CONFLICTING_SOURCE',
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
};

export const REVIEWER_AUTHORIZATION_STATES = {
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
};

export const EXECUTION_STATES = {
  APPLIED: 'APPLIED',
  NEEDS_MANUAL_REVIEW: 'NEEDS_MANUAL_REVIEW',
  UNSUPPORTED: 'UNSUPPORTED',
  NOT_APPLIED: 'NOT_APPLIED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

export function buildRuleTrustState({
  sourceVerification = SOURCE_VERIFICATION_STATES.QUOTATION_NOT_VERIFIED,
  reviewerAuthorization = REVIEWER_AUTHORIZATION_STATES.PROPOSED,
  execution = EXECUTION_STATES.NOT_APPLIED,
  authorizedBy = null,
  authorizedAt = null,
  reason = '',
} = {}) {
  return {
    sourceVerification,
    reviewerAuthorization,
    execution,
    authorizedBy,
    authorizedAt,
    reason,
    isTrusted:
      sourceVerification === SOURCE_VERIFICATION_STATES.VERIFIED_QUOTATION &&
      reviewerAuthorization === REVIEWER_AUTHORIZATION_STATES.APPROVED,
    isExecutable:
      sourceVerification === SOURCE_VERIFICATION_STATES.VERIFIED_QUOTATION &&
      reviewerAuthorization === REVIEWER_AUTHORIZATION_STATES.APPROVED &&
      execution === EXECUTION_STATES.APPLIED,
  };
}

/**
 * Transitions a rule trust state when a reviewer acts.
 */
export function transitionRuleAuthorization(currentTrustState, decision, actor = null, reason = '') {
  const nextAuth = REVIEWER_AUTHORIZATION_STATES[decision] || currentTrustState.reviewerAuthorization;
  let nextExec = currentTrustState.execution;

  if (nextAuth === REVIEWER_AUTHORIZATION_STATES.APPROVED) {
    if (currentTrustState.sourceVerification === SOURCE_VERIFICATION_STATES.VERIFIED_QUOTATION) {
      nextExec = EXECUTION_STATES.APPLIED;
    } else {
      nextExec = EXECUTION_STATES.NEEDS_MANUAL_REVIEW;
    }
  } else if (nextAuth === REVIEWER_AUTHORIZATION_STATES.REJECTED || nextAuth === REVIEWER_AUTHORIZATION_STATES.SUPERSEDED) {
    nextExec = EXECUTION_STATES.NOT_APPLIED;
  }

  return buildRuleTrustState({
    sourceVerification: currentTrustState.sourceVerification,
    reviewerAuthorization: nextAuth,
    execution: nextExec,
    authorizedBy: actor?.displayName || actor?.id || 'reviewer',
    authorizedAt: new Date().toISOString(),
    reason: reason || `Reviewer changed authorization to ${nextAuth}`,
  });
}

export function canRuleFailArtwork(trustState) {
  if (!trustState) return false;
  return (
    trustState.reviewerAuthorization === REVIEWER_AUTHORIZATION_STATES.APPROVED &&
    trustState.sourceVerification === SOURCE_VERIFICATION_STATES.VERIFIED_QUOTATION
  );
}

export const createRuleTrustState = buildRuleTrustState;
export const transitionReviewerAuthorization = transitionRuleAuthorization;

