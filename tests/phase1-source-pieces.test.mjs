import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdfSourcePieces,
  parseExcelSourcePieces,
  parseOrganizerSamples
} from '../lib/source-pieces.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const samplesDir = join(root, 'samples', 'organizer');
const pdfPath = join(samplesDir, 'DancingFish_Granola_Berry_US_Carton.pdf');
const xlsxPath = join(samplesDir, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');

describe('Phase 1 — Read files with positions (15 Oct)', () => {

  test('both of Esko sample files parse successfully', () => {
    const samples = parseOrganizerSamples(samplesDir);
    assert.ok(samples.pdf, 'PDF sample must parse');
    assert.ok(samples.excel, 'Excel sample must parse');
    assert.ok(samples.pdf.pieces.length > 50, 'PDF should produce structured pieces');
    assert.ok(samples.excel.pieces.length > 30, 'Excel should produce structured pieces');
  });

  test('each piece shows its file, and either panel (PDF) or cell (Excel)', () => {
    const samples = parseOrganizerSamples(samplesDir);

    for (const piece of samples.pdf.pieces) {
      assert.equal(piece.file, 'DancingFish_Granola_Berry_US_Carton.pdf', 'PDF piece must show file name');
      assert.ok(piece.panel, `PDF piece "${piece.text}" must show its panel`);
      assert.ok(piece.sourceType === 'pdf', 'Must have sourceType pdf');
      assert.ok(Array.isArray(piece.box) && piece.box.length === 4, 'Must have box coordinates');
      assert.ok(typeof piece.page === 'number', 'Must have page number');
    }

    for (const piece of samples.excel.pieces) {
      assert.equal(piece.file, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx', 'Excel piece must show file name');
      assert.ok(piece.cell, `Excel piece "${piece.text}" must show its cell coordinate`);
      assert.ok(piece.sheet, 'Excel piece must show sheet name');
      assert.ok(piece.sourceType === 'excel', 'Must have sourceType excel');
      assert.ok(['A', 'B', 'C'].includes(piece.col), `Excel column must be A-C only, got ${piece.col}`);
    }
  });

  test('Excel parser strictly reads columns A–C only (scaled columns D+ are Excel 365 formulas)', () => {
    const excelRes = parseExcelSourcePieces(xlsxPath);
    assert.ok(excelRes.pieces.length > 0);

    const distinctCols = new Set(excelRes.pieces.map(p => p.col));
    for (const col of distinctCols) {
      assert.ok(['A', 'B', 'C'].includes(col), `Column ${col} is beyond A-C`);
    }

    // Verify cell coordinates are strictly A, B, or C
    for (const piece of excelRes.pieces) {
      assert.match(piece.cell, /^[ABC]\d+$/, `Cell ${piece.cell} must be in column A, B, or C`);
    }
  });

  test('"Art orientation" and "Copy free" are in the ignored list', () => {
    const pdfRes = parsePdfSourcePieces(pdfPath);
    assert.ok(Array.isArray(pdfRes.ignoredList), 'Must have ignoredList');

    const ignoredTexts = pdfRes.ignoredList.map(p => p.text.toLowerCase());
    const artOrientationFound = ignoredTexts.some(t => t.includes('art orientation'));
    const copyFreeFound = ignoredTexts.some(t => t.includes('copy free'));

    assert.ok(artOrientationFound, '"Art orientation" must be present in ignored list');
    assert.ok(copyFreeFound, '"Copy free" must be present in ignored list');

    // Also verify their ignored flag is true
    const artPieces = pdfRes.ignoredList.filter(p => p.text.toLowerCase().includes('art orientation'));
    for (const ap of artPieces) {
      assert.equal(ap.ignored, true);
    }
  });

  test('the EU per-100 g table is marked hidden by checking against artwork occlusion render', () => {
    const pdfRes = parsePdfSourcePieces(pdfPath);
    assert.ok(Array.isArray(pdfRes.hiddenPieces), 'Must have hiddenPieces');

    const hiddenTexts = pdfRes.hiddenPieces.map(p => p.text.toLowerCase());
    const euTableMarkers = ['typical values', '100g', '1868kj', 'salt 0.04'];

    const foundMarkers = euTableMarkers.filter(marker => hiddenTexts.some(t => t.includes(marker)));
    assert.ok(foundMarkers.length >= 2, `EU per-100g table text must be marked hidden. Found: ${foundMarkers.join(', ')}`);

    for (const hp of pdfRes.hiddenPieces) {
      assert.equal(hp.hidden, true);
      assert.ok(hp.hiddenReason, 'Hidden piece must have a documented hiddenReason');
    }
  });

  test('"1 5 g" reads as "15 g" after letter-spaced text rebuilding', () => {
    const pdfRes = parsePdfSourcePieces(pdfPath);

    // Look for piece where text is '15 g' rebuilt from letter-spaced '1 5 g'
    const fifteenGramsPieces = pdfRes.pieces.filter(p => p.text === '15 g' && p.rawText.includes('1 5 g'));
    assert.ok(fifteenGramsPieces.length > 0, '"1 5 g" must be read and rebuilt as "15 g"');

    const target = fifteenGramsPieces[0];
    assert.equal(target.text, '15 g');
    assert.match(target.rawText, /1\s+5\s*g/);
    assert.equal(target.letterSpacedRebuilt, true);
    assert.equal(target.hidden, true, 'The 1 5 g piece from the EU table should also be marked hidden');
  });

  test('curved and tracked phrases like "GRANOLA" and "PACKED WITH GOODNESS" are reconstructed', () => {
    const pdfRes = parsePdfSourcePieces(pdfPath);
    const activeTexts = pdfRes.activePieces.map(p => p.text);

    assert.ok(activeTexts.includes('GRANOLA'), 'Curved word "GRANOLA" must be reconstructed');
    assert.ok(activeTexts.includes('PACKED WITH GOODNESS'), 'Curved phrase "PACKED WITH GOODNESS" must be reconstructed');
  });
});
