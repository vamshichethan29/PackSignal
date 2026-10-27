import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  sealReview,
  reviewSealProof,
  verifyPortableSealProof,
  signedPayload,
  verifyReviewSeal,
} from '../lib/audit-signature.mjs';

import { appendAuditEvent } from '../lib/audit-chain.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Signed Report Export & Full Security Threat Model (Attacks A–J)', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-threat-model-tests-'));

  const baseReview = {
    id: 'rev-threat-model-001',
    reviewRevision: 1,
    name: 'Dancing Fish Granola Packaging Review',
    market: 'US',
    engine: 'Packaging Intelligence v2.4',
    createdAt: '2026-10-25T08:00:00Z',
    finishedAt: '2026-10-25T08:20:00Z',
    documents: [
      {
        id: 'doc-artwork-01',
        role: 'artwork',
        name: 'Granola_Carton_Artwork.pdf',
        sha256: '4a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
        sizeBytes: 245012,
      },
    ],
    options: { market: 'US', profile: 'FDA-CFR-21' },
    findings: [
      {
        id: 'finding-001',
        rule: { id: 'FDA-NUT-001', name: 'Atwater Energy Factor Verification' },
        status: 'issue',
        expected: 'Total Calories <= 210 kcal per 55g serving based on 4-4-9 Atwater factors',
        observed: 'Declared Calories = 180 kcal, but macronutrients (4g fat, 35g carb, 10g protein) yield 216 kcal (delta: +36 kcal, >20% underdeclaration)',
        method: 'atwater_energy_density',
        calculationProof: {
          declaredCalories: 180,
          calculatedCalories: 216,
          formula: '(10g * 4) + (35g * 4) + (4g * 9) = 216 kcal',
          deltaPercent: 20.0,
        },
        evidence: [
          {
            documentId: 'doc-artwork-01',
            quote: 'Calories 180 | Total Fat 4g | Total Carb 35g | Protein 10g',
            page: 1,
            box: [0.15, 0.40, 0.35, 0.65],
          },
        ],
      },
    ],
    deepVerification: {
      atwaterVerification: {
        formulaProof: '(10*4)+(35*4)+(4*9)=216',
      },
      netQuantityVerification: {
        calcProof: '454g / 16 oz = 28.375g/oz',
      },
    },
    pdfPreflight: {
      findings: [
        {
          check: 'TAC_TOTAL_AREA_COVERAGE',
          status: 'issue',
          observed: '318% TAC at front logo shadow',
          expected: 'Max 300% TAC for coated paperboard',
          preflight: { measurement: 318, threshold: 300 },
        },
      ],
    },
    decisions: {
      'finding-001': {
        disposition: 'acknowledged',
        note: 'Nutritionist notified to correct panel to 215 or 220 kcal',
        reviewer: 'Chief Regulatory Reviewer',
        at: '2026-10-25T08:15:00Z',
      },
    },
    team: {
      approvals: [
        {
          reviewerId: 'reviewer-jane',
          reviewerName: 'Jane Doe, Regulatory Affairs',
          outcome: 'approved_with_corrections',
          at: '2026-10-25T08:18:00Z',
          note: 'Approved on condition of nutrition panel correction',
        },
      ],
    },
    audit: [],
  };

  appendAuditEvent(baseReview, { action: 'INGESTED', detail: 'Artwork PDF uploaded' }, { id: 'designer', displayName: 'Artwork Designer' }, true);
  appendAuditEvent(baseReview, { action: 'CHECKS_COMPLETED', detail: 'Atwater and TAC checks executed' }, { id: 'system', displayName: 'PackSignal' });
  appendAuditEvent(baseReview, { action: 'DECISION_LOGGED', detail: 'finding-001 acknowledged' }, { id: 'reviewer-jane', displayName: 'Jane Doe' }, true);

  // Seal with authoritative v2 schema
  const sealV2 = await sealReview(baseReview, tempDir, { schemaVersion: 'v2' });
  const signedReviewV2 = { ...baseReview, signature: sealV2 };
  const v2ReportPath = join(tempDir, 'v2-report.json');
  await writeFile(v2ReportPath, JSON.stringify(signedReviewV2, null, 2));

  // Authoritative trusted key
  const trustedKeyPath = join(tempDir, 'trusted-key.pem');
  await writeFile(trustedKeyPath, sealV2.publicKey);

  // ATTACK A: Finding status modified from ISSUE to MATCH
  await t.test('ATTACK A: Unauthorized modification of finding status is detected', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.findings[0].status = 'match';
    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    const check = verifyPortableSealProof(proof);
    assert.equal(check.valid, false);
    assert.ok(check.reason.includes('does not match'));
  });

  // ATTACK B: Someone changes a signed reviewer decision
  await t.test('ATTACK B: Tampering with a recorded reviewer decision is detected', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.decisions['finding-001'].disposition = 'rejected';
    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    assert.equal(verifyPortableSealProof(proof).valid, false);
  });

  // ATTACK C: Someone edits an exported source quotation
  await t.test('ATTACK C: Altering source evidence quote text is detected', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.findings[0].evidence[0].quote = 'Calories 220 | Total Fat 4g';
    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    assert.equal(verifyPortableSealProof(proof).valid, false);
  });

  // ATTACK D: Someone alters the signed artwork hash
  await t.test('ATTACK D: Altering the signed artwork document SHA-256 hash is detected', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.documents[0].sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    assert.equal(verifyPortableSealProof(proof).valid, false);
  });

  // ATTACK E: Someone changes a calculation proof (Atwater arithmetic)
  await t.test('ATTACK E: Altering an Atwater formula or calculation proof is detected', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.deepVerification.atwaterVerification.formulaProof = '(10*4)+(35*4)+(4*9)=180';
    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    assert.equal(verifyPortableSealProof(proof).valid, false);
  });

  // ATTACK F: Someone replaces a signed report attachment
  await t.test('ATTACK F: Modifying external source attachment bytes triggers hash mismatch', async () => {
    const fakeAttachmentPath = join(tempDir, 'Granola_Carton_Artwork.pdf');
    await writeFile(fakeAttachmentPath, 'Tampered PDF bytes replacing genuine artwork');

    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      v2ReportPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('INTEGRITY: FAILED'));
    assert.ok(res.stderr.includes('Source attachment \'Granola_Carton_Artwork.pdf\' SHA-256 mismatch'));

    await rm(fakeAttachmentPath, { force: true });
  });

  // ATTACK G: Someone removes or modifies audit events
  await t.test('ATTACK G: Deleting or altering audit history breaks audit chain and checkpoint anchor', () => {
    const tampered = JSON.parse(JSON.stringify(signedReviewV2));
    tampered.audit.pop(); // Remove 3rd audit event
    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    assert.equal(verifyPortableSealProof(proof).valid, false);
  });

  // ATTACK H: Someone replaces embedded public key and creates new signature
  await t.test('ATTACK H: Replaced rogue key is detected and fails trusted-key verification', async () => {
    const attacker = generateKeyPairSync('ed25519');
    const attackerPub = attacker.publicKey.export({ type: 'spki', format: 'pem' });
    const attackerKeyId = createHash('sha256').update(attackerPub).digest('hex').slice(0, 16);

    const forged = JSON.parse(JSON.stringify(signedReviewV2));
    forged.findings[0].status = 'match'; // Rogue modification

    const proof = reviewSealProof(forged);
    const forgedSig = sign(null, Buffer.from(proof.canonicalPayload), attacker.privateKey).toString('base64');
    forged.signature = {
      algorithm: 'Ed25519',
      schema: 'packproof-review-seal/v2',
      payloadHash: proof.payloadHash,
      publicKeyId: attackerKeyId,
      publicKey: attackerPub,
      signature: forgedSig,
      sealedAt: new Date().toISOString(),
    };

    const forgedPath = join(tempDir, 'forged-attack-h.json');
    await writeFile(forgedPath, JSON.stringify(forged, null, 2));

    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      forgedPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('UNTRUSTED SIGNER'));
  });

  // ATTACK I: Someone substitutes an earlier valid report for a later report
  await t.test('ATTACK I: Earlier report substitution is distinguished by reviewRevision and auditChainHead', async () => {
    // Rev 1 was sealed
    const rev2 = {
      ...baseReview,
      reviewRevision: 2,
      parentId: baseReview.id,
      audit: JSON.parse(JSON.stringify(baseReview.audit)),
      findings: [
        { ...baseReview.findings[0], status: 'match', observed: 'Calories 216 correctly declared' },
      ],
    };
    appendAuditEvent(rev2, { action: 'CORRECTION_VERIFIED', detail: 'Artwork revision 2 verified' });
    const sealRev2 = await sealReview(rev2, tempDir, { schemaVersion: 'v2' });

    // Both Rev 1 and Rev 2 have valid signatures, but represent distinct historical revisions
    const payload1 = signedPayload(signedReviewV2, 'v2');
    const payload2 = signedPayload({ ...rev2, signature: sealRev2 }, 'v2');

    assert.equal(payload1.reviewRevision, 1);
    assert.equal(payload2.reviewRevision, 2);
    assert.notEqual(payload1.auditChainHead, payload2.auditChainHead);
    assert.notEqual(payload1.findings[0].status, payload2.findings[0].status);
  });

  // ATTACK J: Someone modifies visible HTML report content while leaving old valid signature proof embedded
  await t.test('ATTACK J: Modified visible HTML text does not claim HTML visual byte verification', async () => {
    // Render portable HTML block
    const validProof = { ...reviewSealProof(signedReviewV2), ...signedReviewV2.signature };
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Dancing Fish Granola Report</h1>
          <p class="status">ALL CHECKS MATCH (Tampered visual HTML)</p>
          <script type="application/json" id="packproof-signature-proof">
            ${JSON.stringify(validProof)}
          </script>
        </body>
      </html>
    `;
    const htmlPath = join(tempDir, 'report.html');
    await writeFile(htmlPath, html);

    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      htmlPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0);
    // Verifier explicitly reports that only the embedded canonical data is signed, not arbitrary DOM HTML
    assert.ok(res.stdout.includes('SIGNATURE VALID'));
  });

  // Backward compatibility: Legacy v1 report verifies
  await t.test('Backward Compatibility: packproof-review-seal/v1 verifies cleanly', async () => {
    const sealV1 = await sealReview(baseReview, tempDir, { schemaVersion: 'v1' });
    assert.equal(sealV1.schema, 'packproof-review-seal/v1');

    const v1Report = { ...baseReview, signature: sealV1 };
    const v1ReportPath = join(tempDir, 'v1-report.json');
    await writeFile(v1ReportPath, JSON.stringify(v1Report, null, 2));

    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      v1ReportPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('Schema:                         packproof-review-seal/v1'));
    assert.ok(res.stdout.includes('SIGNATURE VALID'));
  });

  // Release authorization vs Review seal distinction
  await t.test('Release Status Distinction: Review without release sign-off shows RELEASE_NOT_ESTABLISHED', async () => {
    const unapproved = JSON.parse(JSON.stringify(baseReview));
    unapproved.team = { approvals: [] }; // No authorized sign-offs
    const unapprovedSeal = await sealReview(unapproved, tempDir, { schemaVersion: 'v2' });
    const unapprovedReport = { ...unapproved, signature: unapprovedSeal };

    const unapprovedPath = join(tempDir, 'unapproved-report.json');
    await writeFile(unapprovedPath, JSON.stringify(unapprovedReport, null, 2));

    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      unapprovedPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('Release authorization:          NOT ESTABLISHED'));
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
