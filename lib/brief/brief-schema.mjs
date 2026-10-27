/**
 * @file lib/brief/brief-schema.mjs
 * 
 * Phase 5 — Canonical Packaging Design Brief Schema
 * Defines the 11 brief sections, sentence kinds, evidence statuses,
 * and data contracts for atomic brief auditing and export.
 */

export const BRIEF_SECTIONS = [
  { id: 'sec-01-overview', code: '01', title: '01 — PROJECT OVERVIEW', required: true },
  { id: 'sec-02-product-info', code: '02', title: '02 — PRODUCT INFORMATION', required: true },
  { id: 'sec-03-ingredients', code: '03', title: '03 — INGREDIENTS AND ALLERGENS', required: true },
  { id: 'sec-04-nutrition', code: '04', title: '04 — NUTRITION REQUIREMENTS', required: true },
  { id: 'sec-05-claims', code: '05', title: '05 — MARKETING CLAIMS', required: true },
  { id: 'sec-06-regulatory', code: '06', title: '06 — REGULATORY REQUIREMENTS', required: true },
  { id: 'sec-07-brand', code: '07', title: '07 — DESIGN AND BRAND DIRECTION', required: true },
  { id: 'sec-08-keep-change', code: '08', title: '08 — KEEP / CHANGE / ADD / REMOVE', required: true },
  { id: 'sec-09-production', code: '09', title: '09 — PRODUCTION REQUIREMENTS', required: true },
  { id: 'sec-10-open-questions', code: '10', title: '10 — OPEN QUESTIONS AND DEPENDENCIES', required: true },
  { id: 'sec-11-checklist', code: '11', title: '11 — DELIVERY / REVIEW CHECKLIST', required: true }
];

export const SENTENCE_KINDS = {
  FACTUAL_CLAIM: 'FACTUAL_CLAIM',
  REQUIREMENT_DIRECTIVE: 'REQUIREMENT_DIRECTIVE',
  APPROVED_DESIGN_DECISION: 'APPROVED_DESIGN_DECISION',
  OPEN_QUESTION: 'OPEN_QUESTION',
  PROCESS_INSTRUCTION: 'PROCESS_INSTRUCTION',
  SECTION_HEADING: 'SECTION_HEADING',
  EXPLANATORY_NOTE: 'EXPLANATORY_NOTE'
};

export const AUDIT_STATUS = {
  SUPPORTED: 'SUPPORTED',
  UNSUPPORTED: 'UNSUPPORTED',
  CONFLICTED: 'CONFLICTED',
  STALE: 'STALE',
  NEEDS_HUMAN_REVIEW: 'NEEDS_HUMAN_REVIEW',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  AUDIT_REQUIRED: 'AUDIT_REQUIRED'
};

export const BRIEF_STATUS = {
  DRAFT: 'DRAFT',
  AUDIT_FAILED: 'AUDIT_FAILED',
  READY_FOR_APPROVAL: 'READY_FOR_APPROVAL',
  APPROVED: 'APPROVED',
  SUPERSEDED: 'SUPERSEDED'
};

export const AUTHORIZED_APPROVAL_ROLES = [
  'REGULATORY_LEAD',
  'QA_SPECIALIST',
  'PACKAGING_ENGINEER',
  'LEAD_REVIEWER',
  'ADMIN'
];

/**
 * Creates an atomic brief sentence adhering to the canonical schema.
 */
export function createBriefSentence({
  sentenceId,
  sectionId,
  text,
  kind = SENTENCE_KINDS.FACTUAL_CLAIM,
  factIds = [],
  requirementIds = [],
  decisionIds = [],
  evidenceStatus = AUDIT_STATUS.AUDIT_REQUIRED,
  sourceReviewVersion = '1.0.0',
  claimSpans = [],
  auditFindings = []
}) {
  if (!sentenceId) throw new Error('sentenceId is required');
  if (!sectionId) throw new Error('sectionId is required');
  if (typeof text !== 'string') throw new Error('text must be a string');

  return {
    sentenceId,
    sectionId,
    text: text.trim(),
    kind,
    factIds: Array.isArray(factIds) ? [...factIds] : [],
    requirementIds: Array.isArray(requirementIds) ? [...requirementIds] : [],
    decisionIds: Array.isArray(decisionIds) ? [...decisionIds] : [],
    evidenceStatus,
    sourceReviewVersion,
    claimSpans: Array.isArray(claimSpans) ? [...claimSpans] : [],
    auditFindings: Array.isArray(auditFindings) ? [...auditFindings] : [],
    lastEditedAt: new Date().toISOString()
  };
}

/**
 * Validates a complete brief object against the Phase 5 schema.
 */
export function validateBriefSchema(brief) {
  const errors = [];
  if (!brief) {
    return { valid: false, errors: ['Brief is null or undefined'] };
  }

  const requiredFields = [
    'briefId', 'reviewId', 'briefVersion', 'market',
    'productIdentity', 'sections', 'sentences',
    'requirements', 'designDecisions', 'unresolvedQuestions',
    'auditResult', 'approvalState', 'createdAt', 'updatedAt'
  ];

  for (const field of requiredFields) {
    if (brief[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (Array.isArray(brief.sections)) {
    if (brief.sections.length < 11) {
      errors.push(`Expected at least 11 brief sections, found ${brief.sections.length}`);
    }
  } else {
    errors.push('sections must be an array');
  }

  if (!Array.isArray(brief.sentences)) {
    errors.push('sentences must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
