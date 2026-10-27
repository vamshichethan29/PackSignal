/**
 * @file tests/brief-schema.test.mjs
 * 
 * Unit tests for Phase 5 Brief Schema, 11 canonical sections,
 * sentence kinds, and schema validation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRIEF_SECTIONS,
  SENTENCE_KINDS,
  AUDIT_STATUS,
  BRIEF_STATUS,
  AUTHORIZED_APPROVAL_ROLES,
  createBriefSentence,
  validateBriefSchema
} from '../lib/brief/brief-schema.mjs';

describe('Phase 5 — Brief Schema & Data Model', () => {

  test('1. Defines all 11 canonical brief sections in statutory order', () => {
    assert.strictEqual(BRIEF_SECTIONS.length, 11, 'Must define exactly 11 canonical sections');
    assert.strictEqual(BRIEF_SECTIONS[0].code, '01');
    assert.match(BRIEF_SECTIONS[0].title, /PROJECT OVERVIEW/i);
    assert.strictEqual(BRIEF_SECTIONS[1].code, '02');
    assert.match(BRIEF_SECTIONS[1].title, /PRODUCT INFORMATION/i);
    assert.strictEqual(BRIEF_SECTIONS[2].code, '03');
    assert.match(BRIEF_SECTIONS[2].title, /INGREDIENTS AND ALLERGENS/i);
    assert.strictEqual(BRIEF_SECTIONS[3].code, '04');
    assert.match(BRIEF_SECTIONS[3].title, /NUTRITION REQUIREMENTS/i);
    assert.strictEqual(BRIEF_SECTIONS[4].code, '05');
    assert.match(BRIEF_SECTIONS[4].title, /MARKETING CLAIMS/i);
    assert.strictEqual(BRIEF_SECTIONS[5].code, '06');
    assert.match(BRIEF_SECTIONS[5].title, /REGULATORY REQUIREMENTS/i);
    assert.strictEqual(BRIEF_SECTIONS[6].code, '07');
    assert.match(BRIEF_SECTIONS[6].title, /DESIGN AND BRAND DIRECTION/i);
    assert.strictEqual(BRIEF_SECTIONS[7].code, '08');
    assert.match(BRIEF_SECTIONS[7].title, /KEEP \/ CHANGE \/ ADD \/ REMOVE/i);
    assert.strictEqual(BRIEF_SECTIONS[8].code, '09');
    assert.match(BRIEF_SECTIONS[8].title, /PRODUCTION REQUIREMENTS/i);
    assert.strictEqual(BRIEF_SECTIONS[9].code, '10');
    assert.match(BRIEF_SECTIONS[9].title, /OPEN QUESTIONS AND DEPENDENCIES/i);
    assert.strictEqual(BRIEF_SECTIONS[10].code, '11');
    assert.match(BRIEF_SECTIONS[10].title, /DELIVERY \/ REVIEW CHECKLIST/i);
  });

  test('2. Atomic sentence factory generates valid sentence records with stable IDs', () => {
    const sent = createBriefSentence({
      sentenceId: 'BR-S-001',
      sectionId: 'sec-02-product-info',
      text: 'The net quantity of contents is 480 g (16.9 oz).',
      kind: SENTENCE_KINDS.FACTUAL_CLAIM,
      factIds: ['fact-net-quantity'],
      requirementIds: ['US-001']
    });

    assert.strictEqual(sent.sentenceId, 'BR-S-001');
    assert.strictEqual(sent.sectionId, 'sec-02-product-info');
    assert.strictEqual(sent.kind, 'FACTUAL_CLAIM');
    assert.deepStrictEqual(sent.factIds, ['fact-net-quantity']);
    assert.deepStrictEqual(sent.requirementIds, ['US-001']);
    assert.strictEqual(sent.evidenceStatus, AUDIT_STATUS.AUDIT_REQUIRED);
    assert.ok(sent.lastEditedAt);
  });

  test('3. Schema validator detects missing required brief fields and fails cleanly', () => {
    const incompleteBrief = {
      briefId: 'brief-123',
      title: 'Incomplete'
    };

    const res = validateBriefSchema(incompleteBrief);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.length > 0);
    assert.ok(res.errors.some(e => e.includes('Missing required field')));
  });

  test('4. Authorized approval roles include regulatory and packaging leads', () => {
    assert.ok(AUTHORIZED_APPROVAL_ROLES.includes('REGULATORY_LEAD'));
    assert.ok(AUTHORIZED_APPROVAL_ROLES.includes('QA_SPECIALIST'));
    assert.ok(AUTHORIZED_APPROVAL_ROLES.includes('PACKAGING_ENGINEER'));
    assert.ok(AUTHORIZED_APPROVAL_ROLES.includes('LEAD_REVIEWER'));
    assert.ok(AUTHORIZED_APPROVAL_ROLES.includes('ADMIN'));
    assert.ok(!AUTHORIZED_APPROVAL_ROLES.includes('UNAUTHORIZED_INTERN'));
  });

});
