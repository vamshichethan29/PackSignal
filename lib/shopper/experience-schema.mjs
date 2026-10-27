/**
 * PackSignal — Phase 6A: Shopper Experience Schema
 * Canonical data contracts, enums, validators, and record factories.
 *
 * (lib/shopper/experience-schema.mjs)
 */

export const EXPERIENCE_MODEL_VERSION = '2026.04-shopper-lab-v1';

export const SHOPPER_PERSONA_TYPES = Object.freeze({
  ALL: 'all',
  NUT_ALLERGY: 'nut_allergy',
  VEGAN: 'vegan',
  WATCHING_SUGAR: 'watching_sugar',
  LOW_VISION: 'low_vision',
  INDIA_VEG: 'india_veg',
  INDIA_METROLOGY: 'india_metrology'
});

export const SIMULATION_MODES = Object.freeze({
  STANDARD: 'standard',
  SHELF_READABILITY: 'shelf_readability',
  VISUAL_SALIENCY: 'visual_saliency',
  COLOUR_VISION: 'colour_vision',
  CONTRAST_ANALYSIS: 'contrast_analysis',
  CONFIDENCE_GLOW: 'confidence_glow',
  BEFORE_AFTER: 'before_after'
});

export const COLOUR_VISION_MODES = Object.freeze({
  NORMAL: 'normal',
  PROTANOPIA: 'protanopia',       // L-cone red deficiency (~1% of males)
  DEUTERANOPIA: 'deuteranopia',   // M-cone green deficiency (~1% of males, most common)
  TRITANOPIA: 'tritanopia',       // S-cone blue deficiency (~0.003% population)
  ACHROMATOPSIA: 'achromatopsia'  // Complete absence of color perception (grayscale)
});

export const READABILITY_THRESHOLDS = Object.freeze({
  ABOVE_MODELED_THRESHOLD: 'ABOVE_MODELED_THRESHOLD',
  NEAR_MODELED_THRESHOLD: 'NEAR_MODELED_THRESHOLD',
  BELOW_MODELED_THRESHOLD: 'BELOW_MODELED_THRESHOLD',
  INSUFFICIENT_MEASUREMENT: 'INSUFFICIENT_MEASUREMENT'
});

export const EVIDENCE_CONFIDENCE_LEVELS = Object.freeze({
  VERIFIED_SOURCE_EVIDENCE: 'VERIFIED_SOURCE_EVIDENCE', // Solid outline
  PARTIAL_EVIDENCE: 'PARTIAL_EVIDENCE',                 // Dashed outline
  AI_SUGGESTED: 'AI_SUGGESTED',                         // Dotted outline
  SOURCE_CONFLICT: 'SOURCE_CONFLICT',                   // Striped overlay
  NOT_EVALUATED: 'NOT_EVALUATED',                       // Neutral outline
  UNABLE_TO_VERIFY: 'UNABLE_TO_VERIFY'                  // Neutral outline with alert
});

export const ASSESSMENT_STATUSES = Object.freeze({
  COMMUNICATION_CLEAR: 'COMMUNICATION_CLEAR',
  POTENTIAL_CONFUSION: 'POTENTIAL_CONFUSION',
  SOURCE_CONFLICT: 'SOURCE_CONFLICT',
  UNVERIFIED_CLAIM: 'UNVERIFIED_CLAIM',
  READABILITY_RISK: 'READABILITY_RISK',
  INSUFFICIENT_MEASUREMENT: 'INSUFFICIENT_MEASUREMENT',
  SOURCE_REVIEW_REQUIRED: 'SOURCE_REVIEW_REQUIRED'
});

export const CONTRAST_BENCHMARKS = Object.freeze({
  WEB_UI_WCAG_CHECK: 'WEB_UI_WCAG_CHECK',
  PACKAGING_CONTRAST_HEURISTIC: 'PACKAGING_CONTRAST_HEURISTIC',
  APPLICABLE_PACKAGING_LEGAL_CHECK: 'APPLICABLE_PACKAGING_LEGAL_CHECK'
});

export const MODEL_DISCLAIMERS = Object.freeze({
  GENERAL_ESTIMATE: 'All visual simulations and perceptual readability scores are mathematical estimates based on optical projection models and do not replace controlled consumer panel testing.',
  SHELF_READABILITY: 'Angular character height and retinal projection calculations are objective optical geometry. Readability classification is a documented perceptual estimate under standard retail illumination (500 lux, 20/20 Snellen equivalent) and does not guarantee legibility for all individual shoppers.',
  LOW_VISION: 'Illustrative low-vision viewing simulation. Demonstrates estimated appearance under reduced visual acuity and contrast sensitivity. Low vision is heterogeneous; this simulation does not represent all visual impairments or provide clinical diagnosis.',
  VISUAL_SALIENCY: 'Illustrative 3-second glance attention proxy based on low-level feature contrast, edge density, and spatial layout. Does not represent empirical human eye-tracking or gaze scanpath.',
  COLOUR_VISION: 'Color appearance simulation based on documented colorimetric transformations (Brettel/Viénot). Actual perception varies among individuals with color vision deficiency.',
  CONTRAST_ANALYSIS: 'Contrast ratio derived from digital RGB raster data using the WCAG relative luminance formula as an informational heuristic. Packaging print substrates, ink absorption, surface varnish, and store lighting will affect physical on-shelf contrast.',
  ALLERGEN_SAFETY: 'PackSignal evaluates packaging disclosure accuracy and communication clarity against regulatory requirements and supplied formulation records. It does NOT provide individual medical safety determinations or food safety certifications.'
});

