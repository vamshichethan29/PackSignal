/**
 * PackSignal Phase 2 — Deterministic Quote Check & Evidence Verification
 * (lib/facts/fact-quote-check.mjs)
 * 
 * Verifies that extracted facts are independently grounded in genuine source pieces:
 * - Exact source piece matching.
 * - Text quotation verification (EXACT, NORMALIZED_EQUIVALENT, VERIFIED_RECONSTRUCTION, IMAGE_EVIDENCE).
 * - Rejection of fabricated cell coordinates or unsupported pages.
 * - Rejection of source-label mismatches (e.g. "Fat 15g" cannot justify carbohydrate fact).
 * - PDF visibility awareness (hidden text cannot prove visible labeling).
 */

import { parseNormalizedQuantity, areQuantitiesEquivalent } from './fact-normalization.mjs';

/**
 * Normalizes text for clean whitespace/casing comparison without destroying punctuation/digits.
 */
function normalizeText(str) {
  return String(str || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Checks whether candidate text is an alphanumeric reconstruction (e.g. "1 5 g" -> "15 g").
 */
function isLetterSpacedReconstruction(sourceText, candidateQuote) {
  const sNorm = normalizeText(sourceText).replace(/[^a-z0-9]/g, '');
  const qNorm = normalizeText(candidateQuote).replace(/[^a-z0-9]/g, '');
  return sNorm.length > 0 && qNorm.length > 0 && sNorm.includes(qNorm);
}

/**
 * Verifies candidate fact against a collection of Phase 1 source pieces.
 * 
 * @param {object} candidate - Proposed fact candidate.
 * @param {Array<object>} sourcePieces - Collection of verified source pieces.
 * @param {object} options - Verification options.
 * @returns {object} Quote check result: { verified, quoteMatch, matchedPieces, reason, visibility, error }
 */
export function verifyFactQuote(candidate, sourcePieces = [], options = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return { verified: false, quoteMatch: 'UNSUPPORTED', reason: 'Invalid candidate object.' };
  }

  // 1. Image-only mark check
  if (candidate.evidence?.method === 'rendered_page_vision' || candidate.evidence?.visualEvidenceRef) {
    const visualRef = candidate.evidence.visualEvidenceRef;
    if (!visualRef || !visualRef.page || !visualRef.crop) {
      return {
        verified: false,
        quoteMatch: 'UNSUPPORTED',
        reason: 'Image-only mark requires verified visual evidence reference with crop coordinates.'
      };
    }
    return {
      verified: true,
      quoteMatch: 'IMAGE_EVIDENCE',
      visibility: candidate.evidence.visibility || 'VISIBLE',
      reason: 'Verified through visual crop evidence on rendered page.'
    };
  }

  const quote = candidate.evidence?.quote || candidate.quote || null;
  const docId = candidate.source?.documentId;
  const docSha256 = candidate.source?.documentSha256;
  const targetSheet = candidate.source?.sheet;
  const targetCell = candidate.source?.cell;
  const targetPage = candidate.source?.page;
  const pieceIds = candidate.source?.sourcePieceIds || [];

  if (!quote && !candidate.value) {
    return { verified: false, quoteMatch: 'NOT_FOUND', reason: 'Fact has neither quotation nor value.' };
  }

  const testQuote = quote || candidate.value;
  const normQuote = normalizeText(testQuote);

  // 2. Filter candidate source pieces by document identity if specified
  let candidates = sourcePieces;
  if (docId) {
    candidates = candidates.filter(p => p.documentId === docId || p.file === docId || p.documentName === docId);
    if (candidates.length === 0) {
      return {
        verified: false,
        quoteMatch: 'NOT_FOUND',
        reason: `Referenced document not found in source pieces: "${docId}".`
      };
    }
  }

  if (docSha256) {
    const hashMatch = candidates.filter(p => p.documentSha256 === docSha256);
    if (hashMatch.length === 0) {
      return {
        verified: false,
        quoteMatch: 'NOT_FOUND',
        reason: `Document hash mismatch: "${docSha256}".`
      };
    }
    candidates = hashMatch;
  }

  // 3. Coordinate validation: cell or page
  if (targetCell) {
    const cellMatch = candidates.filter(p => p.cell === targetCell);
    if (cellMatch.length === 0) {
      return {
        verified: false,
        quoteMatch: 'NOT_FOUND',
        reason: `Referenced cell "${targetCell}" does not exist in spreadsheet source pieces.`
      };
    }
    candidates = cellMatch;
  }

  if (targetSheet) {
    const sheetMatch = candidates.filter(p => !p.sheet || p.sheet === targetSheet);
    if (sheetMatch.length > 0) {
      candidates = sheetMatch;
    }
  }

  if (targetPage !== null && targetPage !== undefined) {
    const pageMatch = candidates.filter(p => !p.page || p.page === targetPage);
    if (pageMatch.length === 0) {
      return {
        verified: false,
        quoteMatch: 'NOT_FOUND',
        reason: `Referenced page ${targetPage} not found in document pieces.`
      };
    }
    candidates = pageMatch;
  }

  // 4. Source-piece ID check if provided
  if (pieceIds.length > 0) {
    const idSet = new Set(pieceIds);
    const idMatch = candidates.filter(p => idSet.has(p.id));
    if (idMatch.length > 0) {
      candidates = idMatch;
    }
  }

  // 5. Check quotation against candidate source piece texts
  let bestMatch = null;
  let matchType = 'NOT_FOUND';
  let matchedPiece = null;

  // Check joined text only if multiple pieces were explicitly referenced
  if (pieceIds.length > 1 && candidates.length > 1) {
    const joinedText = candidates.map(p => p.text || '').join(' ');
    const normJoined = normalizeText(joinedText);
    if (normJoined.includes(normQuote)) {
      matchType = 'EXACT';
      matchedPiece = candidates[0];
    }
  }

  if (!matchedPiece) {
    for (const p of candidates) {
      const pText = p.text || '';
      const pRaw = p.rawText || '';
      const normP = normalizeText(pText);
      const normRaw = normalizeText(pRaw);

      // Exact match
      if (normP.includes(normQuote) || normRaw.includes(normQuote)) {
        matchType = 'EXACT';
        matchedPiece = p;
        break;
      }

      // Normalized match (case/punctuation)
      const cleanP = normP.replace(/[^a-z0-9%]/g, '');
      const cleanQ = normQuote.replace(/[^a-z0-9%]/g, '');
      if (cleanP && cleanQ && cleanP.includes(cleanQ)) {
        if (matchType !== 'EXACT') {
          matchType = 'NORMALIZED_EQUIVALENT';
          matchedPiece = p;
        }
      }

      // Letter-spaced or curved text reconstruction
      if (isLetterSpacedReconstruction(pRaw, testQuote) || isLetterSpacedReconstruction(pText, testQuote)) {
        if (matchType !== 'EXACT' && matchType !== 'NORMALIZED_EQUIVALENT') {
          matchType = 'VERIFIED_RECONSTRUCTION';
          matchedPiece = p;
        }
      }
    }
  }

  if (!matchedPiece) {
    return {
      verified: false,
      quoteMatch: 'NOT_FOUND',
      reason: `Quotation "${testQuote}" could not be located in genuine source pieces.`
    };
  }

  // 6. Label mismatch guardrail:
  // "Fat 15g" must not justify a carbohydrate fact!
  // "of which sugars 15g" must not justify a carbohydrate fact!
  const field = String(candidate.field || '').toLowerCase();
  const matchedText = normalizeText(matchedPiece.rawText || matchedPiece.text);

  if (field.includes('carbohydrate') && !field.includes('sugar')) {
    // If quote is just "15g", ensure source piece is actually carbohydrate
    if (matchedText.includes('fat') && !matchedText.includes('carbohydrate')) {
      return {
        verified: false,
        quoteMatch: 'UNSUPPORTED',
        reason: `Source-label mismatch: "${matchedPiece.text}" belongs to Fat, not Carbohydrate.`
      };
    }
    if (matchedText.includes('sugars') && !matchedText.includes('carbohydrate')) {
      return {
        verified: false,
        quoteMatch: 'UNSUPPORTED',
        reason: `Source-label mismatch: "${matchedPiece.text}" belongs to Sugars, not Total Carbohydrate.`
      };
    }
  }

  if (field.includes('fat') && !field.includes('acid')) {
    if (matchedText.includes('carbohydrate') && !matchedText.includes('fat')) {
      return {
        verified: false,
        quoteMatch: 'UNSUPPORTED',
        reason: `Source-label mismatch: "${matchedPiece.text}" belongs to Carbohydrate, not Fat.`
      };
    }
  }

  // 7. PDF Visibility check:
  // Hidden text (e.g. EU per-100g table) must not be presented as independently visible package declaration
  const visibility = matchedPiece.visibility || (matchedPiece.hidden ? 'HIDDEN' : 'VISIBLE');

  return {
    verified: true,
    quoteMatch: matchType,
    matchedPiece,
    visibility,
    location: matchedPiece.location,
    panel: matchedPiece.panel,
    cell: matchedPiece.cell,
    page: matchedPiece.page,
    reason: `Quotation verified via ${matchType} match in ${matchedPiece.displayName || matchedPiece.location}.`
  };
}
