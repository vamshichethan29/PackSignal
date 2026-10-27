/**
 * tests/key-trust.test.mjs
 * Key management, external trust verification, key rotation,
 * and private key server-side isolation tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sealReview, rotateSigningKeys } from '../lib/audit-signature.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Key Management, Signer Trust Verification & Key Lifecycle Suite', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-key-trust-tests-'));

  const sampleReview = {
    id: 'rev-trust-001',
    createdAt: '2026-10-26T12:00:00Z',
    finishedAt: '2026-10-26T12:20:00Z',
    name: 'Carton Packaging Signer Trust Check',
    documents: [{ id: 'doc-1', role: 'artwork', name: 'art.pdf', sha256: 'deadbeef12345678' }],
    findings: [{ id: 'f-1', status: 'match', expected: '100g', observed: '100g' }],
    decisions: {},
    audit: [],
  };

  const seal = await sealReview(sampleReview, tempDir);
  const signedReview = { ...sampleReview, signature: seal };

  const reportPath = join(tempDir, 'report.json');
  await writeFile(reportPath, JSON.stringify(signedReview, null, 2));

  const trustedKeyPath = join(tempDir, 'trusted-key.pem');
  await writeFile(trustedKeyPath, seal.publicKey);

  const roguePair = generateKeyPairSync('ed25519');
  const rogueKeyPath = join(tempDir, 'rogue-key.pem');
  await writeFile(rogueKeyPath, roguePair.publicKey.export({ type: 'spki', format: 'pem' }));

  await t.test('1. Trusted key verification: matching trusted public key confirms TRUSTED signer', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-public-key',
      trustedKeyPath,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('Signer trust:                   TRUSTED') || res.stdout.includes('TRUSTED SIGNER'));
  });

  await t.test('2. Untrusted key verification: non-matching trusted key rejects signer as UNTRUSTED', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-public-key',
      rogueKeyPath,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 1);
    assert.ok(res.stdout.includes('UNTRUSTED SIGNER'));
  });

  await t.test('3. Forged embedded key: self-signed key inside report is UNVERIFIED without external trust', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
    ], { encoding: 'utf8' });
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('Signer trust:                   UNVERIFIED'));
    assert.ok(res.stdout.includes('NOT INDEPENDENTLY VERIFIED'));
  });

  await t.test('4. Missing trusted key file: returns explicit exit code 3', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
      '--trusted-public-key',
      join(tempDir, 'non-existent-key.pem'),
    ], { encoding: 'utf8' });
    assert.equal(res.status, 3);
    assert.ok(res.stderr.includes('Specified trusted key file not found'));
  });

  await t.test('5. Key rotation: archives old keypair and generates fresh active keypair', async () => {
    const initialKey = seal.publicKey;
    const rotated = await rotateSigningKeys(tempDir);
    assert.notEqual(rotated.publicKey, initialKey, 'Rotated key must be distinct from prior key');

    const keyDir = join(tempDir, 'keys');
    const privPath = join(keyDir, 'review-seal-private.pem');
    const pubPath = join(keyDir, 'review-seal-public.pem');
    assert.ok(existsSync(privPath), 'Active private key file exists');
    assert.ok(existsSync(pubPath), 'Active public key file exists');
    assert.ok(existsSync(join(keyDir, 'archived')), 'Archived keys directory exists');
  });

  await t.test('6. Server-side key isolation: private keys never placed in public/ directory', async () => {
    const publicDir = join(root, 'public');
    const res = spawnSync('find', [publicDir, '-name', '*private*.pem'], { encoding: 'utf8' });
    assert.equal(res.stdout.trim(), '', 'No private key files must exist in public/ directory');
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
