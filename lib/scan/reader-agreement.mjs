/**
 * PackSignal — Dual-Reader Agreement Engine (lib/scan/reader-agreement.mjs)
 * Phase 10A: Evaluates consensus between Reader A (Local Tesseract OCR)
 * and Reader B (Multimodal Gemini Vision).
 * 
 * Classifies into:
 * - AGREE_EXACT
 * - AGREE_NORMALIZED
 * - DISAGREE
 * - ONE_READER_ONLY
 * - BOTH_UNREADABLE
 * - UNSUPPORTED
 */

export const AGREEMENT_STATUSES = {
  AGREE_EXACT: 'AGREE_EXACT',
  AGREE_NORMALIZED: 'AGREE_NORMALIZED',
  DISAGREE: 'DISAGREE',
  ONE_READER_ONLY: 'ONE_READER_ONLY',
  BOTH_UNREADABLE: 'BOTH_UNREADABLE',
  UNSUPPORTED: 'UNSUPPORTED',
};

export const OBSERVATION_CATEGORIES = {
  CONFIRMED_PRINTED: 'CONFIRMED PRINTED OBSERVATION',
  AI_SUGGESTED: 'AI-SUGGESTED / REVIEW REQUIRED',
  CANDIDATE_WITH_LIMITATIONS: 'CANDIDATE_CONFIRMED_WITH_LIMITATIONS',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
};

// Critical regulatory fields requiring extra corroboration
const CRITICAL_FIELDS = new Set([
  'net_quantity',
  'allergens',
  'nutrition_calories',
  'nutrition_fat',
  'nutrition_sodium',
  'nutrition_sugars',
  'nutrition_protein',
  'barcode_gtin',
  'fssai_license',
  'fda_statement',
  'claims',
]);

/**
 * Normalizes text for comparison (whitespace, punctuation, units).
 */
