/**
 * PackSignal Native PDF Preflight & Structural Inspection Layer (lib/pdf-preflight.mjs)
 * Phase 3 primary integration module.
 * 
 * Safely invokes lib/pdf-inspector.py via argument arrays without shell interpolation.
 * Produces structured inspection JSON, maps technical observations to PackSignal review findings,
 * caches results by document hash & options, and maintains robust fallbacks.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const python = process.env.PYTHON_BIN || 'python3';

const id = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 14);

// In-memory inspection cache
const inspectionCache = new Map();

/**
 * Execute native PDF structural inspector (lib/pdf-inspector.py) synchronously.
 * 
 * @param {string} pdfPath - Absolute path to PDF file
 * @param {Object} options - Inspection options (thresholds, rules, dieline segments)
 * @returns {Object} Structured inspection report
 */
export function inspectPdf(pdfPath, options = {}) {
  if (!pdfPath || !existsSync(pdfPath)) {
    return {
      schemaVersion: 'packsignal-pdf-inspector/v1',
      status: 'error',
      error: `PDF document not found: ${pdfPath}`,
      pages: [],
      textSpans: [],
      drawingOperations: [],
      embeddedImages: [],
      optionalContent: [],
      observations: [],
      capabilities: { nativePdfInspection: false },
      warnings: ['File does not exist on filesystem.'],
      limitations: ['Inspection requires an accessible PDF file.']
    };
  }

  // Compute cache key from file SHA-256 and options
  let fileHash = '';
  try {
    const buf = readFileSync(pdfPath);
    fileHash = createHash('sha256').update(buf).digest('hex');
  } catch (err) {
    fileHash = pdfPath;
  }

  const cacheKey = `${fileHash}:${JSON.stringify(options)}`;
  if (inspectionCache.has(cacheKey)) {
    return inspectionCache.get(cacheKey);
  }

  const inspectorScript = join(root, 'lib', 'pdf-inspector.py');
  const safeArgs = [
    inspectorScript,
    '--input', pdfPath,
    '--options', JSON.stringify(options)
  ];

  try {
    const res = spawnSync(python, safeArgs, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 45000,
      env: {
        ...process.env,
        PYTHONPATH: [join(root, 'lib'), process.env.PYTHONPATH].filter(Boolean).join(':')
      }
    });

    if (res.error || res.status !== 0) {
      const errMsg = res.stderr || res.error?.message || 'PDF inspector process failed';
      const fallbackReport = {
        schemaVersion: 'packsignal-pdf-inspector/v1',
        status: 'error',
        error: errMsg,
        documentHash: fileHash,
        pages: [],
        textSpans: [],
        drawingOperations: [],
        embeddedImages: [],
        optionalContent: [],
        observations: [],
        capabilities: { nativePdfInspection: false },
        warnings: [errMsg],
        limitations: ['PDF inspector process terminated with error; fallback to standard text extraction.']
      };
      return fallbackReport;
    }

    const parsed = JSON.parse(res.stdout);
    inspectionCache.set(cacheKey, parsed);
    return parsed;
  } catch (err) {
    return {
      schemaVersion: 'packsignal-pdf-inspector/v1',
      status: 'error',
      error: err.message,
      documentHash: fileHash,
      pages: [],
      textSpans: [],
      drawingOperations: [],
      embeddedImages: [],
      optionalContent: [],
      observations: [],
      capabilities: { nativePdfInspection: false },
      warnings: [err.message],
      limitations: [err.message]
    };
  }
}

/**
 * Maps a single technical observation to a PackSignal finding object.
 */
export function mapObservationToFinding(obs, artworkDoc, reviewId = '') {
  const checkId = obs.checkId || 'PVP-000';
  const page = obs.page || 1;
  const outcome = obs.screeningOutcome || 'REVIEW_REQUIRED';

  let status = 'review';
  let severity = 'minor';

  if (outcome === 'NO_CONCERN_DETECTED') {
    status = 'match';
    severity = 'info';
  } else if (outcome === 'UNABLE_TO_EVALUATE') {
    status = 'unable';
    severity = 'minor';
  } else if (outcome === 'SCREENING_WARNING') {
    status = 'review';
    if (obs.title?.includes('Crosses Cut Line') || obs.classification === 'NONRENDERING_TEXT') {
      severity = 'major';
    }
  }

  // Stable finding key
  const regionSig = Array.isArray(obs.region)
    ? obs.region.map(n => Math.round(n * 1000)).join('_')
    : 'noregion';
  const titleSlug = (obs.title || 'finding')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 32);

  const findingKey = `pdf-preflight:${obs.checkId || 'check'}:${page}:${regionSig}:${titleSlug}`;
  const findingId = id(findingKey);

  const evidenceItem = {
    documentId: artworkDoc?.id || 'artwork-pdf',
    name: artworkDoc?.name || 'Artwork PDF',
    role: 'artwork',
    page,
    box: Array.isArray(obs.region) && obs.region.length === 4 ? obs.region : null,
    quote: obs.explanation || obs.title || '',
    location: `Page ${page} · ${obs.checkId || 'Preflight'}`
  };

  return {
    id: findingId,
    key: findingKey,
    title: `[PREPRESS SCREENING] ${obs.title || `Preflight Check (${checkId})`}`,
    status,
    severity,
    expected: obs.threshold ? `${obs.threshold} ${obs.measurementUnit || ''}` : 'Prepress Screening Threshold',
    observed: obs.measuredValue != null ? `${obs.measuredValue} ${obs.measurementUnit || ''}` : obs.classification || '',
    difference: obs.threshold ? `Screening setting: ${obs.threshold}` : null,
    unit: obs.measurementUnit || null,
    measuredValue: obs.measuredValue ?? null,
    requiredValue: obs.threshold ?? null,
    measurementMethod: obs.method || 'native_pdf_inspection',
    explanation: obs.explanation || '',
    verificationLimitations: (obs.limitations || []).join(' '),
    reviewerAction: obs.reviewerAction || 'Inspect rendered artwork region in 2D viewer.',
    rule: {
      id: obs.sourceRuleId || obs.checkId || 'PREPRESS-RULE',
      source: `PackSignal Prepress Screening (${obs.thresholdOrigin || 'reviewer_defined'})`,
      text: obs.title || 'Preflight structural check.',
      thresholdOrigin: obs.thresholdOrigin || 'reviewer_defined',
      citation: obs.thresholdOrigin ? `Threshold Provenance: ${obs.thresholdOrigin}` : null
    },
    evidence: [evidenceItem],
    category: obs.checkId === 'PVP-001' ? 'visibility'
      : obs.checkId === 'PVP-002' ? 'overlap'
      : obs.checkId === 'PVP-003' ? 'typography'
      : obs.checkId === 'PVP-004' ? 'clearance'
      : obs.checkId === 'PVP-005' ? 'allergens'
      : obs.checkId === 'PVP-006' ? 'images'
      : obs.checkId === 'PVP-007' ? 'colors'
      : obs.checkId === 'PVP-008' ? 'layers'
      : 'preflight',
    check: obs.checkId,
    method: 'pdf_preflight_screening',
    observation: obs
  };
}

