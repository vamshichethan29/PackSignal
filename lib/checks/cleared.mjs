/**
 * PackSignal Cleared Checks & Proof Ledger (lib/checks/cleared.mjs)
 * Wave 1A & 2B: Manages positive verification proofs and ignored/excluded metadata.
 */

import { createClearedCheck } from '../contracts/review-contract.mjs';

export class ClearedCheckLedger {
  constructor() {
    this.records = [];
  }

  /**
   * Adds an evaluated MATCH check with its deterministic proof.
   */
  addClearedMatch({ checkId, ruleId = null, title, proof, sourceEvidenceIds = [], artworkEvidenceIds = [], verificationMethod = 'deterministic_comparator', limitations = null }) {
    const record = createClearedCheck({
      checkId,
      ruleId,
      title,
      proof,
      sourceEvidenceIds,
      artworkEvidenceIds,
      verificationMethod,
      limitations: limitations || 'Verified against confirmed sources. Excludes technical guide lines and non-printing layers.',
    });
    this.records.push(record);
    return record;
  }

  /**
   * Records production guide content that was intentionally ignored from consumer labeling checks.
   */
  addIgnoredProductionGuide({ guideType, layerName, notes }) {
    return {
      type: 'IGNORED_PRODUCTION_CONTENT',
      guideType,
      layerName,
      proof: `Layer "${layerName}" classified as non-printing production guide (${guideType}). Excluded from consumer copy checks.`,
      timestamp: new Date().toISOString(),
      notes,
    };
  }

  /**
   * Records uncertain or non-rendering PDF stream content excluded from calculations.
   */
  addExcludedPdfStream({ streamId, reason, page = 1 }) {
    return {
      type: 'EXCLUDED_PDF_CONTENT',
      streamId,
      page,
      reason,
      proof: `PDF content stream ${streamId} on page ${page} identified as ${reason}. Excluded from statutory calculations.`,
      timestamp: new Date().toISOString(),
    };
  }

  getAll() {
    return this.records;
  }
}

export const defaultClearedLedger = new ClearedCheckLedger();