/**
 * Validates and instantiates a canonical Shopper Experience record.
 */
export function createShopperExperienceRecord(params = {}) {
  const {
    reviewId = 'rev-canonical',
    revisionId = 'rev-01',
    documentId = 'doc-artwork',
    documentSha256 = 'unknown-sha256',
    market = 'US',
    marketPackVersion = '2026.1',
    personaId = SHOPPER_PERSONA_TYPES.ALL,
    simulationMode = SIMULATION_MODES.STANDARD,
    sourceFindings = [],
    sourceFacts = [],
    sourceEvidence = [],
    artworkLocations = [],
    measurementInputs = {},
    modelVersion = EXPERIENCE_MODEL_VERSION,
    result = {},
    limitations = [MODEL_DISCLAIMERS.GENERAL_ESTIMATE],
    estimated = true,
    assessmentStatus = ASSESSMENT_STATUSES.COMMUNICATION_CLEAR
  } = params;

  const record = {
    reviewId,
    revisionId,
    documentId,
    documentSha256,
    market,
    marketPackVersion,
    personaId,
    simulationMode,
    sourceFindings: Array.isArray(sourceFindings) ? sourceFindings : [],
    sourceFacts: Array.isArray(sourceFacts) ? sourceFacts : [],
    sourceEvidence: Array.isArray(sourceEvidence) ? sourceEvidence : [],
    artworkLocations: Array.isArray(artworkLocations) ? artworkLocations : [],
    measurementInputs: typeof measurementInputs === 'object' && measurementInputs !== null ? measurementInputs : {},
    modelVersion,
    result: typeof result === 'object' && result !== null ? result : {},
    limitations: Array.isArray(limitations) ? limitations : [limitations],
    estimated: Boolean(estimated),
    assessmentStatus,
    timestamp: new Date().toISOString()
  };

  validateShopperExperienceRecord(record);
  return Object.freeze(record);
}

/**
 * Validates that a Shopper Experience record contains all required canonical keys.
 */
export function validateShopperExperienceRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new TypeError('Shopper experience record must be a non-null object');
  }

  const requiredFields = [
    'reviewId',
    'revisionId',
    'documentId',
    'documentSha256',
    'market',
    'marketPackVersion',
    'personaId',
    'simulationMode',
    'sourceFindings',
    'sourceFacts',
    'sourceEvidence',
    'artworkLocations',
    'measurementInputs',
    'modelVersion',
    'result',
    'limitations',
    'estimated',
    'assessmentStatus'
  ];

  for (const field of requiredFields) {
    if (!(field in record)) {
      throw new Error(`Shopper experience record missing required field: ${field}`);
    }
  }

  if (record.estimated !== true) {
    throw new Error('Shopper experience record must have estimated: true (computational simulation)');
  }

  return true;
}

/**
 * Creates an audited one-line verdict structure.
 * Every verdict MUST be backed by actual factIds, findingIds, or ruleIds.
 */
export function createAuditedVerdict({
  verdictId,
  personaId,
  statement,
  factIds = [],
  findingIds = [],
  ruleIds = [],
  sourceEvidenceRefs = [],
  reason = '',
  limitations = [],
  auditStatus = 'VERIFIED_GROUNDED'
}) {
  if (!verdictId || !personaId || !statement) {
    throw new Error('createAuditedVerdict requires verdictId, personaId, and statement');
  }

  if (factIds.length === 0 && findingIds.length === 0 && ruleIds.length === 0 && sourceEvidenceRefs.length === 0) {
    throw new Error(`Verdict ${verdictId} has no supporting evidence citations (factIds, findingIds, or sourceEvidenceRefs required)`);
  }

  return Object.freeze({
    verdictId,
    personaId,
    statement,
    factIds: Array.from(new Set(factIds)),
    findingIds: Array.from(new Set(findingIds)),
    ruleIds: Array.from(new Set(ruleIds)),
    sourceEvidenceRefs: Array.from(new Set(sourceEvidenceRefs)),
    reason,
    limitations: Array.isArray(limitations) ? limitations : [limitations],
    auditStatus,
    timestamp: new Date().toISOString()
  });
}
