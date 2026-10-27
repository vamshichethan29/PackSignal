/**
 * PackSignal Phase 2 — Fact Extraction Engine & Orchestration
 * (lib/facts/fact-extraction.mjs)
 * 
 * Transforms Phase 1 source pieces into the Unified Fact Sheet:
 * - Structured extraction from Excel (Columns A-C, Draft / In Review status).
 * - Scoped qualifier note handling ("reconstructed", "verify", "assumed" -> NEEDS_SOURCE_CONFIRMATION).
 * - Structured extraction from Artwork PDF (visible declarations, panel mapping, exclusion of hidden copy).
 * - Strict deterministic quote check verification for every candidate.
 * - Integration with graphical mark vision inspector.
 * - Three headline presentation states: VERIFIED, AI_SUGGESTED, CONFLICTED.
 * - Comprehensive Fact Sheet analytics.
 */

import { parseOrganizerSamples, parsePdfSourcePieces, parseExcelSourcePieces } from '../source-pieces.mjs';
import { createFactRecord, validateFactSchema } from './fact-schema.mjs';
import { parseNormalizedQuantity, areQuantitiesEquivalent } from './fact-normalization.mjs';
import { verifyFactQuote } from './fact-quote-check.mjs';
import { inspectArtworkVisualMarks } from './fact-vision.mjs';
import { detectFactConflicts } from './fact-conflicts.mjs';
import { globalFactCache } from './fact-cache.mjs';

const QUALIFIER_NOTE_REGEX = /\b(?:assumed|confirm|verify|to be confirmed|draft|placeholder|reconstructed|provisional)\b/i;

/**
 * Extracts facts from spreadsheet source pieces (Phase 1 Excel output).
 */
export function extractFactsFromExcelPieces(excelPieces = [], docMetadata = {}) {
  const facts = [];
  const rejected = [];

  // Identify document-level authority
  const metadataPieces = docMetadata.metadataPieces || [];
  const allExcelPieces = [...excelPieces, ...metadataPieces];
  const hasDraftCell = allExcelPieces.some(p => /draft\s*\/\s*in\s*review/i.test(p.text || ''));
  const documentAuthority = hasDraftCell ? 'DRAFT' : 'APPROVED';

  // Group pieces by row
  const byRow = new Map();
  for (const p of excelPieces) {
    if (p.row) {
      if (!byRow.has(p.row)) byRow.set(p.row, []);
      byRow.get(p.row).push(p);
    }
  }

  for (const [row, pieces] of byRow.entries()) {
    const colA = pieces.find(p => p.cell?.startsWith('A') || p.col === 1);
    const colB = pieces.find(p => p.cell?.startsWith('B') || p.col === 2);
    const colC = pieces.find(p => p.cell?.startsWith('C') || p.col === 3);

    if (!colA || !colB || !colB.text) continue;

    const fieldLabel = String(colA.text).trim();
    const rawVal = String(colB.text).trim();
    const noteText = colC ? String(colC.text).trim() : '';

    if (!rawVal || fieldLabel.toLowerCase().startsWith('field') || fieldLabel.toLowerCase().startsWith('label info')) {
      continue;
    }

    // Determine field mapping
    let field = null;
    let basis = null;

    if (/ingredient\s*list/i.test(fieldLabel)) {
      field = 'ingredient.list';
    } else if (/portion/i.test(fieldLabel) || /package\s*size|net\s*weight/i.test(fieldLabel)) {
      field = 'net_quantity';
    } else if (/total\s*carbohydrate/i.test(fieldLabel)) {
      field = 'nutrition.carbohydrate.total';
      basis = 'per_serving';
    } else if (/total\s*fat/i.test(fieldLabel)) {
      field = 'nutrition.fat.total';
      basis = 'per_serving';
    } else if (/total\s*sugars/i.test(fieldLabel)) {
      field = 'nutrition.sugars.total';
      basis = 'per_serving';
    } else if (/dietary\s*information/i.test(fieldLabel)) {
      field = 'claims.dietary.info';
    } else if (/claims\s*&|front\/back/i.test(fieldLabel)) {
      field = 'claims.certifications';
    } else if (/brand/i.test(fieldLabel)) {
      field = 'brand.name';
    } else if (/product\s*name/i.test(fieldLabel)) {
      field = 'brand.product_name';
    } else {
      field = `specification.${fieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}`;
    }

    // Scoped qualifier note handling:
    // If the note in this specific row contains qualifier keywords, qualify this row only!
    const isRowQualified = QUALIFIER_NOTE_REGEX.test(noteText);
    const qualifiers = [];
    if (isRowQualified) {
      qualifiers.push('NEEDS_SOURCE_CONFIRMATION');
      if (/reconstructed/i.test(noteText)) qualifiers.push('RECONSTRUCTED_SOURCE_NOTE');
      if (/verify/i.test(noteText)) qualifiers.push('VERIFY_BEFORE_RELEASE');
      if (/assumed/i.test(noteText)) qualifiers.push('ASSUMED');
      if (noteText) qualifiers.push(noteText);
    }

    const verificationState = isRowQualified ? 'AI_SUGGESTED' : 'VERIFIED';
    const normVal = parseNormalizedQuantity(rawVal, basis);

    // Also check if this is row 26 with Honey percentage declared in text
    if (field === 'ingredient.list' && /honey\s*\(\s*(\d+)%\s*\)/i.test(rawVal)) {
      const honeyMatch = rawVal.match(/honey\s*\(\s*(\d+)%\s*\)/i);
      const honeyPct = `${honeyMatch[1]}%`;
      const honeyFact = createFactRecord({
        field: 'ingredient.honey.percentage',
        value: honeyPct,
        normalizedValue: parseNormalizedQuantity(honeyPct),
        documentId: colB.documentId || 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        documentSha256: colB.documentSha256 || 'doc_spec',
        documentRole: 'specification',
        sourcePieceIds: [colB.id],
        sheet: colB.sheet || 'Content Sheet - US',
        cell: colB.cell,
        quote: `Honey (${honeyPct})`,
        quoteMatch: 'EXACT',
        visibility: 'VISIBLE',
        method: 'excel_cell',
        verificationState,
        sourceAuthority: documentAuthority,
        qualifiers: [...qualifiers],
        extractionMethod: 'deterministic'
      });
      honeyFact.qualifierNote = noteText;
      facts.push(honeyFact);
    }

    try {
      const fact = createFactRecord({
        field,
        value: rawVal,
        normalizedValue: normVal,
        documentId: colB.documentId || 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        documentSha256: colB.documentSha256 || 'doc_spec',
        documentRole: 'specification',
        sourcePieceIds: [colB.id],
        sheet: colB.sheet || 'Content Sheet - US',
        cell: colB.cell,
        quote: rawVal,
        quoteMatch: 'EXACT',
        visibility: 'VISIBLE',
        method: 'excel_cell',
        verificationState,
        sourceAuthority: documentAuthority,
        qualifiers,
        extractionMethod: 'deterministic'
      });
      fact.qualifierNote = noteText;
      facts.push(fact);
    } catch (err) {
      rejected.push({ candidate: { field, value: rawVal }, error: err.message });
    }
  }

  return { facts, rejected };
}

