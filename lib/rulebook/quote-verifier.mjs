import { SOURCE_VERIFICATION } from './schema.mjs';

/**
 * Verifies if candidate quote exists verbatim in raw source document text.
 * Supports multiline normalization (e.g. carriage returns / multiple spaces).
 * Handles both:
 *   verifyRuleQuotation(candidateQuote, sourceDoc)
 *   verifyRuleQuotation({ candidateQuote, sourceDocumentText, rule, sourceDocument })
 */
export function verifyRuleQuotation(arg1, arg2) {
  let candidateQuote = '';
  let sourceText = '';
  let sourceDoc = null;
  let rule = null;

  if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1) && !arg2) {
    candidateQuote = arg1.candidateQuote || arg1.rule?.source?.originalQuote || arg1.rule?.originalQuote || '';
    sourceText = arg1.sourceDocumentText || arg1.sourceDocument?.text || '';
    sourceDoc = arg1.sourceDocument || null;
    rule = arg1.rule || null;
  } else {
    candidateQuote = typeof arg1 === 'string' ? arg1 : (arg1?.source?.originalQuote || arg1?.originalQuote || '');
    if (typeof arg2 === 'string') {
      sourceText = arg2;
    } else if (typeof arg2 === 'object' && arg2 !== null) {
      sourceDoc = arg2;
      sourceText = arg2.text || '';
    }
  }

  // Check for source change / hash mismatch if rule has a recorded hash
  if (rule?.source?.documentHash && sourceDoc?.sha256) {
    if (rule.source.documentHash !== sourceDoc.sha256) {
      return {
        verified: false,
        status: SOURCE_VERIFICATION.SOURCE_CHANGED,
        reason: `Source document hash changed from ${rule.source.documentHash.slice(0, 8)} to ${sourceDoc.sha256.slice(0, 8)}`,
      };
    }
  }

  if (!candidateQuote || !sourceText) {
    return {
      verified: false,
      status: SOURCE_VERIFICATION.UNVERIFIED,
      reason: 'Candidate quote or source text missing',
    };
  }

  const rawQuote = String(candidateQuote).trim();
  const rawDoc = String(sourceText);

  // 1. Direct verbatim character match
  if (rawDoc.includes(rawQuote)) {
    return {
      verified: true,
      status: SOURCE_VERIFICATION.VERIFIED,
      matchType: 'EXACT_VERBATIM',
      quote: rawQuote,
    };
  }

  // 2. Whitespace-normalized multiline match (handles soft wraps across PDF lines)
  const normQuote = rawQuote.replace(/\s+/g, ' ');
  const normDoc = rawDoc.replace(/\s+/g, ' ');

  if (normDoc.includes(normQuote)) {
    return {
      verified: true,
      status: SOURCE_VERIFICATION.VERIFIED,
      matchType: 'WHITESPACE_NORMALIZED_MULTILINE',
      quote: rawQuote,
    };
  }

  // 3. Numerical or unit modification check (e.g. 1000 mL -> 750 mL)
  const quoteNumbers = rawQuote.match(/\b\d+(?:\.\d+)?\b/g) || [];
  const docNumbers = rawDoc.match(/\b\d+(?:\.\d+)?\b/g) || [];
  const hasAlteredNumber = quoteNumbers.some(num => !docNumbers.includes(num));

  if (hasAlteredNumber) {
    return {
      verified: false,
      status: SOURCE_VERIFICATION.UNVERIFIED,
      reason: 'Numerical or unit modification rejected: extracted numbers do not match source text',
    };
  }

  return {
    verified: false,
    status: SOURCE_VERIFICATION.UNVERIFIED,
    reason: 'Quotation was not found in source document bytes. Potential AI hallucination rejected.',
  };
}
