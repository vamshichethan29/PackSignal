import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  appendAuditEvent,
  chainAuditTrail,
  verifyAuditChain,
  computeEventHash,
} from '../lib/audit-chain.mjs';

import {
  sealReview,
  signedPayload,
  reviewSealProof,
  verifyPortableSealProof,
} from '../lib/audit-signature.mjs';

test('Audit Event Hash Chain & Checkpoint Anchoring Suite', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-chain-tests-'));

  const review = {
    id: 'rev-chain-001',
    reviewRevision: 1,
    name: 'Aluminium Beverage Can 330ml UK Review',
    createdAt: '2026-10-25T10:00:00Z',
    finishedAt: '2026-10-25T10:30:00Z',
    documents: [
      { id: 'doc-can-art', role: 'artwork', name: 'Can_Artwork_V1.pdf', sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' },
    ],
    findings: [],
    decisions: {},
    audit: [],
  };

  // Build authentic 6-event workflow (Phase 20 Audit Chain Demo)
  // EVENT 1: Artwork uploaded
  appendAuditEvent(review, { action: 'ARTWORK_UPLOADED', detail: 'Artwork file Can_Artwork_V1.pdf ingested' }, { id: 'designer-01', displayName: 'Packaging Designer', role: 'designer' }, true);

  // EVENT 2: Rule checks completed
  appendAuditEvent(review, { action: 'RULES_EVALUATED', detail: 'Executed UK / EU Food Safety Rulebook (18 rules evaluated)' }, { id: 'system', displayName: 'PackSignal Engine' });

  // EVENT 3: Issue acknowledged
  appendAuditEvent(review, { action: 'ISSUE_ACKNOWLEDGED', detail: 'High caffeine warning label missing on primary display panel' }, { id: 'reviewer-qa', displayName: 'Senior Compliance Reviewer', role: 'reviewer' }, true);

  // EVENT 4: Correction requested
  appendAuditEvent(review, { action: 'CORRECTION_REQUESTED', detail: 'Remediation ticket #412 created for designer' }, { id: 'reviewer-qa', displayName: 'Senior Compliance Reviewer', role: 'reviewer' }, true);

  // EVENT 5: Revised artwork uploaded
  appendAuditEvent(review, { action: 'REVISED_ARTWORK_INGESTED', detail: 'Received Can_Artwork_V2.pdf with caffeine warning label' }, { id: 'designer-01', displayName: 'Packaging Designer', role: 'designer' }, true);

  // EVENT 6: Reviewer approval recorded
  appendAuditEvent(review, { action: 'REVIEWER_APPROVAL_RECORDED', detail: 'Final UK regulatory compliance sign-off approved' }, { id: 'signoff-lead', displayName: 'Director of Packaging Regulatory Affairs', role: 'admin' }, true);

  await t.test('1. Authentic 6-event workflow chain verifies sequentially and cryptographically', () => {
    assert.equal(review.audit.length, 6);
    const result = verifyAuditChain(review.audit);
    assert.equal(result.valid, true);
    assert.equal(result.length, 6);
    assert.ok(result.finalHash);
    assert.notEqual(result.finalHash, '0'.repeat(64));
  });

  await t.test('2. Modifying a middle event (EVENT 3) breaks the chain hash link', () => {
    const tampered = JSON.parse(JSON.stringify(review.audit));
    tampered[2].safeDetails = 'Issue cleared without remediation'; // Tampered EVENT 3

    const result = verifyAuditChain(tampered);
    assert.equal(result.valid, false);
    // Tampering is detected by eventHash mismatch at index 2
    assert.ok(result.reason.includes('has been tampered with') || result.reason.includes('previousEventHash mismatch'));
    assert.equal(result.failedIndex, 2);
  });

  await t.test('3. Deleting an intermediate event breaks sequence and previousEventHash linkage', () => {
    const tampered = JSON.parse(JSON.stringify(review.audit));
    tampered.splice(2, 1); // Delete EVENT 3 (leaving 5 events)

    const result = verifyAuditChain(tampered);
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('out-of-order sequence') || result.reason.includes('previousEventHash mismatch'));
  });

  await t.test('4. Reordering audit events breaks sequence continuity', () => {
    const tampered = JSON.parse(JSON.stringify(review.audit));
    // Swap EVENT 1 and EVENT 2
    const temp = tampered[0];
    tampered[0] = tampered[1];
    tampered[1] = temp;

    const result = verifyAuditChain(tampered);
    assert.equal(result.valid, false);
  });

  await t.test('5. Checkpoint anchoring: full rewrite of events with new valid hashes fails against signed checkpoint head', async () => {
    // A privileged attacker rewrites all events, re-hashes them to make them self-consistent
    const seal = await sealReview(review, tempDir, { schemaVersion: 'v2' });
    const signedRep = { ...review, signature: seal };

    // Attacker fabricates an alternative history and re-chains it
    const forgedAudit = [
      { at: '2026-10-25T10:00:00Z', action: 'ARTWORK_UPLOADED', detail: 'Artwork ingested' },
      { at: '2026-10-25T10:05:00Z', action: 'RULES_EVALUATED', detail: 'Zero issues found - instant pass' },
      { at: '2026-10-25T10:10:00Z', action: 'APPROVED', detail: 'Instant approval' },
    ];
    const forgedChain = chainAuditTrail(forgedAudit, review.id);

    // Individually the forged chain is self-consistent
    const forgedSelfCheck = verifyAuditChain(forgedChain);
    assert.equal(forgedSelfCheck.valid, true);

    // But when verified against the signed checkpoint head (in seal.payloadHash / v2 payload), it fails!
    const v2Payload = signedPayload(signedRep, 'v2');
    assert.notEqual(forgedSelfCheck.finalHash, v2Payload.auditChainHead);

    // Tampered report with forged chain fails seal verification
    const tamperedRep = { ...signedRep, audit: forgedChain };
    const proof = { ...reviewSealProof(tamperedRep), ...tamperedRep.signature };
    const portableResult = verifyPortableSealProof(proof);
    assert.equal(portableResult.valid, false);
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
