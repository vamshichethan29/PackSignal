import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createExportPackage, computeReportState } from '../../lib/export-package.mjs';
import { sealReview, verifyPortableSealProof } from '../../lib/audit-signature.mjs';
import { verifyAuditChain } from '../../lib/audit-chain.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundledPython = join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python = process.env.PACKPROOF_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');
const verifierScript = join(root, 'scripts/verify-report.mjs');

async function setupArtworkAndKeys(dir, reviewId) {
  const reviewDir = join(dir, 'reviews', reviewId);
  const renderedDir = join(reviewDir, 'rendered');
  await mkdir(renderedDir, { recursive: true });

  const script = `
from PIL import Image, ImageDraw
im = Image.new('RGB', (800, 600), color=(240, 248, 244))
draw = ImageDraw.Draw(im)
draw.rectangle([50, 50, 750, 550], outline=(24, 70, 50), width=4)
draw.rectangle([80, 80, 350, 250], fill=(220, 235, 225), outline=(30, 90, 60), width=2)
draw.text((90, 90), "DANCING FISH\\nBERRY CRUNCH 750g\\nCalories 535", fill=(10, 40, 25))
draw.rectangle([400, 400, 700, 500], fill=(255, 245, 230), outline=(180, 100, 20), width=2)
draw.text((410, 410), "NET WT 750 g", fill=(120, 50, 10))
im.save('${join(renderedDir, 'art-p1.png')}')
`;
  spawnSync(python, ['-c', script]);
}

function buildCertificateReview(id = 'review-cert-01') {
  return {
    id,
    name: 'Dancing Fish · Berry Crunch 750g',
    sku: 'DF-BC-750-US',
    artworkVersion: 'Revision B',
    market: 'United States',
    engine: 'PackSignal Prepress & Exact Comparison',
    status: 'ready',
    createdAt: '2026-10-23T14:30:00.000Z',
    finishedAt: '2026-10-23T14:35:00.000Z',
    counts: { issue: 1, review: 1, match: 2, unable: 0 },
    documents: [
      {
        id: 'doc-art-01',
        role: 'artwork',
        name: 'DancingFish_RevB_Carton.pdf',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        pages: [{ number: 1, image: 'art-p1.png', width: 800, height: 600, method: 'vector' }],
      },
      {
        id: 'doc-spec-01',
        role: 'spec',
        name: 'Master-Specification.xlsx',
        sha256: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
        pages: [],
      },
    ],
    findings: [
      {
        id: 'FIND-CAL-01',
        status: 'issue',
        severity: 'critical',
        title: 'Calorie declaration discrepancy',
        expected: '166 kcal per 100g (from formulation specification)',
        observed: '535 kcal per 100g (detected on artwork PDP)',
        explanation: 'Atwater calculation of macronutrients yields 535 kcal, conflicting with the printed 166 kcal.',
        rule: { id: 'DF-01', text: 'Calorie factor declaration must reconcile within 20% tolerance.' },
        evidence: [
          {
            role: 'artwork',
            documentId: 'doc-art-01',
            page: 1,
            box: [0.1, 0.15, 0.44, 0.42],
            quote: 'Calories 535',
            location: 'Front Panel Nutrition Facts',
          },
        ],
      },
      {
        id: 'FIND-NET-02',
        status: 'review',
        severity: 'major',
        title: 'Dual net quantity declaration check',
        expected: 'NET WT 750 g (26.4 OZ)',
        observed: 'NET WT 750 g',
        explanation: 'Verify whether target jurisdiction mandates dual customary and metric units.',
        rule: { id: 'DF-02', text: 'Net quantity must declare both US Customary and Metric units.' },
        evidence: [
          {
            role: 'artwork',
            documentId: 'doc-art-01',
            page: 1,
            box: [0.5, 0.65, 0.88, 0.85],
            quote: 'NET WT 750 g',
            location: 'PDP Bottom Panel',
          },
        ],
      },
      {
        id: 'FIND-UNL-03',
        status: 'review',
        severity: 'minor',
        title: 'Global distribution regulatory advisory',
        expected: 'FSSAI import license clause in secondary distribution markets',
        observed: 'Not present on packaging',
        explanation: 'Statutory market evaluation rule DF-03 requires legal advisory review.',
        rule: { id: 'DF-03', text: 'Statutory market import license notice.' },
        evidence: [],
      },
    ],
  };
}

