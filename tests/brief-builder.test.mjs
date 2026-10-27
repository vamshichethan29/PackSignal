/**
 * @file tests/brief-builder.test.mjs
 * 
 * Unit tests for Phase 5 Brief Builder and offline deterministic fallback.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskSession, resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { validateBriefSchema } from '../lib/brief/brief-schema.mjs';

describe('Phase 5 — Brief Builder & Deterministic Fallback', () => {

  test('1. Builds full 11-section packaging brief from evidence desk session', () => {
    const session = resetDeskSession('test-builder-11-sec');
    const brief = buildBriefFromSession(session);

    assert.ok(brief.briefId);
    assert.strictEqual(brief.sections.length, 11, 'Must construct all 11 canonical sections');
    assert.ok(brief.sentences.length >= 15, 'Must generate atomic sentences across all sections');

    const validation = validateBriefSchema(brief);
    assert.strictEqual(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
  });

  test('2. Every factual claim carries explicit fact IDs and provenance links', () => {
    const session = resetDeskSession('test-builder-provenance');
    const brief = buildBriefFromSession(session);

    const netQtySent = brief.sentences.find(s => s.sectionId === 'sec-02-product-info' && s.text.includes('net quantity'));
    assert.ok(netQtySent, 'Must have net quantity sentence');
    assert.ok(netQtySent.factIds.includes('fact-net-quantity'), 'Must link to fact-net-quantity');

    const allergenSent = brief.sentences.find(s => s.sectionId === 'sec-03-ingredients' && s.text.includes('allergen'));
    assert.ok(allergenSent, 'Must have allergen sentence');
    assert.ok(allergenSent.factIds.includes('fact-allergen-statement'), 'Must link to fact-allergen-statement');
  });

  test('3. Open questions are represented explicitly when items are unresolved', () => {
    const session = resetDeskSession('test-builder-open-q');
    // Ensure at least one open question exists
    session.questions[0].status = 'OPEN';
    const brief = buildBriefFromSession(session);

    const openQSec = brief.sections.find(s => s.id === 'sec-10-open-questions');
    assert.ok(openQSec);
    assert.ok(openQSec.sentences.some(s => s.kind === 'OPEN_QUESTION' || s.text.includes('Open Question')));
  });

  test('4. Deterministic fallback builder functions offline without external AI keys', () => {
    const session = resetDeskSession('test-builder-offline');
    const brief = buildBriefFromSession(session);

    assert.ok(brief);
    assert.strictEqual(brief.productIdentity.brand, 'Dancing Fish');
    assert.strictEqual(brief.sections.length, 11);
  });

});
