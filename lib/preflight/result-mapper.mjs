/**
 * PackSignal Result Mapper for Preflight Screening (lib/preflight/result-mapper.mjs)
 * Maps conservative PDF preflight screening outcomes to PackSignal's finding schema:
 * - SCREENING_WARNING -> status: 'review' (or 'issue' if critical cut intersection)
 * - REVIEW_REQUIRED -> status: 'review'
 * - UNABLE_TO_EVALUATE -> status: 'unable'
 * - NO_CONCERN_DETECTED -> status: 'match'
 * Generates stable finding keys for repeatability across reruns.
 */

import { createHash } from 'node:crypto';

const id = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 14);

export const SCREENING_OUTCOMES = {
  NO_CONCERN_DETECTED: 'NO_CONCERN_DETECTED',
  SCREENING_WARNING: 'SCREENING_WARNING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  UNABLE_TO_EVALUATE: 'UNABLE_TO_EVALUATE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

export const CHECK_CATEGORIES = {
  'PVP-001': 'visibility',
  'PVP-002': 'overlap',
  'PVP-003': 'text_height',
  'PVP-004': 'clearance',
};

/**
 * Maps a single raw preflight check object into a PackSignal review finding.
 */
export function mapCheckToFinding(check, artworkDoc, reviewId = '') {
  const checkId = check.checkId || 'PVP-000';
  const category = CHECK_CATEGORIES[checkId] || 'preflight';
  const page = check.page || 1;
  const outcome = check.screeningOutcome || SCREENING_OUTCOMES.REVIEW_REQUIRED;

  // Map outcome to PackSignal status
  let status = 'review';
  let severity = 'minor';

  if (outcome === SCREENING_OUTCOMES.NO_CONCERN_DETECTED) {
    status = 'match';
    severity = 'info';
  } else if (outcome === SCREENING_OUTCOMES.UNABLE_TO_EVALUATE) {
    status = 'unable';
    severity = 'minor';
  } else if (outcome === SCREENING_OUTCOMES.SCREENING_WARNING) {
    status = 'review';
    // If text crosses cut line directly, mark as major review concern
    if (check.title?.includes('Crosses Cut Line') || check.technicalState === 'PDF_NONRENDERING_TEXT') {
      severity = 'major';
    }
  }

  // Generate stable deterministic finding key
  const boxSig = Array.isArray(check.evidenceBox)
    ? check.evidenceBox.map(n => Math.round(n * 1000)).join('_')
    : 'nobox';
  const titleSlug = (check.title || 'finding')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 32);

  const findingKey = `pdf-preflight:${category}:${page}:${boxSig}:${titleSlug}`;
  const findingId = id(findingKey);

  // Evidence region on artwork document
  const evidenceBox = Array.isArray(check.evidenceBox) && check.evidenceBox.length === 4
    ? check.evidenceBox
    : null;

  const quote = check.observations
    ? (check.observations.length > 120 ? check.observations.slice(0, 117) + '…' : check.observations)
    : check.title;

  const evidenceItem = {
    documentId: artworkDoc?.id || 'artwork-pdf',
    name: artworkDoc?.name || 'Artwork PDF',
    role: 'artwork',
    page,
    box: evidenceBox,
    quote,
    location: `Page ${page}${evidenceBox ? ' · Located Vector Region' : ''}`
  };

  return {
    id: findingId,
    key: findingKey,
    title: `[PREPRESS SCREENING] ${check.title}`,
    status,
    severity,
    category,
    check: checkId,
    method: 'pdf_preflight_screening',
    expected: check.threshold || 'Prepress Screening Threshold',
    observed: check.measurement || check.observations || 'Prepress Screening Observation',
    difference: check.threshold ? `Screening setting: ${check.threshold}` : null,
    explanation: check.explanation || '',
    verificationLimitations: check.limitations || (
      'Prepress screening observation only. Does not certify legal typography, print-readiness, or press release.'
    ),
    rule: {
      id: check.sourceRuleId || `${checkId}-SCREENING`,
      source: `PackSignal Prepress Screening (${check.thresholdOrigin || 'reviewer_defined'})`,
      text: check.explanation || 'Prepress technical screening check.',
      thresholdOrigin: check.thresholdOrigin || 'reviewer_defined',
      citation: check.thresholdOrigin ? `Threshold Provenance: ${check.thresholdOrigin}` : null
    },
    evidence: [evidenceItem],
    preflight: {
      checkId: check.checkId,
      title: check.title,
      method: check.method,
      executionStatus: check.executionStatus,
      screeningOutcome: check.screeningOutcome,
      technicalState: check.technicalState || null,
      documentId: artworkDoc?.id,
      page,
      evidenceBox,
      observations: check.observations,
      measurement: check.measurement,
      threshold: check.threshold,
      thresholdOrigin: check.thresholdOrigin,
      sourceGeometry: check.sourceGeometry,
      explanation: check.explanation,
      limitations: check.limitations,
      suggestedReviewerAction: check.suggestedReviewerAction
    }
  };
}
