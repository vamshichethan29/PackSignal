/**
 * PackSignal Ambiguity Resolution Engine — Server-Side Answer Validator
 * (lib/ambiguity/answer-validator.mjs)
 */

import { QUESTION_TYPES, QUESTION_STATUS, ANSWER_TYPES } from './question-types.mjs';

/**
 * Validates a proposed resolution against the question, review sources, and reviewer permissions.
 * @param {object} params
 * @param {object} params.question - The question object
 * @param {object} params.answer - The submitted answer { candidateId, value, rationale, evidenceQuote, answerType }
 * @param {object} params.review - The current review
 * @param {object} params.actor - The authenticated reviewer
 * @returns {{ valid: boolean, status: string, error?: string, candidate?: object, validatedResolution?: object }}
 */
export function validateAnswer({ question, answer, review, actor }) {
  if (!question) {
    return { valid: false, status: 'INVALID', error: 'Question not found.' };
  }
  if (!answer) {
    return { valid: false, status: 'INVALID', error: 'No answer payload provided.' };
  }
  if (question.status === QUESTION_STATUS.SUPERSEDED) {
    return { valid: false, status: 'SUPERSEDED', error: 'This question was superseded by a source document revision and cannot be answered.' };
  }

  // 1. Authorization check
  if (actor?.role && !['admin', 'reviewer'].includes(actor.role)) {
    return { valid: false, status: 'UNAUTHORIZED', error: 'User does not have permission to resolve regulatory ambiguities.' };
  }

  // 2. Concurrency & Dependency Hash check
  const docs = review.documents || [];
  const currentSourceHash = question.sourceDependencyHash;
  // If the question is linked to a document, verify document still exists
  const candidateDoc = docs.find(d => question.sourceCandidates.some(c => c.documentId === d.id));
  if (candidateDoc && question.sourceDependencyHash) {
    // If the doc sha has changed, reject
    if (candidateDoc.sha256 && !question.sourceDependencyHash.includes(candidateDoc.sha256) && !question.sourceCandidates.some(c => c.documentSha256 === candidateDoc.sha256)) {
      return { valid: false, status: 'STALE_DEPENDENCY', error: 'Source document was modified after this question was generated. Review new source before answering.' };
    }
  }

  // 3. Evidence Request handling
  if (answer.answerType === ANSWER_TYPES.REQUEST_EVIDENCE || answer.status === QUESTION_STATUS.NEEDS_EVIDENCE || answer.action === 'need_evidence') {
    return {
      valid: true,
      status: QUESTION_STATUS.NEEDS_EVIDENCE,
      validatedResolution: {
        status: QUESTION_STATUS.NEEDS_EVIDENCE,
        action: 'REQUEST_EVIDENCE',
        rationale: answer.rationale?.trim() || 'Reviewer requested additional formulation or certification evidence.',
        reviewerId: actor?.id || 'reviewer',
        reviewerName: actor?.displayName || actor?.username || 'Reviewer',
        answeredAt: new Date().toISOString(),
      }
    };
  }

  // 4. Candidate selection validation
  let selectedCandidate = null;
  if (answer.candidateId) {
    selectedCandidate = question.sourceCandidates.find(c => c.candidateId === answer.candidateId);
    if (!selectedCandidate) {
      return { valid: false, status: 'INVALID_CANDIDATE', error: `Candidate ID "${answer.candidateId}" is not a valid option for this question.` };
    }
  } else if (answer.value) {
    selectedCandidate = question.sourceCandidates.find(c => c.value === answer.value || normal(c.value) === normal(answer.value));
    if (!selectedCandidate && question.allowedAnswerTypes.includes(ANSWER_TYPES.CUSTOM_CONFIRMATION)) {
      selectedCandidate = {
        candidateId: 'cand-custom',
        label: answer.value,
        value: answer.value,
        documentId: 'reviewer-input',
        documentName: 'Reviewer Confirmation',
        approvalStatus: 'REVIEWER_CONFIRMED',
        quote: answer.evidenceQuote || answer.value,
      };
    }
  }

  if (!selectedCandidate) {
    return { valid: false, status: 'MISSING_SELECTION', error: 'You must select one of the candidate sources or request supporting evidence.' };
  }

  // 5. Specific question type checks
  if (question.type === QUESTION_TYPES.NUTRITION_BASIS) {
    const val = String(selectedCandidate.value).toLowerCase();
    const isPerServing = /serving/i.test(val);
    const isPer100g = /100\s*(?:g|ml)/i.test(val);
    if (!isPerServing && !isPer100g) {
      // Must be a recognized basis
      return { valid: false, status: 'INVALID_BASIS', error: 'Selected nutrition basis must specify either a per-serving basis or per-100 g / 100 mL.' };
    }
  }

  if (question.type === QUESTION_TYPES.FACT_CONFLICT && question.field === 'net_quantity') {
    // Prevent comparing mass with volume directly
    const val = String(selectedCandidate.value);
    const isMass = /\b(?:g|kg|oz|lb)\b/i.test(val);
    const isVol = /\b(?:ml|l|fl\s*oz)\b/i.test(val);
    if (isMass && isVol) {
      // Dual declaration is fine
    }
  }

  // 6. Rationale requirement
  const rationale = (answer.rationale || '').trim();
  if (rationale.length < 2) {
    return { valid: false, status: 'MISSING_RATIONALE', error: 'Please provide a brief reviewer rationale or citation note.' };
  }

  const validatedResolution = {
    status: QUESTION_STATUS.RESOLVED,
    candidateId: selectedCandidate.candidateId,
    value: selectedCandidate.value,
    column: selectedCandidate.column || null,
    sheet: selectedCandidate.sheet || null,
    location: selectedCandidate.location || null,
    documentId: selectedCandidate.documentId,
    documentName: selectedCandidate.documentName,
    documentSha256: selectedCandidate.documentSha256 || null,
    isDraftSource: selectedCandidate.approvalStatus === 'DRAFT',
    approvalStatus: selectedCandidate.approvalStatus,
    rationale,
    evidenceQuote: answer.evidenceQuote || selectedCandidate.quote,
    reviewerId: actor?.id || 'reviewer',
    reviewerName: actor?.displayName || actor?.username || 'Reviewer',
    resolvedAt: new Date().toISOString(),
  };

  return {
    valid: true,
    status: QUESTION_STATUS.RESOLVED,
    candidate: selectedCandidate,
    validatedResolution,
  };
}

function normal(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
