import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sealReview, reviewSealProof, verifyPortableSealProof } from '../lib/audit-signature.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Report Cryptographic Verification & Tamper Detection Suite', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-verify-tests-'));

  // Create baseline mock review
  const baseReview = {
    id: 'rev-proof-001',
    createdAt: '2026-10-25T12:00:00Z',
    finishedAt: '2026-10-25T12:15:00Z',
    name: 'Dancing Fish Granola US Artwork',
    documents: [
      { id: 'doc-art-1', role: 'artwork', name: 'Granola_Art.pdf', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    ],
    options: { market: 'US', profile: 'ISO-OFFSET-COATED-300' },
    findings: [
      {
        id: 'find-1',
        status: 'issue',
        expected: 'Net quantity 454g',
        observed: 'Net quantity 400g',
        evidence: [{ documentId: 'doc-art-1', quote: '400g', page: 1, box: [0.1, 0.8, 0.3, 0.85] }],
      },
    ],
    decisions: { 'find-1': { disposition: 'acknowledged', reviewer: 'Senior QA' } },
    followUps: [],
    revision: null,
    audit: [
      { at: '2026-10-25T12:00:00Z', action: 'REVIEW_STARTED', detail: 'Ingested artwork' },
      { at: '2026-10-25T12:15:00Z', action: 'FINDING_ACKNOWLEDGED', detail: 'find-1 accepted' },
    ],
  };

  // Seal review
  const seal = await sealReview(baseReview, tempDir);
  const signedReview = { ...baseReview, signature: seal };

  const validJsonPath = join(tempDir, 'valid-report.json');
  await writeFile(validJsonPath, JSON.stringify(signedReview, null, 2));

  // Extract public key to a PEM file
  const trustedKeyPath = join(tempDir, 'trusted-key.pem');
  await writeFile(trustedKeyPath, seal.publicKey);

  // Generate an untrusted key
  const roguePair = generateKeyPairSync('ed25519');
  const rogueKeyPath = join(tempDir, 'rogue-key.pem');
  await writeFile(rogueKeyPath, roguePair.publicKey.export({ type: 'spki', format: 'pem' }));

  await t.test('1. Original valid report verifies successfully via CLI', () => {
    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), validJsonPath], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('SIGNATURE VALID'));
    assert.ok(res.stdout.includes('Key ID: ' + seal.publicKeyId));
  });

  await t.test('2. Finding status modification is detected and fails verification', async () => {
    const tampered = JSON.parse(JSON.stringify(signedReview));
    tampered.findings[0].status = 'match'; // Tampered from 'issue' to 'match'

    const tamperedPath = join(tempDir, 'tampered-finding.json');
    await writeFile(tamperedPath, JSON.stringify(tampered, null, 2));

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), tamperedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('SIGNATURE INVALID') || res.stderr.includes('does not match'));
  });

  await t.test('3. Source document hash modification is detected and fails verification', async () => {
    const tampered = JSON.parse(JSON.stringify(signedReview));
    tampered.documents[0].sha256 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    const tamperedPath = join(tempDir, 'tampered-source.json');
    await writeFile(tamperedPath, JSON.stringify(tampered, null, 2));

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), tamperedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('SIGNATURE INVALID') || res.stderr.includes('does not match'));
  });

  await t.test('4. Reviewer decision modification is detected and fails verification', async () => {
    const tampered = JSON.parse(JSON.stringify(signedReview));
    tampered.decisions['find-1'].disposition = 'rejected';

    const tamperedPath = join(tempDir, 'tampered-decision.json');
    await writeFile(tamperedPath, JSON.stringify(tampered, null, 2));

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), tamperedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('SIGNATURE INVALID'));
  });

  await t.test('5. Audit digest modification is detected and fails verification', async () => {
    const tampered = JSON.parse(JSON.stringify(signedReview));
    tampered.audit.push({ at: '2026-10-25T12:20:00Z', action: 'DELETED_EVENT', detail: 'Fake event' });

    const tamperedPath = join(tempDir, 'tampered-audit.json');
    await writeFile(tamperedPath, JSON.stringify(tampered, null, 2));

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), tamperedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('SIGNATURE INVALID'));
  });

  await t.test('6. Signature modification / corruption is detected', async () => {
    const tampered = JSON.parse(JSON.stringify(signedReview));
    tampered.signature.signature = 'AAAAAAAAAAAAAAAA' + tampered.signature.signature.slice(16);

    const tamperedPath = join(tempDir, 'corrupted-sig.json');
    await writeFile(tamperedPath, JSON.stringify(tampered, null, 2));

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), tamperedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('SIGNATURE INVALID'));
  });

  await t.test('7. Trusted key verification: matching trusted key verifies signer identity', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      validJsonPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('SIGNER IDENTITY: VERIFIED (TRUSTED SIGNER)'));
  });

  await t.test('8. Trusted key verification: wrong trusted public key rejects signer as UNTRUSTED', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      validJsonPath,
      '--trusted-public-key',
      rogueKeyPath,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('UNTRUSTED SIGNER'));
  });

  await t.test('9. Trusted fingerprint verification: matching fingerprint succeeds', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      validJsonPath,
      '--trusted-fingerprint',
      seal.publicKeyId,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('SIGNER IDENTITY: VERIFIED (TRUSTED SIGNER)'));
  });

  await t.test('10. Missing signature is detected with explicit exit code', async () => {
    const unsigned = JSON.parse(JSON.stringify(baseReview));
    delete unsigned.signature;
    const unsignedPath = join(tempDir, 'unsigned.json');
    await writeFile(unsignedPath, JSON.stringify(unsigned, null, 2));

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), unsignedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('MISSING SIGNATURE'));
  });

  await t.test('11. Malformed JSON file is rejected cleanly', async () => {
    const malformedPath = join(tempDir, 'broken.json');
    await writeFile(malformedPath, '{ not valid json');

    const res = spawnSync(process.execPath, [join(root, 'scripts/verify-report.mjs'), malformedPath], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('UNSUPPORTED FORMAT'));
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
