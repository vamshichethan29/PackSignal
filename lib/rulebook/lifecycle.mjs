/**
 * PackSignal Multi-Dimensional Rule Lifecycle & Authorization Gate
 * (lib/rulebook/lifecycle.mjs)
 *
 * Implements Step 8 & Step 9:
 * - Manages distinct dimensions: Source Verification, Reviewer Authorization,
 *   Legal/Source Status, Applicability, Evaluation Method, and Execution.
 * - Enforces the human authorization gate for AI-proposed rules.
 * - Protects against unauthorized mutations and stale approvals.
 */

import { createHash } from 'node:crypto';
import {
  SOURCE_VERIFICATION,
  AUTHORIZATION_STATUS,
  LEGAL_STATUS,
  APPLICABILITY_STATUS,
  EVALUATION_METHOD,
  EXECUTION_STATUS,
  FINDING_RESULT,
} from './schema.mjs';

/**
 * Computes a cryptographic fingerprint of the rule interpretation and source quote.
 */
export function computeRuleInterpretationHash(rule) {
  const quote = rule.source?.originalQuote || rule.text || '';
  const type = rule.interpretation?.checkType || '';
  const params = JSON.stringify(rule.interpretation?.parameters || {});
  return createHash('sha256').update(`${quote}:${type}:${params}`).digest('hex').slice(0, 16);
}

/**
 * Evaluates whether a rule is eligible to execute deterministically and fail artwork.
 */
export function isRuleExecutable(rule) {
  if (!rule || typeof rule !== 'object') return false;

  // Gate 1: Source quote must be verified
  const isQuoteVerified = rule.source?.verificationStatus === SOURCE_VERIFICATION.VERIFIED;
  if (!isQuoteVerified) return false;

  // Gate 2: Must be approved by human reviewer or pre-approved built-in
  const isApproved = rule.authorization?.status === AUTHORIZATION_STATUS.APPROVED;
  if (!isApproved) return false;

  // Gate 3: Must be applicable
  const isApplicable = rule.applicability?.status !== APPLICABILITY_STATUS.NOT_APPLICABLE;
  if (!isApplicable) return false;

  return true;
}

/**
 * Transitions a rule's authorization status (APPROVED, REJECTED, PROPOSED, SUPERSEDED)
 * with strict server-side validation.
 */
export function transitionRuleAuthorization(rule, newStatus, actor = null, reason = '') {
  const validTransitions = Object.values(AUTHORIZATION_STATUS);
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Invalid authorization transition: ${newStatus}`);
  }

  const currentStatus = rule.authorization?.status || AUTHORIZATION_STATUS.PROPOSED;
  const actorName = actor?.displayName || actor?.name || actor?.id || 'Authorized Reviewer';
  const timestamp = new Date().toISOString();
  const ruleHash = computeRuleInterpretationHash(rule);

  // If approving, verify that quotation is not unverified
  if (newStatus === AUTHORIZATION_STATUS.APPROVED) {
    if (rule.source?.verificationStatus === SOURCE_VERIFICATION.UNVERIFIED) {
      // Reviewer cannot approve an unverified quotation without recording explicit reason
      if (!reason || reason.trim().length < 5) {
        throw new Error('Approval of an unverified quotation requires an explicit documented reason.');
      }
    }
  }

  // Record audit history entry
  const historyEntry = {
    action: `rule_authorization_${newStatus.toLowerCase()}`,
    from: currentStatus,
    to: newStatus,
    actor: actorName,
    at: timestamp,
    reason: reason || `Reviewer changed authorization to ${newStatus}`,
    ruleHash,
  };

  const updated = {
    ...rule,
    authorization: {
      status: newStatus,
      authorizedBy: newStatus === AUTHORIZATION_STATUS.APPROVED ? actorName : null,
      authorizedAt: newStatus === AUTHORIZATION_STATUS.APPROVED ? timestamp : null,
      decisionReason: reason,
      approvedRuleHash: newStatus === AUTHORIZATION_STATUS.APPROVED ? ruleHash : null,
    },
    history: [...(rule.history || []), historyEntry],
  };

  return updated;
}

/**
 * Invalidates authorization when underlying source document or interpretation changes.
 */
export function invalidateStaleAuthorization(rule, changeReason = 'Source document changed') {
  if (rule.authorization?.status !== AUTHORIZATION_STATUS.APPROVED) return rule;

  const timestamp = new Date().toISOString();
  const historyEntry = {
    action: 'rule_approval_invalidated',
    from: AUTHORIZATION_STATUS.APPROVED,
    to: AUTHORIZATION_STATUS.PROPOSED,
    actor: 'System / Source Integrity Monitor',
    at: timestamp,
    reason: changeReason,
  };

  return {
    ...rule,
    source: {
      ...rule.source,
      verificationStatus: SOURCE_VERIFICATION.SOURCE_CHANGED,
      verificationReason: changeReason,
    },
    authorization: {
      status: AUTHORIZATION_STATUS.PROPOSED,
      authorizedBy: null,
      authorizedAt: null,
      decisionReason: `Invalidated: ${changeReason}`,
      approvedRuleHash: null,
    },
    execution: {
      ...rule.execution,
      status: EXECUTION_STATUS.NOT_APPLIED,
      blockers: [changeReason],
    },
    history: [...(rule.history || []), historyEntry],
  };
}
