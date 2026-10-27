/**
 * PackSignal Ambiguity Resolution Engine — Question Types & Schemas
 * (lib/ambiguity/question-types.mjs)
 */

export const QUESTION_TYPES = {
  FACT_CONFLICT: 'FACT_CONFLICT',
  NUTRITION_BASIS: 'NUTRITION_BASIS',
  SOURCE_AUTHORITY: 'SOURCE_AUTHORITY',
  MISSING_REQUIRED_FACT: 'MISSING_REQUIRED_FACT',
  SKU_VARIANT_AMBIGUITY: 'SKU_VARIANT_AMBIGUITY',
  RULE_APPLICABILITY: 'RULE_APPLICABILITY',
  CLAIM_SUBSTANTIATION: 'CLAIM_SUBSTANTIATION',
  ARTWORK_COVERAGE: 'ARTWORK_COVERAGE',
};

export const QUESTION_STATUS = {
  OPEN: 'OPEN',
  NEEDS_EVIDENCE: 'NEEDS_EVIDENCE',
  READY_FOR_DECISION: 'READY_FOR_DECISION',
  RESOLVED: 'RESOLVED',
  REOPENED: 'REOPENED',
  SUPERSEDED: 'SUPERSEDED',
};

export const QUESTION_PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const ANSWER_TYPES = {
  SELECT_CANDIDATE: 'SELECT_CANDIDATE',
  REQUEST_EVIDENCE: 'REQUEST_EVIDENCE',
  CUSTOM_CONFIRMATION: 'CUSTOM_CONFIRMATION',
};

export const QUESTION_TYPE_METADATA = {
  [QUESTION_TYPES.NUTRITION_BASIS]: {
    label: 'Nutrition Basis Ambiguity',
    defaultPriority: QUESTION_PRIORITY.HIGH,
    description: 'Multiple nutrition columns (e.g. per serving vs per 100 g) require explicit authorized selection.',
    allowedAnswerTypes: [ANSWER_TYPES.SELECT_CANDIDATE, ANSWER_TYPES.REQUEST_EVIDENCE],
  },
  [QUESTION_TYPES.FACT_CONFLICT]: {
    label: 'Conflicting Specification Values',
    defaultPriority: QUESTION_PRIORITY.HIGH,
    description: 'Supplied sources provide contradictory values for the same product specification field.',
    allowedAnswerTypes: [ANSWER_TYPES.SELECT_CANDIDATE, ANSWER_TYPES.REQUEST_EVIDENCE],
  },
  [QUESTION_TYPES.SOURCE_AUTHORITY]: {
    label: 'Source Document Authority',
    defaultPriority: QUESTION_PRIORITY.HIGH,
    description: 'Document authority or approval status is unconfirmed, blocking definitive production error verdicts.',
    allowedAnswerTypes: [ANSWER_TYPES.CUSTOM_CONFIRMATION, ANSWER_TYPES.REQUEST_EVIDENCE],
  },
  [QUESTION_TYPES.MISSING_REQUIRED_FACT]: {
    label: 'Missing Required Fact',
    defaultPriority: QUESTION_PRIORITY.MEDIUM,
    description: 'A regulatory check requires a reference specification that is absent from supplied documents.',
    allowedAnswerTypes: [ANSWER_TYPES.REQUEST_EVIDENCE, ANSWER_TYPES.CUSTOM_CONFIRMATION],
  },
  [QUESTION_TYPES.SKU_VARIANT_AMBIGUITY]: {
    label: 'Cross-SKU / Variant Ambiguity',
    defaultPriority: QUESTION_PRIORITY.MEDIUM,
    description: 'Artwork copy mentions sibling variant values or multi-SKU table records requiring SKU alignment.',
    allowedAnswerTypes: [ANSWER_TYPES.SELECT_CANDIDATE, ANSWER_TYPES.CUSTOM_CONFIRMATION],
  },
  [QUESTION_TYPES.RULE_APPLICABILITY]: {
    label: 'Regulatory Rule Applicability',
    defaultPriority: QUESTION_PRIORITY.MEDIUM,
    description: 'Applicability of a voluntary exemption or alternative nutrition panel format is undetermined.',
    allowedAnswerTypes: [ANSWER_TYPES.CUSTOM_CONFIRMATION, ANSWER_TYPES.REQUEST_EVIDENCE],
  },
  [QUESTION_TYPES.CLAIM_SUBSTANTIATION]: {
    label: 'Claim Substantiation Evidence',
    defaultPriority: QUESTION_PRIORITY.LOW,
    description: 'Marketing or environmental claim requires verified third-party certification or lifecycle evidence.',
    allowedAnswerTypes: [ANSWER_TYPES.REQUEST_EVIDENCE, ANSWER_TYPES.CUSTOM_CONFIRMATION],
  },
  [QUESTION_TYPES.ARTWORK_COVERAGE]: {
    label: 'Artwork Inspection Coverage',
    defaultPriority: QUESTION_PRIORITY.MEDIUM,
    description: 'Rasterized or unmapped artwork area requires human visual confirmation before asserting absence.',
    allowedAnswerTypes: [ANSWER_TYPES.CUSTOM_CONFIRMATION, ANSWER_TYPES.REQUEST_EVIDENCE],
  },
};
