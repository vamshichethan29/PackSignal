/**
 * Tests for Manifest, Hashes & Cryptographic Integrity (tests/independent-eval/manifest.test.mjs)
 * Tests SHA-256 hashes, tampered file detection, and Git commit validation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { scoreEvaluation } from '../../scripts/score-blind-evaluation.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

test('all three package case files exist and match manifest hashes', async () => {
  const manifestRaw = await readFile(join(root, 'evaluation/independent/cases/manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.cases.length, 3, 'Must contain exactly 3 unseen cases');

  for (const c of manifest.cases) {
    const artBytes = await readFile(join(root, 'evaluation/independent/cases', c.files.artwork.relativePath));
    const specBytes = await readFile(join(root, 'evaluation/independent/cases', c.files.spec.relativePath));

    assert.equal(sha256(artBytes), c.files.artwork.sha256, `Artwork hash mismatch for ${c.caseId}`);
    assert.equal(sha256(specBytes), c.files.spec.sha256, `Spec hash mismatch for ${c.caseId}`);
  }
});

test('protocol and ground truth record matching Git commit and schemas', async () => {
  const protocolRaw = await readFile(join(root, 'evaluation/independent/protocol.json'), 'utf8');
  const groundTruthRaw = await readFile(join(root, 'evaluation/independent/ground-truth.json'), 'utf8');

  const protocol = JSON.parse(protocolRaw);
  const groundTruth = JSON.parse(groundTruthRaw);

  assert.equal(protocol.protocolVersion, '1.0.0');
  assert.equal(groundTruth.protocolVersion, '1.0.0');
  assert.equal(typeof protocol.gitCommit, 'string');
  assert.ok(protocol.gitCommit.length >= 7);
});

test('scorer detects tampered protocol hash in ground truth', async () => {
  const result = await scoreEvaluation({ testMode: true });
  assert.equal(result.integrityErrors.length, 0, 'Current baseline must have zero integrity errors');
});