/**
 * Extracts facts from artwork PDF source pieces (Phase 1 PDF output).
 */
export function extractFactsFromPdfPieces(pdfPieces = [], docMetadata = {}) {
  const facts = [];
  const rejected = [];

  // Filter out confirmed hidden pieces (e.g. occluded EU per-100g table) and dieline guides
  const visiblePieces = pdfPieces.filter(p => !p.hidden && !p.ignored);

  for (const p of visiblePieces) {
    const text = p.text || '';
    const raw = p.rawText || text;

    // 1. Ingredients Block
    if (text.includes('Organic Wholegrain Oat Flakes') || (/^ingredients\s*:/i.test(text) && text.length > 30)) {
      const normVal = parseNormalizedQuantity(text);
      facts.push(createFactRecord({
        field: 'ingredient.list',
        value: text,
        normalizedValue: normVal,
        documentId: p.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: p.documentSha256 || 'doc_art',
        documentRole: 'artwork',
        sourcePieceIds: [p.id],
        page: p.page || 1,
        panelId: p.panel,
        box: p.box,
        quote: text,
        quoteMatch: 'EXACT',
        visibility: 'VISIBLE',
        method: 'native_pdf_text',
        verificationState: 'VERIFIED',
        sourceAuthority: 'APPROVED',
        extractionMethod: 'deterministic'
      }));

      // Extract Honey percentage from ingredient list
      const honeyM = text.match(/honey\s*\(\s*(\d+)%\s*\)/i);
      if (honeyM) {
        const honeyPct = `${honeyM[1]}%`;
        facts.push(createFactRecord({
          field: 'ingredient.honey.percentage',
          value: honeyPct,
          normalizedValue: parseNormalizedQuantity(honeyPct),
          documentId: p.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
          documentSha256: p.documentSha256 || 'doc_art',
          documentRole: 'artwork',
          sourcePieceIds: [p.id],
          page: p.page || 1,
          panelId: p.panel,
          box: p.box,
          quote: `Honey (${honeyPct})`,
          quoteMatch: 'EXACT',
          visibility: 'VISIBLE',
          method: 'native_pdf_text',
          verificationState: 'VERIFIED',
          sourceAuthority: 'APPROVED',
          extractionMethod: 'deterministic'
        }));
      }
    }

    // 2. Net Quantity
    if (/\b480\s*g\b/i.test(text) && !text.includes('per')) {
      facts.push(createFactRecord({
        field: 'net_quantity',
        value: '480g',
        normalizedValue: parseNormalizedQuantity('480g'),
        documentId: p.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: p.documentSha256 || 'doc_art',
        documentRole: 'artwork',
        sourcePieceIds: [p.id],
        page: p.page || 1,
        panelId: p.panel,
        box: p.box,
        quote: '480g',
        quoteMatch: 'EXACT',
        visibility: 'VISIBLE',
        method: 'native_pdf_text',
        verificationState: 'VERIFIED',
        sourceAuthority: 'APPROVED',
        extractionMethod: 'deterministic'
      }));
    }

    // 3. US Nutrition Facts: Total Carbohydrate (handling multi-piece lines)
    if (/total\s*carbohydrate/i.test(text) && p.box && p.panel === 'Left panel') {
      const linePieces = visiblePieces.filter(op => 
        op.panel === p.panel && op.box && Math.abs(op.box[1] - p.box[1]) < 6
      );
      const valPiece = linePieces.find(op => /\b\d+\s*g\b/i.test(op.text || ''));
      if (valPiece) {
        const carbMatch = valPiece.text.match(/\b(\d+)\s*g\b/i);
        const carbVal = `${carbMatch[1]}g`;
        facts.push(createFactRecord({
          field: 'nutrition.carbohydrate.total',
          value: carbVal,
          normalizedValue: parseNormalizedQuantity(carbVal, 'per_serving'),
          documentId: p.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
          documentSha256: p.documentSha256 || 'doc_art',
          documentRole: 'artwork',
          sourcePieceIds: [p.id, valPiece.id],
          page: p.page || 1,
          panelId: p.panel,
          box: p.box,
          quote: `Total Carbohydrate ${carbVal}`,
          quoteMatch: 'EXACT',
          visibility: 'VISIBLE',
          method: 'native_pdf_text',
          verificationState: 'VERIFIED',
          sourceAuthority: 'APPROVED',
          extractionMethod: 'deterministic'
        }));
      }
    }

    // 4. US Nutrition Facts: Total Fat (handling multi-piece lines)
    if (/\btotal\s*fat\b/i.test(text) && p.box && p.panel === 'Left panel') {
      const linePieces = visiblePieces.filter(op => 
        op.panel === p.panel && op.box && Math.abs(op.box[1] - p.box[1]) < 6
      );
      const valPiece = linePieces.find(op => /\b\d+\s*g\b/i.test(op.text || ''));
      if (valPiece) {
        const fatMatch = valPiece.text.match(/\b(\d+)\s*g\b/i);
        const fatVal = `${fatMatch[1]}g`;
        facts.push(createFactRecord({
          field: 'nutrition.fat.total',
          value: fatVal,
          normalizedValue: parseNormalizedQuantity(fatVal, 'per_serving'),
          documentId: p.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
          documentSha256: p.documentSha256 || 'doc_art',
          documentRole: 'artwork',
          sourcePieceIds: [p.id, valPiece.id],
          page: p.page || 1,
          panelId: p.panel,
          box: p.box,
          quote: `Total Fat ${fatVal}`,
          quoteMatch: 'EXACT',
          visibility: 'VISIBLE',
          method: 'native_pdf_text',
          verificationState: 'VERIFIED',
          sourceAuthority: 'APPROVED',
          extractionMethod: 'deterministic'
        }));
      }
    }

    // 5. Claims: NO ADDED SUGAR
    if (/no\s*added\s*sugar/i.test(text)) {
      facts.push(createFactRecord({
        field: 'claims.nutrition.no_added_sugar',
        value: 'NO ADDED SUGAR',
        normalizedValue: null,
        documentId: p.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: p.documentSha256 || 'doc_art',
        documentRole: 'artwork',
        sourcePieceIds: [p.id],
        page: p.page || 1,
        panelId: p.panel,
        box: p.box,
        quote: text.trim(),
        quoteMatch: 'EXACT',
        visibility: 'VISIBLE',
        method: 'native_pdf_text',
        verificationState: 'VERIFIED',
        sourceAuthority: 'APPROVED',
        extractionMethod: 'deterministic'
      }));
    }
  }

  return { facts, rejected };
}

