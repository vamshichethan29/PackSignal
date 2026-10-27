/**
 * PackSignal Phase 2 — Source Authority & Qualifiers Unit Tests
 * (tests/fact-authority.test.mjs)
 * 
 * Verifies:
 * - Draft status preserved separately from verification state.
 * - Sheet notes containing "assumed", "verify", "reconstructed" create review qualifiers.
 * - Scoped note resolution: a note on row 26 does NOT taint facts from row 48.
 * - Human approval is never inferred automatically.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractFactsFromExcelPieces } from '../lib/facts/fact-extraction.mjs';

describe('Phase 2 — Source Authority & Scoped Qualifier Handling', () => {

  const excelPiecesWithNotes = [
    // Header status: Draft / In Review
    {
      id: 'sp_stat',
      cell: 'E3',
      row: 3,
      col: 5,
      text: 'Draft / In Review',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    },
    // Row 26: Ingredient list with note "please verify" and "reconstructed"
    {
      id: 'sp_r26_a',
      cell: 'A26',
      row: 26,
      col: 1,
      text: 'Ingredient List',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    },
    {
      id: 'sp_r26_b',
      cell: 'B26',
      row: 26,
      col: 2,
      text: 'INGREDIENTS: Organic Wholegrain Oat Flakes (79%), Honey (9%).',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    },
    {
      id: 'sp_r26_c',
      cell: 'C26',
      row: 26,
      col: 3,
      text: 'Back-panel ingredient copy overlaps dieline guide lines in the source file, so line breaks/order are reconstructed — please verify word-for-word against the native art file before release.',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    },
    // Row 48: Total Fat with ordinary note
    {
      id: 'sp_r48_a',
      cell: 'A48',
      row: 48,
      col: 1,
      text: 'Total Fat',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    },
    {
      id: 'sp_r48_b',
      cell: 'B48',
      row: 48,
      col: 2,
      text: '15g',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    },
    {
      id: 'sp_r48_c',
      cell: 'C48',
      row: 48,
      col: 3,
      text: '2.2%*',
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_sheet'
    }
  ];

  it('1. Content sheet Draft / In Review status is preserved as sourceAuthority = DRAFT', () => {
    const res = extractFactsFromExcelPieces(excelPiecesWithNotes);
    assert.ok(res.facts.length > 0);

    for (const f of res.facts) {
      assert.equal(f.sourceAuthority, 'DRAFT', 'All facts from draft sheet must carry sourceAuthority: DRAFT');
    }
  });

  it('2. Note on row 26 with "verify" and "reconstructed" makes row 26 fact AI_SUGGESTED', () => {
    const res = extractFactsFromExcelPieces(excelPiecesWithNotes);
    const ingFact = res.facts.find(f => f.field === 'ingredient.list');

    assert.ok(ingFact);
    assert.equal(ingFact.verificationState, 'AI_SUGGESTED', 'Fact with "verify" note must be AI_SUGGESTED');
    assert.ok(ingFact.qualifiers.includes('NEEDS_SOURCE_CONFIRMATION'));
    assert.ok(ingFact.qualifiers.includes('RECONSTRUCTED_SOURCE_NOTE'));
    assert.ok(ingFact.qualifiers.includes('VERIFY_BEFORE_RELEASE'));
  });

  it('3. Unrelated note does NOT taint facts in other rows (Row 48 is VERIFIED)', () => {
    const res = extractFactsFromExcelPieces(excelPiecesWithNotes);
    const fatFact = res.facts.find(f => f.field === 'nutrition.fat.total');

    assert.ok(fatFact);
    // Crucial: row 48 has no qualifier notes! It must be VERIFIED (faithfully read from source cell)
    assert.equal(fatFact.verificationState, 'VERIFIED', 'Row 48 must not be tainted by row 26 note');
    assert.equal(fatFact.qualifiers.length, 0);
  });

  it('4. Human approval is not inferred without an explicit review decision', () => {
    const res = extractFactsFromExcelPieces(excelPiecesWithNotes);
    for (const f of res.facts) {
      assert.equal(f.humanApproval, undefined, 'Human approval must not be pre-populated or inferred');
    }
  });
});
