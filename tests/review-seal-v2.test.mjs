/**
 * tests/review-seal-v2.test.mjs
 * Cryptographic test suite for Ed25519 packproof-review-seal/v2,
 * backwards compatibility with v1, and tamper detection on all protected sections.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  sealReview,
  signedPayload,
  reviewSealProof,
  verifyPortableSealProof,
} from '../lib/audit-signature.mjs';

test('Ed25519 Digital Review Seal v2 & Backward Compatibility Suite', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-seal-v2-tests-'));

  const sampleReviewV2 = {
    id: 'rev-seal2-100',
    reviewRevision: 2,
    name: 'Fieldday Organic Orange Juice 1L V2 Verification',
    createdAt: '2026-10-26T10:00:00Z',
    finishedAt: '2026-10-26T10:15:00Z',
    market: 'US-FDA',
    engine: 'Packaging Intelligence v2',
    documents: [
      { id: 'doc-art-v2', role: 'artwork', name: 'fieldday-v2.pdf', sha256: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b' },
      { id: 'doc-spec', role: 'spec', name: 'Fieldday_Spec.pdf', sha256: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff' },
    ],
    options: { marketPreset: 'US_FDA_CONVENTIONAL' },
    findings: [
      {
        id: 'find-qty',
        status: 'match',
        expected: '1000 mL (1 L)',
        observed: '1000 mL (1 L)',
        calculationProof: 'Net quantity verification formula: 1000 mL == 1 L exact match',
        evidence: [{ documentId: 'doc-art-v2', quote: '1000 mL (1 L)', page: 1, box: [0.35, 0.78, 0.65, 0.85] }],
      },
      {
        id: 'find-care',
        status: 'issue',
        expected: 'Customer care contact details',
        observed: null,
        evidence: [],
      },
    ],
    decisions: {
      'find-care': { disposition: 'correction_requested', note: 'Customer email omitted in V2 layout' },
    },
    team: {
      approvals: [
        { reviewerId: 'rev-qa', reviewerName: 'Quality Lead', outcome: 'CHANGES_REQUIRED', at: '2026-10-26T10:14:00Z', note: 'Fix customer care before release' },
      ],
    },
    revision: {
      previousId: 'rev-seal2-099',
      kind: 'artwork',
      intelligence: { summaryText: 'Fieldday V1 to V2 revision comparison: R03 resolved, R09 regression' },
      changes: [{ id: 'chg-1', title: 'Net quantity', change: 'resolved' }],
    },
    audit: [
      { at: '2026-10-26T10:00:00Z', action: 'INGESTED', detail: 'Artwork loaded', eventHash: 'hash-evt-001' },
      { at: '2026-10-26T10:15:00Z', action: 'REVIEW_SEALED', detail: 'Digital seal generated', eventHash: 'hash-evt-002' },
    ],
  };

  // 1. Sign with v2 schema
  const sealV2 = await sealReview(sampleReviewV2, tempDir);
  const signedReviewV2 = { ...sampleReviewV2, signature: sealV2 };

  await t.test('1. Ed25519 v2 signing succeeds and produces canonical proof', () => {
    assert.equal(sealV2.algorithm, 'Ed25519');
    assert.equal(sealV2.schema, 'packproof-review-seal/v2');
    assert.ok(sealV2.signature, 'Signature string must be generated');
    assert.ok(sealV2.publicKey, 'Public key PEM must be present');
    assert.ok(sealV2.publicKeyId, 'Key ID must be 16-hex fingerprint');
    assert.ok(sealV2.payloadHash, 'Payload SHA-256 hash must be present');
  });

  await t.test('2. Original signed v2 review payload verifies successfully', () => {
    const proof = { ...reviewSealProof(signedReviewV2), ...signedReviewV2.signature };
    const res = verifyPortableSealProof(proof);
    assert.equal(res.valid, true);
    assert.equal(res.schema, 'packproof-review-seal/v2');
    assert.equal(res.payloadHash, sealV2.payloadHash);
  });

  await t.test('3. Backwards compatibility: packproof-review-seal/v1 remains supported', async () => {
    const sampleV1 = {
      id: 'rev-v1-legacy',
      createdAt: '2026-09-01T12:00:00Z',
      finishedAt: '2026-09-01T12:30:00Z',
      name: 'Legacy V1 Review',
      documents: [{ id: 'doc-1', role: 'artwork', name: 'Legacy.pdf', sha256: 'abc123' }],
      findings: [{ id: 'f-1', status: 'issue', expected: 'A', observed: 'B' }],
      audit: [{ at: '2026-09-01T12:00:00Z', action: 'STARTED', detail: 'Init' }],
    };

    const payloadV1 = signedPayload(sampleV1, 'v1');
    assert.equal(payloadV1.schema, 'packproof-review-seal/v1');
    assert.ok(payloadV1.review);
    assert.ok(payloadV1.sources);
  });

  await t.test('4. Tamper detection: modified finding status invalidates signature', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.findings[1].status = 'match'; // Changing regression issue -> match

    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    const res = verifyPortableSealProof(proof);
    assert.equal(res.valid, false);
    assert.ok(res.reason.includes('does not match') || res.reason.includes('invalid'));
  });

  await t.test('5. Tamper detection: modified reviewer decision invalidates signature', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.decisions['find-care'].disposition = 'approved';

    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    const res = verifyPortableSealProof(proof);
    assert.equal(res.valid, false);
  });

  await t.test('6. Tamper detection: modified source document SHA-256 invalidates signature', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.documents[0].sha256 = '0000000000000000000000000000000000000000000000000000000000000000';

    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    const res = verifyPortableSealProof(proof);
    assert.equal(res.valid, false);
  });

  await t.test('7. Tamper detection: corrupted signature bytes are rejected', () => {
    const corruptedProof = {
      ...reviewSealProof(signedReviewV2),
      ...signedReviewV2.signature,
      signature: 'AAAAAAAAAAAAAAAA' + signedReviewV2.signature.signature.slice(16),
    };
    const res = verifyPortableSealProof(corruptedProof);
    assert.equal(res.valid, false);
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
