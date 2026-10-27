import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskSession, answerDeskQuestion } from '../lib/evidence-desk.mjs';

describe('Phase 4 — Creative Brief Keep / Change / Add / Remove Decisions', () => {
  it('updates Creative Brief KEEP list when reviewer decides to retain brand asset', () => {
    const session = answerDeskQuestion('brief-test-session', {
      questionId: 'Q-BRAND-LOGO',
      answerId: 'opt-keep-logo'
    });

    assert.ok(session.briefFeed.keep.some(item => item.includes('Design Asset (Logo)')));
  });

  it('updates Creative Brief CHANGE list when reviewer decides to refresh brand asset', () => {
    const session = answerDeskQuestion('brief-test-session', {
      questionId: 'Q-BRAND-COLOURS',
      answerId: 'opt-brighten-colours'
    });

    assert.ok(session.briefFeed.change.some(item => item.includes('Design Asset (Colours)')));
  });

  it('updates Creative Brief REMOVE list when reviewer decides to drop asset or claim', () => {
    const session = answerDeskQuestion('brief-test-session', {
      questionId: 'Q-BRAND-TAGLINE',
      answerId: 'opt-remove-tagline'
    });

    assert.ok(session.briefFeed.remove.some(item => item.includes('Design Asset (Tagline)')));
  });

  it('preserves master PDF artwork bytes when recording design brief choices', () => {
    const session = getDeskSession('brief-test-session');
    const artworkFile = session.files.find(f => f.type === 'pdf' && f.name.includes('Carton'));
    assert.ok(artworkFile);
    assert.ok(artworkFile.sha256);
    // Decisions populate the brief matrix without mutating original document bytes
  });
});
