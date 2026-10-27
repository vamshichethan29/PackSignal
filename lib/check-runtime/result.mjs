/**
 * PackSignal Check Execution Result (lib/check-runtime/result.mjs)
 * Implements result normalization into the four canonical PackSignal outcomes:
 * issue, match, review, unable
 */

export const FINDING_OUTCOMES = {
  ISSUE: 'issue',
  MATCH: 'match',
  REVIEW: 'review',
  UNABLE: 'unable',
};

export const EVALUATION_METHODS = {
  DETERMINISTIC_CHECK: 'DETERMINISTIC_CHECK',
  AI_EXTRACTION_PLUS_DETERMINISTIC_CHECK: 'AI_EXTRACTION_PLUS_DETERMINISTIC_CHECK',
  AI_ASSISTED_INTERPRETATION: 'AI_ASSISTED_INTERPRETATION',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  TECHNICAL_SCREENING: 'TECHNICAL_SCREENING',
  UNSUPPORTED: 'UNSUPPORTED',
};

export function createCheckResult({
  checkId,
  ruleId = null,
  outcome = FINDING_OUTCOMES.UNABLE,
  executionState = 'executed', // executed, blocked, not_applicable
  evaluationMethod = EVALUATION_METHODS.DETERMINISTIC_CHECK,
  evaluatorId = 'engine_deterministic',
  observedValue = null,
  expectedValue = null,
  sourceEvidence = null,
  artworkEvidence = null,
  explanation = '',
  limitations = '',
  findingKeys = [],
  metadata = {},
}) {
  return {
    checkId,
    ruleId: ruleId || checkId,
    outcome,
    executionState,
    evaluationMethod,
    evaluatorId,
    observedValue,
    expectedValue,
    sourceEvidence,
    artworkEvidence,
    explanation,
    limitations,
    findingKeys: findingKeys.length ? findingKeys : [checkId],
    completedAt: new Date().toISOString(),
    metadata,
  };
}