export function normalizeTextForComparison(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[,\.;:!\?'"“”‘’]/g, '')
    // Normalize common packaging units: 750ml -> 750 ml, 10oz -> 10 oz, 283g -> 283 g
    .replace(/(\d+)\s*(g|grams?|ml|milliliters?|fl\s*oz|oz|ounces?|kg)\b/gi, '$1 $2')
    .trim();
}

/**
 * Extracts numeric value and unit if present.
 */
export function extractNumericQuantity(str) {
  if (!str) return null;
  const match = String(str).match(/([\d\.]+)\s*([a-zA-Z%]+)?/);
  if (!match) return null;
  return {
    value: parseFloat(match[1]),
    unit: (match[2] || '').toLowerCase(),
  };
}

/**
 * Compares two reader outputs for a given semantic field.
 */
export function compareReaderOutputs(fieldKey, ocrResult, visionResult, options = {}) {
  const ocrRaw = String(ocrResult?.text || ocrResult?.values?.[fieldKey] || '').trim();
  const visionRaw = String(visionResult?.text || visionResult?.values?.[fieldKey] || '').trim();

  // 1. Both unreadable
  if (!ocrRaw && !visionRaw) {
    return {
      field: fieldKey,
      agreement: AGREEMENT_STATUSES.BOTH_UNREADABLE,
      category: OBSERVATION_CATEGORIES.NEEDS_REVIEW,
      isConfirmed: false,
      value: null,
      ocrValue: null,
      visionValue: null,
      confidence: 0,
      reason: 'Neither Local OCR nor Multimodal Vision detected readable text.',
      reconciliationRequired: false,
    };
  }

  // 2. One reader only
  if (ocrRaw && !visionRaw) {
    return {
      field: fieldKey,
      agreement: AGREEMENT_STATUSES.ONE_READER_ONLY,
      category: OBSERVATION_CATEGORIES.AI_SUGGESTED,
      isConfirmed: false,
      value: ocrRaw,
      ocrValue: ocrRaw,
      visionValue: null,
      confidence: ocrResult?.confidence || 0.70,
      reason: 'Local OCR read text, but Vision model produced no reading.',
      reconciliationRequired: true,
      suggestedAction: 'REVIEW_OR_CLOSEUP',
    };
  }

  if (!ocrRaw && visionRaw) {
    return {
      field: fieldKey,
      agreement: AGREEMENT_STATUSES.ONE_READER_ONLY,
      category: OBSERVATION_CATEGORIES.AI_SUGGESTED,
      isConfirmed: false,
      value: visionRaw,
      ocrValue: null,
      visionValue: visionRaw,
      confidence: visionResult?.confidence || 0.80,
      reason: 'Vision model suggested text, but Local OCR was silent or unreadable.',
      reconciliationRequired: true,
      suggestedAction: 'CONFIRM_OR_RETAKE',
    };
  }

  // 3. Both readers produced output
  // Exact string match
  if (ocrRaw === visionRaw) {
    const isCritical = CRITICAL_FIELDS.has(fieldKey);
    const hasQualityWarning = options.hasQualityWarning || options.isBlurry || options.hasGlare;

    return {
      field: fieldKey,
      agreement: AGREEMENT_STATUSES.AGREE_EXACT,
      category: hasQualityWarning && isCritical
        ? OBSERVATION_CATEGORIES.CANDIDATE_WITH_LIMITATIONS
        : OBSERVATION_CATEGORIES.CONFIRMED_PRINTED,
      isConfirmed: !hasQualityWarning || !isCritical,
      value: visionRaw,
      ocrValue: ocrRaw,
      visionValue: visionRaw,
      confidence: hasQualityWarning ? 0.85 : 0.99,
      reason: 'Exact verbatim consensus between Local OCR and Vision model.',
      reconciliationRequired: false,
      qualityLimitation: hasQualityWarning ? 'Image quality gate flagged glare or blur — verified with limitation' : null,
    };
  }

  // Normalized match (e.g. "480g" vs "480 g" or capitalization)
  const normOcr = normalizeTextForComparison(ocrRaw);
  const normVision = normalizeTextForComparison(visionRaw);

  if (normOcr === normVision) {
    return {
      field: fieldKey,
      agreement: AGREEMENT_STATUSES.AGREE_NORMALIZED,
      category: OBSERVATION_CATEGORIES.CONFIRMED_PRINTED,
      isConfirmed: true,
      value: visionRaw, // Preserve best formatted casing
      ocrValue: ocrRaw,
      visionValue: visionRaw,
      confidence: 0.95,
      reason: 'Consensus achieved after safe whitespace and typographic normalization.',
      reconciliationRequired: false,
    };
  }

  // Check if numeric quantities conflict
  const numOcr = extractNumericQuantity(ocrRaw);
  const numVision = extractNumericQuantity(visionRaw);

  const numericConflict = numOcr && numVision && (numOcr.value !== numVision.value || (numOcr.unit && numVision.unit && numOcr.unit !== numVision.unit));

  // Disagreement
  return {
    field: fieldKey,
    agreement: AGREEMENT_STATUSES.DISAGREE,
    category: OBSERVATION_CATEGORIES.NEEDS_REVIEW,
    isConfirmed: false,
    value: null,
    ocrValue: ocrRaw,
    visionValue: visionRaw,
    numericConflict: Boolean(numericConflict),
    confidence: 0.50,
    reason: `Reader discrepancy: OCR reads "${ocrRaw}", Vision reads "${visionRaw}".`,
    reconciliationRequired: true,
    reconciliationCard: {
      field: fieldKey,
      ocrText: ocrRaw,
      visionText: visionRaw,
      sourceCropRef: options.sourceCropRef || null,
      reason: numericConflict ? 'Different numerical values or units detected' : 'Character or wording variance between readers',
      actions: ['Retake Close-Up', 'Select OCR Reading', 'Select Vision Reading', 'Mark Unreadable'],
    },
  };
}

/**
 * Aggregates dual-reader consensus for an entire panel across all observed fields.
 */
export function evaluatePanelConsensus(panelId, ocrFields = {}, visionFields = {}, options = {}) {
  const allKeys = new Set([...Object.keys(ocrFields), ...Object.keys(visionFields)]);
  const fieldConsensus = {};
  let totalAgreed = 0;
  let totalDisagreed = 0;
  let totalOneReader = 0;

  for (const key of allKeys) {
    const ocrVal = ocrFields[key];
    const visionVal = visionFields[key];
    const c = compareReaderOutputs(
      key,
      typeof ocrVal === 'object' ? ocrVal : { text: ocrVal },
      typeof visionVal === 'object' ? visionVal : { text: visionVal },
      options
    );
    fieldConsensus[key] = c;

    if (c.agreement === AGREEMENT_STATUSES.AGREE_EXACT || c.agreement === AGREEMENT_STATUSES.AGREE_NORMALIZED) {
      totalAgreed++;
    } else if (c.agreement === AGREEMENT_STATUSES.DISAGREE) {
      totalDisagreed++;
    } else if (c.agreement === AGREEMENT_STATUSES.ONE_READER_ONLY) {
      totalOneReader++;
    }
  }

  return {
    panelId,
    totalFields: allKeys.size,
    totalAgreed,
    totalDisagreed,
    totalOneReader,
    fieldConsensus,
    isPanelConfirmed: totalDisagreed === 0 && totalAgreed > 0,
  };
}
