/**
 * PackSignal Multilingual Intelligence — Approved Phrase Pair Registry
 * (lib/multilingual/approved-pairs.mjs)
 *
 * Implements Step 24, 25, 26, 27 of Phase 6:
 * Script-preserving, Unicode-normalized parallel phrase matching.
 * Compares artwork text strictly against source-approved reference phrases
 * without pretending exact phrase matching proves semantic translation equivalence.
 */

import { tokenSequencePresent, normal } from '../engine.mjs';

export const MULTILINGUAL_OUTCOMES = {
  EXACT_APPROVED_MATCH: 'EXACT_APPROVED_MATCH',
  SOURCE_COPY_MISMATCH: 'SOURCE_COPY_MISMATCH',
  MISSING_PHRASE_CANDIDATE: 'MISSING_PHRASE_CANDIDATE',
  ARTWORK_EXTRACTION_UNCERTAIN: 'ARTWORK_EXTRACTION_UNCERTAIN',
  APPROVAL_UNKNOWN: 'APPROVAL_UNKNOWN',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
};

/**
 * Creates an approved phrase pair record.
 */
export function createApprovedPhrasePair({
  pairId = '',
  sku = null,
  market = 'ALL',
  field = 'storage_statement',
  language = 'English',
  languageCode = 'en',
  approvedText = '',
  sourceDocumentId = null,
  sourceDocumentHash = null,
  sourceLocation = null,
  approvalStatus = 'approved',
  approvalDate = null,
  version = 1,
  applicability = 'applicable'
}) {
  return {
    pairId: pairId || `pair-${languageCode}-${field}`,
    sku,
    market,
    field,
    language,
    languageCode,
    approvedText: String(approvedText || '').trim(),
    sourceDocumentId,
    sourceDocumentHash,
    sourceLocation,
    approvalStatus,
    approvalDate: approvalDate || new Date().toISOString(),
    version,
    applicability
  };
}

/**
 * Compares artwork text against an approved phrase pair using Unicode NFKC normalization.
 */
export function matchApprovedPhrase({
  approvedPhrase = {},
  artworkText = '',
  artworkCoverage = true
}) {
  const sourceText = String(approvedPhrase.approvedText || '').trim();
  if (!sourceText) {
    return {
      outcome: MULTILINGUAL_OUTCOMES.APPROVAL_UNKNOWN,
      status: 'review',
      explanation: 'No approved source phrase provided.'
    };
  }

  // Unicode NFKC normalization preserving native scripts, matras, diacritics
  const normSource = sourceText.normalize('NFKC');
  const normArt = String(artworkText || '').normalize('NFKC');

  // Check presence
  const matches = normArt.includes(normSource) || tokenSequencePresent(artworkText, sourceText);

  if (matches) {
    return {
      outcome: MULTILINGUAL_OUTCOMES.EXACT_APPROVED_MATCH,
      status: 'match',
      explanation: `Approved ${approvedPhrase.language || 'language'} phrase was detected in artwork. (Note: exact phrase match confirms presence of approved copy; does not certify semantic translation accuracy).`,
      observed: sourceText,
      expected: sourceText
    };
  }

  if (artworkCoverage) {
    return {
      outcome: MULTILINGUAL_OUTCOMES.SOURCE_COPY_MISMATCH,
      status: 'issue',
      explanation: `Approved ${approvedPhrase.language || 'language'} phrase was not detected in extracted artwork copy.`,
      observed: 'Not detected in extracted content',
      expected: sourceText
    };
  }

  return {
    outcome: MULTILINGUAL_OUTCOMES.ARTWORK_EXTRACTION_UNCERTAIN,
    status: 'unable',
    explanation: `Artwork coverage is unconfirmed or image-based; cannot verify absence of ${approvedPhrase.language || 'language'} phrase.`,
    observed: 'Not detected in extracted content',
    expected: sourceText
  };
}

export const compareApprovedPhrasePair = matchApprovedPhrase;
