/**
 * PackSignal Change Classification Engine (lib/revision/change-classifier.mjs)
 * Classifies correlated findings and visual differences into semantically meaningful,
 * audit-grade revision categories.
 */

export const REVISION_CHANGE_TYPES = {
  VERIFIED_RESOLVED: 'VERIFIED_RESOLVED',
  RESOLVED: 'RESOLVED',
  REGRESSION: 'REGRESSION',
  NEW_ISSUE: 'NEW_ISSUE',
  UNCHANGED: 'UNCHANGED',
  VISUAL_CHANGE: 'VISUAL_CHANGE',
  NEUTRAL_VISUAL_CHANGE: 'NEUTRAL_VISUAL_CHANGE',
  REMOVED_CONTENT: 'REMOVED_CONTENT',
  ADDED_CONTENT: 'ADDED_CONTENT',
  UNVERIFIED_CHANGE: 'UNVERIFIED_CHANGE',
  NOT_COMPARABLE: 'NOT_COMPARABLE',
  SOURCE_BASIS_CHANGED: 'SOURCE_BASIS_CHANGED',
};

export const REVISION_STATUS_COLORS = {
  VERIFIED_RESOLVED: 'green',
  RESOLVED: 'green',
  REGRESSION: 'red',
  NEW_ISSUE: 'red',
  UNVERIFIED_CHANGE: 'amber',
  REMOVED_CONTENT: 'amber',
  SOURCE_BASIS_CHANGED: 'amber',
  VISUAL_CHANGE: 'blue',
  NEUTRAL_VISUAL_CHANGE: 'blue',
  ADDED_CONTENT: 'blue',
  UNCHANGED: 'gray',
  NOT_COMPARABLE: 'gray',
};

/**
 * Classifies an individual finding correlation pair based on status change and basis
 */
export function classifyFindingChange(correlation, basisEvaluation) {
  const pf = correlation.previousFinding;
  const cf = correlation.currentFinding;
  const frozen = basisEvaluation.frozenBasis;

  // Case 1: Defect in V1 became Match in V2
  if (pf && cf && pf.status !== 'match' && cf.status === 'match') {
    if (frozen) {
      return {
        classification: REVISION_CHANGE_TYPES.VERIFIED_RESOLVED,
        statusColor: 'green',
        reason: `Verified Resolved: Previous discrepancy "${pf.observed}" now matches approved reference "${cf.expected}".`,
        verifiedAgainstReference: true,
        isResolved: true,
      };
    } else {
      return {
        classification: REVISION_CHANGE_TYPES.SOURCE_BASIS_CHANGED,
        statusColor: 'amber',
        reason: `Status changed to match; note that reference specifications or rulebooks also changed between revisions.`,
        verifiedAgainstReference: false,
        isResolved: false,
      };
    }
  }

  // Case 2: Match in V1 became Defect in V2 (REGRESSION)
  if (pf && cf && pf.status === 'match' && cf.status !== 'match') {
    return {
      classification: REVISION_CHANGE_TYPES.REGRESSION,
      statusColor: 'red',
      reason: `REGRESSION: Previously matching check now fails. Observed: "${cf.observed}" (Expected: "${cf.expected}").`,
      isRegression: true,
    };
  }

  // Case 3: Finding in V1 not found in V2
  if (pf && !cf) {
    // Check if extraction was verified and complete
    const extractionCoverageVerified = pf.evidence?.[0]?.page != null;
    if (extractionCoverageVerified && pf.status === 'match') {
      return {
        classification: REVISION_CHANGE_TYPES.REGRESSION,
        statusColor: 'red',
        reason: `REGRESSION: Required declaration present in V1 was not detected in V2. Check whether content was removed.`,
        isRegression: true,
      };
    }
    return {
      classification: REVISION_CHANGE_TYPES.UNVERIFIED_CHANGE,
      statusColor: 'amber',
      reason: `Finding present in V1 was not detected in V2. Verify whether packaging copy was intentionally removed or missed during extraction.`,
      isUnverified: true,
    };
  }

  // Case 4: Finding in V2 not present in V1 (NEW ISSUE or ADDED CONTENT)
  if (!pf && cf) {
    const isDefect = cf.status !== 'match';
    return {
      classification: isDefect ? REVISION_CHANGE_TYPES.NEW_ISSUE : REVISION_CHANGE_TYPES.ADDED_CONTENT,
      statusColor: isDefect ? 'red' : 'blue',
      reason: isDefect
        ? `NEW ISSUE: Discrepancy introduced in V2 not present in prior artwork. Observed: "${cf.observed}".`
        : `Added content in V2 verified against reference: "${cf.observed}".`,
      isNewIssue: isDefect,
    };
  }

  // Case 5: Unchanged in both
  if (pf && cf) {
    const isMatch = cf.status === 'match';
    return {
      classification: REVISION_CHANGE_TYPES.UNCHANGED,
      statusColor: isMatch ? 'green' : 'gray',
      reason: isMatch
        ? 'Check remains verified and matching in both versions.'
        : 'Discrepancy remains unresolved between versions.',
      isUnchanged: true,
    };
  }

  return {
    classification: REVISION_CHANGE_TYPES.NOT_COMPARABLE,
    statusColor: 'gray',
    reason: 'Not comparable.',
  };
}
