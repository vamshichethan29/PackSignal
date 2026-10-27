/**
 * PackSignal Preflight Evaluator (lib/preflight/evaluator.mjs)
 * Executes and coordinates PDF Visibility & Typography Preflight screening.
 */

import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapCheckToFinding } from './result-mapper.mjs';
import { summarizeCoverage } from './coverage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..', '..');
const python = process.env.PYTHON_BIN || 'python3';

/**
 * Execute Python preflight runner synchronously.
 */
export function executePreflightRunner(pdfPath, options = {}) {
  try {
    const runnerScript = join(root, 'lib', 'pdf-preflight', 'runner.py');
    const res = spawnSync(python, [runnerScript, pdfPath, JSON.stringify(options)], {
      encoding: 'utf8',
      maxBuffer: 25 * 1024 * 1024,
      timeout: 30000,
      env: {
        ...process.env,
        PYTHONPATH: [join(root, 'lib', 'pdf-preflight'), process.env.PYTHONPATH].filter(Boolean).join(':')
      }
    });

    if (res.error || res.status !== 0) {
      return {
        schema: 'packsignal-pdf-preflight/v1',
        error: res.stderr || res.error?.message || 'Preflight process failed',
        checks: [],
        findings: [],
        coverage: { parser: 'error' },
        limitations: ['Preflight runner process failed to complete.']
      };
    }

    return JSON.parse(res.stdout);
  } catch (err) {
    return {
      schema: 'packsignal-pdf-preflight/v1',
      error: err.message,
      checks: [],
      findings: [],
      coverage: { parser: 'error' },
      limitations: [err.message]
    };
  }
}

/**
 * Evaluates preflight screening for a review and its artwork document.
 */
export function evaluatePdfPreflight(review, options = {}) {
  const docs = review.documents || [];
  const artworkDoc = docs.find(d => d.role === 'artwork');
  if (!artworkDoc) {
    return {
      schema: 'packsignal-pdf-preflight/v1',
      reviewId: review.id || '',
      artworkHash: '',
      screeningVersion: '1.0.0',
      checks: [],
      findings: [],
      coverage: { error: 'No artwork document present in review' },
      limitations: ['Prepress screening requires an uploaded artwork document.']
    };
  }

  // Resolve artwork PDF file path
  // If artwork has a path or review storage path
  let pdfPath = options.artworkPath || artworkDoc.path;
  if (!pdfPath && review.storagePath && artworkDoc.name) {
    pdfPath = join(review.storagePath, artworkDoc.name);
  }

  // Default thresholds with provenance
  const runnerOptions = {
    reviewId: review.id || '',
    documentId: artworkDoc.id || 'artwork-pdf',
    textHeightThresholdMm: options.textHeightThresholdMm ?? 1.6,
    cutClearanceMm: options.cutClearanceMm ?? 2.0,
    creaseClearanceMm: options.creaseClearanceMm ?? 1.5,
    thresholdOrigin: options.thresholdOrigin || (options.companyRuleId ? 'company_rule' : 'reviewer_defined'),
    companyRuleId: options.companyRuleId || null,
    parser: options.parser || null,
    dxfLines: []
  };

  // If a dieline document with vector lines exists, pass DXF cut/crease lines
  const dielineDoc = docs.find(d => d.role === 'dieline');
  if (dielineDoc && Array.isArray(dielineDoc.vectorLines) && review.dielineAlignment?.isConfirmed) {
    // Collect transformed dieline segments
    const transform = review.dielineAlignment;
    for (const line of dielineDoc.vectorLines) {
      if (line.points && line.points.length >= 2) {
        // Line points in dieline document
        const p1 = line.points[0];
        const p2 = line.points[1];
        runnerOptions.dxfLines.push({
          p1: [p1[0], p1[1]],
          p2: [p2[0], p2[1]],
          type: line.kind === 'cut' ? 'CUT / TRIM' : line.kind === 'crease' ? 'CREASE / FOLD' : 'UNCLASSIFIED LINE',
          source: `DXF dieline (${line.layer || 'linework'})`
        });
      }
    }
  }

  // Run python preflight engine
  let rawResult;
  if (pdfPath) {
    rawResult = executePreflightRunner(pdfPath, runnerOptions);
  } else {
    rawResult = {
      schema: 'packsignal-pdf-preflight/v1',
      checks: [],
      findings: [],
      coverage: { parser: 'unavailable' },
      limitations: ['Artwork PDF file path was not accessible on server filesystem.']
    };
  }

  const rawChecks = rawResult.checks || [];
  const rawFindings = rawResult.findings || [];

  // Map preflight findings to PackSignal finding objects
  const mappedFindings = [];
  for (const check of rawFindings) {
    mappedFindings.push(mapCheckToFinding(check, artworkDoc, review.id));
  }

  const coverage = summarizeCoverage(rawChecks, rawResult.coverage || {});

  return {
    schema: 'packsignal-pdf-preflight/v1',
    reviewId: review.id || '',
    artworkHash: rawResult.artworkHash || artworkDoc.sha256 || '',
    screeningVersion: '1.0.0',
    checks: rawChecks,
    findings: mappedFindings,
    coverage,
    limitations: rawResult.limitations || [
      'These results are limited technical prepress screening observations.',
      'They do not establish legal labeling compliance or authorize print release.'
    ]
  };
}
