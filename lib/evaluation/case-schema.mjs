/**
 * PackSignal Evaluation Case Schema (lib/evaluation/case-schema.mjs)
 * Phase 8: Canonical schema definitions, enum authorities, and validators
 * for independent benchmark evaluation and ground-truth validation.
 */

export const GROUND_TRUTH_AUTHORITIES = {
  DETERMINISTIC_MUTATION_ORACLE: 'DETERMINISTIC_MUTATION_ORACLE',
  INDEPENDENT_HUMAN_ANNOTATION: 'INDEPENDENT_HUMAN_ANNOTATION',
  DEVELOPER_AUTHORED_FIXTURE: 'DEVELOPER_AUTHORED_FIXTURE',
  REGULATORY_REVIEW_FIXTURE: 'REGULATORY_REVIEW_FIXTURE',
  UNVERIFIED_EXPECTATION: 'UNVERIFIED_EXPECTATION',
};

export const DATASET_SPLITS = {
  DEVELOPMENT: 'DEVELOPMENT',
  REGRESSION: 'REGRESSION',
  VALIDATION: 'VALIDATION',
  HOLDOUT: 'HOLDOUT',
};

export const OUTCOME_CATEGORIES = {
  CORRECT_DETECTION: 'CORRECT_DETECTION',
  MISSED_DEFECT: 'MISSED_DEFECT',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
  TRUE_NEGATIVE: 'TRUE_NEGATIVE',
  CORRECT_ABSTENTION: 'CORRECT_ABSTENTION',
  INCORRECT_ABSTENTION: 'INCORRECT_ABSTENTION',
  WRONG_ERROR_TYPE: 'WRONG_ERROR_TYPE',
  EVIDENCE_FAILURE: 'EVIDENCE_FAILURE',
  INCORRECT_LOCATION: 'INCORRECT_LOCATION',
  PARSER_FAILURE: 'PARSER_FAILURE',
  MODEL_FAILURE: 'MODEL_FAILURE',
  TIMEOUT: 'TIMEOUT',
  NOT_EXECUTED: 'NOT_EXECUTED',
  INVALID_FIXTURE: 'INVALID_FIXTURE',
};

export const MUTATION_CATEGORIES = {
  CATEGORY_A_QUANTITY: 'quantity',
  CATEGORY_B_INGREDIENTS: 'ingredients',
  CATEGORY_C_ALLERGENS: 'allergens',
  CATEGORY_D_NUTRITION: 'nutrition',
  CATEGORY_E_CLAIMS: 'claims',
  CATEGORY_F_DOC_EVIDENCE: 'document_evidence',
  CATEGORY_G_BARCODE: 'barcode',
  CATEGORY_H_REVISIONS: 'revisions',
  CATEGORY_I_MARKET_RULES: 'market_rules',
  CATEGORY_J_CLEAN_CONTROLS: 'clean_controls',
};

export const EXPECTED_OUTCOMES = {
  ISSUE: 'issue',
  MATCH: 'match',
  REVIEW: 'review',
  UNABLE: 'unable',
};

/**
 * Validates whether a raw case object satisfies the canonical schema.
 * @param {Object} rawCase
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvaluationCase(rawCase) {
  const errors = [];
  if (!rawCase || typeof rawCase !== 'object') {
    return { valid: false, errors: ['Case must be a non-null object'] };
  }

  if (!rawCase.caseId || typeof rawCase.caseId !== 'string') {
    errors.push('caseId must be a non-empty string');
  }

  if (!rawCase.suiteId || typeof rawCase.suiteId !== 'string') {
    errors.push('suiteId must be a non-empty string');
  }

  if (!rawCase.scenarioType || typeof rawCase.scenarioType !== 'string') {
    errors.push('scenarioType must be a non-empty string');
  }

  if (!Object.values(EXPECTED_OUTCOMES).includes(rawCase.expectedOutcome)) {
    errors.push(`expectedOutcome must be one of: ${Object.values(EXPECTED_OUTCOMES).join(', ')}`);
  }

  if (rawCase.groundTruthAuthority && !Object.values(GROUND_TRUTH_AUTHORITIES).includes(rawCase.groundTruthAuthority)) {
    errors.push(`groundTruthAuthority must be one of: ${Object.values(GROUND_TRUTH_AUTHORITIES).join(', ')}`);
  }

  if (rawCase.datasetSplit && !Object.values(DATASET_SPLITS).includes(rawCase.datasetSplit)) {
    errors.push(`datasetSplit must be one of: ${Object.values(DATASET_SPLITS).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a canonical evaluation case with guaranteed fields and defaults.
 * @param {Object} params
 * @returns {Object} Canonical evaluation case
 */
export function createEvaluationCase({
  caseId,
  suiteId = 'packsignal-trust-suite-v1',
  caseVersion = '1.0.0',
  scenarioType = 'defect_detection',
  documentType = 'carton_packaging',
  inputFiles = [],
  sourceDocumentHashes = {},
  mutationId = null,
  mutationType = null,
  mutationSeed = null,
  expectedOutcome = EXPECTED_OUTCOMES.ISSUE,
  expectedRuleId = null,
  expectedField = null,
  expectedEvidenceRegions = [],
  expectedSourceEvidence = null,
  expectedSeverity = 'critical',
  applicability = 'FDA_21CFR',
  expectedUncertaintyHandling = 'strict',
  groundTruthAuthority = GROUND_TRUTH_AUTHORITIES.DETERMINISTIC_MUTATION_ORACLE,
  datasetSplit = DATASET_SPLITS.REGRESSION,
  validationStatus = 'VALIDATED',
  metadata = {},
  // Optional convenience fields for engine runner compatibility
  name = '',
  description = '',
  reference = null,
  references = null,
  artwork = [],
  before = null,
  after = null,
  kind = 'copy',
  category = MUTATION_CATEGORIES.CATEGORY_A_QUANTITY,
  complete = true,
  netConfirmed = true,
  nutritionConfirmed = true,
  statutoryRule = '21 CFR §101',
}) {
  const c = {
    caseId: caseId || `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    suiteId,
    caseVersion,
    scenarioType,
    documentType,
    inputFiles,
    sourceDocumentHashes,
    mutationId,
    mutationType,
    mutationSeed,
    expectedOutcome,
    expectedRuleId: expectedRuleId || `rules:EVAL-${caseId}`,
    expectedField: expectedField || 'storage_statement',
    expectedEvidenceRegions,
    expectedSourceEvidence,
    expectedSeverity,
    applicability,
    expectedUncertaintyHandling,
    groundTruthAuthority,
    datasetSplit,
    validationStatus,
    metadata: {
      ...metadata,
      createdAt: metadata.createdAt || new Date().toISOString(),
    },
    // Engine execution helpers
    name: name || caseId,
    description,
    reference,
    references,
    artwork,
    before,
    after,
    kind,
    category,
    complete,
    netConfirmed,
    nutritionConfirmed,
    statutoryRule,
  };

  const validation = validateEvaluationCase(c);
  if (!validation.valid) {
    throw new Error(`Invalid evaluation case schema: ${validation.errors.join('; ')}`);
  }

  return c;
}
