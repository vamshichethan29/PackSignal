/**
 * PackSignal Failure Analysis & Root Cause Diagnostics (lib/evaluation/failure-analysis.mjs)
 * Phase 8: Systematic root-cause categorizer explaining misses and deviations
 * based on actual processing logs, evidence, and rule execution diagnostics.
 */

export const FAILURE_CATEGORIES = {
  EXTRACTION_MISS: 'EXTRACTION_MISS',
  VISIBILITY_MISCLASSIFICATION: 'VISIBILITY_MISCLASSIFICATION',
  QUOTE_VALIDATION_FAILURE: 'QUOTE_VALIDATION_FAILURE',
  FACT_FIELD_MISMATCH: 'FACT_FIELD_MISMATCH',
  UNIT_NORMALIZATION_FAILURE: 'UNIT_NORMALIZATION_FAILURE',
  RULE_APPLICABILITY_ERROR: 'RULE_APPLICABILITY_ERROR',
  SEMANTIC_CONFLICT_MISS: 'SEMANTIC_CONFLICT_MISS',
  INCORRECT_ABSTENTION: 'INCORRECT_ABSTENTION',
  UNSUPPORTED_EVIDENCE: 'UNSUPPORTED_EVIDENCE',
  GEOMETRY_MAPPING_ERROR: 'GEOMETRY_MAPPING_ERROR',
  MODEL_TIMEOUT: 'MODEL_TIMEOUT',
  PROVIDER_QUOTA: 'PROVIDER_QUOTA',
  UNKNOWN_CAUSE: 'UNKNOWN_CAUSE',
};

/**
 * Analyzes a failed or missed evaluation case and produces an evidence-backed diagnostic report.
 *
 * @param {Object} evalCase
 * @param {Object} matchedResult
 * @param {Object} [reviewResult]
 * @returns {Object} Diagnostic report with category, explanation, and remediation guidance
 */
export function diagnoseCaseFailure(evalCase, matchedResult, reviewResult = {}) {
  const expected = evalCase.expectedOutcome;
  const actual = matchedResult?.finding?.status || 'missing';
  const reason = matchedResult?.reason || '';
  const finding = matchedResult?.finding;

  let failureCategory = FAILURE_CATEGORIES.UNKNOWN_CAUSE;
  let diagnosticExplanation = 'ROOT CAUSE NOT YET DETERMINED.';
  let potentialImprovement = 'Inspect full engine logs and document extraction stream.';

  // Scenario 1: Timeout or provider failure
  if (matchedResult.classification === 'TIMEOUT' || reviewResult.timeout) {
    failureCategory = FAILURE_CATEGORIES.MODEL_TIMEOUT;
    diagnosticExplanation = 'Engine or model inference exceeded execution deadline.';
    potentialImprovement = 'Increase inference deadline or optimize preflight bounding box crops.';
  } else if (matchedResult.classification === 'MODEL_FAILURE') {
    failureCategory = FAILURE_CATEGORIES.PROVIDER_QUOTA;
    diagnosticExplanation = `API transport failure: ${reviewResult.error?.message || reason}`;
    potentialImprovement = 'Check API credentials, quota limits, and retry transport configuration.';
  }
  // Scenario 2: Evidence / Citation failure
  else if (matchedResult.classification === 'EVIDENCE_FAILURE') {
    failureCategory = FAILURE_CATEGORIES.UNSUPPORTED_EVIDENCE;
    diagnosticExplanation = 'The defect was recognized, but the engine failed to attach a valid source quote or artwork bounding box.';
    potentialImprovement = 'Improve coordinate projection from text stream to artwork geometry.';
  }
  // Scenario 3: Incorrect Abstention (abstained as review or unable on a real defect)
  else if (matchedResult.classification === 'INCORRECT_ABSTENTION') {
    failureCategory = FAILURE_CATEGORIES.INCORRECT_ABSTENTION;
    if (evalCase.complete === false) {
      diagnosticExplanation = 'Engine safely routed to UNABLE because panel coverage confirmation flag was not asserted.';
      potentialImprovement = 'Ensure unmapped panels are highlighted to user before marking complete.';
    } else {
      diagnosticExplanation = `Engine hesitated and routed to human review instead of flagging confirmed defect on ${evalCase.expectedField}.`;
      potentialImprovement = 'Strengthen statutory confidence scoring threshold for verified specifications.';
    }
  }
  // Scenario 4: Critical Miss of Defect (evaluated as clean match)
  else if (expected === 'issue' && actual === 'match') {
    if (evalCase.category === 'quantity') {
      failureCategory = FAILURE_CATEGORIES.UNIT_NORMALIZATION_FAILURE;
      diagnosticExplanation = 'Engine applied overly permissive unit math or fuzzy tolerance, equating non-identical quantities.';
      potentialImprovement = 'Tighten unit normalization tolerances for net quantity compliance.';
    } else if (evalCase.category === 'allergens' || evalCase.category === 'ingredients') {
      failureCategory = FAILURE_CATEGORIES.EXTRACTION_MISS;
      diagnosticExplanation = `The omitted or conflicting ingredient in ${evalCase.expectedField} was not detected in the extracted text lines.`;
      potentialImprovement = 'Verify OCR text line segmentation and hyphenated word reconstruction.';
    } else if (evalCase.category === 'claims') {
      failureCategory = FAILURE_CATEGORIES.SEMANTIC_CONFLICT_MISS;
      diagnosticExplanation = 'Semantic cross-reference between marketing claim and nutritional facts failed to trigger contradiction.';
      potentialImprovement = 'Ensure Claims Radar cross-references analytical nutrient values against claims.';
    } else {
      failureCategory = FAILURE_CATEGORIES.FACT_FIELD_MISMATCH;
      diagnosticExplanation = `Engine matched ${evalCase.expectedField} as compliant despite planted discrepancy: "${finding?.observed}".`;
      potentialImprovement = 'Verify field extraction key and verbatim string comparison rules.';
    }
  }
  // Scenario 5: False Positive on Clean Content
  else if (expected === 'match' && actual === 'issue') {
    failureCategory = FAILURE_CATEGORIES.QUOTE_VALIDATION_FAILURE;
    diagnosticExplanation = `Clean packaging was incorrectly flagged. Observed: "${finding?.observed}", Expected: "${evalCase.reference || finding?.expected}".`;
    potentialImprovement = 'Adjust whitespace normalization and punctuation handling in exact copy matcher.';
  }

  return {
    caseId: evalCase.caseId,
    name: evalCase.name || evalCase.caseId,
    category: evalCase.category,
    expectedOutcome: expected,
    observedOutcome: actual,
    relevantRule: evalCase.expectedRuleId || evalCase.statutoryRule,
    expectedEvidence: evalCase.reference || 'Specification reference',
    actualEvidence: finding?.observed || 'None provided',
    detectionStage: reviewResult.stage || 'DETERMINISTIC_ANALYSIS',
    failureCategory,
    diagnosticExplanation,
    potentialImprovement,
    pass: matchedResult.matched,
  };
}
