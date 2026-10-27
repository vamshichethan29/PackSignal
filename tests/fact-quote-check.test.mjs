/**
 * PackSignal Phase 2 — Deterministic Quote Check Unit Tests
 * (tests/fact-quote-check.test.mjs)
 * 
 * Verifies:
 * - Valid exact quote accepted.
 * - Nonexistent quote rejected.
 * - Wrong document rejected.
 * - Fabricated cell reference rejected.
 * - Unsupported page coordinate rejected.
 * - Normalized text reconstruction verified.
 * - Wrong nutrient label rejected ("Fat 15g" cannot justify carbohydrate fact!).
 * - Hidden visibility detected.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyFactQuote } from '../lib/facts/fact-quote-check.mjs';

describe('Phase 2 — The Quote Check & Grounding Verification', () => {

  const samplePieces = [
    {
      id: 'sp_pdf_1',
      documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      documentSha256: 'sha_pdf_123',
      text: 'Organic Wholegrain Oat Flakes (79%), Honey (1%)',
      rawText: 'Organic Wholegrain Oat Flakes (79%), Honey (1%)',
      page: 1,
      panel: 'Back panel',
      visibility: 'VISIBLE',
      location: 'Back panel'
    },
    {
      id: 'sp_pdf_fat',
      documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      documentSha256: 'sha_pdf_123',
      text: 'Total Fat 15g',
      rawText: 'Total Fat 15g',
      page: 1,
      panel: 'Left panel',
      visibility: 'VISIBLE',
      location: 'Left panel'
    },
    {
      id: 'sp_pdf_carb_hidden',
      documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      documentSha256: 'sha_pdf_123',
      text: 'Carbohydrate 65g',
      rawText: 'C a r b o h y d r a t e 6 5 g',
      page: 1,
      panel: 'Left panel',
      visibility: 'HIDDEN',
      hidden: true,
      letterSpacedRebuilt: true,
      location: 'Left panel'
    },
    {
      id: 'sp_excel_honey',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_xlsx_456',
      text: 'Honey (9%)',
      rawText: 'Honey (9%)',
      sheet: 'Content Sheet - US',
      cell: 'B26',
      visibility: 'VISIBLE',
      location: 'Content Sheet - US!B26'
    }
  ];

  it('1. Accepts valid exact quotation with genuine provenance', () => {
    const candidate = {
      field: 'ingredient.honey.percentage',
      value: '1%',
      source: {
        documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: 'sha_pdf_123',
        page: 1
      },
      evidence: { quote: 'Honey (1%)' }
    };

    const res = verifyFactQuote(candidate, samplePieces);
    assert.equal(res.verified, true);
    assert.equal(res.quoteMatch, 'EXACT');
    assert.equal(res.visibility, 'VISIBLE');
    assert.equal(res.matchedPiece.id, 'sp_pdf_1');
  });

  it('2. Rejects nonexistent quote not found in source text', () => {
    const candidate = {
      field: 'ingredient.honey.percentage',
      value: '99%',
      source: {
        documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: 'sha_pdf_123'
      },
      evidence: { quote: 'Pure Honey (99%)' }
    };

    const res = verifyFactQuote(candidate, samplePieces);
    assert.equal(res.verified, false);
    assert.equal(res.quoteMatch, 'NOT_FOUND');
  });

  it('3. Rejects quote from wrong document or mismatched document hash', () => {
    const candidate = {
      field: 'ingredient.honey.percentage',
      value: '1%',
      source: {
        documentId: 'Completely_Different_File.pdf',
        documentSha256: 'sha_wrong_hash'
      },
      evidence: { quote: 'Honey (1%)' }
    };

    const res = verifyFactQuote(candidate, samplePieces);
    assert.equal(res.verified, false);
    assert.equal(res.quoteMatch, 'NOT_FOUND');
    assert.ok(res.reason.includes('not found') || res.reason.includes('mismatch'));
  });

  it('4. Rejects fabricated cell reference not present in spreadsheet pieces', () => {
    const candidate = {
      field: 'ingredient.honey.percentage',
      value: '9%',
      source: {
        documentId: 'Content_Sheet.xlsx',
        documentSha256: 'sha_xlsx_456',
        sheet: 'Content Sheet - US',
        cell: 'Z999' // Fabricated cell!
      },
      evidence: { quote: 'Honey (9%)' }
    };

    const res = verifyFactQuote(candidate, samplePieces);
    assert.equal(res.verified, false);
    assert.equal(res.quoteMatch, 'NOT_FOUND');
    assert.ok(res.reason.includes('cell "Z999" does not exist'));
  });

  it('5. Rejects unsupported page number not present in PDF pieces', () => {
    const candidate = {
      field: 'ingredient.honey.percentage',
      value: '1%',
      source: {
        documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: 'sha_pdf_123',
        page: 99 // PDF only has 1 page!
      },
      evidence: { quote: 'Honey (1%)' }
    };

    const res = verifyFactQuote(candidate, samplePieces);
    assert.equal(res.verified, false);
    assert.equal(res.quoteMatch, 'NOT_FOUND');
    assert.ok(res.reason.includes('page 99 not found'));
  });

  it('6. Verifies normalized text reconstruction (letter-spaced text)', () => {
    const candidate = {
      field: 'nutrition.carbohydrate.eu_table',
      value: '65g',
      source: {
        documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: 'sha_pdf_123'
      },
      evidence: { quote: 'Carbohydrate 65g' }
    };

    const res = verifyFactQuote(candidate, samplePieces);
    assert.equal(res.verified, true);
    assert.ok(res.quoteMatch === 'EXACT' || res.quoteMatch === 'VERIFIED_RECONSTRUCTION');
    // Notice: visibility is faithfully reported as HIDDEN!
    assert.equal(res.visibility, 'HIDDEN');
  });

  it('7. CRITICAL: Rejects wrong nutrient label ("Fat 15g" must not justify carbohydrate fact)', () => {
    const badCarbCandidate = {
      field: 'nutrition.carbohydrate.total',
      value: '15g',
      source: {
        documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: 'sha_pdf_123',
        sourcePieceIds: ['sp_pdf_fat'] // Piece has "Total Fat 15g"!
      },
      evidence: { quote: '15g' }
    };

    const res = verifyFactQuote(badCarbCandidate, samplePieces);
    assert.equal(res.verified, false, 'Candidate trying to justify carbohydrate with Fat 15g must fail!');
    assert.equal(res.quoteMatch, 'UNSUPPORTED');
    assert.ok(res.reason.includes('Source-label mismatch') && res.reason.includes('Fat'));
  });

  it('8. Accepts image-only mark with verified visual evidence reference', () => {
    const visionCandidate = {
      field: 'claims.dietary.vegan_mark',
      value: 'Vegan Mark',
      source: {
        documentId: 'carton.pdf',
        documentSha256: 'sha_art',
        documentRole: 'artwork'
      },
      evidence: {
        method: 'rendered_page_vision',
        quote: null, // Image-only: no text quote!
        visualEvidenceRef: {
          page: 1,
          crop: [100, 200, 300, 400],
          notes: 'Observed logo mark on Front PDP'
        }
      }
    };

    const res = verifyFactQuote(visionCandidate, samplePieces);
    assert.equal(res.verified, true);
    assert.equal(res.quoteMatch, 'IMAGE_EVIDENCE');
  });
});
