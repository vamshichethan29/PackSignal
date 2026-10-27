/**
 * PackSignal — Phase 6A: Shopper Verdict Audit Unit Tests
 * Asserts that every persona verdict is grounded in canonical evidence,
 * links real source citations, and rejects unevidenced statements.
 *
 * (tests/shopper-verdict-audit.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuditedVerdict,
  createShopperExperienceRecord,
  validateShopperExperienceRecord
} from '../lib/shopper/experience-schema.mjs';

import {
  evaluateNutAllergyPersona,
  evaluateVeganPersona,
  evaluateSugarPersona,
  evaluateLowVisionPersona
} from '../lib/shopper/experience-engine.mjs';

test('Shopper Verdict Audit Engine', async (t) => {
  await t.test('1. Rejects creation of unevidenced verdict without citations', () => {
    assert.throws(() => {
      createAuditedVerdict({
        verdictId: 'v-unsupported',
        personaId: 'nut_allergy',
        statement: 'Fabricated claim without any sources'
      });
    }, /no supporting evidence citations/);
  });

  await t.test('2. Successfully creates evidence-audited verdict with factIds and findingIds', () => {
    const verdict = createAuditedVerdict({
      verdictId: 'v-valid-01',
      personaId: 'vegan',
      statement: 'Vegan claim conflicts with honey.',
      factIds: ['fact-honey'],
      findingIds: ['f-vegan-conflict'],
      ruleIds: ['RULE-VEGAN-HONEY'],
      sourceEvidenceRefs: ['Artwork: INFOPANEL (honey 1%)'],
      reason: 'Honey is animal-derived',
      auditStatus: 'VERIFIED_GROUNDED'
    });

    assert.equal(verdict.verdictId, 'v-valid-01');
    assert.equal(verdict.auditStatus, 'VERIFIED_GROUNDED');
    assert.ok(verdict.factIds.includes('fact-honey'));
    assert.ok(verdict.sourceEvidenceRefs.length > 0);
  });

  await t.test('3. Nut Allergy persona produces verified verdict with intentional and advisory facts', () => {
    const nut = evaluateNutAllergyPersona({});
    assert.ok(nut.verdict);
    assert.equal(nut.verdict.auditStatus, 'VERIFIED_GROUNDED');
    assert.ok(nut.verdict.factIds.length >= 2, 'Cites multiple allergen facts');
    assert.ok(nut.verdict.sourceEvidenceRefs.length >= 2, 'Cites artwork and factsheet');
    assert.match(nut.verdict.statement, /intentional ingredients/i);
    assert.match(nut.verdict.statement, /advisory/i);
  });

  await t.test('4. Canonical experience record enforces required audit properties', () => {
    const record = createShopperExperienceRecord({
      reviewId: 'rev-test',
      revisionId: 'rev-01',
      documentId: 'doc-01',
      documentSha256: 'sha-test-12345',
      personaId: 'nut_allergy'
    });

    assert.equal(record.estimated, true);
    assert.ok(record.limitations.length > 0);
    assert.ok(validateShopperExperienceRecord(record));
  });
});
