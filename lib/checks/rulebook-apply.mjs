/**
 * PackSignal Typed Rulebook Evaluator (lib/checks/rulebook-apply.mjs)
 * Wave 1A & 2A: Applies verified, authorized statutory rules to artwork copy.
 */

import { RULE_APPROVAL_STATUSES, FINDING_STATUSES, createFinding } from '../contracts/review-contract.mjs';

export function evaluateTypedRule({ rule, artworkText, artworkEvidence = {} }) {
  if (!rule) throw new Error('Rule is required');

  // Guard: unapproved or proposed rules MUST NOT execute as definitive failures
  if (rule.approvalStatus !== RULE_APPROVAL_STATUSES.APPROVED) {
    return {
      executed: false,
      status: FINDING_STATUSES.REVIEW,
      reason: `Rule ${rule.ruleId} is ${rule.approvalStatus || 'PROPOSED'} and requires human reviewer sign-off before execution.`,
      finding: null,
    };
  }

  // Guard: unverified quotes
  if (rule.quoteVerification !== 'verified') {
    return {
      executed: false,
      status: FINDING_STATUSES.REVIEW,
      reason: `Rule ${rule.ruleId} quotation is unverified against primary statutory bytes.`,
      finding: null,
    };
  }

  const artText = String(artworkText || '');
  let outcome = FINDING_STATUSES.MATCH;
  let proof = '';

  switch (rule.checkType) {
    case 'REQUIRED_PHRASE': {
      const phrase = rule.parameters?.phrase || rule.originalQuote;
      if (artText.toLowerCase().includes(phrase.toLowerCase())) {
        outcome = FINDING_STATUSES.MATCH;
        proof = `Required phrase "${phrase}" detected in artwork text.`;
      } else {
        outcome = FINDING_STATUSES.ISSUE;
        proof = `Required phrase "${phrase}" was NOT detected in extracted artwork copy.`;
      }
      break;
    }

    case 'FORBIDDEN_PHRASE': {
      const phrase = rule.parameters?.phrase || rule.originalQuote;
      if (artText.toLowerCase().includes(phrase.toLowerCase())) {
        outcome = FINDING_STATUSES.ISSUE;
        proof = `Forbidden phrase "${phrase}" detected in artwork copy.`;
      } else {
        outcome = FINDING_STATUSES.MATCH;
        proof = `Forbidden phrase "${phrase}" absent from artwork copy.`;
      }
      break;
    }

    default:
      return {
        executed: false,
        status: FINDING_STATUSES.UNABLE,
        reason: `Unsupported checkType "${rule.checkType}" in deterministic evaluator.`,
        finding: createFinding({
          checkId: `rule-${rule.ruleId}`,
          ruleIds: [rule.ruleId],
          kind: 'rulebook',
          title: `Unsupported Rule: ${rule.title || rule.ruleId}`,
          expected: 'Rule requires custom evaluator',
          observed: 'Not compiled into deterministic engine',
          findingStatus: FINDING_STATUSES.UNABLE,
          limitations: 'Rule preserved in ledger without automatic execution.',
        }),
      };
  }

  const finding = createFinding({
    checkId: `rule-${rule.ruleId}`,
    ruleIds: [rule.ruleId],
    kind: 'regulatory_rule',
    title: rule.title || `Regulatory Requirement: ${rule.ruleId}`,
    whyItMatters: `Statutory requirement: ${rule.sourceLocation || 'Gazette citation'}.`,
    expected: rule.originalQuote,
    observed: artText.slice(0, 100),
    proof,
    evaluationMethod: 'typed_rule_evaluator',
    findingStatus: outcome,
    sourceEvidenceIds: [rule.sourceDocumentId || 'doc-rulebook'],
    artworkEvidenceIds: artworkEvidence.evidenceId ? [artworkEvidence.evidenceId] : [],
  });

  return {
    executed: true,
    status: outcome,
    proof,
    finding,
  };
}
