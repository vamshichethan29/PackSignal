/**
 * PackSignal Rule Quotation Verifier (lib/rules/quote-verifier.mjs)
 * Implements Phase 12: Independent verification of source quotations.
 * Prevents AI hallucinations from silently fabricating rule citations.
 */

import { normal, tokenSequencePresent } from '../engine.mjs';

/**
 * Normalizes text for faithful comparison (collapses extra whitespace, unifies quotes).
 */
export function normalizeSourceText(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies whether a candidate quotation exists in a source document.
 */
export function verifyRuleQuotation(candidateQuote, sourceDoc) {
  if (!candidateQuote || typeof candidateQuote !== 'string' || !candidateQuote.trim()) {
    return {
      verified: false,
      state: 'QUOTATION_NOT_VERIFIED',
      status: 'QUOTATION_NOT_VERIFIED',
      verificationStatus: 'QUOTATION_NOT_VERIFIED',
      reason: 'Quotation is empty or invalid.',
    };
  }

  if (!sourceDoc || !sourceDoc.text) {
    return {
      verified: false,
      state: 'SOURCE_UNAVAILABLE',
      status: 'SOURCE_UNAVAILABLE',
      verificationStatus: 'SOURCE_UNAVAILABLE',
      reason: 'Source document text is unavailable for verification.',
    };
  }

  const cleanQuote = normalizeSourceText(candidateQuote);
  const cleanSource = normalizeSourceText(sourceDoc.text);

  // 1. Exact string match
  if (cleanSource.includes(cleanQuote)) {
    return {
      verified: true,
      state: 'VERIFIED_QUOTATION',
      status: 'VERIFIED_QUOTATION',
      verificationStatus: 'VERIFIED_QUOTATION',
      matchType: 'EXACT_SUBSTRING',
      documentId: sourceDoc.id,
      documentName: sourceDoc.name,
      documentSha256: sourceDoc.sha256 || null,
      quote: candidateQuote,
      reason: 'Quotation verified: Exact character sequence confirmed in source document.',
    };
  }

  // Numerical and unit preservation safeguard:
  // Numbers and units in candidate quote must appear in source text.
  const quoteNumbers = candidateQuote.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|oz|fl\s*oz|pt|lb|ml|l|%|kcal|cal)?\b/gi) || [];
  for (const num of quoteNumbers) {
    const cleanNum = num.trim().toLowerCase();
    if (!cleanSource.toLowerCase().includes(cleanNum)) {
      return {
        verified: false,
        state: 'QUOTATION_NOT_VERIFIED',
        status: 'QUOTATION_NOT_VERIFIED',
        verificationStatus: 'QUOTATION_NOT_VERIFIED',
        matchType: 'NUMERICAL_MISMATCH',
        documentId: sourceDoc.id,
        documentName: sourceDoc.name,
        documentSha256: sourceDoc.sha256 || null,
        quote: candidateQuote,
        reason: `Quotation rejected: Numerical value or unit "${num}" is not present in source document.`,
      };
    }
  }

  // 2. Token sequence match (handling line wraps and hyphenation)
  if (tokenSequencePresent(sourceDoc.text, candidateQuote)) {
    return {
      verified: true,
      state: 'VERIFIED_QUOTATION',
      status: 'VERIFIED_QUOTATION',
      verificationStatus: 'VERIFIED_QUOTATION',
      matchType: 'TOKEN_SEQUENCE',
      documentId: sourceDoc.id,
      documentName: sourceDoc.name,
      documentSha256: sourceDoc.sha256 || null,
      quote: candidateQuote,
      reason: 'Quotation verified: Token sequence confirmed across source line wraps.',
    };
  }

  // 3. Normalized alphanumeric sequence match
  const normQuote = normal(candidateQuote);
  const normSource = normal(sourceDoc.text);
  if (normQuote.length >= 10 && normSource.includes(normQuote)) {
    return {
      verified: true,
      state: 'VERIFIED_QUOTATION',
      status: 'VERIFIED_QUOTATION',
      verificationStatus: 'VERIFIED_QUOTATION',
      matchType: 'NORMALIZED_ALPHANUMERIC',
      documentId: sourceDoc.id,
      documentName: sourceDoc.name,
      documentSha256: sourceDoc.sha256 || null,
      quote: candidateQuote,
      reason: 'Quotation verified: Normalized content confirmed in source document.',
    };
  }

  // Failed verification
  return {
    verified: false,
    state: 'QUOTATION_NOT_VERIFIED',
    status: 'QUOTATION_NOT_VERIFIED',
    verificationStatus: 'QUOTATION_NOT_VERIFIED',
    matchType: 'NONE',
    documentId: sourceDoc.id,
    documentName: sourceDoc.name,
    documentSha256: sourceDoc.sha256 || null,
    quote: candidateQuote,
    reason: `Quotation could not be located in source document "${sourceDoc.name}". Quotation may be hallucinated, paraphrased, or taken from an unsupplied version.`,
  };
}
