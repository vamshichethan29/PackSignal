/**
 * @file tests/brief-approval.test.mjs
 * 
 * Unit tests for Phase 5 Server-Side Approval Gate,
 * Role Authorization, and Version Control.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import {
  saveBrief,
  getBrief,
  approveBriefInStore,
  updateBriefSentenceInStore,
  getApprovedSnapshot
} from '../lib/brief/brief-store.mjs';
import { BRIEF_STATUS } from '../lib/brief/brief-schema.mjs';

describe('Phase 5 — Approval Gate & Version Control', () => {

  test('1. Rejects approval when brief contains unproven or conflicted sentences', () => {
    const session = resetDeskSession('test-gate-unproven');
    const brief = buildBriefFromSession(session);
    saveBrief('test-gate-unproven', brief);

    assert.throws(() => {
      approveBriefInStore('test-gate-unproven', {
        name: 'Elena Rostova',
        role: 'REGULATORY_LEAD'
      }, session);
    }, /Approval rejected.*unproven/i);
  });

  test('2. Rejects approval when attempted by unauthorized role', () => {
    const session = resetDeskSession('test-gate-unauthorized');
    const brief = buildBriefFromSession(session);
    saveBrief('test-gate-unauthorized', brief);

    assert.throws(() => {
      approveBriefInStore('test-gate-unauthorized', {
        name: 'Junior Associate',
        role: 'UNAUTHORIZED_INTERN'
      }, session);
    }, /Role "UNAUTHORIZED_INTERN" is not authorized/i);
  });

  test('3. Successfully approves zero-defect brief with authorized role and seal', () => {
    const session = resetDeskSession('test-gate-success');
    // Set all facts to PROVEN
    for (const f of session.facts) {
      f.state = 'PROVEN';
      f.conflictId = null;
    }
    const brief = buildBriefFromSession(session);
    saveBrief('test-gate-success', brief);

    const approved = approveBriefInStore('test-gate-success', {
      name: 'Elena Rostova',
      role: 'REGULATORY_LEAD',
      org: 'Esko Regulatory Assurance'
    }, session);

    assert.strictEqual(approved.status, BRIEF_STATUS.APPROVED);
    assert.ok(approved.approval);
    assert.strictEqual(approved.approval.approvedBy, 'Elena Rostova');
    assert.match(approved.approval.sealId, /^SEAL-PACKSIGNAL-/);
    assert.ok(approved.approval.contentHash);
  });

  test('4. Editing approved brief creates a new draft version, preserving immutable approved snapshot', () => {
    const session = resetDeskSession('test-gate-fork');
    for (const f of session.facts) {
      f.state = 'PROVEN';
      f.conflictId = null;
    }
    const brief = buildBriefFromSession(session);
    saveBrief('test-gate-fork', brief);

    approveBriefInStore('test-gate-fork', {
      name: 'Elena Rostova',
      role: 'REGULATORY_LEAD'
    }, session);

    // Verify snapshot exists
    const snapshotV1 = getApprovedSnapshot('test-gate-fork', 'v1.0.0');
    assert.ok(snapshotV1);
    assert.strictEqual(snapshotV1.status, BRIEF_STATUS.APPROVED);

    // Now edit a sentence in the approved brief
    const sentToEdit = brief.sentences[0];
    const updateResult = updateBriefSentenceInStore(
      'test-gate-fork',
      sentToEdit.sentenceId,
      { text: 'Updated draft text for next iteration.' },
      session
    );

    assert.strictEqual(updateResult.brief.status, BRIEF_STATUS.DRAFT);
    assert.strictEqual(updateResult.brief.briefVersion, 'v2.0.0');
    assert.strictEqual(updateResult.brief.previousVersion, 'v1.0.0');

    // Verify old approved snapshot remains untouched
    const historicalSnapshot = getApprovedSnapshot('test-gate-fork', 'v1.0.0');
    assert.strictEqual(historicalSnapshot.status, BRIEF_STATUS.APPROVED);
    assert.notStrictEqual(historicalSnapshot.sentences[0].text, 'Updated draft text for next iteration.');
  });

});
