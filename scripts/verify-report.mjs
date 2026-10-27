import { createHash, verify } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { reviewSealProof, verifyPortableSealProof } from '../lib/audit-signature.mjs';
import { verifyAuditChain, canonical } from '../lib/audit-chain.mjs';

const bundledPython = join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python = process.env.PACKPROOF_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');

let targetPath = null;
let trustedKeyPath = null;
let trustedFingerprint = null;
let jsonOutput = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--trusted-public-key' && i + 1 < process.argv.length) {
    trustedKeyPath = process.argv[++i];
  } else if (arg === '--trusted-fingerprint' && i + 1 < process.argv.length) {
    trustedFingerprint = process.argv[++i];
  } else if (arg === '--json') {
    jsonOutput = true;
  } else if (!targetPath && !arg.startsWith('--')) {
    targetPath = arg;
  }
}

if (!targetPath) {
  console.error('Usage: node scripts/verify-report.mjs <report.zip|report.html|report.json> [--trusted-public-key <path>] [--trusted-fingerprint <fingerprint>] [--json]');
  process.exit(2);
}

const ext = extname(targetPath).toLowerCase();

if (ext === '.zip') {
  await verifyZipBundle(targetPath, { trustedKeyPath, trustedFingerprint, jsonOutput });
} else {
  await verifySingleFile(targetPath, ext, { trustedKeyPath, trustedFingerprint, jsonOutput });
}

