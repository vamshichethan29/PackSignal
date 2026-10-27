/**
 * @file tests/ask-about-this.test.mjs
 * 
 * Unit tests for Phase 5 "Ask About This" Grounded Assistant.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { queryAskAboutThis } from '../lib/brief/ask-about-this.mjs';

describe('Phase 5 — "Ask About This" Grounded Q&A Assistant', () => {

  test('1. Answers query about honey content using ground-truth facts', () => {
    const session = resetDeskSession('test-ask-honey');
    const res = queryAskAboutThis('What is the honey percentage?', session);

    assert.ok(res.answer.includes('honey'));
    assert.ok(res.sources.length > 0);
  });

  test('2. Answers query about allergens citing FALCPA rules and species declaration', () => {
    const session = resetDeskSession('test-ask-allergens');
    const res = queryAskAboutThis('What tree nuts are in the allergen statement?', session);

    assert.ok(res.answer.includes('Almonds') || res.answer.includes('tree nut'));
    assert.ok(res.sources.length > 0);
  });

  test('3. Returns honest unavailable response for unsupported out-of-scope question', () => {
    const session = resetDeskSession('test-ask-unsupported');
    // Ask something completely outside the documents like price or celebrity endorsement
    const res = queryAskAboutThis('What is the celebrity endorsement contract value for this granola?', session);

    assert.strictEqual(res.answer, "I couldn't establish that from the supplied sources.");
    assert.strictEqual(res.sources.length, 0);
    assert.strictEqual(res.canConfirmAsFact, false);
    assert.strictEqual(res.proposedFact, null);
  });

  test('4. Proposes confirmable fact when inquiring about technical storage conditions in spec', () => {
    const session = resetDeskSession('test-ask-storage');
    const res = queryAskAboutThis('What are the storage conditions and shelf life?', session);

    assert.ok(res.answer.includes('below 22°C'));
    assert.strictEqual(res.canConfirmAsFact, true);
    assert.ok(res.proposedFact);
    assert.strictEqual(res.proposedFact.field, 'storage_conditions');
    assert.strictEqual(res.proposedFact.provenanceType, 'REVIEWER_ATTESTED');
  });

});
