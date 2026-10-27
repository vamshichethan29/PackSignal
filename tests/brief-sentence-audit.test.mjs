/**
 * @file tests/brief-sentence-audit.test.mjs
 * 
 * Unit tests for Phase 5 Zero-Unproven-Claims Sentence Auditor.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { createBriefSentence, AUDIT_STATUS } from '../lib/brief/brief-schema.mjs';
import { auditBriefSentence, auditEntireBrief } from '../lib/brief/brief-auditor.mjs';

describe('Phase 5 — Zero-Unproven-Claims Sentence Auditor', () => {

  test('1. Passes valid sentence supported by active verified fact', () => {
    const session = resetDeskSession('test-audit-valid');
    const netFact = session.facts.find(f => f.field === 'net_quantity');
    netFact.state = 'PROVEN';

    const sent = createBriefSentence({
      sentenceId: 'BR-S-TEST-1',
      sectionId: 'sec-02-product-info',
      text: 'The net quantity declares 480 g (16.9 oz).',
      factIds: [netFact.id]
    });

    const res = auditBriefSentence(sent, session);
    assert.strictEqual(res.status, AUDIT_STATUS.SUPPORTED);
    assert.strictEqual(res.findings.length, 0);
  });

  test('2. Rejects unsupported numeric claim inserted into sentence (No Unproven Numbers)', () => {
    const session = resetDeskSession('test-audit-unproven-num');
    const netFact = session.facts.find(f => f.field === 'net_quantity');

    // Sentence mentions 750 g which does not appear in referenced facts
    const sent = createBriefSentence({
      sentenceId: 'BR-S-TEST-2',
      sectionId: 'sec-02-product-info',
      text: 'The net quantity declares 750 g on front panel.',
      factIds: [netFact.id]
    });

    const res = auditBriefSentence(sent, session);
    assert.strictEqual(res.status, AUDIT_STATUS.UNSUPPORTED);
    assert.ok(res.findings.some(f => f.type === 'UNSUPPORTED_NUMERIC_CLAIM'));
  });

  test('3. Rejects unsupported certification claim (No Unproven Claims)', () => {
    const session = resetDeskSession('test-audit-unproven-cert');
    const nameFact = session.facts.find(f => f.field === 'product_name');

    // Sentence makes an unsupported Certified Vegan claim
    const sent = createBriefSentence({
      sentenceId: 'BR-S-TEST-3',
      sectionId: 'sec-05-claims',
      text: 'The product is certified vegan and organic.',
      factIds: [nameFact.id]
    });

    const res = auditBriefSentence(sent, session);
    assert.strictEqual(res.status, AUDIT_STATUS.UNSUPPORTED);
    assert.ok(res.findings.some(f => f.type === 'UNSUPPORTED_CERTIFICATION_OR_CLAIM'));
  });

  test('4. Flags sentence referencing a fact in CONFLICT state as CONFLICTED', () => {
    const session = resetDeskSession('test-audit-conflict');
    const honeyFact = session.facts.find(f => f.field === 'honey_percentage');
    honeyFact.state = 'CONFLICT';

    const sent = createBriefSentence({
      sentenceId: 'BR-S-TEST-4',
      sectionId: 'sec-03-ingredients',
      text: 'Formulation contains 9% honey.',
      factIds: [honeyFact.id]
    });

    const res = auditBriefSentence(sent, session);
    assert.strictEqual(res.status, AUDIT_STATUS.CONFLICTED);
    assert.ok(res.findings.some(f => f.type === 'FACT_IN_CONFLICT'));
  });

  test('5. Multi-clause claim fails if ANY clause is unsupported', () => {
    const session = resetDeskSession('test-audit-multiclause');
    const netFact = session.facts.find(f => f.field === 'net_quantity');
    netFact.state = 'PROVEN';

    // Clause 1 (480 g) is supported, but Clause 2 ("certified vegan") is unsupported
    const sent = createBriefSentence({
      sentenceId: 'BR-S-TEST-5',
      sectionId: 'sec-02-product-info',
      text: 'The carton net weight is 480 g and is certified vegan.',
      factIds: [netFact.id]
    });

    const res = auditBriefSentence(sent, session);
    assert.strictEqual(res.status, AUDIT_STATUS.UNSUPPORTED);
    assert.ok(res.findings.some(f => f.type === 'UNSUPPORTED_CERTIFICATION_OR_CLAIM'));
  });

});
