import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseOrganizerSamples,
  parseDocxSourcePieces,
  parsePlainPdfSourcePieces,
  parseNoteSourcePieces,
  parseImageSourcePieces
} from '../lib/source-pieces.mjs';
import {
  getDeskSession,
  resetDeskSession,
  resolveDeskConflict,
  answerDeskQuestion,
  uploadDeskInput
} from '../lib/evidence-desk.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');
const samplesDir = join(root, 'samples', 'organizer');

describe('Phase 4 — Core UI flow and Multi-Source Readers', () => {

  it('Word reader (.docx): extracts text pieces with exact paragraph locations', () => {
    const docxPath = join(samplesDir, 'DancingFish_Granola_Product_Spec.docx');
    const result = parseDocxSourcePieces(docxPath);

    assert.equal(result.sourceType, 'docx');
    assert.ok(result.pieces.length >= 5, 'Should extract multiple paragraphs');

    const firstPiece = result.pieces[0];
    assert.equal(firstPiece.sourceType, 'docx');
    assert.ok(firstPiece.paragraph >= 1, 'Should have 1-indexed paragraph number');
    assert.ok(firstPiece.location.includes('Paragraph'), 'Location must specify Paragraph');
    assert.ok(firstPiece.text.includes('Dancing Fish'), 'Should extract text content');

    // Verify all pieces have paragraph locations and no panels
    for (const piece of result.pieces) {
      assert.equal(piece.panel, null, 'Word reader must not assign panel names');
      assert.ok(piece.location, 'Every piece must have a location');
    }
  });

  it('Plain-PDF document reader: extracts text pieces with page and line (no panels) for product specs', () => {
    const plainPdfPath = join(samplesDir, 'DancingFish_Granola_Tech_Spec.pdf');
    const result = parsePlainPdfSourcePieces(plainPdfPath);

    assert.equal(result.sourceType, 'plain_pdf');
    assert.ok(result.pieces.length >= 8, 'Should extract multiple lines from plain PDF');

    const p1 = result.pieces[0];
    assert.equal(p1.sourceType, 'plain_pdf');
    assert.equal(p1.page, 1, 'Should have page number');
    assert.ok(p1.line >= 1, 'Should have line number');
    assert.ok(p1.location.includes('Page 1, Line'), 'Location must state page and line');
    assert.equal(p1.panel, null, 'Plain-PDF must not assign dieline panels');

    // Confirm presence of key technical spec facts
    const hasServing = result.pieces.some(p => p.text.includes('Serving Size: 1/2 cup (55 g)'));
    const hasBarcode = result.pieces.some(p => p.text.includes('1 20000 00003 6'));
    assert.ok(hasServing, 'Should extract serving size fact');
    assert.ok(hasBarcode, 'Should extract barcode fact');
  });

  it('Notes reader (.txt or pasted text): line numbers serve as the source location', () => {
    const txtPath = join(samplesDir, 'DancingFish_QA_Notes.txt');
    const result = parseNoteSourcePieces(txtPath);

    assert.equal(result.sourceType, 'note');
    assert.ok(result.pieces.length >= 5, 'Should extract lines from notes file');

    for (const piece of result.pieces) {
      assert.equal(piece.sourceType, 'note');
      assert.ok(piece.line >= 1, 'Must have line number');
      assert.equal(piece.location, `Line ${piece.line}`);
      assert.equal(piece.panel, null);
    }

    // Also test raw pasted string intake
    const pastedText = "Line 1: Batch QA check approved\nLine 2: Tree nut line validation confirmed";
    const pastedResult = parseNoteSourcePieces(pastedText);
    assert.equal(pastedResult.pieces.length, 2);
    assert.equal(pastedResult.pieces[0].location, "Line 1");
    assert.equal(pastedResult.pieces[1].location, "Line 2");
  });

  it('Image reader (.png/.jpg): vision model extracts brand assets and packaging facts start AI-suggested', () => {
    const imgPath = join(samplesDir, 'DancingFish_Old_Design.png');
    const result = parseImageSourcePieces(imgPath);

    assert.equal(result.sourceType, 'image');
    assert.ok(result.pieces.length >= 5, 'Should extract design elements');

    // Verify facts start AI-suggested
    for (const piece of result.pieces) {
      assert.equal(piece.sourceType, 'image');
      assert.equal(piece.state, 'AI_SUGGESTED', 'Facts extracted from images must start AI-suggested');
      assert.ok(piece.isImageVision);
      assert.ok(piece.location.includes('Visual inspection'));
    }

    // Verify brand assets detected
    const hasLogo = result.pieces.some(p => p.text.includes('Dancing Fish Logo'));
    const hasColours = result.pieces.some(p => p.text.includes('Midnight Navy Blue'));
    const hasTagline = result.pieces.some(p => p.text.includes('Packed with Goodness'));
    const hasVegan = result.pieces.some(p => p.text.includes('Certified Vegan'));

    assert.ok(hasLogo, 'Should identify brand logo');
    assert.ok(hasColours, 'Should identify brand colours');
    assert.ok(hasTagline, 'Should identify tagline');
    assert.ok(hasVegan, 'Should identify certified vegan mark');
  });

  it('Evidence Desk: live progress and all 6 input sources initialize cleanly', () => {
    const session = resetDeskSession('test-suite-desk');
    assert.equal(session.progress.stage, 'READY');
    assert.equal(session.progress.percent, 100);
    assert.equal(session.files.length, 6, 'Should load all 6 input formats');

    const types = session.files.map(f => f.type);
    assert.ok(types.includes('pdf'), 'Carton PDF included');
    assert.ok(types.includes('xlsx'), 'Content sheet Excel included');
    assert.ok(types.includes('docx'), 'Product spec Word included');
    assert.ok(types.includes('plain_pdf'), 'Tech spec plain PDF included');
    assert.ok(types.includes('note'), 'QA notes included');
    assert.ok(types.includes('image'), 'Old design image included');
  });

  it('Fact Sheet: produces proven facts with source chips containing exact locations', () => {
    const session = getDeskSession('test-suite-desk');
    assert.ok(session.facts.length >= 15, 'Should produce comprehensive Fact Sheet');

    // Net Quantity should have multiple sources across files
    const netFact = session.facts.find(f => f.field === 'net_quantity');
    assert.ok(netFact);
    assert.equal(netFact.state, 'PROVEN');
    assert.ok(netFact.sources.length >= 3, 'Net quantity should cite multiple sources');

    // Verify source chips have exact coordinates
    const excelChip = netFact.sources.find(s => s.type === 'excel');
    assert.equal(excelChip.cell, 'B4');

    const pdfChip = netFact.sources.find(s => s.type === 'pdf');
    assert.ok(pdfChip.panel.includes('Front panel'));

    const docxChip = netFact.sources.find(s => s.type === 'docx');
    assert.equal(docxChip.paragraph, 3);
  });

  it('Conflict cards: active conflicts appear and resolving a conflict updates Fact Sheet live', () => {
    const session = resetDeskSession('test-suite-conflict');
    const openConflictsBefore = session.conflicts.filter(c => c.status === 'OPEN').length;
    assert.equal(openConflictsBefore, 3, 'Should have 3 open conflicts initially');

    // 1. Honey conflict is initially CONFLICT state
    const honeyBefore = session.facts.find(f => f.field === 'honey_percentage');
    assert.equal(honeyBefore.state, 'CONFLICT');

    // 2. Resolve Honey conflict in favor of Specification (9%)
    const updatedSession = resolveDeskConflict('test-suite-conflict', {
      conflictId: 'CONFLICT-HONEY-CONTENT',
      chosenValue: '9%',
      chosenSource: 'Specification',
      note: 'Master specification formula approved by QC'
    });

    // 3. Conflict card transitions to RESOLVED
    const honeyConflict = updatedSession.conflicts.find(c => c.id === 'CONFLICT-HONEY-CONTENT');
    assert.equal(honeyConflict.status, 'RESOLVED');
    assert.equal(honeyConflict.resolvedValue, '9%');

    // 4. Fact Sheet updates immediately to PROVEN with 9%
    const honeyAfter = updatedSession.facts.find(f => f.field === 'honey_percentage');
    assert.equal(honeyAfter.state, 'PROVEN');
    assert.equal(honeyAfter.value, '9%');
    assert.equal(honeyAfter.conflictReason, null);

    // 5. Open conflicts count decrements
    const openConflictsAfter = updatedSession.conflicts.filter(c => c.status === 'OPEN').length;
    assert.equal(openConflictsAfter, 2);
  });

  it('Questions stack: answering a question updates the Fact Sheet and Brief Matrix live', () => {
    const session = resetDeskSession('test-suite-questions');
    assert.equal(session.questions.length, 10, 'Should have at most 10 prioritized questions');

    // 1. Answer Added Sugars question: remove the claim
    const updated1 = answerDeskQuestion('test-suite-questions', {
      questionId: 'Q-ADDED-SUGARS',
      answerId: 'opt-remove-claim',
      note: 'Remove claim per FDA 21 CFR 101.60 added sugar restriction'
    });

    const sugarQ = updated1.questions.find(q => q.id === 'Q-ADDED-SUGARS');
    assert.equal(sugarQ.status, 'ANSWERED');

    const sugarFact = updated1.facts.find(f => f.field === 'claim_added_sugar');
    assert.ok(['PROVEN', 'HUMAN_CONFIRMED'].includes(sugarFact.state));
    assert.ok(sugarFact.value.includes('Remove the "No Added Sugar" claim'));

    // 2. Answer Brand Logo question: Keep leaping fish logo
    const updated2 = answerDeskQuestion('test-suite-questions', {
      questionId: 'Q-BRAND-LOGO',
      answerId: 'opt-keep-logo'
    });

    const logoQ = updated2.questions.find(q => q.id === 'Q-BRAND-LOGO');
    assert.equal(logoQ.status, 'ANSWERED');

    // Verify brief matrix keep feed updated
    assert.ok(updated2.briefFeed.keep.some(item => item.includes('Keep leaping fish logo')));
  });

  it('Intake upload: allows uploading new notes and updates pieces count', () => {
    const session = resetDeskSession('test-suite-upload');
    const filesCountBefore = session.files.length;
    const piecesCountBefore = session.summary.totalPieces;

    const res = uploadDeskInput('test-suite-upload', {
      fileName: 'Regulatory_Counsel_Memo.txt',
      content: 'Line 1: Allergen advisory statement reviewed\nLine 2: Tree nut species must be specified explicitly\nLine 3: Barcode check digit confirmed compliant',
      fileType: 'txt'
    });

    assert.equal(res.session.files.length, filesCountBefore + 1);
    assert.equal(res.newFile.piecesCount, 3);
    assert.equal(res.session.summary.totalPieces, piecesCountBefore + 3);
  });

});
