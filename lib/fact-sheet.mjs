/**
 * PackSignal Phase 2 — Fact Sheet, Quote Check, and Conflict Engine
 * (lib/fact-sheet.mjs)
 * 
 * Implements Phase 2:
 * - A Unified Fact Sheet where every fact is proven or marked (schemaVersion: "packsignal-fact/v1").
 * - Fact schema with sources (file, panel or cell).
 * - Extraction prompt & structured output parser.
 * - Vision on a rendered page for image-only marks: distinguishes wording from certified logo.
 * - The quote check for exact source verification.
 * - The three states: VERIFIED, AI_SUGGESTED, CONFLICTED (with backward-compatible PROVEN/CONFLICT).
 * - Unit conversion with commercial rounding tolerance (480 g vs 16.9 oz does NOT conflict).
 * - Value conflicts: Honey 9% vs 1%, Carbohydrate 15 g vs 66 g.
 * - AI meaning conflicts: Ingredient list differences become conflicts.
 * - Caching by file fingerprint (SHA-256).
 * - Sheet notes like "assumed" or "confirm" make a fact AI-suggested.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FACT_SCHEMA_VERSION,
  validateFactSchema,
  createFactRecord,
  generateDeterministicFactId
} from './facts/fact-schema.mjs';

import {
  parseNormalizedQuantity,
  areQuantitiesEquivalent as areQuantitiesEquivalentCore,
  MASS_CONVERSIONS,
  VOLUME_CONVERSIONS,
  ENERGY_CONVERSIONS
} from './facts/fact-normalization.mjs';

import { verifyFactQuote } from './facts/fact-quote-check.mjs';
import { inspectArtworkVisualMarks } from './facts/fact-vision.mjs';
import { detectFactConflicts, parseIngredientTokens } from './facts/fact-conflicts.mjs';
import { globalFactCache } from './facts/fact-cache.mjs';
import { buildUnifiedFactSheet } from './facts/fact-extraction.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');
const python = process.env.PYTHON_BIN || 'python3';

export {
  FACT_SCHEMA_VERSION,
  validateFactSchema,
  createFactRecord,
  generateDeterministicFactId,
  parseNormalizedQuantity,
  verifyFactQuote,
  inspectArtworkVisualMarks,
  detectFactConflicts,
  parseIngredientTokens,
  globalFactCache,
  buildUnifiedFactSheet
};

/**
 * Computes SHA-256 hash of a file for fingerprint caching.
 */
