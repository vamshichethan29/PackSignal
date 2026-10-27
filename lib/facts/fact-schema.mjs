/**
 * PackSignal Phase 2 — Fact Schema and Candidate Validation
 * (lib/facts/fact-schema.mjs)
 * 
 * Canonical Fact Schema: "packsignal-fact/v1"
 * Strictly validates structured packaging facts, their source provenance,
 * evidence quotations, normalized values, and authority states.
 */

import { createHash } from 'node:crypto';

export const FACT_SCHEMA_VERSION = 'packsignal-fact/v1';

export const VALID_VERIFICATION_STATES = ['VERIFIED', 'AI_SUGGESTED', 'CONFLICTED'];
export const VALID_SOURCE_AUTHORITIES = ['APPROVED', 'DRAFT', 'AI_SUGGESTED', 'UNCONFIRMED', 'SUPERSEDED', 'UNKNOWN'];
export const VALID_QUOTE_MATCHES = [
  'EXACT',
  'NORMALIZED_EQUIVALENT',
  'VERIFIED_RECONSTRUCTION',
  'IMAGE_EVIDENCE',
  'NOT_FOUND',
  'AMBIGUOUS',
  'UNSUPPORTED'
];
export const VALID_EXTRACTION_METHODS = ['deterministic', 'structured_ai', 'vision_inspection', 'hybrid'];
export const VALID_VISIBILITIES = ['VISIBLE', 'HIDDEN', 'UNCERTAIN'];

/**
 * Standard semantic field registry.
 */
export const KNOWN_FIELD_PATTERNS = [
  /^ingredient\./,
  /^nutrition\./,
  /^net_quantity$/,
  /^claims\./,
  /^allergen\./,
  /^brand\./,
  /^storage$/,
  /^packaging\./,
  /^marketing_copy$/,
  /^dietary_info$/
];

/**
 * Generates a stable deterministic fact ID from core provenance attributes.
 */
export function generateDeterministicFactId(documentSha256, field, locator, value) {
  const normVal = String(value || '').trim().toLowerCase();
  const rawKey = `${documentSha256 || 'doc'}:${field}:${locator || 'loc'}:${normVal}`;
  const hash = createHash('sha256').update(rawKey).digest('hex').slice(0, 12);
  const cleanField = String(field).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  return `fact_${cleanField}_${hash}`;
}

/**
 * Validates a fact candidate against the canonical schema.
 * Rejects unknown fields, invalid verification states, or missing provenance.
 * 
 * @param {object} fact - Fact candidate to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFactSchema(fact) {
  const errors = [];

  if (!fact || typeof fact !== 'object') {
    return { valid: false, errors: ['Fact must be a non-null object.'] };
  }

  if (fact.schemaVersion !== FACT_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion: expected "${FACT_SCHEMA_VERSION}", received "${fact.schemaVersion}".`);
  }

  if (!fact.factId || typeof fact.factId !== 'string') {
    errors.push('Missing or invalid "factId" (string required).');
  }

  if (!fact.field || typeof fact.field !== 'string') {
    errors.push('Missing or invalid "field" (string required).');
  } else {
    // Check known field registry or dot-separated semantic pattern
    const isKnown = KNOWN_FIELD_PATTERNS.some(p => p.test(fact.field)) || fact.field.includes('.');
    if (!isKnown && !fact.allowCustomField) {
      errors.push(`Unknown field identifier: "${fact.field}". Must follow standard semantic field registry.`);
    }
  }

  if (fact.value === undefined || fact.value === null) {
    errors.push('Fact "value" cannot be null or undefined.');
  }

  // Source object validation
  if (!fact.source || typeof fact.source !== 'object') {
    errors.push('Missing "source" provenance object.');
  } else {
    if (!fact.source.documentId) {
      errors.push('Missing "source.documentId".');
    }
    if (!fact.source.documentSha256) {
      errors.push('Missing "source.documentSha256".');
    }
    if (!['artwork', 'specification', 'source'].includes(fact.source.documentRole)) {
      errors.push(`Invalid "source.documentRole": "${fact.source.documentRole}".`);
    }
    if (!Array.isArray(fact.source.sourcePieceIds)) {
      errors.push('"source.sourcePieceIds" must be an array.');
    }
  }

  // Evidence validation
  if (!fact.evidence || typeof fact.evidence !== 'object') {
    errors.push('Missing "evidence" object.');
  } else {
    if (!VALID_QUOTE_MATCHES.includes(fact.evidence.quoteMatch)) {
      errors.push(`Invalid evidence quoteMatch: "${fact.evidence.quoteMatch}".`);
    }
    if (fact.evidence.visibility && !VALID_VISIBILITIES.includes(fact.evidence.visibility)) {
      errors.push(`Invalid evidence visibility: "${fact.evidence.visibility}".`);
    }
  }

  // State validations
  if (!VALID_VERIFICATION_STATES.includes(fact.verificationState)) {
    errors.push(`Invalid verificationState: "${fact.verificationState}". Must be VERIFIED, AI_SUGGESTED, or CONFLICTED.`);
  }

  if (fact.sourceAuthority && !VALID_SOURCE_AUTHORITIES.includes(fact.sourceAuthority)) {
    errors.push(`Invalid sourceAuthority: "${fact.sourceAuthority}".`);
  }

  if (fact.extractionMethod && !VALID_EXTRACTION_METHODS.includes(fact.extractionMethod)) {
    errors.push(`Invalid extractionMethod: "${fact.extractionMethod}".`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Factory creating a canonical Fact record with sensible defaults.
 */
export function createFactRecord(params) {
  const {
    field,
    value,
    normalizedValue = null,
    documentId,
    documentSha256,
    documentRole = 'source',
    sourcePieceIds = [],
    page = null,
    sheet = null,
    cell = null,
    panelId = null,
    box = null,
    quote = null,
    quoteMatch = 'EXACT',
    visibility = 'VISIBLE',
    method = 'deterministic',
    visualEvidenceRef = null,
    verificationState = 'VERIFIED',
    sourceAuthority = 'APPROVED',
    qualifiers = [],
    conflictGroupIds = [],
    extractionMethod = 'deterministic',
    modelMetadata = null,
    factId = null
  } = params;

  const locator = cell || (panelId ? `${panelId}:p${page}` : `p${page}`);
  const finalFactId = factId || generateDeterministicFactId(documentSha256, field, locator, value);

  const fact = {
    schemaVersion: FACT_SCHEMA_VERSION,
    factId: finalFactId,
    field,
    value: String(value),
    normalizedValue,
    source: {
      documentId,
      documentSha256,
      documentRole,
      sourcePieceIds: Array.isArray(sourcePieceIds) ? sourcePieceIds : [sourcePieceIds].filter(Boolean),
      page,
      sheet,
      cell,
      panelId,
      box
    },
    evidence: {
      quote,
      quoteMatch,
      visibility,
      method,
      visualEvidenceRef
    },
    verificationState,
    sourceAuthority,
    qualifiers: Array.isArray(qualifiers) ? [...qualifiers] : [],
    conflictGroupIds: Array.isArray(conflictGroupIds) ? [...conflictGroupIds] : [],
    extractionMethod,
    modelMetadata
  };

  const validation = validateFactSchema(fact);
  if (!validation.valid) {
    throw new Error(`Cannot create Fact: ${validation.errors.join('; ')}`);
  }

  return fact;
}
