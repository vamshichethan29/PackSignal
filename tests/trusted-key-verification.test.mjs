import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  sealReview,
  reviewSealProof,
  verifyPortableSealProof,
  verifyReviewSeal,
  rotateSigningKeys,
  resetKeyCache,
} from '../lib/audit-signature.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Trusted Public Key Verification & Key Lifecycle Management', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-trusted-key-tests-'));

  const review = {
    id: 'rev-trust-001',
    createdAt: '2026-10-25T14:00:00Z',
    finishedAt: '2026-10-25T14:10:00Z',
    name: 'Artisan Chai Tea Carton US Review',
    documents: [
      { id: 'doc-tea-art', role: 'artwork', name: 'Chai_Carton.pdf', sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0' },
    ],
    options: { market: 'US' },
    findings: [
      {
        id: 'find-tea-1',
        status: 'issue',
        expected: 'Net quantity 250g',
        observed: 'Net quantity 200g',
        evidence: [{ documentId: 'doc-tea-art', quote: '200g' }],
      },
    ],
    decisions: { 'find-tea-1': { disposition: 'acknowledged', reviewer: 'Lead Regulatory QA' } },
    audit: [
      { at: '2026-10-25T14:00:00Z', action: 'REVIEW_STARTED', detail: 'Ingested Chai Tea carton artwork' },
      { at: '2026-10-25T14:10:00Z', action: 'FINDING_ACKNOWLEDGED', detail: 'Net quantity discrepancy flagged' },
    ],
  };

  // 1. Seal review using authoritative key
  const seal = await sealReview(review, tempDir);
  const signedReport = { ...review, signature: seal };

  const reportPath = join(tempDir, 'signed-report.json');
  await writeFile(reportPath, JSON.stringify(signedReport, null, 2));

  const trustedKeyPath = join(tempDir, 'packaging-review-public.pem');
  await writeFile(trustedKeyPath, seal.publicKey);

  // Generate an attacker's rogue key pair
  const attackerPair = generateKeyPairSync('ed25519');
  const attackerPubPem = attackerPair.publicKey.export({ type: 'spki', format: 'pem' });
  const attackerRoguePath = join(tempDir, 'attacker-public.pem');
  await writeFile(attackerRoguePath, attackerPubPem);

  await t.test('1. Valid Ed25519 signature verifies against independent trusted key file', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('SIGNATURE VALID'));
    assert.ok(res.stdout.includes('SIGNER IDENTITY: VERIFIED (TRUSTED SIGNER)'));
    assert.ok(res.stdout.includes('Signer trust:                   TRUSTED'));
  });

  await t.test('2. Independent trusted fingerprint verification succeeds for matching key', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-fingerprint',
      seal.publicKeyId,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('SIGNATURE VALID'));
    assert.ok(res.stdout.includes('SIGNER IDENTITY: VERIFIED (TRUSTED SIGNER)'));
  });

  await t.test('3. Re-signed malicious replacement (Attack H): verifies mathematically but fails trusted signer check', async () => {
    // Attacker modifies finding from issue to match and re-signs with their own Ed25519 key
    const tamperedReview = JSON.parse(JSON.stringify(signedReport));
    tamperedReview.findings[0].status = 'match';
    delete tamperedReview.signature;

    // Attacker generates seal with rogue key
    const rogueProof = reviewSealProof(tamperedReview);
    const rogueKeyId = createHash('sha256').update(attackerPubPem).digest('hex').slice(0, 16);
    const rogueSig = sign(null, Buffer.from(rogueProof.canonicalPayload), attackerPair.privateKey).toString('base64');

    tamperedReview.signature = {
      algorithm: 'Ed25519',
      schema: 'packproof-review-seal/v2',
      payloadHash: rogueProof.payloadHash,
      publicKeyId: rogueKeyId,
      publicKey: attackerPubPem,
      signature: rogueSig,
      sealedAt: new Date().toISOString(),
    };

    const forgedReportPath = join(tempDir, 'forged-report.json');
    await writeFile(forgedReportPath, JSON.stringify(tamperedReview, null, 2));

    // When verified without trusted key, it is self-signed but unverified
    const selfVerify = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      forgedReportPath,
    ], { encoding: 'utf8' });
    assert.equal(selfVerify.status, 0);
    assert.ok(selfVerify.stdout.includes('SIGNER IDENTITY: NOT INDEPENDENTLY VERIFIED'));
    assert.ok(selfVerify.stdout.includes('Signer trust:                   UNVERIFIED'));

    // When verified with the organization's independent trusted key, it FAILS (exit 1)
    const trustVerify = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      forgedReportPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });

    assert.equal(trustVerify.status, 1);
    assert.ok(trustVerify.stdout.includes('UNTRUSTED SIGNER'));
    assert.ok(trustVerify.stderr.includes('does not match trusted key fingerprint'));
  });

  await t.test('4. Missing trusted key file exits with predictable code 3', () => {
    const nonExistentKey = join(tempDir, 'does-not-exist.pem');
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-public-key',
      nonExistentKey,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 3);
    assert.ok(res.stderr.includes('Specified trusted key file not found'));
  });

  await t.test('5. Private key is never exported in reports or seal proof', () => {
    const exportedRaw = JSON.stringify(signedReport);
    assert.equal(exportedRaw.includes('PRIVATE KEY'), false);
    assert.equal(seal.privateKey, undefined);
    assert.ok(seal.publicKey);
  });

  await t.test('6. Missing private-key file while public key exists fails safely without overwriting', async () => {
    const keyDir = join(tempDir, 'keys');
    const privPath = join(keyDir, 'review-seal-private.pem');
    const pubPath = join(keyDir, 'review-seal-public.pem');

    // Invalidate in-memory key cache
    resetKeyCache(tempDir);

    // Backup private key
    const privBackup = await readFile(privPath, 'utf8');
    await unlink(privPath);

    // Attempting to seal when private key is missing but public key exists must reject
    await assert.rejects(
      async () => {
        await sealReview(review, tempDir);
      },
      /Refusing to silently overwrite/
    );

    // Restore private key
    await writeFile(privPath, privBackup, { mode: 0o600 });
    resetKeyCache(tempDir);
  });

  await t.test('7. Missing public-key file is safely reconstructed from private key', async () => {
    const keyDir = join(tempDir, 'keys');
    const pubPath = join(keyDir, 'review-seal-public.pem');

    resetKeyCache(tempDir);
    await unlink(pubPath);
    // sealReview should safely reconstruct public key from private key
    const newSeal = await sealReview(review, tempDir);
    assert.ok(newSeal.publicKey.includes('PUBLIC KEY'));
  });

  await t.test('8. Key rotation archives old key, provisions new key, and retains historical report verification', async () => {
    const rotated = await rotateSigningKeys(tempDir);
    assert.ok(rotated.publicKey);
    assert.ok(rotated.rotatedAt);

    // New review sealed with rotated key
    const newReview = { ...review, id: 'rev-trust-002', name: 'Revision 2 after key rotation' };
    const newSeal = await sealReview(newReview, tempDir);
    assert.notEqual(newSeal.publicKeyId, seal.publicKeyId);

    // Historical report still verifies with its original public key / trusted key
    const resHistorical = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });
    assert.equal(resHistorical.status, 0);
    assert.ok(resHistorical.stdout.includes('SIGNATURE VALID'));
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