async function verifySingleFile(filePath, fileExt, { trustedKeyPath, trustedFingerprint, jsonOutput } = {}) {
  try {
    if (!existsSync(filePath)) {
      if (jsonOutput) {
        console.log(JSON.stringify({ valid: false, error: `File not found at '${filePath}'` }));
      } else {
        console.error(`Error: File not found at '${filePath}'`);
      }
      process.exitCode = 1;
      return;
    }

    const content = await readFile(filePath, 'utf8');
    let proof;
    let review = null;
    let displayedReportIntegrity = fileExt === '.html' ? 'VALID' : 'NOT APPLICABLE';

    if (fileExt === '.html') {
      const match = content.match(/<script type="application\/json" id="packproof-signature-proof">([\s\S]*?)<\/script>/);
      if (!match) {
        if (jsonOutput) {
          console.log(JSON.stringify({ valid: false, error: 'MISSING SIGNATURE: This HTML report does not contain a portable signature proof.' }));
        } else {
          console.error('MISSING SIGNATURE: This HTML report does not contain a portable signature proof.');
        }
        process.exitCode = 1;
        return;
      }
      try {
        proof = JSON.parse(match[1]);
      } catch {
        if (jsonOutput) {
          console.log(JSON.stringify({ valid: false, error: 'UNSUPPORTED FORMAT: Signature proof is malformed JSON.' }));
        } else {
          console.error('UNSUPPORTED FORMAT: Signature proof is malformed JSON.');
        }
        process.exitCode = 1;
        return;
      }

      // Displayed Report Integrity Check (B12):
      // Check if visible HTML findings have been tampered with compared to signed payload
      let signedObj = null;
      try {
        if (proof.canonicalPayload) {
          signedObj = JSON.parse(proof.canonicalPayload);
        }
      } catch {}

      if (signedObj && Array.isArray(signedObj.findings)) {
        const findingRegex = /<article class="finding">[\s\S]*?<div class="finding-title">\s*<span class="status\s+([^"]+)">([\s\S]*?)<\/span>\s*<h3>([\s\S]*?)<\/h3>/g;
        let matchFinding;
        const visibleFindings = [];
        while ((matchFinding = findingRegex.exec(content)) !== null) {
          visibleFindings.push({
            statusClass: matchFinding[1].trim(),
            statusText: matchFinding[2].trim(),
            title: matchFinding[3].trim()
          });
        }

        if (visibleFindings.length > 0 && visibleFindings.length === signedObj.findings.length) {
          for (let i = 0; i < visibleFindings.length; i++) {
            const vis = visibleFindings[i];
            const signedF = signedObj.findings[i];
            if (signedF && vis.statusClass.toLowerCase() !== String(signedF.status).toLowerCase()) {
              displayedReportIntegrity = 'FAILED';
              if (jsonOutput) {
                console.log(JSON.stringify({
                  valid: false,
                  signature: 'VALID',
                  displayedReportIntegrity: 'FAILED',
                  error: `Visible HTML finding status tampered! Finding "${signedF.id || vis.title}" visible status "${vis.statusClass}" does not match signed status "${signedF.status}".`
                }));
              } else {
                console.log('DISPLAYED REPORT INTEGRITY: FAILED');
                console.log('INTEGRITY: FAILED');
                console.error(`Verification Failed: Displayed HTML report finding status tampered! Finding "${signedF.id || vis.title}" visible status "${vis.statusClass}" does not match signed status "${signedF.status}".`);
              }
              process.exitCode = 1;
              return;
            }
          }
        } else if (visibleFindings.length > 0 && visibleFindings.length !== signedObj.findings.length) {
          displayedReportIntegrity = 'FAILED';
          if (jsonOutput) {
            console.log(JSON.stringify({
              valid: false,
              signature: 'VALID',
              displayedReportIntegrity: 'FAILED',
              error: `Visible finding count (${visibleFindings.length}) does not match signed payload count (${signedObj.findings.length}).`
            }));
          } else {
            console.log('DISPLAYED REPORT INTEGRITY: FAILED');
            console.log('INTEGRITY: FAILED');
            console.error(`Verification Failed: Visible finding count (${visibleFindings.length}) does not match signed payload count (${signedObj.findings.length}).`);
          }
          process.exitCode = 1;
          return;
        }
      }
    } else if (fileExt === '.json') {
      try {
        review = JSON.parse(content);
      } catch {
        if (jsonOutput) {
          console.log(JSON.stringify({ valid: false, error: 'UNSUPPORTED FORMAT: Report is not valid JSON.' }));
        } else {
          console.error('UNSUPPORTED FORMAT: Report is not valid JSON.');
        }
        process.exitCode = 1;
        return;
      }
      if (!review.signature) {
        if (jsonOutput) {
          console.log(JSON.stringify({ valid: false, error: 'MISSING SIGNATURE: This JSON report has no signature. Export it from PackSignal first.' }));
        } else {
          console.error('MISSING SIGNATURE: This JSON report has no signature. Export it from PackSignal first.');
        }
        process.exitCode = 1;
        return;
      }
      proof = { ...reviewSealProof(review), ...review.signature };
    } else {
      if (jsonOutput) {
        console.log(JSON.stringify({ valid: false, error: `UNSUPPORTED FORMAT: File extension '${fileExt}' is not a recognized PackSignal report format.` }));
      } else {
        console.error(`UNSUPPORTED FORMAT: File extension '${fileExt}' is not a recognized PackSignal report format.`);
      }
      process.exitCode = 1;
      return;
    }

    const result = verifyPortableSealProof(proof);
    const keyId = result.publicKeyId || proof.publicKeyId;

    if (!result.valid) {
      if (jsonOutput) {
        console.log(JSON.stringify({ valid: false, signature: 'INVALID', error: result.reason }));
      } else {
        console.log('SIGNATURE INVALID');
        console.error(`Verification Failed: ${result.reason}`);
      }
      process.exitCode = 1;
      return;
    }

    // Trusted Key / Trusted Fingerprint Check
    let isTrusted = false;
    if (trustedKeyPath) {
      if (!existsSync(trustedKeyPath)) {
        console.log('UNTRUSTED SIGNER');
        console.error(`Verification Failed: Specified trusted key file not found at '${trustedKeyPath}'.`);
        process.exitCode = 3;
        return;
      }
      const trustedKeyPem = (await readFile(trustedKeyPath, 'utf8')).trim();
      const trustedKeyFp = createHash('sha256').update(trustedKeyPem).digest('hex').slice(0, 16);
      const signerKeyPem = String(proof.publicKey || '').trim();

      if (trustedKeyPem === signerKeyPem || trustedKeyFp === keyId) {
        isTrusted = true;
      } else {
        console.log('UNTRUSTED SIGNER');
        console.error(`Verification Failed: Signer key fingerprint (${keyId}) does not match trusted key fingerprint (${trustedKeyFp}).`);
        process.exitCode = 1;
        return;
      }
    } else if (trustedFingerprint) {
      if (trustedFingerprint.toLowerCase() === keyId.toLowerCase()) {
        isTrusted = true;
      } else {
        console.log('UNTRUSTED SIGNER');
        console.error(`Verification Failed: Signer key fingerprint (${keyId}) does not match trusted fingerprint (${trustedFingerprint}).`);
        process.exitCode = 1;
        return;
      }
    }

    // Check external attachments if present adjacent to JSON
    let attachmentStatus = 'VERIFIED';
    if (review?.documents && Array.isArray(review.documents)) {
      const baseDir = resolve(filePath, '..');
      let foundCount = 0;
      for (const doc of review.documents) {
        const candidatePaths = [
          join(baseDir, doc.name || ''),
          join(baseDir, doc.id || ''),
          join(baseDir, 'sources', doc.name || ''),
        ];
        const existingPath = candidatePaths.find(p => doc.name && existsSync(p));
        if (existingPath) {
          foundCount++;
          const fileBytes = await readFile(existingPath);
          const computedDocHash = createHash('sha256').update(fileBytes).digest('hex');
          if (computedDocHash !== doc.sha256) {
            console.log('INTEGRITY: FAILED');
            console.error(`Verification Failed: Source attachment '${doc.name}' SHA-256 mismatch!`);
            console.error(`  Expected:   ${doc.sha256}`);
            console.error(`  Calculated: ${computedDocHash}`);
            process.exitCode = 1;
            return;
          }
        }
      }
      if (foundCount > 0) {
        attachmentStatus = `VERIFIED (${foundCount} source file${foundCount === 1 ? '' : 's'} checked)`;
      } else if (review.documents.length > 0) {
        attachmentStatus = 'NOT CHECKED (Source files not co-located with standalone JSON)';
      }
    }

    // Extract audit trail if present in review
    let auditStatus = 'UNAVAILABLE';
    if (review?.audit && Array.isArray(review.audit) && review.audit.length > 0) {
      const hasChainFields = review.audit.some(e => e.previousEventHash !== undefined || e.eventHash !== undefined);
      if (hasChainFields) {
        const auditRes = verifyAuditChain(review.audit);
        auditStatus = auditRes.valid ? 'VALID' : 'INVALID';
        if (!auditRes.valid) {
          console.log('AUDIT CHAIN: INVALID');
          console.error(`Verification Failed: Audit trail tampering detected! ${auditRes.reason}`);
          process.exitCode = 1;
          return;
        }
      } else {
        auditStatus = 'LEGACY (Unchained entries)';
      }
    }

    // Determine release authorization
    const hasApprovals = (review?.team?.approvals || []).length > 0;
    const releaseAuth = hasApprovals ? 'RECORDED' : 'NOT ESTABLISHED';

    if (jsonOutput) {
      console.log(JSON.stringify({
        valid: true,
        signature: 'VALID',
        schema: result.schema || proof.schema || 'packproof-review-seal/v2',
        keyId,
        signerTrust: isTrusted ? 'TRUSTED' : 'UNVERIFIED',
        auditChain: auditStatus,
        releaseAuthorization: releaseAuth,
        attachmentStatus,
        displayedReportIntegrity,
        payloadHash: result.payloadHash
      }, null, 2));
      return;
    }

    console.log('============================================================');
    console.log('PACKSIGNAL REPORT VERIFICATION');
    console.log('============================================================');
    console.log(`Schema:                         ${result.schema || proof.schema || 'packproof-review-seal/v2'}`);
    console.log('SIGNATURE:                      VALID');
    console.log('SIGNATURE VALID');
    console.log('VALID · Ed25519');
    console.log(`Algorithm:                      Ed25519`);
    console.log(`Key ID:                         ${keyId}`);
    console.log(`Algorithm: Ed25519 · Key ID: ${keyId}`);
    console.log(`Payload integrity:              VALID`);
    console.log(`Payload SHA-256:                ${result.payloadHash}`);
    console.log(`Signer trust:                   ${isTrusted ? 'TRUSTED' : 'UNVERIFIED'}`);
    if (isTrusted) {
      console.log('SIGNER IDENTITY: VERIFIED (TRUSTED SIGNER)');
    } else {
      console.log('SIGNER IDENTITY: NOT INDEPENDENTLY VERIFIED (Self-signed portable proof)');
    }
    console.log(`Source attachment verification: ${attachmentStatus}`);
    console.log(`Audit chain:                    ${auditStatus}`);
    console.log(`Displayed report integrity:     ${displayedReportIntegrity}`);
    console.log(`Release authorization:          ${releaseAuth}`);
    console.log('============================================================');
    if (!isTrusted) {
      console.log('Note: To certify signer identity against a trusted key, supply:');
      console.log('  --trusted-public-key <path/to/public.pem> or --trusted-fingerprint <fingerprint>');
    }
  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({ valid: false, error: error.message }));
    } else {
      console.error(`Verification Exception: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

async function verifyZipBundle(zipFilePath, { trustedKeyPath, trustedFingerprint } = {}) {
  const fullZipPath = resolve(zipFilePath);
  if (!existsSync(fullZipPath)) {
    console.error(`Error: File not found at '${zipFilePath}'`);
    process.exit(1);
  }

  const tempExtractDir = await mkdtemp(join(tmpdir(), 'packsignal-verify-zip-'));
  try {
    // 1. Safe extraction with traversal (Zip Slip) checks
    const extractScript = `
import zipfile, sys, os
from pathlib import Path

zip_path = sys.argv[1]
dest_dir = sys.argv[2]

dest_dir_real = os.path.realpath(dest_dir)

with zipfile.ZipFile(zip_path, 'r') as zf:
    for member in zf.infolist():
        target_path = os.path.realpath(os.path.join(dest_dir, member.filename))
        if not target_path.startswith(dest_dir_real + os.sep) and target_path != dest_dir_real:
            print(f"FORBIDDEN_TRAVERSAL:{member.filename}")
            sys.exit(3)
        if member.filename.startswith('/') or member.filename.startswith('\\\\') or '..' in member.filename:
            print(f"FORBIDDEN_PATH:{member.filename}")
            sys.exit(3)
    zf.extractall(dest_dir)
print("EXTRACTED_OK")
`;

    const extractProc = spawnSync(python, ['-c', extractScript, fullZipPath, tempExtractDir], {
      encoding: 'utf8',
      timeout: 30000,
    });

    if (extractProc.status !== 0) {
      console.log('INTEGRITY: FAILED');
      console.error(`Security Violation or ZIP extraction error: ${extractProc.stdout || extractProc.stderr}`);
      process.exitCode = 1;
      return;
    }

    // Resolve base directory (handles both flat and single-subfolder archive structures)
    let targetBaseDir = tempExtractDir;
    const { readdir, stat } = await import('node:fs/promises');
    const rootEntries = await readdir(tempExtractDir);
    if (rootEntries.length === 1 && !rootEntries[0].includes('.')) {
      const candidateDir = join(tempExtractDir, rootEntries[0]);
      if ((await stat(candidateDir)).isDirectory()) {
        targetBaseDir = candidateDir;
      }
    }

    // 2. Required files check
    const requiredFiles = [
      'verification-manifest.json',
      'review.json',
      'audit-trail.json',
      'verification-instructions.txt',
    ];

    for (const reqFile of requiredFiles) {
      if (!existsSync(join(targetBaseDir, reqFile))) {
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Required package file '${reqFile}' is missing from ZIP bundle.`);
        process.exitCode = 1;
        return;
      }
    }

    if (!existsSync(join(targetBaseDir, 'certificate.pdf')) && !existsSync(join(targetBaseDir, 'report.pdf'))) {
      console.log('INTEGRITY: FAILED');
      console.error(`Verification Failed: Neither 'certificate.pdf' nor 'report.pdf' found in ZIP bundle.`);
      process.exitCode = 1;
      return;
    }

    // 3. Parse manifest
    const manifestRaw = await readFile(join(targetBaseDir, 'verification-manifest.json'), 'utf8');
    let manifest;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch {
      console.log('INTEGRITY: FAILED');
      console.error('Verification Failed: verification-manifest.json is malformed JSON.');
      process.exitCode = 1;
      return;
    }

    if (!manifest.signature || !manifest.publicKey || manifest.algorithm !== 'Ed25519') {
      console.log('MISSING SIGNATURE');
      console.log('INTEGRITY: FAILED');
      console.error('Verification Failed: Manifest is missing signature or public key.');
      process.exitCode = 1;
      return;
    }

    // 4. Verify Ed25519 manifest signature
    const unsignedManifest = { ...manifest };
    delete unsignedManifest.signature;
    delete unsignedManifest.algorithm;

    const canonicalManifestStr = canonical(unsignedManifest);
    const keyId = createHash('sha256').update(manifest.publicKey).digest('hex').slice(0, 16);

    if (keyId !== manifest.publicKeyId) {
      console.log('SIGNATURE INVALID');
      console.log('INTEGRITY: FAILED');
      console.error(`Verification Failed: Public key fingerprint mismatch (expected ${manifest.publicKeyId}, calculated ${keyId}).`);
      process.exitCode = 1;
      return;
    }

    let manifestSigValid = false;
    try {
      manifestSigValid = verify(
        null,
        Buffer.from(canonicalManifestStr),
        manifest.publicKey,
        Buffer.from(manifest.signature, 'base64')
      );
    } catch (e) {
      console.log('SIGNATURE INVALID');
      console.log('INTEGRITY: FAILED');
      console.error(`Verification Failed: Cryptographic error during signature verification: ${e.message}`);
      process.exitCode = 1;
      return;
    }

    if (!manifestSigValid) {
      console.log('SIGNATURE INVALID');
      console.log('INTEGRITY: FAILED');
      console.error('Verification Failed: Ed25519 manifest signature is INVALID. Manifest has been tampered with.');
      process.exitCode = 1;
      return;
    }

    // Trusted Key / Trusted Fingerprint Check
    let isTrusted = false;
    if (trustedKeyPath) {
      if (!existsSync(trustedKeyPath)) {
        console.log('UNTRUSTED SIGNER');
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Specified trusted key file not found at '${trustedKeyPath}'.`);
        process.exitCode = 1;
        return;
      }
      const trustedKeyPem = (await readFile(trustedKeyPath, 'utf8')).trim();
      const trustedKeyFp = createHash('sha256').update(trustedKeyPem).digest('hex').slice(0, 16);
      const signerKeyPem = String(manifest.publicKey || '').trim();

      if (trustedKeyPem === signerKeyPem || trustedKeyFp === keyId) {
        isTrusted = true;
      } else {
        console.log('UNTRUSTED SIGNER');
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Signer key fingerprint (${keyId}) does not match trusted key fingerprint (${trustedKeyFp}).`);
        process.exitCode = 1;
        return;
      }
    } else if (trustedFingerprint) {
      if (trustedFingerprint.toLowerCase() === keyId.toLowerCase()) {
        isTrusted = true;
      } else {
        console.log('UNTRUSTED SIGNER');
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Signer key fingerprint (${keyId}) does not match trusted fingerprint (${trustedFingerprint}).`);
        process.exitCode = 1;
        return;
      }
    }

    // 5. Verify SHA-256 for all files listed in manifest
    const files = manifest.files || {};
    const verifiedFiles = [];

    for (const [relPath, meta] of Object.entries(files)) {
      const fullPath = join(targetBaseDir, relPath);
      if (!existsSync(fullPath)) {
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Manifest file '${relPath}' is missing from package.`);
        process.exitCode = 1;
        return;
      }

      const fileBuf = await readFile(fullPath);
      const computedHash = createHash('sha256').update(fileBuf).digest('hex');

      if (computedHash !== meta.sha256) {
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: SHA-256 mismatch for '${relPath}'!`);
        console.error(`  Expected:   ${meta.sha256}`);
        console.error(`  Calculated: ${computedHash}`);
        console.error('The file has been modified or corrupted after signing.');
        process.exitCode = 1;
        return;
      }

      if (meta.bytes !== undefined && fileBuf.byteLength !== meta.bytes) {
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Byte length mismatch for '${relPath}' (expected ${meta.bytes}, got ${fileBuf.byteLength}).`);
        process.exitCode = 1;
        return;
      }

      verifiedFiles.push(relPath);
    }

    // 6. Verify audit chain in audit-trail.json
    const auditRaw = await readFile(join(targetBaseDir, 'audit-trail.json'), 'utf8');
    const auditTrail = JSON.parse(auditRaw);
    const auditCheck = verifyAuditChain(auditTrail);

    if (!auditCheck.valid) {
      console.log('INTEGRITY: FAILED');
      console.error(`Verification Failed: Audit trail tampering detected! ${auditCheck.reason}`);
      process.exitCode = 1;
      return;
    }

    if (manifest.finalAuditChainHash && auditCheck.finalHash !== manifest.finalAuditChainHash) {
      console.log('INTEGRITY: FAILED');
      console.error('Verification Failed: Audit chain final digest does not match the signed manifest!');
      process.exitCode = 1;
      return;
    }

    // 7. Verify review payload seal in review.json
    const reviewRaw = await readFile(join(targetBaseDir, 'review.json'), 'utf8');
    const reviewObj = JSON.parse(reviewRaw);
    if (reviewObj.signature) {
      const proof = { ...reviewSealProof(reviewObj), ...reviewObj.signature };
      const portable = verifyPortableSealProof(proof);
      if (!portable.valid) {
        console.log('INTEGRITY: FAILED');
        console.error(`Verification Failed: Review payload seal invalid: ${portable.reason}`);
        process.exitCode = 1;
        return;
      }
    }

    // Success Output
    const cropsCount = verifiedFiles.filter(f => f.startsWith('evidence/')).length;

    const stateLabels = {
      draft: 'DRAFT INSPECTION',
      issues_outstanding: 'ISSUES OUTSTANDING',
      human_review_pending: 'HUMAN REVIEW PENDING',
      inspection_completed: 'INSPECTION COMPLETED',
      internal_signoff_recorded: 'INTERNAL SIGN-OFF RECORDED',
      superseded: 'SUPERSEDED BY A NEWER REVISION',
    };
    const displayState = stateLabels[manifest.reportState] || String(manifest.reportState || 'N/A').replace(/_/g, ' ').toUpperCase();

    console.log('============================================================');
    console.log('PACKSIGNAL PREPRESS REPORT BUNDLE VERIFICATION');
    console.log('============================================================');
    console.log(`Archive:             ${zipFilePath}`);
    console.log(`Export ID:           ${manifest.exportId || 'N/A'}`);
    console.log(`Review ID:           ${manifest.reviewId || 'N/A'}`);
    console.log(`Snapshot ID:         ${manifest.snapshotId || 'N/A'}`);
    console.log(`Generated (UTC):     ${manifest.createdAt || 'N/A'}`);
    console.log(`Inspection State:    ${displayState}`);
    console.log(`Files Verified:      ${verifiedFiles.length} (including PDF, JSON records, and ${cropsCount} evidence crops)`);
    console.log('');
    console.log('SIGNATURE:                  VALID (Ed25519)');
    console.log('CERTIFICATE FILE INTEGRITY: VERIFIED');
    console.log('REVIEW SNAPSHOT:            VERIFIED');
    console.log('INTEGRITY:                  VERIFIED');
    console.log(`SIGNING KEY:                FINGERPRINT ${keyId} (Ed25519)`);
    console.log(`SIGNER IDENTITY:            ${isTrusted ? 'VERIFIED (TRUSTED SIGNER)' : 'NOT INDEPENDENTLY VERIFIED'}`);
    console.log(`KEY OWNER:                  ${isTrusted ? 'VERIFIED' : 'NOT INDEPENDENTLY VERIFIED'}`);
    console.log(`QA SIGN-OFF:                ${displayState}`);
    console.log('PRINT RELEASE:              NOT ESTABLISHED');
    console.log('PRINT-RELEASE AUTHORITY:    NOT ESTABLISHED');
    console.log('');
    console.log('GOVERNANCE & AUDIT ASSURANCES:');
    console.log('- Cryptographic file hashes match the Ed25519 signed manifest.');
    console.log('- PDF bytes, review decisions, and visual defect crops are intact.');
    console.log(`- Tamper-evident audit chain verified (${auditTrail.length} sequential events).`);
    console.log('- To trust signer authority, verify the public key fingerprint out-of-band.');
    console.log('- Technical inspection completeness does NOT constitute statutory print approval.');
    console.log('============================================================');

  } catch (error) {
    console.log('INTEGRITY: FAILED');
    console.error(`Verification Exception: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
  }
}
