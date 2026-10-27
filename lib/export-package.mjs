import { createHash, randomUUID, sign, verify } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { sealReview, verifyPortableSealProof, reviewSealProof } from './audit-signature.mjs';
import { chainAuditTrail, appendAuditEvent, verifyAuditChain, canonical, sha256Hex } from './audit-chain.mjs';
import { createHtmlReport } from './html-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundledPython = join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python = process.env.PACKPROOF_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');

export function computeReportState(review) {
  if (review.supersededBy) return 'superseded';
  if (review.status !== 'ready') return 'draft';

  const counts = review.counts || {};
  const issues = counts.issue || (review.findings || []).filter(f => f.status === 'issue').length;
  const reviews = counts.review || (review.findings || []).filter(f => f.status === 'review').length;

  if (issues > 0) return 'issues_outstanding';

  const undecidedReviews = (review.findings || []).filter(
    f => f.status === 'review' && !review.decisions?.[f.id]
  );
  if (reviews > 0 && undecidedReviews.length > 0) return 'human_review_pending';

  const hasSignOff = (review.team?.approvals || []).length > 0;
  if (hasSignOff) return 'internal_signoff_recorded';

  return 'inspection_completed';
}

export function reportStateLabel(state) {
  const map = {
    draft: 'Draft inspection',
    issues_outstanding: 'Issues outstanding',
    human_review_pending: 'Human review pending',
    inspection_completed: 'Inspection completed',
    internal_signoff_recorded: 'Internal sign-off recorded',
    superseded: 'Superseded by a newer revision',
  };
  return map[state] || 'Draft inspection';
}

async function readSigningKeys(storage) {
  const keyDirectory = join(storage, 'keys');
  const privatePath = join(keyDirectory, 'review-seal-private.pem');
  const publicPath = join(keyDirectory, 'review-seal-public.pem');
  const privateKey = await readFile(privatePath, 'utf8');
  const publicKey = await readFile(publicPath, 'utf8');
  const publicKeyId = createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
  return { privateKey, publicKey, publicKeyId };
}

async function fileHashAndSize(path) {
  const buf = await readFile(path);
  return {
    sha256: createHash('sha256').update(buf).digest('hex'),
    bytes: buf.byteLength,
  };
}