test('Certificate Export: Generates PS-XXXX Certificate ID, Scorecard, and Signed Manifest', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-cert-test-'));
  try {
    const review = buildCertificateReview('review-cert-main');
    await setupArtworkAndKeys(tempDir, review.id);

    const pkg = await createExportPackage(review, tempDir, { id: 'tester-01', displayName: 'QA Lead' });

    assert.ok(pkg.certificateId.startsWith('PS-'), 'Certificate ID must start with PS-');
    assert.equal(pkg.reportState, 'issues_outstanding');
    assert.ok(existsSync(pkg.zipPath), 'ZIP bundle must be created');
    assert.ok(existsSync(pkg.certificatePdfPath), 'certificate.pdf must be created');
    assert.ok(existsSync(pkg.pdfPath), 'report.pdf must be created');

    const manifest = pkg.manifest;
    assert.equal(manifest.certificateId, pkg.certificateId);
    assert.equal(manifest.reportTitle, 'PACKSIGNAL PREPRESS INSPECTION & SIGN-OFF CERTIFICATE');
    assert.ok(manifest.files['certificate.pdf'], 'certificate.pdf must be in manifest');
    assert.ok(manifest.files['report.pdf'], 'report.pdf must be in manifest');
    assert.ok(manifest.files['review.json'], 'review.json must be in manifest');
    assert.ok(manifest.files['audit-trail.json'], 'audit-trail.json must be in manifest');
    assert.ok(manifest.files['evidence/finding-FIND-CAL-01.png'], 'Defect crop must be generated and signed');

    const verifyRes = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(verifyRes.status, 0, verifyRes.stderr || verifyRes.stdout);
    assert.match(verifyRes.stdout, /CERTIFICATE FILE INTEGRITY:\s+VERIFIED/);
    assert.match(verifyRes.stdout, /REVIEW SNAPSHOT:\s+VERIFIED/);
    assert.match(verifyRes.stdout, /SIGNING KEY:\s+FINGERPRINT/);
    assert.match(verifyRes.stdout, /QA SIGN-OFF:\s+ISSUES OUTSTANDING/);
    assert.match(verifyRes.stdout, /PRINT-RELEASE AUTHORITY:\s+NOT ESTABLISHED/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Certificate 3D Preview: Embeds high-res 3D preview or truthful 2D fallback', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-cert-3d-'));
  try {
    const review = buildCertificateReview('review-cert-3d');
    await setupArtworkAndKeys(tempDir, review.id);

    // 1. Without 3D preview (truthful 2D fallback)
    const pkgFallback = await createExportPackage(review, tempDir);
    assert.ok(pkgFallback.manifest.files['images/artwork-2d-overview.png'], 'Truthful 2D overview should be saved when 3D preview not provided');

    // 2. With client-supplied 3D preview base64 (1x1 green PNG)
    const sampleB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pkgWith3D = await createExportPackage(review, tempDir, null, { previewImage: sampleB64 });
    assert.ok(pkgWith3D.manifest.files['images/package-3d-preview.png'], '3D preview PNG must be saved in images/ and signed in manifest');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Security & Tamper Proofing: Altered Certificate PDF byte breaks verification', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-cert-tamper-'));
  try {
    const review = buildCertificateReview('review-cert-tamper');
    await setupArtworkAndKeys(tempDir, review.id);

    const pkg = await createExportPackage(review, tempDir);

    const tamperScript = `
import zipfile, sys
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'r') as zin:
    files = {item.filename: zin.read(item.filename) for item in zin.infolist()}

pdf_bytes = bytearray(files['certificate.pdf'])
pdf_bytes[64] = (pdf_bytes[64] + 1) % 256
files['certificate.pdf'] = bytes(pdf_bytes)

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
    for name, content in files.items():
        zout.writestr(name, content)
`;
    const tamperProc = spawnSync(python, ['-c', tamperScript, pkg.zipPath]);
    assert.equal(tamperProc.status, 0);

    const checkResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(checkResult.status, 1, 'Verification must fail on modified PDF');
    assert.match(checkResult.stdout, /INTEGRITY:\s+FAILED/);
    assert.match(checkResult.stderr, /SHA-256 mismatch for 'certificate\.pdf'/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Security & Tamper Proofing: Altered evidence crop PNG breaks verification', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-cert-crop-tamper-'));
  try {
    const review = buildCertificateReview('review-cert-crop-tamper');
    await setupArtworkAndKeys(tempDir, review.id);

    const pkg = await createExportPackage(review, tempDir);

    const tamperScript = `
import zipfile, sys
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'r') as zin:
    files = {item.filename: zin.read(item.filename) for item in zin.infolist()}

crop_key = [k for k in files.keys() if k.startswith('evidence/')][0]
img_bytes = bytearray(files[crop_key])
img_bytes[-10] = (img_bytes[-10] + 1) % 256
files[crop_key] = bytes(img_bytes)

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
    for name, content in files.items():
        zout.writestr(name, content)
`;
    const tamperProc = spawnSync(python, ['-c', tamperScript, pkg.zipPath]);
    assert.equal(tamperProc.status, 0);

    const checkResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(checkResult.status, 1, 'Verification must fail on tampered crop image');
    assert.match(checkResult.stdout, /INTEGRITY:\s+FAILED/);
    assert.match(checkResult.stderr, /SHA-256 mismatch for 'evidence\//);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('QA Operator Sign-Off: Distinguishes named recorded sign-off from pending state', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-cert-signoff-'));
  try {
    const reviewPending = buildCertificateReview('review-pending');
    await setupArtworkAndKeys(tempDir, reviewPending.id);
    const pkgPending = await createExportPackage(reviewPending, tempDir);
    assert.equal(pkgPending.reportState, 'issues_outstanding');

    const reviewSigned = buildCertificateReview('review-signed');
    reviewSigned.findings = reviewSigned.findings.map(f => ({ ...f, status: 'match' }));
    reviewSigned.counts = { issue: 0, review: 0, match: 3, unable: 0 };
    reviewSigned.team = {
      approvals: [{
        reviewerId: 'usr-sarah-qa',
        reviewerName: 'Sarah Jenkins',
        outcome: 'approved',
        note: 'All prepress checks verified against master spec.',
        at: '2026-10-23T15:00:00.000Z',
      }],
    };
    await setupArtworkAndKeys(tempDir, reviewSigned.id);
    const pkgSigned = await createExportPackage(reviewSigned, tempDir);
    assert.equal(pkgSigned.reportState, 'internal_signoff_recorded');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

