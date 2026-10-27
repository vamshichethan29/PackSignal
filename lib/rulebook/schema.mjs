/**
 * PackSignal Rulebook Schema and Enumerations (lib/rulebook/schema.mjs)
 * Implements multi-dimensional rule modeling:
 * - Source Verification
 * - Reviewer Authorization
 * - Legal/Source Status
 * - Applicability
 * - Evaluation Method
 * - Execution Status
 * - Finding Results
 */

import { createHash } from 'node:crypto';

export const SUPPORTED_CHECK_TYPES = Object.freeze([
  'REQUIRED_PHRASE',
  'FORBIDDEN_PHRASE',
  'EXACT_NUMERIC_VALUE',
  'UNIT_EQUIVALENT_VALUE',
  'PANEL_PLACEMENT',
  'MINIMUM_TEXT_SIZE',
  'INGREDIENT_COMPARISON',
  'ALLERGEN_COMPARISON',
  'CLAIM_SUBSTANTIATION',
  'REQUIRED_SUPPORTING_DOCUMENT',
  'NUTRITION_ARITHMETIC',
  'BARCODE_IDENTIFIER_MATCH',
  'CONDITIONAL_REQUIREMENT',
  'MANUAL_REVIEW',
  'UNSUPPORTED',
  // Six packaging rule families (Wave D)
  'BARCODE_GTIN_MATCH',
  'STATUTORY_SYMBOL_PRESENCE',
  'MULTILINGUAL_PAIR_REQUIREMENT',
  'MANUFACTURER_ADDRESS_DECLARATION',
  'STORAGE_INSTRUCTION_MANDATE',
  'NUTRIENT_CONTENT_CLAIM_LIMIT',
]);

export const SOURCE_VERIFICATION = Object.freeze({
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  FAILED: 'FAILED',
  SOURCE_CHANGED: 'SOURCE_CHANGED',
});

export const AUTHORIZATION_STATUS = Object.freeze({
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
});

export const LEGAL_STATUS = Object.freeze({
  STATUTORY: 'STATUTORY',
  VOLUNTARY: 'VOLUNTARY',
  COMPANY_SPEC: 'COMPANY_SPEC',
  UNCONFIRMED: 'UNCONFIRMED',
});

export const APPLICABILITY_STATUS = Object.freeze({
  APPLICABLE: 'APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  UNDETERMINED: 'UNDETERMINED',
});

export const EVALUATION_METHOD = Object.freeze({
  DETERMINISTIC: 'DETERMINISTIC',
  AI_ASSISTED: 'AI_ASSISTED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
});

export const EXECUTION_STATUS = Object.freeze({
  APPLIED: 'APPLIED',
  NOT_APPLIED: 'NOT_APPLIED',
  EXECUTED: 'EXECUTED',
  BLOCKED: 'BLOCKED',
  PENDING: 'PENDING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  MANUAL_REVIEW_PENDING: 'MANUAL_REVIEW_PENDING',
});

export const FINDING_RESULT = Object.freeze({
  MATCH: 'MATCH',
  ISSUE: 'ISSUE',
  REVIEW: 'REVIEW',
  UNABLE: 'UNABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export function buildStableRuleId(textOrObj = '', citation = '', section = '') {
  if (typeof textOrObj === 'object' && textOrObj !== null) {
    const docId = textOrObj.documentId || '';
    const quote = textOrObj.quotation || textOrObj.text || '';
    const sec = textOrObj.section || textOrObj.citation || '';
    const seed = `${docId}:${sec}:${quote}`.trim().toLowerCase();
    return `rule_${createHash('sha256').update(seed).digest('hex').slice(0, 12)}`;
  }
  const seed = `${citation || ''}:${section || ''}:${textOrObj || ''}`.trim().toLowerCase();
  return `rule_${createHash('sha256').update(seed).digest('hex').slice(0, 12)}`;
}

export function createRuleRecord(raw = {}) {
  const quote = raw.source?.originalQuote || raw.originalQuote || raw.exactQuotation || raw.text || '';
  const citation = raw.source?.sourceCitation || raw.citation || raw.section || '';
  const id = raw.id || raw.ruleId || buildStableRuleId(quote, citation);

  return {
    id,
    ruleId: id,
    title: raw.title || raw.name || (citation ? `Requirement: ${citation}` : 'Packaging Requirement'),
    source: {
      documentId: raw.source?.documentId || raw.documentId || 'doc-rulebook',
      documentName: raw.source?.documentName || raw.documentName || 'Rulebook Document',
      documentHash: raw.source?.documentHash || raw.sourceHash || null,
      originalQuote: quote,
      verificationStatus: raw.source?.verificationStatus || (raw.quoteVerification === 'verified' ? SOURCE_VERIFICATION.VERIFIED : SOURCE_VERIFICATION.UNVERIFIED),
      sourceCitation: citation,
      page: raw.source?.page || raw.page || null,
      section: raw.source?.section || raw.section || null,
      ...raw.source,
    },
    interpretation: {
      checkType: raw.interpretation?.checkType || raw.checkType || 'REQUIRED_PHRASE',
      field: raw.interpretation?.field || raw.field || null,
      parameters: raw.interpretation?.parameters || raw.parameters || { phrase: quote },
      proposedBy: raw.interpretation?.proposedBy || 'rulebook',
      isCompiled: raw.interpretation?.isCompiled ?? (raw.checkType !== 'MANUAL_REVIEW' && raw.checkType !== 'UNSUPPORTED'),
      interpretedRequirement: raw.interpretation?.interpretedRequirement || quote,
      ...raw.interpretation,
    },
    authorization: {
      status: raw.authorization?.status || (raw.approved ? AUTHORIZATION_STATUS.APPROVED : AUTHORIZATION_STATUS.PROPOSED),
      authorizedBy: raw.authorization?.authorizedBy || null,
      authorizedAt: raw.authorization?.authorizedAt || null,
      approvedRuleHash: raw.authorization?.approvedRuleHash || null,
      ...raw.authorization,
    },
    applicability: {
      status: raw.applicability?.status || APPLICABILITY_STATUS.APPLICABLE,
      market: raw.applicability?.market || 'US',
      ...raw.applicability,
    },
    execution: {
      status: raw.execution?.status || EXECUTION_STATUS.PENDING,
      result: raw.execution?.result || null,
      ...raw.execution,
    },
    ...raw,
  };
}

export function validateRuleRecord(rule) {
  if (!rule || typeof rule !== 'object') throw new Error('Rule must be an object');
  if (!rule.id && !rule.ruleId) throw new Error('Rule missing id');
  return true;
}

export function validateRuleCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Candidate rule must be an object');
  }
  if (!candidate.ruleId && !candidate.id) throw new Error('Candidate missing ruleId');
  if (!candidate.exactQuotation && !candidate.originalQuote && !candidate.text) {
    throw new Error('Candidate missing exactQuotation');
  }
  if (!candidate.checkType) candidate.checkType = 'UNSUPPORTED';
  return true;
}