export async function createExportPackage(review, storage, actor = null, options = {}) {
  // 1. Freeze snapshot
  const snapshot = structuredClone(review);
  const exportId = 'exp-' + randomUUID();
  const snapshotId = snapshot.snapshotId || ('snap-' + randomUUID());
  const now = new Date().toISOString();

  snapshot.snapshotId = snapshotId;
  snapshot.exportId = exportId;
  snapshot.exportedAt = now;

  // 2. Chained audit trail
  snapshot.audit = chainAuditTrail(snapshot.audit || [], snapshot.id);
  appendAuditEvent(
    snapshot,
    {
      action: 'report_snapshot_created',
      safeDetails: `Prepress inspection export package created with export ID ${exportId}.`,
      targetType: 'export',
      targetId: exportId,
    },
    actor
  );

  // 3. Cryptographic seal of the canonical review payload
  snapshot.signature = await sealReview(snapshot, storage);

  // 4. Working directory for export
  const reviewBaseDir = existsSync(join(storage, 'reviews', review.id))
    ? join(storage, 'reviews', review.id)
    : join(storage, review.id);
  const exportDir = join(reviewBaseDir, 'exports', exportId);
  const evidenceDir = join(exportDir, 'evidence');
  const imagesDir = join(exportDir, 'images');
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  await mkdir(imagesDir, { recursive: true, mode: 0o700 });

  // 5. Generate Evidence Crops
  const renderedDir = join(reviewBaseDir, 'rendered');
  let cropsResult = { cropsByFinding: {}, allCrops: [], totalExtracted: 0 };
  if (existsSync(renderedDir)) {
    const cropProc = spawnSync(
      python,
      [join(root, 'lib/evidence-crops.py'), '--json'],
      {
        input: JSON.stringify({ review: snapshot, rendered: renderedDir, output: evidenceDir }),
        encoding: 'utf8',
        timeout: 30000,
      }
    );
    if (cropProc.status === 0 && cropProc.stdout) {
      try {
        cropsResult = JSON.parse(cropProc.stdout);
      } catch {}
    }
  }

  // 5b. Resolve and store high-res 3D packaging preview (or 2D fallback overview)
  let previewImagePath = null;
  if (options.previewImage) {
    if (typeof options.previewImage === 'string' && options.previewImage.startsWith('data:image/')) {
      const b64Data = options.previewImage.split(',')[1];
      if (b64Data) {
        const previewDest = join(imagesDir, 'package-3d-preview.png');
        await writeFile(previewDest, Buffer.from(b64Data, 'base64'));
        previewImagePath = previewDest;
        if (existsSync(renderedDir)) {
          await writeFile(join(renderedDir, 'package-3d-preview.png'), Buffer.from(b64Data, 'base64')).catch(() => {});
        }
      }
    } else if (existsSync(options.previewImage)) {
      const previewDest = join(imagesDir, 'package-3d-preview.png');
      await copyFile(options.previewImage, previewDest);
      previewImagePath = previewDest;
    }
  }

  if (!previewImagePath && existsSync(join(renderedDir, 'package-3d-preview.png'))) {
    const previewDest = join(imagesDir, 'package-3d-preview.png');
    await copyFile(join(renderedDir, 'package-3d-preview.png'), previewDest);
    previewImagePath = previewDest;
  }

  if (!previewImagePath) {
    // Truthful fallback: copy first rendered artwork page to images/artwork-2d-overview.png
    const artDoc = (snapshot.documents || []).find(d => d.role === 'artwork');
    const firstPageImage = artDoc?.pages?.[0]?.image;
    if (firstPageImage && existsSync(join(renderedDir, firstPageImage))) {
      const overviewDest = join(imagesDir, 'artwork-2d-overview.png');
      await copyFile(join(renderedDir, firstPageImage), overviewDest).catch(() => {});
      previewImagePath = overviewDest;
    }
  }

  // 6. Generate report.pdf & certificate.pdf
  const pdfPath = join(exportDir, 'report.pdf');
  const certPdfPath = join(exportDir, 'certificate.pdf');
  const pdfProc = spawnSync(
    python,
    [join(root, 'lib/report-pdf.py'), '--json'],
    {
      input: JSON.stringify({
        review: snapshot,
        output: pdfPath,
        crops: cropsResult.cropsByFinding,
        preview_image: previewImagePath,
      }),
      encoding: 'utf8',
      timeout: 45000,
    }
  );
  if (pdfProc.status !== 0) {
    throw new Error(`PDF generation failed: ${pdfProc.stderr || pdfProc.stdout || 'Unknown error'}`);
  }
  await copyFile(pdfPath, certPdfPath);

  // 7. Write review.json
  const reviewJsonPath = join(exportDir, 'review.json');
  await writeFile(reviewJsonPath, JSON.stringify(snapshot, null, 2), 'utf8');

  // 8. Write audit-trail.json
  const auditJsonPath = join(exportDir, 'audit-trail.json');
  await writeFile(auditJsonPath, JSON.stringify(snapshot.audit, null, 2), 'utf8');

  // 9. Write report.html
  const htmlPath = join(exportDir, 'report.html');
  const htmlContent = await createHtmlReport(snapshot, reviewBaseDir);
  await writeFile(htmlPath, htmlContent, 'utf8');

  // 10. Write verification-instructions.txt
  const instructionsPath = join(exportDir, 'verification-instructions.txt');
  const keys = await readSigningKeys(storage);
  const state = computeReportState(snapshot);
  const certificateId = 'PS-' + snapshot.id.slice(0, 8).toUpperCase();
  const instructions = `PACKSIGNAL PREPRESS INSPECTION & SIGN-OFF CERTIFICATE
PACKAGE VERIFICATION INSTRUCTIONS
============================================================
Certificate ID:      ${certificateId}
Export ID:           ${exportId}
Review ID:           ${snapshot.id}
Snapshot ID:         ${snapshotId}
Generated (UTC):     ${now}
Inspection State:    ${reportStateLabel(state).toUpperCase()}
Public Key Fingerprint: ${keys.publicKeyId}

PACKAGE CONTENTS:
------------------------------------------------------------
- certificate.pdf                Official Prepress Inspection Certificate PDF
- report.pdf                     Prepress Inspection Report PDF
- review.json                    Frozen canonical review snapshot
- audit-trail.json               Sequentially hashed tamper-evident audit history
- report.html                    Portable standalone HTML report with embedded proof
- verification-manifest.json     Ed25519-signed cryptographic file manifest
- images/                        Package 3D physical preview (or truthful 2D overview)
- evidence/                      Lossless bounding-box crops of located artwork defects
- verification-instructions.txt  This verification guide

OFFLINE VERIFICATION PROCEDURE:
------------------------------------------------------------
To verify that none of the files (Certificate PDF, review JSON, audit history, 3D preview, or defect crops)
have been altered, tampered with, or substituted since the package was sealed:

Run the bundled PackSignal verification command:

  node scripts/verify-report.mjs <PackageName>.zip

VERIFICATION CHECKS PERFORMED:
------------------------------------------------------------
1. Signed Manifest Integrity:
   Verifies the Ed25519 signature of 'verification-manifest.json'
   against the included public key (${keys.publicKeyId}).

2. File Hash Verification:
   Computes SHA-256 for 'certificate.pdf', 'report.pdf', 'review.json', 'audit-trail.json',
   'report.html', preview images, and every defect crop in 'evidence/'.
   Ensures every byte matches the signed manifest.

3. Tamper-Evident Audit Chain:
   Validates the continuous sequence and previous-event SHA-256 chaining
   of all audit trail entries from genesis to final digest.

4. Review Payload Seal:
   Verifies the cryptographic seal over source hashes, findings, decisions,
   and sign-off records.

IMPORTANT GOVERNANCE & LEGAL NOTICE:
------------------------------------------------------------
Cryptographic verification confirms data integrity relative to the signing key.
It does NOT certify legal compliance, regulatory approval, or authorize printing.
Final print release requires authorized human managerial approval.
`;
  await writeFile(instructionsPath, instructions, 'utf8');

  // 11. Collect all files and calculate hashes for manifest
  const filesMap = {};
  const standardFiles = [
    'certificate.pdf',
    'report.pdf',
    'review.json',
    'audit-trail.json',
    'report.html',
    'verification-instructions.txt',
  ];

  for (const name of standardFiles) {
    const fPath = join(exportDir, name);
    if (existsSync(fPath)) {
      filesMap[name] = await fileHashAndSize(fPath);
    }
  }

  // Include all images (e.g. package-3d-preview.png or artwork-2d-overview.png)
  if (existsSync(imagesDir)) {
    const imgFiles = await readdir(imagesDir);
    for (const imgFile of imgFiles) {
      if (imgFile.endsWith('.png') || imgFile.endsWith('.jpg')) {
        const rel = `images/${imgFile}`;
        filesMap[rel] = await fileHashAndSize(join(imagesDir, imgFile));
      }
    }
  }

  // Include all evidence crop PNGs
  if (existsSync(evidenceDir)) {
    const cropFiles = await readdir(evidenceDir);
    for (const cropFile of cropFiles) {
      if (cropFile.endsWith('.png')) {
        const rel = `evidence/${cropFile}`;
        filesMap[rel] = await fileHashAndSize(join(evidenceDir, cropFile));
      }
    }
  }

  // 12. Build and sign canonical manifest
  const manifestData = {
    schema: 'packsignal-certificate-manifest/v1',
    schemaVersion: 'packsignal-verification-manifest/v1',
    certificateId,
    exportId,
    reviewId: snapshot.id,
    snapshotId,
    createdAt: now,
    reportTitle: 'PACKSIGNAL PREPRESS INSPECTION & SIGN-OFF CERTIFICATE',
    reportState: state,
    reviewSeal: {
      algorithm: snapshot.signature.algorithm,
      publicKeyId: snapshot.signature.publicKeyId,
      payloadHash: snapshot.signature.payloadHash,
    },
    finalAuditChainHash: snapshot.audit.length ? snapshot.audit[snapshot.audit.length - 1].eventHash : '0'.repeat(64),
    files: filesMap,
    publicKeyId: keys.publicKeyId,
    publicKey: keys.publicKey,
  };

  const canonicalManifest = canonical(manifestData);
  const manifestSignature = sign(null, Buffer.from(canonicalManifest), keys.privateKey).toString('base64');
  const signedManifest = {
    ...manifestData,
    algorithm: 'Ed25519',
    signature: manifestSignature,
  };

  const manifestPath = join(exportDir, 'verification-manifest.json');
  await writeFile(manifestPath, JSON.stringify(signedManifest, null, 2), 'utf8');

  // 13. Package everything into ZIP
  const safeReviewId = review.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTimestamp = now.replace(/[:.]/g, '-');
  const zipFilename = `PackSignal_${safeReviewId}_${safeTimestamp}_Inspection-Certificate.zip`;
  const zipPath = join(exportDir, zipFilename);

  const zipScript = `
import zipfile, sys, os
from pathlib import Path

source_dir = Path(sys.argv[1])
zip_path = Path(sys.argv[2])

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(source_dir):
        for f in sorted(files):
            full = Path(root) / f
            if full == zip_path:
                continue
            rel = full.relative_to(source_dir)
            zf.write(full, arcname=str(rel))
`;

  const zipProc = spawnSync(python, ['-c', zipScript, exportDir, zipPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (zipProc.status !== 0) {
    throw new Error(`ZIP package creation failed: ${zipProc.stderr || zipProc.stdout}`);
  }

  const zipStats = await stat(zipPath);

  return {
    certificateId,
    exportId,
    snapshotId,
    createdAt: now,
    filename: zipFilename,
    zipPath,
    zipSize: zipStats.size,
    pdfPath,
    certificatePdfPath: certPdfPath,
    reportState: state,
    manifest: signedManifest,
    filesCount: Object.keys(filesMap).length + 1, // + manifest
  };
}
