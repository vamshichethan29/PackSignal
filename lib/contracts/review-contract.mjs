/**
 * PackSignal Canonical Review Contract (lib/contracts/review-contract.mjs)
 * Step 1: Frozen Data Contract for Parallel Multi-Agent Tracks.
 *
 * Enforces unified schemas across Findings, Evidence, Rules, Cleared Checks,
 * Decisions, and Source Roles.
 */

export const FINDING_STATUSES = Object.freeze({
  ISSUE: 'issue',   // Fail / Action required
  REVIEW: 'review', // Needs human review / ambiguity
  MATCH: 'match',   // Pass for evaluated check
  UNABLE: 'unable', // Could not evaluate / insufficient evidence
});

export const SOURCE_ROLES = Object.freeze({
  ARTWORK: 'artwork',
  PRODUCT_SPECIFICATION: 'reference',
  RULEBOOK: 'rules',
  SUPPORTING_DOCUMENT: 'supplemental',
  OTHER: 'other',
});

export const RULE_APPROVAL_STATUSES = Object.freeze({
  PROPOSED: 'PROPOSED',
  VERIFIED_QUOTE: 'VERIFIED_QUOTE',
  APPROVED: 'APPROVED',
  APPLICABLE: 'APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNSUPPORTED: 'UNSUPPORTED',
  BLOCKED: 'BLOCKED',
  EXECUTED: 'EXECUTED',
});

export const DECISION_TYPES = Object.freeze({
  CONFIRMED_ISSUE: 'CONFIRMED_ISSUE',
  NOT_A_PROBLEM: 'NOT_A_PROBLEM',
  NEEDS_MORE_EVIDENCE: 'NEEDS_MORE_EVIDENCE',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  CONFIRM_REVISION: 'CONFIRM_REVISION',
  USE_SOURCE: 'USE_SOURCE',
});

/**
 * 1A: Canonical Finding Creator & Validator
 */
