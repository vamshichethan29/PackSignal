import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSourceFile,
  parsePdfSourcePieces,
  parseExcelSourcePieces,
  parseOrganizerSamples
} from '../lib/source-pieces.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');
const samplesDir = join(root, 'samples', 'organizer');
const pdfPath = join(samplesDir, 'DancingFish_Granola_Berry_US_Carton.pdf');
const xlsxPath = join(samplesDir, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');

test('Unified Source Piece Contract — Phase 1', async (t) => {
  await t.test('PDF source pieces satisfy schemaVersion: source-piece/v1', () => {
    const res = parsePdfSourcePieces(pdfPath);
    assert.ok(res.pieces.length > 50, 'Must have at least 50 pieces');
    
    for (const p of res.pieces) {
      assert.equal(p.schemaVersion, 'source-piece/v1');
      assert.ok(p.id.startsWith('sp_'), `ID must start with sp_: ${p.id}`);
      assert.equal(p.documentName, 'DancingFish_Granola_Berry_US_Carton.pdf');
      assert.ok(p.documentSha256 && p.documentSha256.length === 64, 'Must have 64-char sha256');
      assert.equal(p.sourceType, 'pdf');
      assert.equal(p.role, 'artwork');
      assert.ok(p.text, 'Must have normalized text');
      assert.ok(p.rawText, 'Must have raw text');
      assert.ok(p.location, 'Must have location object');
      assert.equal(p.location.page, 1);
      assert.ok(Array.isArray(p.location.sourceQuads), 'sourceQuads must be array');
      assert.ok(p.location.panelId, 'Must have panelId');
      assert.ok(p.location.panelRole, 'Must have panelRole');
      assert.ok(p.visibility, 'Must have visibility');
      assert.ok(p.classification, 'Must have classification');
      assert.ok(Array.isArray(p.transforms), 'transforms must be array');
      assert.ok(p.provenance, 'Must have provenance');
    }
  });

  await t.test('Excel source pieces satisfy schemaVersion: source-piece/v1 and strictly columns A–C', () => {
    const res = parseExcelSourcePieces(xlsxPath);
    assert.ok(res.pieces.length > 30, 'Must have at least 30 pieces');

    for (const p of res.pieces) {
      assert.equal(p.schemaVersion, 'source-piece/v1');
      assert.ok(p.id.startsWith('sp_'), `ID must start with sp_: ${p.id}`);
      assert.equal(p.documentName, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
      assert.ok(p.documentSha256 && p.documentSha256.length === 64);
      assert.ok(['excel', 'xlsx'].includes(p.sourceType));
      assert.equal(p.role, 'source');
      assert.ok(p.location.sheet, 'Must have sheet name');
      assert.ok(p.location.cell, 'Must have cell coordinate');
      assert.ok(['A', 'B', 'C'].includes(p.location.column), `Column must be A, B, or C: ${p.location.column}`);
      assert.ok(p.cell.startsWith('A') || p.cell.startsWith('B') || p.cell.startsWith('C'));
    }
  });

  await t.test('Ignored guide pieces are preserved separately with full auditability', () => {
    const res = parsePdfSourcePieces(pdfPath);
    assert.ok(Array.isArray(res.ignoredList), 'ignoredList must exist');
    assert.ok(res.ignoredList.length > 0, 'Must have ignored pieces');

    const ignoredTexts = res.ignoredList.map(p => p.text.toLowerCase());
    assert.ok(ignoredTexts.some(t => t.includes('art orientation')), 'Art orientation must be in ignoredList');
    assert.ok(ignoredTexts.some(t => t.includes('copy free')), 'Copy free must be in ignoredList');

    for (const p of res.ignoredList) {
      assert.equal(p.schemaVersion, 'source-piece/v1');
      assert.ok(['CONSTRUCTION_GUIDE', 'DIELINE_LABEL', 'ANNOTATION'].includes(p.classification));
      assert.equal(p.ignored, true);
      assert.ok(p.ignoreReason, 'Must carry ignoreReason');
      assert.ok(p.provenance.filterRuleId, 'Must carry filterRuleId');
    }
  });

  await t.test('Hidden text detection for EU nutrition table is render-verified', () => {
    const res = parsePdfSourcePieces(pdfPath);
    assert.ok(Array.isArray(res.hiddenPieces), 'hiddenPieces must exist');
    assert.ok(res.hiddenPieces.length > 0, 'Must have hidden pieces');

    const hiddenTexts = res.hiddenPieces.map(p => p.text.toLowerCase());
    assert.ok(hiddenTexts.some(t => t.includes('100g') || t.includes('typical values')), 'EU table must be hidden');

    for (const p of res.hiddenPieces) {
      assert.equal(p.visibility, 'HIDDEN');
      assert.equal(p.hidden, true);
      assert.ok(p.hiddenReason, 'Must have hiddenReason');
    }
  });

  await t.test('Letter-spaced text "1 5 g" is reconstructed to "15 g" with transform audit trail', () => {
    const res = parsePdfSourcePieces(pdfPath);
    const target = res.pieces.find(p => p.text === '15 g' && p.rawText.includes('1 5 g'));
    assert.ok(target, 'Reconstructed 15 g piece must exist');
    assert.equal(target.text, '15 g');
    assert.ok(target.transforms.some(t => t.type === 'letter_spacing_reconstruction'));
  });

  await t.test('Curved text "GRANOLA" and "PACKED WITH GOODNESS" are reconstructed with source quads', () => {
    const res = parsePdfSourcePieces(pdfPath);
    const granola = res.pieces.find(p => p.text.includes('GRANOLA'));
    assert.ok(granola, 'GRANOLA curved piece must exist');
    assert.ok(granola.isCurved || granola.reconstructed);
    assert.ok(granola.sourceQuads && granola.sourceQuads.length > 0);

    const packed = res.pieces.find(p => p.text.includes('PACKED WITH GOODNESS'));
    assert.ok(packed, 'PACKED WITH GOODNESS curved piece must exist');
    assert.ok(packed.isCurved || packed.reconstructed);
  });

  await t.test('Extraction diagnostics are present on both PDF and Excel results', () => {
    const pdfRes = parsePdfSourcePieces(pdfPath);
    assert.ok(pdfRes.extractionDiagnostics, 'PDF diagnostics must exist');
    assert.equal(pdfRes.extractionDiagnostics.pageCount, 1);
    assert.ok(pdfRes.extractionDiagnostics.nativePieces > 0);
    assert.ok(pdfRes.extractionDiagnostics.reconstructedPieces > 0);
    assert.ok(pdfRes.extractionDiagnostics.guidePiecesIgnored > 0);

    const xlsxRes = parseExcelSourcePieces(xlsxPath);
    assert.ok(xlsxRes.extractionDiagnostics, 'Excel diagnostics must exist');
    assert.ok(xlsxRes.extractionDiagnostics.worksheetCount > 0);
    assert.ok(xlsxRes.extractionDiagnostics.acPopulatedSourceCells > 0);
    assert.ok(xlsxRes.extractionDiagnostics.excludedFormulaColumns > 0);
  });

  await t.test('parseOrganizerSamples aggregates all pieces with audit counts', () => {
    const agg = parseOrganizerSamples();
    assert.ok(agg.pdf.pieces.length > 0);
    assert.ok(agg.excel.pieces.length > 0);
    assert.ok(agg.allPieces.length > 80);
    assert.ok(agg.allActivePieces.length > 0);
    assert.ok(agg.allIgnoredPieces.length > 0);
    assert.ok(agg.allHiddenPieces.length > 0);
  });
});
