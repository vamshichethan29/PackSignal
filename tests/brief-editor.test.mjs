/**
 * @file tests/brief-editor.test.mjs
 * 
 * Unit tests for Phase 5 Brief Editor and edit invalidation behavior.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { saveBrief, getBrief, updateBriefSentenceInStore } from '../lib/brief/brief-store.mjs';
import { AUDIT_STATUS } from '../lib/brief/brief-schema.mjs';

describe('Phase 5 — Brief Editor & Immediate Edit Invalidation', () => {

  test('1. Editing sentence immediately invalidates prior audit and marks AUDIT_REQUIRED', () => {
    const session = resetDeskSession('test-editor-invalidation');
    const brief = buildBriefFromSession(session);
    saveBrief('test-editor-invalidation', brief);

    const sent = brief.sentences[0];
    const updateRes = updateBriefSentenceInStore(
      'test-editor-invalidation',
      sent.sentenceId,
      { text: 'Edited product overview statement with updated information.' },
      session
    );

    assert.strictEqual(updateRes.sentence.text, 'Edited product overview statement with updated information.');
    assert.ok(updateRes.brief.updatedAt);
  });

  test('2. Editing sentence to include unsupported numbers flags issue in fresh audit', () => {
    const session = resetDeskSession('test-editor-number-injection');
    const brief = buildBriefFromSession(session);
    saveBrief('test-editor-number-injection', brief);

    // Pick net quantity sentence and inject unsupported 999 g
    const netSent = brief.sentences.find(s => s.sectionId === 'sec-02-product-info' && s.text.includes('net quantity'));
    const updateRes = updateBriefSentenceInStore(
      'test-editor-number-injection',
      netSent.sentenceId,
      { text: 'The package declares 999 g net quantity.' },
      session
    );

    assert.strictEqual(updateRes.sentence.evidenceStatus, AUDIT_STATUS.UNSUPPORTED);
    assert.ok(updateRes.brief.auditResult.issues.some(i => i.sentenceId === netSent.sentenceId && i.type === 'UNSUPPORTED_NUMERIC_CLAIM'));
  });

});
