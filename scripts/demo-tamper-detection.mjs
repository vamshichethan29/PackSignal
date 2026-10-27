#!/usr/bin/env node
/**
 * scripts/demo-tamper-detection.mjs
 * Deterministic Tamper Evidence Demonstration (TEST A through TEST I)
 * Uses temporary copies; never alters actual review history or original artwork.
 */

import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sealReview, reviewSealProof } from '../lib/audit-signature.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const verifyScript = join(root, 'scripts/verify-report.mjs');

async function main() {
  console.log('============================================================');
  console.log('PACKSIGNAL CRYPTOGRAPHIC TAMPER DETECTION DEMO');
  console.log('============================================================');

  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-tamper-demo-'));

  try {
    // 1. Create genuine baseline review
    const originalReview = {
      id: 'rev-fieldday-v2-demo',
      reviewRevision: 2,
      name: 'Fieldday Organic Orange Juice 1L - V2 (Revised)',
      createdAt: '2026-10-26T14:00:00Z',
      finishedAt: '2026-10-26T14:20:00Z',
      documents: [
        { id: 'doc-art-v2', role: 'artwork', name: 'fieldday-v2.pdf', sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' },
      ],
      options: { market: 'US-FDA' },
      findings: [
        {
          id: 'R03',
          title: 'Net quantity declaration',
          status: 'match',
          expected: '1000 mL (1 L)',
          observed: '1000 mL (1 L)',
          evidence: [{ documentId: 'doc-art-v2', quote: '1000 mL (1 L)', page: 1 }],
        },
        {
          id: 'R09',
          title: 'Customer-care contact email/phone',
          status: 'issue', // Regression
          expected: 'Customer contact details',
          observed: null,
          evidence: [],
        },
      ],
      decisions: {
        R09: { disposition: 'correction_requested', note: 'Customer email omitted in V2 layout' },
      },
      audit: [],
    };

    const { appendAuditEvent } = await import('../lib/audit-chain.mjs');
    appendAuditEvent(originalReview, { action: 'INGESTED', detail: 'Artwork loaded' }, { id: 'sys', displayName: 'System' });
    appendAuditEvent(originalReview, { action: 'REGRESSION_FLAGGED', detail: 'R09 contact missing' }, { id: 'qa', displayName: 'QA' }, true);
    appendAuditEvent(originalReview, { action: 'REVIEW_SEALED', detail: 'Sealed' }, { id: 'qa', displayName: 'QA' }, true);

    // Calculate actual sha256 for genuine attachment in sources/
    const sourcesDir = join(tempDir, 'sources');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(sourcesDir, { recursive: true });
    const docPath = join(sourcesDir, 'fieldday-v2.pdf');
    await writeFile(docPath, 'Real genuine artwork content for attachment verification');
    const genuineDocHash = createHash('sha256').update(await readFile(docPath)).digest('hex');
    originalReview.documents[0].sha256 = genuineDocHash;

    // Seal original
    const seal = await sealReview(originalReview, tempDir);
    const signedOriginal = { ...originalReview, signature: seal };

    const genuineJsonPath = join(tempDir, 'genuine-report.json');
    await writeFile(genuineJsonPath, JSON.stringify(signedOriginal, null, 2));

    const trustedKeyPath = join(tempDir, 'trusted-key.pem');
    await writeFile(trustedKeyPath, seal.publicKey);

    // Generate HTML report
    const htmlContent = await createHtmlReport(signedOriginal, tempDir);
    const genuineHtmlPath = join(tempDir, 'genuine-report.html');
    await writeFile(genuineHtmlPath, htmlContent);

    // TEST A: Verify genuine signed review with trusted key
    console.log('\n[TEST A] Verify genuine signed review with trusted public key:');
    let res = spawnSync(process.execPath, [verifyScript, genuineJsonPath, '--trusted-public-key', trustedKeyPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status}`);
    console.log('STDOUT:\n' + res.stdout);
    console.log('STDERR:\n' + res.stderr);
    if (res.status !== 0) throw new Error('TEST A failed');

    // TEST B: Copy report & modify finding status (R09 regression: issue -> match)
    console.log('\n[TEST B] Alter protected finding (R09: issue -> match):');
    const tamperedB = JSON.parse(JSON.stringify(signedOriginal));
    tamperedB.findings[1].status = 'match';
    const tamperedBPath = join(tempDir, 'tampered-b.json');
    await writeFile(tamperedBPath, JSON.stringify(tamperedB, null, 2));
    res = spawnSync(process.execPath, [verifyScript, tamperedBPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST B did not detect tampering!');

    // TEST C: Alter source document hash
    console.log('\n[TEST C] Alter document SHA-256 hash:');
    const tamperedC = JSON.parse(JSON.stringify(signedOriginal));
    tamperedC.documents[0].sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
    const tamperedCPath = join(tempDir, 'tampered-c.json');
    await writeFile(tamperedCPath, JSON.stringify(tamperedC, null, 2));
    res = spawnSync(process.execPath, [verifyScript, tamperedCPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST C did not detect tampering!');

    // TEST D: Alter reviewer decision
    console.log('\n[TEST D] Alter reviewer decision (correction_requested -> approved):');
    const tamperedD = JSON.parse(JSON.stringify(signedOriginal));
    tamperedD.decisions.R09.disposition = 'approved';
    const tamperedDPath = join(tempDir, 'tampered-d.json');
    await writeFile(tamperedDPath, JSON.stringify(tamperedD, null, 2));
    res = spawnSync(process.execPath, [verifyScript, tamperedDPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST D did not detect tampering!');

    // TEST E: Alter audit event history
    console.log('\n[TEST E] Delete or reorder audit trail event:');
    const tamperedE = JSON.parse(JSON.stringify(signedOriginal));
    tamperedE.audit.pop(); // Delete last event
    const tamperedEPath = join(tempDir, 'tampered-e.json');
    await writeFile(tamperedEPath, JSON.stringify(tamperedE, null, 2));
    res = spawnSync(process.execPath, [verifyScript, tamperedEPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST E did not detect tampering!');

    // TEST F: Replace public key with rogue unauthorized key
    console.log('\n[TEST F] Verify with unauthorized/rogue public key:');
    const roguePair = generateKeyPairSync('ed25519');
    const rogueKeyPath = join(tempDir, 'rogue-key.pem');
    await writeFile(rogueKeyPath, roguePair.publicKey.export({ type: 'spki', format: 'pem' }));
    res = spawnSync(process.execPath, [verifyScript, genuineJsonPath, '--trusted-public-key', rogueKeyPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout.split('\n').find(l => l.includes('UNTRUSTED SIGNER')) || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST F did not reject untrusted signer!');

    // TEST G: Alter visible HTML report wording/status only
    console.log('\n[TEST G] Alter visible HTML report status only (<span class="status issue"> -> <span class="status match">):');
    const tamperedHtml = htmlContent.replace('<span class="status issue">issue</span>', '<span class="status match">match</span>');
    const tamperedHtmlPath = join(tempDir, 'tampered-report.html');
    await writeFile(tamperedHtmlPath, tamperedHtml);
    res = spawnSync(process.execPath, [verifyScript, tamperedHtmlPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST G did not detect visible HTML tampering!');

    // TEST H: Modify protected attachment file
    console.log('\n[TEST H] Modify attached source document:');
    await writeFile(docPath, 'CORRUPTED / TAMPERED ATTACHMENT CONTENT');
    res = spawnSync(process.execPath, [verifyScript, genuineJsonPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 1)`);
    console.log(res.stdout || res.stderr.trim());
    if (res.status === 0) throw new Error('TEST H did not detect attachment modification!');

    // Restore attachment for TEST I
    await writeFile(docPath, 'Real genuine artwork content for attachment verification');

    // TEST I: Re-verify genuine original report
    console.log('\n[TEST I] Re-verify original unmodified report:');
    res = spawnSync(process.execPath, [verifyScript, genuineJsonPath, '--trusted-public-key', trustedKeyPath], { encoding: 'utf8' });
    console.log(`Exit code: ${res.status} (Expected: 0)`);
    console.log(res.stdout.split('\n').filter(l => l.includes('SIGNATURE') || l.includes('Signer trust')).join('\n'));
    if (res.status !== 0) throw new Error('TEST I failed');

    console.log('\n============================================================');
    console.log('ALL TAMPER DETECTION DEMONSTRATION TESTS (A-I) PASSED CLEANLY');
    console.log('============================================================');
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
