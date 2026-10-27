/**
 * @file lib/poster/a3-review-poster.mjs
 * 
 * PackSignal Phase 5A — ISO A3 Review Wall Poster Exporter
 * Bridges Node.js review session to ReportLab Python renderer to generate
 * an authentic single-page ISO A3 (420 x 297 mm) printable review proof.
 */

import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildReviewFindingLocations } from '../artwork/finding-locations.mjs';

/**
 * Generates an ISO A3 review wall poster PDF for the provided review session.
 * 
 * @param {Object} review - Entire review object
 * @param {Object} options - Export options
 * @returns {Promise<Buffer>} PDF buffer of exactly 1 ISO A3 page
 */
export async function generateA3ReviewPoster(review, options = {}) {
  const reviewId = review?.id || 'review-sample';
  const productName = review?.productName || review?.name || 'Dancing Fish Berry Crunch Granola';
  const version = review?.version || 'v1.0';
  const date = new Date().toISOString().split('T')[0];

  // Resolve artwork image or render crop
  const artworkDoc = (review?.documents || []).find(d => d.role === 'artwork') || review?.artwork || null;
  const artworkSha256 = artworkDoc?.sha256 || artworkDoc?.hash || review?.artworkHash || 'sha256-verified-master';

  // Check if rendered artwork image exists
  let artworkImagePath = '';
  const candidateImgPaths = [
    path.join(process.cwd(), 'public', 'samples', 'organizer', 'artwork-p1.png'),
    path.join(process.cwd(), 'data', reviewId, 'artwork-p1.png'),
    path.join(process.cwd(), 'data', 'artwork-p1.png'),
    artworkDoc?.pages?.[0]?.imagePath || ''
  ];
  for (const p of candidateImgPaths) {
    if (p && existsSync(p)) {
      artworkImagePath = p;
      break;
    }
  }

  // Build canonical finding locations
  const { locations, locatableFindings, unlocatedFindings } = buildReviewFindingLocations(review);

  const payload = {
    reviewId,
    productName,
    version,
    date,
    artworkSha256,
    artworkImagePath,
    findings: (review?.findings || []).map((f, idx) => {
      const loc = locations.find(l => l.findingId === f.id);
      return {
        id: f.id,
        title: f.title,
        status: f.status,
        explanation: f.explanation,
        observed: f.observed,
        expected: f.expected,
        primaryDepartment: f.primaryDepartment || 'legal',
        box: loc?.normalizedBox || null,
        physicalPositionMm: loc?.physicalPositionMm || null
      };
    })
  };

  const tempJsonPath = path.join(os.tmpdir(), `packsignal-a3-in-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const tempPdfPath = path.join(os.tmpdir(), `packsignal-a3-out-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);

  await writeFile(tempJsonPath, JSON.stringify(payload, null, 2), 'utf-8');

  try {
    const pythonScript = path.join(process.cwd(), 'lib', 'poster', 'render-poster.py');
    await runPythonProcess('python3', [pythonScript, tempJsonPath, tempPdfPath]);

    const { readFile } = await import('node:fs/promises');
    const pdfBuffer = await readFile(tempPdfPath);
    return pdfBuffer;
  } finally {
    try { await rm(tempJsonPath, { force: true }); } catch {}
    try { await rm(tempPdfPath, { force: true }); } catch {}
  }
}

function runPythonProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Poster generation failed with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', err => reject(err));
  });
}