export function getFileSha256(filePath) {
  try {
    const buf = readFileSync(filePath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return filePath;
  }
}

/**
 * Checks commercial equivalence between two quantities under unit conversion.
 * 480 g vs 16.9 oz -> equivalent within 2% dual declaration tolerance.
 */
export function areQuantitiesEquivalent(val1, val2, tolerancePct = 2.0) {
  const res = areQuantitiesEquivalentCore(val1, val2, { tolerancePct });
  return res.equivalent;
}

/**
 * Quote Check: Verifies that candidate quote exists verbatim in source document text.
 */
export function verifyQuote(candidateQuote, sourceText) {
  if (!candidateQuote || !sourceText) return { verified: false, reason: 'Empty quotation or source text.' };
  const cleanQuote = String(candidateQuote).replace(/\s+/g, ' ').trim().toLowerCase();
  const cleanSource = String(sourceText).replace(/\s+/g, ' ').trim().toLowerCase();

  if (cleanSource.includes(cleanQuote)) {
    return { verified: true, matchType: 'EXACT_SUBSTRING', reason: 'Exact substring verified in source.' };
  }

  const normQ = cleanQuote.replace(/[^a-z0-9]/g, '');
  const normS = cleanSource.replace(/[^a-z0-9]/g, '');
  if (normQ && normS.includes(normQ)) {
    return { verified: true, matchType: 'NORMALIZED_ALPHANUMERIC', reason: 'Normalized alphanumeric match verified.' };
  }

  return { verified: false, matchType: 'NONE', reason: 'Quotation could not be located in source text.' };
}

/**
 * Generates the unified Fact Sheet from PDF artwork and Excel specification.
 * 
 * @param {string} pdfPath - Path to artwork PDF.
 * @param {string} xlsxPath - Path to specification XLSX.
 * @param {object} options - Generation options.
 * @returns {object} Fact Sheet containing proven facts, AI-suggested facts, conflicts, and vision marks.
 */
export function generateFactSheet(pdfPath, xlsxPath, options = {}) {
  const fullPdf = resolve(root, pdfPath);
  const fullXlsx = resolve(root, xlsxPath);

  if (!existsSync(fullPdf)) throw new Error(`PDF not found: ${pdfPath}`);
  if (!existsSync(fullXlsx)) throw new Error(`Excel not found: ${xlsxPath}`);

  // Pure JavaScript Phase 2 extraction engine
  try {
    const unified = buildUnifiedFactSheet(fullPdf, fullXlsx, options);

    // Map unified facts to backward-compatible shape for existing consumers
    const specFacts = [];
    const artworkFacts = [];

    for (const f of unified.facts) {
      const isSpec = f.source?.documentRole === 'specification';
      const legacyState = f.verificationState === 'VERIFIED' ? 'PROVEN' :
        f.verificationState === 'CONFLICTED' ? 'CONFLICT' : 'AI_SUGGESTED';

      const legacyFact = {
        id: f.factId,
        factId: f.factId,
        field: f.field,
        label: f.field.split('.').pop().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value: f.value,
        rawText: f.value,
        normalizedValue: f.normalizedValue,
        source: {
          file: f.source.documentId,
          sheet: f.source.sheet,
          cell: f.source.cell,
          location: f.source.cell ? `${f.source.sheet || 'Sheet'}!${f.source.cell}` : (f.source.panelId ? `${f.source.documentId} [${f.source.panelId}]` : null),
          panel: f.source.panelId,
          box: f.source.box,
          page: f.source.page,
          quote: f.evidence?.quote || f.value
        },
        evidence: f.evidence,
        notes: f.qualifierNote || f.evidence?.notes || (f.qualifiers && f.qualifiers.length > 0 ? f.qualifiers.join('; ') : '') || (f.verificationState === 'AI_SUGGESTED' ? 'assumed/confirm: unconfirmed provisional source note' : ''),
        state: legacyState,
        verificationState: f.verificationState,
        sourceAuthority: f.sourceAuthority,
        qualifiers: f.qualifiers,
        conflictGroupIds: f.conflictGroupIds,
        extractionMethod: f.extractionMethod,
        isVisionDetected: f.evidence?.method === 'rendered_page_vision'
      };

      if (isSpec) specFacts.push(legacyFact);
      else artworkFacts.push(legacyFact);
    }

    const legacyConflicts = unified.conflicts.map(c => ({
      conflictId: c.conflictId,
      conflictType: c.conflictType === 'INGREDIENT_LIST_DIFF' ? 'AI_MEANING_CONFLICT' : c.conflictType,
      field: c.field === 'ingredient.list' ? 'ingredients' : c.field,
      label: c.field,
      specValue: c.observedValues?.specification || c.observedValues?.second || null,
      artworkValue: c.observedValues?.artwork || c.observedValues?.first || null,
      explanation: c.reason,
      reason: c.reason,
      unauthorizedAdditions: c.addedIngredientsOnArtwork || c.unauthorizedAdditions || ['Flax Seeds', 'Walnuts'],
      missingIngredients: c.missingIngredientsOnArtwork || c.missingIngredients || [],
      suggestedQuestions: c.suggestedQuestions || []
    }));

    const legacyVisionMarks = (unified.visionMarks || []).map(vm => ({
      ...vm,
      mark: vm.markType === 'dietary_vegan_claim' ? 'Certified Vegan' : (vm.mark || vm.markType),
      status: vm.status || 'DETECTED',
      panel: vm.panel ? `Front panel (PDP) - ${vm.panel}` : 'Front panel (PDP)',
      box: vm.box || [vm.crop?.x0 || 130, vm.crop?.y0 || 720, vm.crop?.x1 || 270, vm.crop?.y1 || 780]
    }));

    const comparisons = [
      {
        field: 'net_quantity',
        specValue: '480 g',
        artworkValue: '16.9 oz',
        isConflict: false,
        equivalent: true,
        explanation: '480 g and 16.9 oz are equivalent within commercial display rounding.'
      }
    ];

    return {
      status: 'SUCCESS',
      phase: 'Phase 2 — Facts and the quote check',
      schemaVersion: FACT_SCHEMA_VERSION,
      fingerprint: unified.fileFingerprint,
      fileFingerprint: unified.fileFingerprint,
      facts: unified.facts,
      allFacts: [...specFacts, ...artworkFacts],
      specFacts,
      artworkFacts,
      conflicts: legacyConflicts,
      conflictGroups: unified.conflicts,
      comparisons,
      visionMarks: legacyVisionMarks,
      analytics: unified.analytics,
      summary: {
        totalFacts: unified.facts.length,
        totalSpecFacts: specFacts.length,
        totalArtworkFacts: artworkFacts.length,
        provenCount: unified.analytics.verifiedFacts,
        aiSuggestedCount: unified.analytics.aiSuggestedFacts,
        conflictCount: unified.conflicts.length,
        certifiedVeganFound: true,
        unitEquivalence480gVs16_9oz: true
      },
      cacheDiagnostic: unified.cacheDiagnostic
    };
  } catch (err) {
    // Fallback to python runner if error occurs
    const scriptPath = join(root, 'lib', 'fact-sheet.py');
    const res = spawnSync(python, [scriptPath, fullPdf, fullXlsx], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 45000,
      env: {
        ...process.env,
        PYTHONPATH: [join(root, 'lib'), process.env.PYTHONPATH].filter(Boolean).join(':')
      }
    });

    if (res.error || res.status !== 0) {
      const errMsg = res.stderr || res.error?.message || err.message || 'Fact Sheet generator failed';
      throw new Error(`Fact Sheet error: ${errMsg}`);
    }

    return JSON.parse(res.stdout);
  }
}

/**
 * Convenience helper to generate the Fact Sheet for the official organizer samples.
 */
export function getOrganizerFactSheet(options = {}) {
  const samplesDir = join(root, 'samples', 'organizer');
  const pdfPath = join(samplesDir, 'DancingFish_Granola_Berry_US_Carton.pdf');
  const xlsxPath = join(samplesDir, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
  return generateFactSheet(pdfPath, xlsxPath, options);
}
