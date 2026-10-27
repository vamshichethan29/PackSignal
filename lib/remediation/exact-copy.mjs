/**
 * PackSignal Deterministic Exact Copy Remediation (lib/remediation/exact-copy.mjs)
 * Mode 1: DETERMINISTIC_EXACT_FIX
 * Generates exact source-backed replacements without generative AI.
 */

export function remediateExactCopy(finding, review = {}, sourceResolution = {}) {
  const expected = finding.expected || sourceResolution.expectedValue || '';
  const observed = finding.observed || sourceResolution.observedValue || '';

  if (!expected || expected === 'Missing reference value') {
    return {
      success: false,
      reason: 'Missing approved reference value for exact copy replacement.',
      blockers: ['Approved specification value required.'],
    };
  }

  const sourceEvidence = sourceResolution.sourceEvidence?.length
    ? sourceResolution.sourceEvidence
    : (finding.evidence || []).filter(e => e.role && e.role !== 'artwork');

  const ruleEvidence = sourceResolution.ruleEvidence?.length
    ? sourceResolution.ruleEvidence
    : (finding.rule ? [finding.rule] : []);

  return {
    success: true,
    mode: 'EXACT_REPLACEMENT',
    remediationMode: 'DETERMINISTIC_EXACT_FIX',
    originalText: observed,
    proposedText: expected,
    options: [
      {
        id: 'opt-exact',
        label: 'Exact Approved Copy',
        text: expected,
        description: 'Exact literal wording transcribed from the approved product specification document.',
      },
    ],
    sourceEvidence,
    ruleEvidence,
    changes: [`Replaced observed "${observed}" with verified reference "${expected}"`],
    reasoningSummary: 'Verified source document explicitly provides the required approved wording. No generative modification used.',
    assumptions: [],
    blockers: [],
    requiresHumanReview: true,
    legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
  };
}
