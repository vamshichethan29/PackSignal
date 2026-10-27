/**
 * @file tests/answer-confirmation.test.mjs
 * 
 * Unit tests for Phase 5 "Confirm Answer as Fact" safe confirmation workflow.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { queryAskAboutThis, confirmAnswerAsFact } from '../lib/brief/ask-about-this.mjs';

describe('Phase 5 — Safe Answer-to-Fact Confirmation Workflow', () => {

  test('1. Confirms supported answer as REVIEWER_ATTESTED fact recording reviewer provenance', () => {
    const session = resetDeskSession('test-confirm-actor');
    const brief = buildBriefFromSession(session);

    const askRes = queryAskAboutThis('storage conditions and shelf life', session);
    assert.ok(askRes.canConfirmAsFact);

    const confirmRes = confirmAnswerAsFact({
      session,
      brief,
      proposedFact: askRes.proposedFact,
      reviewer: {
        name: 'Elena Rostova',
        role: 'REGULATORY_LEAD',
        reason: 'Confirmed based on Word Spec paragraph 5'
      }
    });

    assert.strictEqual(confirmRes.success, true);
    assert.strictEqual(confirmRes.confirmedFact.state, 'PROVEN');
    assert.strictEqual(confirmRes.confirmedFact.provenanceType, 'REVIEWER_ATTESTED');
    assert.strictEqual(confirmRes.confirmedFact.attestation.confirmedBy, 'Elena Rostova');
    assert.strictEqual(confirmRes.confirmedFact.attestation.role, 'REGULATORY_LEAD');

    // Fact must now exist in session
    const saved = session.facts.find(f => f.field === 'storage_conditions');
    assert.ok(saved);
    assert.strictEqual(saved.provenanceType, 'REVIEWER_ATTESTED');
  });

  test('2. Answer confirmation refreshes dependencies and updates brief audit state', () => {
    const session = resetDeskSession('test-confirm-audit-update');
    const brief = buildBriefFromSession(session);

    // Initial audit
    assert.ok(brief.auditResult);

    const askRes = queryAskAboutThis('storage conditions and shelf life', session);
    confirmAnswerAsFact({
      session,
      brief,
      proposedFact: askRes.proposedFact,
      reviewer: { name: 'Elena Rostova', role: 'REGULATORY_LEAD' }
    });

    // Brief must have been re-audited
    assert.ok(brief.auditResult.auditedAt);
  });

});
