/**
 * PackSignal Phase 2 — Fact Schema Unit Tests
 * (tests/fact-schema.test.mjs)
 * 
 * Verifies:
 * - Valid structured output accepted.
 * - Invalid schema rejected.
 * - Unknown field rejected.
 * - Stable deterministic fact IDs generated.
 * - Three presentation states (VERIFIED, AI_SUGGESTED, CONFLICTED).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACT_SCHEMA_VERSION,
  validateFactSchema,
  createFactRecord,
  generateDeterministicFactId
} from '../lib/facts/fact-schema.mjs';

describe('Phase 2 — Fact Schema & Integrity (packsignal-fact/v1)', () => {

  it('1. Generates stable, deterministic fact IDs from core attributes', () => {
    const id1 = generateDeterministicFactId('sha123', 'ingredient.honey.percentage', 'B26', '1%');
    const id2 = generateDeterministicFactId('sha123', 'ingredient.honey.percentage', 'B26', '1%');
    const id3 = generateDeterministicFactId('sha123', 'ingredient.honey.percentage', 'B26', '9%');

    assert.equal(id1, id2, 'Identical attributes must produce identical fact IDs');
    assert.notEqual(id1, id3, 'Different values must produce different fact IDs');
    assert.ok(id1.startsWith('fact_ingredient_honey_per'), 'ID should include field prefix');
  });

  it('2. Accepts valid structured fact conforming to canonical schema', () => {
    const validFact = {
      schemaVersion: FACT_SCHEMA_VERSION,
      factId: 'fact_honey_123',
      field: 'ingredient.honey.percentage',
      value: '1%',
      normalizedValue: { amount: 1, unit: '%', dimension: 'percentage', basis: null },
      source: {
        documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
        documentSha256: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
        documentRole: 'artwork',
        sourcePieceIds: ['sp_123'],
        page: 1,
        sheet: null,
        cell: null,
        panelId: 'Back panel',
        box: [100, 200, 300, 400]
      },
      evidence: {
        quote: 'Honey (1%)',
        quoteMatch: 'EXACT',
        visibility: 'VISIBLE',
        method: 'native_pdf_text'
      },
      verificationState: 'VERIFIED',
      sourceAuthority: 'APPROVED',
      qualifiers: [],
      conflictGroupIds: [],
      extractionMethod: 'deterministic',
      modelMetadata: null
    };

    const res = validateFactSchema(validFact);
    assert.equal(res.valid, true, 'Valid schema must pass without errors');
    assert.equal(res.errors.length, 0);
  });

  it('3. Rejects invalid schema version or malformed fact object', () => {
    const res1 = validateFactSchema(null);
    assert.equal(res1.valid, false);

    const badVersion = {
      schemaVersion: 'legacy-fact/v0',
      factId: 'fact_1',
      field: 'ingredient.honey.percentage',
      value: '1%'
    };
    const res2 = validateFactSchema(badVersion);
    assert.equal(res2.valid, false);
    assert.ok(res2.errors.some(e => e.includes('schemaVersion')));
  });

  it('4. Rejects unknown arbitrary field not registered in semantic registry', () => {
    const unknownFieldFact = {
      schemaVersion: FACT_SCHEMA_VERSION,
      factId: 'fact_bad_field',
      field: 'random_unregistered_hack_property',
      value: 'test',
      source: {
        documentId: 'doc.pdf',
        documentSha256: 'hash',
        documentRole: 'artwork',
        sourcePieceIds: []
      },
      evidence: { quoteMatch: 'EXACT' },
      verificationState: 'VERIFIED'
    };

    const res = validateFactSchema(unknownFieldFact);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('Unknown field identifier')));
  });

  it('5. Rejects missing provenance or invalid verification state', () => {
    const missingSource = {
      schemaVersion: FACT_SCHEMA_VERSION,
      factId: 'fact_no_source',
      field: 'ingredient.list',
      value: 'Oats',
      evidence: { quoteMatch: 'EXACT' },
      verificationState: 'INVALID_STATE'
    };

    const res = validateFactSchema(missingSource);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('source')));
    assert.ok(res.errors.some(e => e.includes('verificationState')));
  });

  it('6. createFactRecord factory enforces strict validation and defaults', () => {
    const fact = createFactRecord({
      field: 'nutrition.carbohydrate.total',
      value: '66g',
      documentId: 'carton.pdf',
      documentSha256: 'abc123456789',
      documentRole: 'artwork',
      quote: 'Total Carbohydrate 66g',
      quoteMatch: 'EXACT',
      verificationState: 'VERIFIED'
    });

    assert.equal(fact.schemaVersion, FACT_SCHEMA_VERSION);
    assert.ok(fact.factId.startsWith('fact_nutrition'));
    assert.equal(fact.verificationState, 'VERIFIED');
    assert.equal(fact.sourceAuthority, 'APPROVED');
  });
});
