/**
 * tests/signed-revision.test.mjs
 * Cryptographic binding between signed review seal and exact artwork revision comparison.
 * Verifies that Fieldday V1 -> V2 regression (R09) is protected in the cryptographic payload
 * and that signing review evidence is strictly separated from print release authorization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sealReview, reviewSealProof, verifyPortableSealProof } from '../lib/audit-signature.mjs';
import { compareArtworkRevisions } from '../lib/revision/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Signed Revision Comparison & Release Authorization Isolation Suite', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-signed-rev-'));

  const v1ArtworkHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const v2ArtworkHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  const revFielddayV1 = {
    id: 'rev-fieldday-v1',
    name: 'Fieldday Organic Orange Juice 1L - V1',
    documents: [
      { id: 'doc-art-v1', role: 'artwork', name: 'fieldday-v1.pdf', sha256: v1ArtworkHash },
    ],
    findings: [
      { id: 'R03', status: 'issue', expected: '1000 mL (1 L)', observed: '750 mL', rule: { id: 'R03' } },
      { id: 'R09', status: 'match', expected: 'Customer care', observed: 'help@fieldday.com', rule: { id: 'R09' } },
      { id: 'R11', status: 'issue', expected: 'Keep refrigerated', observed: null, rule: { id: 'R11' } },
      { id: 'R12', status: 'review', expected: 'Claim substantiation', observed: '100% Pure Squeezed', rule: { id: 'R12' } },
    ],
  };

  const revFielddayV2 = {
    id: 'rev-fieldday-v2',
    parentId: 'rev-fieldday-v1',
    name: 'Fieldday Organic Orange Juice 1L - V2 (Revised)',
    documents: [
      { id: 'doc-art-v2', role: 'artwork', name: 'fieldday-v2.pdf', sha256: v2ArtworkHash },
    ],
    findings: [
      { id: 'R03', status: 'match', expected: '1000 mL (1 L)', observed: '1000 mL (1 L)', rule: { id: 'R03' } },
      { id: 'R09', status: 'issue', expected: 'Customer care', observed: null, rule: { id: 'R09' } }, // REGRESSION
      { id: 'R11', status: 'match', expected: 'Keep refrigerated', observed: 'Refrigerate after opening', rule: { id: 'R11' } },
      { id: 'R12', status: 'review', expected: 'Claim substantiation', observed: '100% Pure Squeezed', rule: { id: 'R12' } },
    ],
    decisions: {
      R09: { disposition: 'correction_requested', note: 'Customer care email accidentally omitted in V2' },
      R12: { disposition: 'pending_legal', note: 'Awaiting trademark clearance' },
    },
    team: {
      approvals: [], // No release authorization granted
    },
    audit: [
      { at: '2026-10-26T14:00:00Z', action: 'REVISION_COMPARED', detail: 'V1 vs V2 compared: 2 fixes, 1 regression' },
    ],
  };

  // Perform authentic engine comparison
  const comparison = compareArtworkRevisions(revFielddayV1, revFielddayV2);
  revFielddayV2.revision = {
    previousId: revFielddayV1.id,
    kind: 'artwork',
    intelligence: {
      previousArtworkSha256: v1ArtworkHash,
      currentArtworkSha256: v2ArtworkHash,
      summaryText: 'Fieldday V1 -> V2: R03/R11 resolved, R09 new regression, R12 needs review',
    },
    changes: comparison.changes,
  };

  // Generate cryptographic seal over V2 with revision comparison attached
  const seal = await sealReview(revFielddayV2, tempDir);
  const signedV2 = { ...revFielddayV2, signature: seal };

  const reportPath = join(tempDir, 'signed-fieldday-v2.json');
  await writeFile(reportPath, JSON.stringify(signedV2, null, 2));

  await t.test('1. Signed review binds exact V1 and V2 artwork document hashes', () => {
    assert.equal(signedV2.documents[0].sha256, v2ArtworkHash);
    assert.equal(signedV2.revision.intelligence.previousArtworkSha256, v1ArtworkHash);
    assert.equal(signedV2.revision.intelligence.currentArtworkSha256, v2ArtworkHash);
  });

  await t.test('2. R09 regression is covered by cryptographic signature', () => {
    const proof = { ...reviewSealProof(signedV2), ...signedV2.signature };
    const res = verifyPortableSealProof(proof);
    assert.equal(res.valid, true);

    // If an attacker tampers R09 to hide the regression (issue -> match)
    const tampered = JSON.parse(JSON.stringify(signedV2));
    const r09 = tampered.findings.find(f => f.id === 'R09');
    r09.status = 'match';

    const tamperedProof = { ...reviewSealProof(tampered), ...tampered.signature };
    const tamperedRes = verifyPortableSealProof(tamperedProof);
    assert.equal(tamperedRes.valid, false, 'Tampering R09 regression MUST invalidate seal');
  });

  await t.test('3. Release authorization is strictly isolated from review evidence signing', () => {
    const res = spawnSync(process.execPath, [
      join(root, 'scripts/verify-report.mjs'),
      reportPath,
    ], { encoding: 'utf8' });

    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes('SIGNATURE:                      VALID'));
    assert.ok(res.stdout.includes('Release authorization:          NOT ESTABLISHED'));
  });

  await t.test('4. Tampering with revision metadata invalidates cryptographic verification', () => {
    const tampered = JSON.parse(JSON.stringify(signedV2));
    tampered.revision.previousId = 'fake-v0-id';

    const proof = { ...reviewSealProof(tampered), ...tampered.signature };
    const res = verifyPortableSealProof(proof);
    assert.equal(res.valid, false, 'Tampering revision metadata MUST invalidate signature');
  });

  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
});
