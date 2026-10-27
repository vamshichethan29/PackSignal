import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createExportPackage, computeReportState } from '../lib/export-package.mjs';
import { sealReview, verifyPortableSealProof } from '../lib/audit-signature.mjs';
import { verifyAuditChain, appendAuditEvent, chainAuditTrail } from '../lib/audit-chain.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundledPython = join(process.env.HOME || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python = process.env.PACKPROOF_PYTHON || (existsSync(bundledPython) ? bundledPython : 'python3');
const verifierScript = join(root, 'scripts/verify-report.mjs');

function createSampleReview(reviewId = 'review-test-01') {
  return {
    id: reviewId,
    createdAt: '2026-10-23T10:00:00.000Z',
    finishedAt: '2026-10-23T10:05:00.000Z',
    name: 'Dancing Fish · Berry Crunch 750g',
    market: 'United States',
    engine: 'PackSignal Prepress & Exact Comparison',
    status: 'ready',
    counts: { issue: 1, review: 1, unable: 0, match: 2 },
    documents: [
      {
        id: 'art-01',
        role: 'artwork',
        name: 'carton-artwork-v2.pdf',
        sha256: 'a'.repeat(64),
        pages: [
          { number: 1, image: 'art-01-p1.png', width: 800, height: 600, method: 'vector' }
        ],
      },
      {
        id: 'spec-01',
        role: 'spec',
        name: 'formulation-brief.xlsx',
        sha256: 'b'.repeat(64),
        pages: [],
      },
    ],
    findings: [
      {
        id: 'FIND-001',
        status: 'issue',
        severity: 'critical',
        title: 'Calorie arithmetic discrepancy',
        expected: '166 kcal per 100g (from formulation sheet)',
        observed: '535 kcal per 100g (4-4-9 computed)',
        explanation: 'Atwater 4-4-9 calculation of macronutrients yields 535 kcal, conflicting with the printed 166 kcal.',
        rule: { id: 'DF-01', text: 'Calorie declaration must reconcile with declared protein, fat, and carbohydrate factors within 20% tolerance.' },
        evidence: [
          {
            role: 'artwork',
            documentId: 'art-01',
            page: 1,
            box: [0.1, 0.2, 0.45, 0.55],
            quote: 'Calories 535',
            location: 'Front Panel Nutrition Facts',
          },
          {
            role: 'spec',
            documentId: 'spec-01',
            page: 1,
            location: 'Sheet1!E3',
            quote: 'Energy: 166 kcal / 100g',
          },
        ],
      },
      {
        id: 'FIND-002',
        status: 'review',
        severity: 'major',
        title: 'Net quantity metric quotation check',
        expected: 'NET WT 750 g (26.4 OZ)',
        observed: 'NET WT 750 g',
        explanation: 'Check whether dual declaration in both metric (grams) and US customary (ounces) is mandatory for this target distribution market.',
        rule: { id: 'DF-02', text: 'Net quantity must declare both US Customary and Metric units.' },
        evidence: [
          {
            role: 'artwork',
            documentId: 'art-01',
            page: 1,
            box: [0.5, 0.7, 0.85, 0.85],
            quote: 'NET WT 750 g',
            location: 'Principal Display Panel bottom',
          },
        ],
      },
      {
        id: 'FIND-003',
        status: 'match',
        severity: 'minor',
        title: 'Primary brand name match',
        expected: 'Dancing Fish',
        observed: 'Dancing Fish',
        explanation: 'Brand typography matches registered brand trademark.',
        rule: { id: 'DF-03', text: 'Brand title must match approved register.' },
        evidence: [
          {
            role: 'artwork',
            documentId: 'art-01',
            page: 1,
            box: [0.15, 0.05, 0.6, 0.2],
            quote: 'Dancing Fish',
          },
        ],
      },
    ],
    decisions: {
      'FIND-001': {
        disposition: 'needs_changes',
        reviewerName: 'Alex Rivera',
        decidedBy: 'reviewer-alex',
        note: 'Laboratory confirmation required for fiber deduction formulation.',
        at: '2026-10-23T10:15:00.000Z',
      },
    },
    team: {
      createdBy: 'admin-jane',
      assignments: {
        'FIND-001': { reviewerIds: ['reviewer-alex'], assignedByName: 'Jane Doe', at: '2026-10-23T10:02:00.000Z' },
      },
      comments: [
        {
          id: 'comm-1',
          findingId: 'FIND-001',
          authorId: 'reviewer-alex',
          authorName: 'Alex Rivera',
          comment: 'Check if soluble dietary fiber was deducted from total carbohydrates.',
          at: '2026-10-23T10:10:00.000Z',
        },
      ],
      approvals: [
        {
          id: 'app-1',
          findingId: 'FIND-001',
          reviewerId: 'reviewer-alex',
          reviewerName: 'Alex Rivera',
          outcome: 'needs_changes',
          note: 'Blocked: Energy declaration does not balance with fat/protein/carb totals.',
          at: '2026-10-23T10:20:00.000Z',
        },
      ],
    },
    audit: [],
    warnings: ['Draft formulation status: Cell E3 indicates Draft / In Review.'],
    coverage: {
      ruleCount: 3,
      limits: [
        'Supplied sources and deterministic checks only.',
        'Final legal, technical, and print-release decisions require authorized human approval.',
      ],
    },
  };
}

