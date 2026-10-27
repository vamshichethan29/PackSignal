/**
 * PackSignal Deterministic Finding Classifier (lib/checks/verdicts.mjs)
 * Wave 1A: Implements deterministic classification according to the canonical contract.
 */

import { FINDING_STATUSES, createFinding } from '../contracts/review-contract.mjs';

/**
 * Classifies an evaluation result into one of the 4 immutable finding statuses:
 * - ISSUE: Supported check with verified evidence and an empirical defect.
 * - REVIEW: Source ambiguity, unconfirmed draft authority, or AI interpretation.
 * - MATCH: Supported check passed with documented proof of evaluation.
 * - UNABLE: Insufficient evidence or uncompiled rule. Never hidden inside a PASS.
 */
export function classifyFinding({
  checkId,
  ruleIds = [],
  kind = 'general',
  title,
  whyItMatters,
  expected,
  observed,
  proof = null,
  evaluationMethod = 'deterministic_comparator',
  sourceAuthority = 'draft',
  quoteVerified = true,
  evidenceComplete = true,
  discrepancyDetected = false,
  isUnsupportedRule = false,
  isProposedRule = false,
  limitations = null,
  sourceEvidenceIds = [],
  artworkEvidenceIds = [],
}) {
  let status = FINDING_STATUSES.UNABLE;

  if (isUnsupportedRule || !evidenceComplete) {
    status = FINDING_STATUSES.UNABLE;
  } else if (isProposedRule || sourceAuthority === 'draft' || sourceAuthority === 'unconfirmed' || !quoteVerified) {
    // When source authority is draft or quotation is unverified, discrepancies stay as REVIEW
    status = discrepancyDetected ? FINDING_STATUSES.REVIEW : FINDING_STATUSES.REVIEW;
  } else if (discrepancyDetected) {
    // Verified source with authoritative sign-off and empirical defect -> ISSUE
    status = FINDING_STATUSES.ISSUE;
  } else {
    // Evaluated condition passed with evidence -> MATCH
    status = FINDING_STATUSES.MATCH;
  }

  return createFinding({
    checkId,
    ruleIds,
    kind,
    title,
    whyItMatters,
    expected,
    observed,
    proof,
    evaluationMethod,
    findingStatus: status,
    sourceEvidenceIds,
    artworkEvidenceIds,
    limitations: limitations || (status === FINDING_STATUSES.UNABLE
      ? 'Could not evaluate check due to incomplete evidence or uncompiled rule.'
      : 'Evaluated deterministically against supplied files.'),
  });
}
