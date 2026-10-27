import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeskSession,
  resolveDeskConflict,
  answerDeskQuestion,
  uploadDeskInput
} from '../lib/evidence-desk.mjs';

describe('Phase 4 — Review Session Persistence & Safety', () => {
  it('reopening a persisted session restores all previous decisions and answers (Check 36)', () => {
    const sId = 'persistence-test-session';
    // 1. Make decisions
    resolveDeskConflict(sId, {
      conflictId: 'CONFLICT-HONEY-CONTENT',
      chosenValue: 'Honey (9%)',
      chosenSource: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
      reviewer: 'Sarah Auditor',
      role: 'QA_SPECIALIST'
    });

    answerDeskQuestion(sId, {
      questionId: 'Q-TREE-NUTS',
      answerId: 'opt-specific-nuts',
      actor: 'Sarah Auditor'
    });

    // 2. Simulate reopen by querying session anew
    const reopened = getDeskSession(sId);
    const resolvedConflict = reopened.conflicts.find(c => c.id === 'CONFLICT-HONEY-CONTENT');
    assert.equal(resolvedConflict.status, 'RESOLVED');
    assert.equal(resolvedConflict.resolvedValue, 'Honey (9%)');
    assert.equal(resolvedConflict.reviewer, 'Sarah Auditor');

    const answeredQ = reopened.questions.find(q => q.id === 'Q-TREE-NUTS');
    assert.equal(answeredQ.status, 'ANSWERED');
    assert.equal(answeredQ.answer.actor, 'Sarah Auditor');
  });

  it('preserves cached extraction respecting fingerprints (Check 38)', () => {
    const sId = 'fingerprint-cache-session';
    const upload1 = uploadDeskInput(sId, {
      fileName: 'spec_v1.txt',
      content: 'Line 1: Spec content original',
      role: 'PRODUCT_SPECIFICATION'
    });

    assert.ok(upload1.newFile.sha256);
    const hash1 = upload1.newFile.sha256;

    // Same content produces exact same fingerprint
    const upload2 = uploadDeskInput(sId, {
      fileName: 'spec_v2_dup.txt',
      content: 'Line 1: Spec content original',
      role: 'PRODUCT_SPECIFICATION'
    });

    assert.equal(upload2.newFile.sha256, hash1);
  });

  it('handles malformed or empty uploads safely without crashing session (Check 39)', () => {
    const sId = 'safety-test-session';
    const res = uploadDeskInput(sId, {
      fileName: null,
      content: '',
      fileType: null,
      role: 'INVALID_ROLE'
    });

    assert.ok(res.newFile);
    assert.ok(res.newFile.id);
    assert.ok(res.session);
    assert.equal(res.newFile.piecesCount, 0);
  });
});
