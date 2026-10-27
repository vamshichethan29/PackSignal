/**
 * PackSignal Preflight Coverage Tracker (lib/preflight/coverage.mjs)
 * Summarizes screening coverage across PVP-001, PVP-002, PVP-003, and PVP-004.
 */

export function summarizeCoverage(checks = [], rawCoverage = {}) {
  const categories = {
    'PVP-001': { id: 'PVP-001', name: 'Rendered Text Visibility', checks: 0, warnings: 0, reviews: 0, matches: 0, unable: 0 },
    'PVP-002': { id: 'PVP-002', name: 'Hidden / Overlapping Text', checks: 0, warnings: 0, reviews: 0, matches: 0, unable: 0 },
    'PVP-003': { id: 'PVP-003', name: 'Estimated Text Height', checks: 0, warnings: 0, reviews: 0, matches: 0, unable: 0 },
    'PVP-004': { id: 'PVP-004', name: 'Dieline / Trim Clearance', checks: 0, warnings: 0, reviews: 0, matches: 0, unable: 0 },
  };

  const outcomes = {
    NO_CONCERN_DETECTED: 0,
    SCREENING_WARNING: 0,
    REVIEW_REQUIRED: 0,
    UNABLE_TO_EVALUATE: 0,
    NOT_APPLICABLE: 0,
  };

  for (const check of checks) {
    const outcome = check.screeningOutcome || 'REVIEW_REQUIRED';
    if (outcomes[outcome] !== undefined) outcomes[outcome]++;

    const cat = categories[check.checkId];
    if (cat) {
      cat.checks++;
      if (outcome === 'SCREENING_WARNING') cat.warnings++;
      else if (outcome === 'REVIEW_REQUIRED') cat.reviews++;
      else if (outcome === 'NO_CONCERN_DETECTED') cat.matches++;
      else if (outcome === 'UNABLE_TO_EVALUATE') cat.unable++;
    }
  }

  return {
    parser: rawCoverage.parser || 'unknown',
    parserVersion: rawCoverage.parserVersion || '',
    licenseNotice: rawCoverage.licenseNotice || '',
    capabilities: rawCoverage.capabilities || {},
    totalPages: rawCoverage.totalPages || 1,
    totalSpansInspected: rawCoverage.totalSpansInspected || 0,
    dielineSegmentsInspected: rawCoverage.dielineSegmentsInspected || 0,
    totalChecks: checks.length,
    outcomes,
    categories,
  };
}
