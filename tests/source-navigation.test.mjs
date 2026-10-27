import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSourceLabel, renderSourceChip } from '../public/source-chip.js';
import { validateSourceContract } from '../public/source-viewer.js';

describe('Phase 4 — Source Navigation & Clickable Chips', () => {
  it('formats DOCX source chips with paragraph provenance', () => {
    const chipLabel = formatSourceLabel({
      sourceType: 'docx',
      name: 'Product_Spec.docx',
      paragraph: 17
    });
    assert.equal(chipLabel, 'DOCX · Paragraph 17');
  });

  it('formats Plain PDF source chips with page and line reference', () => {
    const chipLabel = formatSourceLabel({
      role: 'PRODUCT_SPECIFICATION',
      sourceType: 'plain_pdf',
      name: 'Tech_Spec.pdf',
      page: 4,
      line: 12
    });
    assert.equal(chipLabel, 'PDF · Page 4 · Line 12');
  });

  it('formats Notes and TXT chips with exact line reference', () => {
    const chipLabel = formatSourceLabel({
      role: 'REVIEWER_NOTES',
      sourceType: 'note',
      name: 'QA_Notes.txt',
      line: 5
    });
    assert.equal(chipLabel, 'Notes · Line 5');
  });

  it('formats Old Design Image chips as AI Suggested observation', () => {
    const chipLabel = formatSourceLabel({
      role: 'PREVIOUS_DESIGN',
      sourceType: 'image',
      name: 'Old_Packaging.png'
    });
    assert.equal(chipLabel, 'IMAGE · Old Design · AI Suggested');
  });

  it('formats Excel spreadsheet chips with sheet and cell coordinates', () => {
    const chipLabel = formatSourceLabel({
      sourceType: 'spreadsheet',
      name: 'Content_Sheet.xlsx',
      sheet: 'US',
      cell: 'B26'
    });
    assert.equal(chipLabel, 'Content_Sheet · US!B26');
  });

  it('validates canonical source chip data contract (Phase 18)', () => {
    const contract = validateSourceContract({
      documentId: 'doc-dancing-fish-carton',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      sourcePieceIds: ['sp_front_1', 'sp_front_2'],
      sourceType: 'artwork',
      role: 'ARTWORK',
      location: 'Front panel (PDP)',
      quote: 'BERRY CRUNCH GRANOLA',
      method: 'pdf_text_extraction'
    });

    assert.ok(contract);
    assert.equal(contract.documentId, 'doc-dancing-fish-carton');
    assert.equal(contract.role, 'ARTWORK');
    assert.equal(contract.sourceType, 'artwork');
    assert.equal(contract.location, 'Front panel (PDP)');
    assert.equal(contract.quote, 'BERRY CRUNCH GRANOLA');
    assert.equal(contract.verificationState, 'SOURCE_VERIFIED');
  });

  it('renders interactive button chip markup with embedded data attributes', () => {
    const markup = renderSourceChip({
      documentName: 'Content_Sheet.xlsx',
      sheet: 'US',
      cell: 'B4',
      quote: '480g',
      authority: 'approved'
    });

    assert.ok(markup.includes('data-source-chip="true"'));
    assert.ok(markup.includes('data-sheet="US"'));
    assert.ok(markup.includes('data-cell="B4"'));
    assert.ok(markup.includes('Content_Sheet · US!B4'));
  });
});
