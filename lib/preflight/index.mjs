/**
 * PackSignal PDF Visibility & Typography Preflight Module (lib/preflight/index.mjs)
 * Main entry point for conservative prepress screening:
 * - PVP-001: Rendered Text Visibility
 * - PVP-002: Hidden / Overlapping Text
 * - PVP-003: Estimated Text Height
 * - PVP-004: Dieline / Trim Clearance
 */

import { evaluatePdfPreflight } from './evaluator.mjs';

export { mapCheckToFinding, SCREENING_OUTCOMES, CHECK_CATEGORIES } from './result-mapper.mjs';
export { summarizeCoverage } from './coverage.mjs';

/**
 * Main screening entry point:
 * runPdfPreflight(review, options)
 *
 * @param {object} review - PackSignal review object
 * @param {object} options - Thresholds, parser preferences, and alignment
 * @returns {object} Standardized prepress screening result
 */
export function runPdfPreflight(review, options = {}) {
  return evaluatePdfPreflight(review, options);
}