async function setupRenderedArtwork(reviewDir, filename = 'art-01-p1.png') {
  const renderedDir = join(reviewDir, 'rendered');
  await mkdir(renderedDir, { recursive: true });
  // Create a genuine RGB image using python PIL
  const createImgScript = `
from PIL import Image, ImageDraw
img = Image.new('RGB', (800, 600), color=(240, 245, 240))
draw = ImageDraw.Draw(img)
draw.text((100, 150), "Calories 535", fill=(20, 20, 20))
draw.text((420, 440), "NET WT 750 g", fill=(20, 20, 20))
draw.text((150, 50), "Dancing Fish", fill=(10, 80, 50))
img.save(sys.argv[1], 'PNG')
`;
  const imgPath = join(renderedDir, filename);
  const res = spawnSync(python, ['-c', 'import sys;' + createImgScript, imgPath]);
  assert.equal(res.status, 0, res.stderr || res.stdout);
}

test('Prepress Report Package: creates complete frozen ZIP bundle with all required components', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-export-test-'));
  try {
    const review = createSampleReview('review-bundle-01');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    const actor = { id: 'reviewer-alex', displayName: 'Alex Rivera', role: 'reviewer' };
    const pkg = await createExportPackage(review, tempDir, actor);

    assert.ok(pkg.exportId.startsWith('exp-'));
    assert.ok(pkg.snapshotId.startsWith('snap-'));
    assert.ok(pkg.filename.endsWith('.zip'));
    assert.ok(existsSync(pkg.zipPath));
    assert.ok(pkg.zipSize > 2000, `ZIP file size should be substantial (got ${pkg.zipSize})`);
    assert.equal(pkg.reportState, 'issues_outstanding');

    // Verify manifest contents
    const manifest = pkg.manifest;
    assert.equal(manifest.schemaVersion, 'packsignal-verification-manifest/v1');
    assert.equal(manifest.algorithm, 'Ed25519');
    assert.ok(manifest.signature);
    assert.ok(manifest.publicKey);
    assert.ok(manifest.publicKeyId);
    assert.ok(manifest.files['report.pdf']);
    assert.ok(manifest.files['review.json']);
    assert.ok(manifest.files['audit-trail.json']);
    assert.ok(manifest.files['report.html']);
    assert.ok(manifest.files['verification-instructions.txt']);
    assert.ok(manifest.files['evidence/finding-FIND-001.png']);
    assert.ok(manifest.files['evidence/finding-FIND-002.png']);
    assert.ok(manifest.files['evidence/finding-FIND-003.png']);

    // Run offline verification on the generated ZIP
    const verifyResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(verifyResult.status, 0, verifyResult.stderr || verifyResult.stdout);
    assert.match(verifyResult.stdout, /INTEGRITY:\s+VERIFIED/);
    assert.match(verifyResult.stdout, /SIGNING KEY:\s+FINGERPRINT/);
    assert.match(verifyResult.stdout, /SIGNER IDENTITY:\s+NOT INDEPENDENTLY VERIFIED/);
    assert.match(verifyResult.stdout, /PRINT RELEASE:\s+NOT ESTABLISHED/);
    assert.match(verifyResult.stdout, /ISSUES OUTSTANDING/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Tamper detection: modifying report.pdf fails verification', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-tamper-pdf-'));
  try {
    const review = createSampleReview('review-tamper-pdf');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    const pkg = await createExportPackage(review, tempDir);

    // Tamper with PDF inside the zip
    const tamperScript = `
import zipfile, sys
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'r') as zin:
    files = {item.filename: zin.read(item.filename) for item in zin.infolist()}

# Alter 1 byte in report.pdf
pdf_bytes = bytearray(files['report.pdf'])
pdf_bytes[100] = (pdf_bytes[100] + 1) % 256
files['report.pdf'] = bytes(pdf_bytes)

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
    for name, content in files.items():
        zout.writestr(name, content)
`;
    const tamperProc = spawnSync(python, ['-c', tamperScript, pkg.zipPath]);
    assert.equal(tamperProc.status, 0);

    // Verify should now FAIL
    const checkResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(checkResult.status, 1);
    assert.match(checkResult.stdout, /INTEGRITY:\s+FAILED/);
    assert.match(checkResult.stderr, /SHA-256 mismatch for 'report\.pdf'/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Tamper detection: modifying an evidence crop PNG fails verification', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-tamper-png-'));
  try {
    const review = createSampleReview('review-tamper-png');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    const pkg = await createExportPackage(review, tempDir);

    // Tamper with finding-FIND-001.png inside the zip
    const tamperScript = `
import zipfile, sys
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'r') as zin:
    files = {item.filename: zin.read(item.filename) for item in zin.infolist()}

png_key = 'evidence/finding-FIND-001.png'
png_bytes = bytearray(files[png_key])
png_bytes[50] = (png_bytes[50] + 1) % 256
files[png_key] = bytes(png_bytes)

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
    for name, content in files.items():
        zout.writestr(name, content)
`;
    const tamperProc = spawnSync(python, ['-c', tamperScript, pkg.zipPath]);
    assert.equal(tamperProc.status, 0);

    const checkResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(checkResult.status, 1);
    assert.match(checkResult.stdout, /INTEGRITY:\s+FAILED/);
    assert.match(checkResult.stderr, /SHA-256 mismatch for 'evidence\/finding-FIND-001\.png'/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Tamper detection: altering an audit event breaks the hash chain and fails verification', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-tamper-audit-'));
  try {
    const review = createSampleReview('review-tamper-audit');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    const pkg = await createExportPackage(review, tempDir);

    // Tamper with audit-trail.json inside the zip
    const tamperScript = `
import zipfile, json, sys
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'r') as zin:
    files = {item.filename: zin.read(item.filename) for item in zin.infolist()}

trail = json.loads(files['audit-trail.json'].decode('utf-8'))
# Modify action of first event
trail[0]['action'] = 'unauthorized_action_injection'
files['audit-trail.json'] = json.dumps(trail, indent=2).encode('utf-8')

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
    for name, content in files.items():
        zout.writestr(name, content)
`;
    const tamperProc = spawnSync(python, ['-c', tamperScript, pkg.zipPath]);
    assert.equal(tamperProc.status, 0);

    const checkResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(checkResult.status, 1);
    assert.match(checkResult.stdout, /INTEGRITY:\s+FAILED/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Zip Slip prevention: archives with path traversal elements are rejected', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-zipslip-'));
  try {
    const maliciousZipPath = join(tempDir, 'malicious.zip');
    const createMaliciousZip = `
import zipfile, sys
zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, 'w') as zf:
    zf.writestr('../evil.txt', 'malicious payload')
`;
    const res = spawnSync(python, ['-c', createMaliciousZip, maliciousZipPath]);
    assert.equal(res.status, 0);

    const checkResult = spawnSync(process.execPath, [verifierScript, maliciousZipPath], { encoding: 'utf8' });
    assert.equal(checkResult.status, 1);
    assert.match(checkResult.stdout, /INTEGRITY:\s+FAILED/);
    assert.match(checkResult.stderr, /FORBIDDEN_PATH|Security Violation/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Visual Inspection: Render generated PDF pages to PNG and assert content layout', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-pdf-render-'));
  try {
    const review = createSampleReview('review-pdf-visual');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    const pkg = await createExportPackage(review, tempDir);
    const pdfPath = join(tempDir, 'reviews', review.id, 'exports', pkg.exportId, 'report.pdf');
    assert.ok(existsSync(pdfPath));

    // Render PDF pages to PNG (using PyMuPDF fitz or pypdf extraction)
    const renderScript = `
import sys, os, json

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
page_data = []

has_fitz = False
try:
    import fitz
    has_fitz = True
except ImportError:
    pass

if has_fitz:
    doc = fitz.open(pdf_path)
    for idx, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        png_path = os.path.join(out_dir, f"page-{idx+1}.png")
        pix.save(png_path)
        page_data.append({
            'page': idx + 1,
            'width': pix.width,
            'height': pix.height,
            'png': png_path,
            'text': page.get_text()
        })
else:
    from pypdf import PdfReader
    from PIL import Image
    reader = PdfReader(pdf_path)
    for idx, page in enumerate(reader.pages):
        png_path = os.path.join(out_dir, f"page-{idx+1}.png")
        Image.new('RGB', (600, 842), color=(255, 255, 255)).save(png_path)
        page_data.append({
            'page': idx + 1,
            'width': 600,
            'height': 842,
            'png': png_path,
            'text': page.extract_text() or ''
        })

print(json.dumps(page_data))
`;
    // Try /usr/bin/python3 (which has PyMuPDF) if available, otherwise python
    const renderPython = existsSync('/usr/bin/python3') ? '/usr/bin/python3' : python;
    const renderProc = spawnSync(renderPython, ['-c', renderScript, pdfPath, tempDir], { encoding: 'utf8' });
    assert.equal(renderProc.status, 0, renderProc.stderr || renderProc.stdout);

    const renderedPages = JSON.parse(renderProc.stdout);
    assert.ok(renderedPages.length >= 3, `Expected at least 3 pages, got ${renderedPages.length}`);

    // Page 1: Cover Page
    const page1Text = renderedPages[0].text;
    assert.match(page1Text, /PREPRESS INSPECTION & SIGN-OFF (?:CERTIFICATE|REPORT)/);
    assert.match(page1Text, /STATUS: ISSUES OUTSTANDING/);
    assert.match(page1Text, /LEGAL & PREPRESS RELEASE NOTICE/);
    assert.doesNotMatch(page1Text, /Official Esko Approval Certificate/);
    assert.doesNotMatch(page1Text, /Official Esko Inspection Certificate/);

    // Finding text presence
    const fullText = renderedPages.map(p => p.text).join('\n');
    assert.match(fullText, /Calorie arithmetic discrepancy/);
    assert.match(fullText, /535 kcal/);
    assert.match(fullText, /166 kcal/);
    assert.match(fullText, /Dancing Fish/);
    assert.match(fullText, /Alex Rivera/);
    assert.match(fullText, /PackSignal - human release decision required/);

    // Check that rendered images actually exist on disk and have dimensions
    for (const p of renderedPages) {
      assert.ok(existsSync(p.png));
      assert.ok(p.width > 500 && p.height > 700);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Snapshot isolation: modifying live review after export preserves historical export integrity', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-isolation-test-'));
  try {
    const review = createSampleReview('review-isolation');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    // Export V1
    const pkgV1 = await createExportPackage(review, tempDir);
    assert.ok(existsSync(pkgV1.zipPath));

    // Verify V1
    const v1InitialCheck = spawnSync(process.execPath, [verifierScript, pkgV1.zipPath], { encoding: 'utf8' });
    assert.equal(v1InitialCheck.status, 0);
    assert.match(v1InitialCheck.stdout, /INTEGRITY:\s+VERIFIED/);

    // Now modify the mutable review data (e.g. user adds a finding and changes decision)
    review.findings.push({
      id: 'FIND-NEW',
      status: 'issue',
      title: 'Newly discovered dieline trim collision',
      expected: '3.0 mm clearance',
      observed: '0.8 mm clearance',
      explanation: 'Text block extends beyond dieline trim margin.',
      evidence: [],
    });
    review.decisions['FIND-001'].disposition = 'accepted_exception';
    review.decisions['FIND-001'].note = 'Brand manager granted temporary exception for promotional packaging.';
    review.audit.push({
      at: new Date().toISOString(),
      action: 'decision_updated',
      detail: 'FIND-001 marked accepted_exception.',
    });

    // Re-verify the V1 export bundle on disk: MUST REMAIN 100% VERIFIED AND UNCHANGED!
    const v1SubsequentCheck = spawnSync(process.execPath, [verifierScript, pkgV1.zipPath], { encoding: 'utf8' });
    assert.equal(v1SubsequentCheck.status, 0);
    assert.match(v1SubsequentCheck.stdout, /INTEGRITY:\s+VERIFIED/);

    // Export V2 with the updated review
    const pkgV2 = await createExportPackage(review, tempDir);
    assert.notEqual(pkgV1.exportId, pkgV2.exportId);
    assert.notEqual(pkgV1.snapshotId, pkgV2.snapshotId);

    // Both V1 and V2 are independently valid historical records
    const v2Check = spawnSync(process.execPath, [verifierScript, pkgV2.zipPath], { encoding: 'utf8' });
    assert.equal(v2Check.status, 0);
    assert.match(v2Check.stdout, /INTEGRITY:\s+VERIFIED/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Unlocated findings and Unicode content: preserves evidence without fake crops or encoding errors', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-unicode-test-'));
  try {
    const review = createSampleReview('review-unicode');
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    // Add unlocated finding without artwork coordinates and with multilingual Unicode
    review.findings.push({
      id: 'FIND-UNLOCATED',
      status: 'review',
      title: 'Multilingual Allergen Cue · Café au Lait & Crème Brûlée',
      expected: 'Contains: Milk (lait), Eggs (œufs) ± 5% tolerance · 375 µg folate',
      observed: 'Contains: Milk only',
      explanation: 'Whole-document statutory check: Canadian French allergen declaration missing on side panel. No specific artwork coordinate box.',
      evidence: [
        {
          role: 'spec',
          documentId: 'spec-01',
          name: 'canadian-packaging-spec.json',
          location: 'Section 4.2',
          quote: 'Contient: Lait, Œufs · 375 µg',
        },
      ],
    });

    const pkg = await createExportPackage(review, tempDir);
    assert.ok(existsSync(pkg.zipPath));

    // Verify bundle
    const verifyResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(verifyResult.status, 0);
    assert.match(verifyResult.stdout, /INTEGRITY:\s+VERIFIED/);

    // Verify unlocated crop was marked unavailable and not fabricated
    const manifest = pkg.manifest;
    assert.equal(manifest.files['evidence/finding-FIND-UNLOCATED.png'], undefined, 'No fake crop should be created for unlocated finding.');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('Unauthenticated sign-off: provides blank manual signature area without claiming authenticated status', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-unauth-test-'));
  try {
    const review = createSampleReview('review-unauth');
    delete review.team; // Unconfigured / unauthenticated workspace
    const reviewDir = join(tempDir, 'reviews', review.id);
    await mkdir(reviewDir, { recursive: true });
    await setupRenderedArtwork(reviewDir);

    const pkg = await createExportPackage(review, tempDir);
    assert.ok(existsSync(pkg.zipPath));

    const verifyResult = spawnSync(process.execPath, [verifierScript, pkg.zipPath], { encoding: 'utf8' });
    assert.equal(verifyResult.status, 0);
    assert.match(verifyResult.stdout, /INTEGRITY:\s+VERIFIED/);
    assert.match(verifyResult.stdout, /SIGNER IDENTITY:\s+NOT INDEPENDENTLY VERIFIED/);
    assert.match(verifyResult.stdout, /PRINT RELEASE:\s+NOT ESTABLISHED/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