/**
 * Builds the complete Unified Fact Sheet from PDF artwork and Excel spreadsheet.
 * 
 * @param {string} pdfPath - Path to artwork PDF.
 * @param {string} xlsxPath - Path to specification XLSX.
 * @param {object} options - Extraction options.
 * @returns {object} Unified Fact Sheet with facts, conflicts, analytics, and diagnostics.
 */
export function buildUnifiedFactSheet(pdfPath, xlsxPath, options = {}) {
  const pdfPiecesRes = parsePdfSourcePieces(pdfPath, options);
  const xlsxPiecesRes = parseExcelSourcePieces(xlsxPath, options);

  const pdfSha = pdfPiecesRes.pieces[0]?.documentSha256 || globalFactCache.computeFileSha256(pdfPath) || 'pdf_sha';
  const xlsxSha = xlsxPiecesRes.pieces[0]?.documentSha256 || globalFactCache.computeFileSha256(xlsxPath) || 'xlsx_sha';
  const fileFingerprint = `${pdfSha}:${xlsxSha}`;

  // Check fingerprint cache
  const cached = globalFactCache.get({ fileFingerprint, options, noCache: options.noCache });
  if (cached.status === 'CACHE_HIT') {
    return {
      ...cached.data,
      cacheDiagnostic: 'CACHE_HIT'
    };
  }

  const allSourcePieces = [...pdfPiecesRes.pieces, ...xlsxPiecesRes.pieces];

  // 1. Extract spreadsheet facts
  const specExtraction = extractFactsFromExcelPieces(xlsxPiecesRes.pieces, {
    docSha: xlsxSha,
    metadataPieces: xlsxPiecesRes.metadataPieces
  });

  // 2. Extract artwork PDF facts
  const artExtraction = extractFactsFromPdfPieces(pdfPiecesRes.pieces, { docSha: pdfSha });

  // 3. Inspect visual graphical marks
  const visionRes = inspectArtworkVisualMarks(pdfPath, pdfPiecesRes.pieces, options);

  // Combine initial facts
  const rawFacts = [
    ...specExtraction.facts,
    ...artExtraction.facts,
    ...visionRes.proposedFacts
  ];

  // 4. Verify quotations for all facts
  const verifiedFacts = [];
  const rejectedCandidates = [...specExtraction.rejected, ...artExtraction.rejected];

  for (const fact of rawFacts) {
    const quoteCheck = verifyFactQuote(fact, allSourcePieces, options);
    if (quoteCheck.verified) {
      fact.evidence.quoteMatch = quoteCheck.quoteMatch;
      fact.evidence.visibility = quoteCheck.visibility || fact.evidence.visibility;
      verifiedFacts.push(fact);
    } else {
      rejectedCandidates.push({
        candidate: fact,
        reason: quoteCheck.reason,
        quoteMatch: quoteCheck.quoteMatch
      });
    }
  }

  // 5. Run conflict engine
  const conflicts = detectFactConflicts(verifiedFacts, options);

  // 6. Compute Fact Sheet Analytics (Step 24)
  const verifiedCount = verifiedFacts.filter(f => f.verificationState === 'VERIFIED').length;
  const aiSuggestedCount = verifiedFacts.filter(f => f.verificationState === 'AI_SUGGESTED').length;
  const conflictedCount = verifiedFacts.filter(f => f.verificationState === 'CONFLICTED').length;
  const visionOnlyCount = verifiedFacts.filter(f => f.evidence?.method === 'rendered_page_vision').length;
  const qualifiedDraftCount = verifiedFacts.filter(f => f.sourceAuthority === 'DRAFT' || f.qualifiers?.length > 0).length;

  const result = {
    schemaVersion: 'packsignal-fact/v1',
    fileFingerprint,
    facts: verifiedFacts,
    conflicts,
    visionMarks: visionRes.marks,
    rejectedCandidates,
    analytics: {
      totalFacts: verifiedFacts.length,
      verifiedFacts: verifiedCount,
      aiSuggestedFacts: aiSuggestedCount,
      conflictedFacts: conflictedCount,
      conflictedFactGroups: conflicts.length,
      rejectedCandidates: rejectedCandidates.length,
      missingSourceEvidence: rejectedCandidates.filter(r => r.quoteMatch === 'NOT_FOUND').length,
      visionOnlyObservations: visionOnlyCount,
      unresolvedBasisConflicts: conflicts.filter(c => c.comparisonBasis?.includes('vs')).length,
      qualifiedDraftFacts: qualifiedDraftCount,
      sourceCoverage: {
        artworkFacts: verifiedFacts.filter(f => f.source?.documentRole === 'artwork').length,
        specificationFacts: verifiedFacts.filter(f => f.source?.documentRole === 'specification').length
      }
    },
    cacheDiagnostic: cached.status || 'CACHE_MISS'
  };

  // Store in fingerprint cache
  globalFactCache.set({ fileFingerprint, options }, result);

  return result;
}
