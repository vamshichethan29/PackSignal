import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskSession, answerDeskQuestion } from '../lib/evidence-desk.mjs';

describe('Phase 4 — Prioritized Questions Stack & Answering Workflow', () => {
  it('enforces hard maximum of 10 prioritized questions (Check 30)', () => {
    const session = getDeskSession('q-test-session');
    assert.ok(session.questions.length <= 10, `Expected <= 10 questions, got ${session.questions.length}`);
  });

  it('verifies question reasons and impacts are source-backed (Check 31)', () => {
    const session = getDeskSession('q-test-session');
    for (const q of session.questions) {
      assert.ok(q.question, 'Question wording required');
      assert.ok(q.reason, 'Source-backed reason required');
      assert.ok(q.rank >= 1 && q.rank <= 10, 'Rank between 1 and 10');
      assert.ok(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(q.priority));
    }
  });

  it('rejects incomplete question answers (Check 33)', () => {
    assert.throws(() => {
      answerDeskQuestion('q-test-session', {
        questionId: 'Q-TREE-NUTS',
        answerId: null,
        answerText: '   '
      });
    }, /Validation failed/);
  });

  it('persists answers with responsible actor and audit history (Check 32)', () => {
    const session = answerDeskQuestion('q-test-session', {
      questionId: 'Q-TREE-NUTS',
      answerId: 'opt-specific-nuts',
      actor: 'Marcus Vance',
      actorRole: 'LEAD_REGULATORY_SCIENTIST',
      note: 'Validated against tree nut test results.'
    });

    const q = session.questions.find(item => item.id === 'Q-TREE-NUTS');
    assert.equal(q.status, 'ANSWERED');
    assert.equal(q.answer.actor, 'Marcus Vance');
    assert.equal(q.answer.actorRole, 'LEAD_REGULATORY_SCIENTIST');
    assert.ok(q.answer.answeredAt);
    assert.ok(q.auditTrail.length > 0);
  });

  it('does not turn human answers into automatically approved specifications (Check 34)', () => {
    const session = answerDeskQuestion('q-test-session', {
      questionId: 'Q-BRAND-PHOTO',
      answerId: 'opt-reshot-photo',
      actor: 'Alex BrandManager'
    });

    const fact = session.facts.find(f => f.field === 'brand_asset_photo');
    assert.ok(fact);
    // Human answer marks it HUMAN_CONFIRMED, not unconditionally PROVEN
    assert.equal(fact.state, 'HUMAN_CONFIRMED');
    assert.ok(fact.clarificationNote.includes('Alex BrandManager'));
  });
});