export function createFinding(payload = {}) {
  const finding = {
    findingId: String(payload.findingId || payload.id || `fnd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    checkId: String(payload.checkId || payload.key || 'generic-check'),
    ruleIds: Array.isArray(payload.ruleIds) ? payload.ruleIds.map(String) : (payload.rule?.citation ? [String(payload.rule.citation)] : []),
    kind: String(payload.kind || payload.group || 'general'),
    title: String(payload.title || 'Untitled Verification Finding'),
    whyItMatters: String(payload.whyItMatters || payload.explanation || 'Regulatory compliance and prepress accuracy.'),
    expected: payload.expected !== undefined ? String(payload.expected) : 'No approved reference value',
    observed: payload.observed !== undefined ? String(payload.observed) : 'Not detected in artwork',
    proof: payload.proof ? String(payload.proof) : null,
    evaluationMethod: String(payload.evaluationMethod || payload.method || 'deterministic_comparator'),
    findingStatus: validateFindingStatus(payload.findingStatus || payload.status),
    sourceEvidenceIds: Array.isArray(payload.sourceEvidenceIds) ? payload.sourceEvidenceIds.map(String) : [],
    artworkEvidenceIds: Array.isArray(payload.artworkEvidenceIds) ? payload.artworkEvidenceIds.map(String) : [],
    factIds: Array.isArray(payload.factIds) ? payload.factIds.map(String) : [],
    conflictIds: Array.isArray(payload.conflictIds) ? payload.conflictIds.map(String) : [],
    requirementIds: Array.isArray(payload.requirementIds) ? payload.requirementIds.map(String) : [],
    reviewerDecisionId: payload.reviewerDecisionId ? String(payload.reviewerDecisionId) : null,
    reviewRevision: Number(payload.reviewRevision || 1),
    limitations: String(payload.limitations || 'Evaluated within supported deterministic checks. Does not certify print production readiness.'),
  };

  validateFindingContract(finding);
  return finding;
}

export function validateFindingStatus(status) {
  const s = String(status || '').toLowerCase().trim();
  if (['issue', 'fail', 'defect'].includes(s)) return FINDING_STATUSES.ISSUE;
  if (['review', 'ambiguous', 'needs_review'].includes(s)) return FINDING_STATUSES.REVIEW;
  if (['match', 'pass', 'cleared'].includes(s)) return FINDING_STATUSES.MATCH;
  if (['unable', 'incomplete', 'unsupported'].includes(s)) return FINDING_STATUSES.UNABLE;
  return FINDING_STATUSES.UNABLE;
}

export function validateFindingContract(f) {
  if (!f.findingId) throw new Error('Contract violation: findingId is required');
  if (!f.checkId) throw new Error('Contract violation: checkId is required');
  if (!Object.values(FINDING_STATUSES).includes(f.findingStatus)) {
    throw new Error(`Contract violation: invalid findingStatus "${f.findingStatus}". Must be issue, review, match, or unable.`);
  }
  return true;
}

/**
 * 1B: Canonical Evidence Creator & Validator
 */
export function createEvidence(payload = {}) {
  const evidence = {
    evidenceId: String(payload.evidenceId || payload.id || `evi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    documentId: String(payload.documentId || 'doc-primary'),
    documentHash: String(payload.documentHash || payload.sha256 || '0'.repeat(64)),
    sourceType: String(payload.sourceType || (payload.sheet ? 'spreadsheet' : payload.panel ? 'artwork' : 'pdf')),
    originalQuote: payload.originalQuote !== undefined ? String(payload.originalQuote) : (payload.quote ? String(payload.quote) : ''),
    quoteVerified: Boolean(payload.quoteVerified ?? (payload.quoteVerification === 'verified')),
    sourceAuthority: String(payload.sourceAuthority || payload.authority || 'draft'),
    page: payload.page !== undefined ? Number(payload.page) : null,
    panel: payload.panel ? String(payload.panel) : null,
    sheet: payload.sheet ? String(payload.sheet) : null,
    cell: payload.cell ? String(payload.cell) : null,
    boundingBox: Array.isArray(payload.boundingBox) ? payload.boundingBox.map(Number) : (Array.isArray(payload.box) ? payload.box.map(Number) : null),
    coordinateSystem: String(payload.coordinateSystem || 'normalized_0_1'),
    extractionMethod: String(payload.extractionMethod || payload.method || 'native_stream_extractor'),
    visibilityState: String(payload.visibilityState || payload.visibility?.state || 'unknown_visibility'),
  };

  validateEvidenceContract(evidence);
  return evidence;
}

export function validateEvidenceContract(e) {
  if (!e.evidenceId) throw new Error('Contract violation: evidenceId is required');
  if (!e.documentHash || e.documentHash.length < 16) {
    throw new Error('Contract violation: valid cryptographic documentHash is required');
  }
  return true;
}

/**
 * 1C: Canonical Rulebook Rule Creator & Validator
 */
export function createRulebookRule(payload = {}) {
  const rule = {
    ruleId: String(payload.ruleId || payload.id || `rule-${Date.now()}`),
    title: String(payload.title || payload.name || 'Statutory Requirement'),
    originalQuote: String(payload.originalQuote || payload.exactQuotation || payload.text || ''),
    sourceDocumentId: String(payload.sourceDocumentId || payload.documentId || 'rulebook-primary'),
    sourceHash: String(payload.sourceHash || payload.sha256 || '0'.repeat(64)),
    sourceLocation: String(payload.sourceLocation || payload.section || payload.citation || 'Unspecified'),
    quoteVerification: payload.quoteVerification === 'verified' ? 'verified' : 'unverified',
    approvalStatus: Object.values(RULE_APPROVAL_STATUSES).includes(payload.approvalStatus)
      ? payload.approvalStatus
      : (payload.approved ? RULE_APPROVAL_STATUSES.APPROVED : RULE_APPROVAL_STATUSES.PROPOSED),
    applicability: String(payload.applicability || 'US_FOOD_LABELING'),
    checkType: String(payload.checkType || payload.type || 'REQUIRED_PHRASE'),
    evaluatorId: String(payload.evaluatorId || 'generic_text_comparator'),
    executionStatus: String(payload.executionStatus || 'PENDING'),
    findingIds: Array.isArray(payload.findingIds) ? payload.findingIds.map(String) : [],
    blockers: Array.isArray(payload.blockers) ? payload.blockers.map(String) : [],
  };

  validateRuleContract(rule);
  return rule;
}

export function validateRuleContract(r) {
  if (!r.ruleId) throw new Error('Contract violation: ruleId is required');
  if (!r.originalQuote) throw new Error('Contract violation: originalQuote is required');
  return true;
}

/**
 * 1D: Canonical Cleared Check Creator & Validator
 */
export function createClearedCheck(payload = {}) {
  const cleared = {
    clearedId: String(payload.clearedId || `clr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    checkId: String(payload.checkId || payload.key || 'cleared-check'),
    ruleId: payload.ruleId ? String(payload.ruleId) : null,
    title: String(payload.title || 'Verified & Cleared Check'),
    proof: payload.proof !== undefined ? String(payload.proof) : 'Character sequences and unit conversions match reference specification verbatim.',
    sourceEvidenceIds: Array.isArray(payload.sourceEvidenceIds) ? payload.sourceEvidenceIds.map(String) : [],
    artworkEvidenceIds: Array.isArray(payload.artworkEvidenceIds) ? payload.artworkEvidenceIds.map(String) : [],
    executionId: String(payload.executionId || `exec-${Date.now()}`),
    verificationMethod: String(payload.verificationMethod || 'deterministic_comparator'),
    limitations: String(payload.limitations || 'Verified for evaluated criteria only. Excludes non-printing guide text and hidden layers.'),
  };

  validateClearedContract(cleared);
  return cleared;
}

export function validateClearedContract(c) {
  if (!c.clearedId) throw new Error('Contract violation: clearedId is required');
  if (!c.proof || !c.proof.trim()) throw new Error('Contract violation: proof is required for cleared check');
  return true;
}

/**
 * 1E: Canonical Review Decision Creator & Validator
 */
export function createReviewDecision(payload = {}) {
  const decision = {
    decisionId: String(payload.decisionId || `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    findingId: String(payload.findingId),
    actorId: String(payload.actorId || payload.user || 'anonymous-reviewer'),
    decision: Object.values(DECISION_TYPES).includes(payload.decision) ? payload.decision : DECISION_TYPES.NOT_A_PROBLEM,
    note: String(payload.note || payload.comment || ''),
    timestamp: payload.timestamp ? String(payload.timestamp) : new Date().toISOString(),
    sourceDependencyHash: String(payload.sourceDependencyHash || '0'.repeat(64)),
    ruleDependencyHash: String(payload.ruleDependencyHash || '0'.repeat(64)),
    artworkDependencyHash: String(payload.artworkDependencyHash || '0'.repeat(64)),
    staleState: Boolean(payload.staleState || false),
  };

  validateDecisionContract(decision);
  return decision;
}

export function validateDecisionContract(d) {
  if (!d.decisionId) throw new Error('Contract violation: decisionId is required');
  if (!d.findingId) throw new Error('Contract violation: findingId is required');
  return true;
}

/**
 * 1F: Source Role Adapter (cleanly maps external roles to existing PackSignal roles)
 */
export function canonicalSourceRole(rawRole) {
  const r = String(rawRole || '').toUpperCase().trim();
  if (r === 'ARTWORK') return SOURCE_ROLES.ARTWORK;
  if (r === 'PRODUCT_SPECIFICATION' || r === 'SPECIFICATION') return SOURCE_ROLES.PRODUCT_SPECIFICATION;
  if (r === 'RULEBOOK' || r === 'REGULATION') return SOURCE_ROLES.RULEBOOK;
  if (r === 'SUPPORTING_DOCUMENT' || r === 'DIELINE') return SOURCE_ROLES.SUPPORTING_DOCUMENT;

  const low = r.toLowerCase();
  if (Object.values(SOURCE_ROLES).includes(low)) return low;
  return SOURCE_ROLES.OTHER;
}