/**
 * High-level evaluator that runs pdf-inspector on review artwork,
 * updates review findings, and returns the comprehensive preflight model.
 */
export function evaluatePdfPreflight(review, options = {}) {
  const docs = review.documents || [];
  const artworkDoc = docs.find(d => d.role === 'artwork');
  if (!artworkDoc) {
    return {
      schemaVersion: 'packsignal-pdf-inspector/v1',
      reviewId: review.id || '',
      artworkHash: '',
      inspectorVersion: '3.0.0',
      pages: [],
      textSpans: [],
      drawingOperations: [],
      embeddedImages: [],
      optionalContent: [],
      observations: [],
      findings: [],
      coverage: { error: 'No artwork document present in review' },
      limitations: ['Prepress screening requires an uploaded artwork document.']
    };
  }

  // Resolve artwork PDF file path
  let pdfPath = options.artworkPath || artworkDoc.path;
  if (!pdfPath && review.storagePath && artworkDoc.name) {
    pdfPath = join(review.storagePath, artworkDoc.name);
  }

  // Fallback to samples if running with sample review
  if (!pdfPath && review.sample === 'organizer') {
    pdfPath = join(root, 'samples', 'organizer', 'DancingFish_Granola_Berry_US_Carton.pdf');
  }

  // Run native PDF inspector
  const inspectionResult = inspectPdf(pdfPath, {
    minFontSizePt: options.minFontSizePt ?? options.textHeightThresholdMm ?? 6.0,
    textHeightThresholdMm: options.textHeightThresholdMm ?? 1.6,
    minPpi: options.minPpi ?? 300.0,
    cutClearanceMm: options.cutClearanceMm ?? 2.0,
    creaseClearanceMm: options.creaseClearanceMm ?? 1.5,
    thresholdOrigin: options.thresholdOrigin || (options.companyRuleId ? 'company_rule' : 'reviewer_defined'),
    rules: review.rules || review.rulebookLedger?.rules || []
  });

  const rawObservations = inspectionResult.observations || [];
  const mappedFindings = [];

  for (const obs of rawObservations) {
    mappedFindings.push(mapObservationToFinding(obs, artworkDoc, review.id));
  }

  // Calculate coverage summary
  const coverage = {
    parser: inspectionResult.parserVersion || 'PyMuPDF',
    totalSpansInspected: (inspectionResult.textSpans || []).length,
    totalDrawingsInspected: (inspectionResult.drawingOperations || []).length,
    totalImagesInspected: (inspectionResult.embeddedImages || []).length,
    totalLayersInspected: (inspectionResult.optionalContent || []).length,
    totalChecks: rawObservations.length,
    licenseNotice: 'PyMuPDF AGPL-3.0 / Commercial license. Standard pypdfium2 extraction preserved.',
  };

  return {
    schemaVersion: inspectionResult.schemaVersion || 'packsignal-pdf-inspector/v1',
    schema: 'packsignal-pdf-preflight/v1', // Maintain backwards compatibility with v1
    reviewId: review.id || '',
    artworkHash: inspectionResult.documentHash || artworkDoc.sha256 || '',
    inspectorVersion: inspectionResult.inspectorVersion || '3.0.0',
    screeningVersion: '3.0.0',
    pages: inspectionResult.pages || [],
    textSpans: inspectionResult.textSpans || [],
    drawingOperations: inspectionResult.drawingOperations || [],
    embeddedImages: inspectionResult.embeddedImages || [],
    optionalContent: inspectionResult.optionalContent || [],
    colorSpaces: inspectionResult.colorSpaces || {},
    observations: rawObservations,
    checks: rawObservations,
    findings: mappedFindings,
    coverage,
    capabilities: inspectionResult.capabilities || {},
    warnings: inspectionResult.warnings || [],
    limitations: inspectionResult.limitations || [
      'These findings are technical preflight screening observations.',
      'They do not establish legal labeling compliance or authorize print release.'
    ]
  };
}
