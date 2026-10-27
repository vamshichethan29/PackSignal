/**
 * PackSignal Physical Prepress — Bleed, Trim Safety & Crease Clearance Preflight
 * (lib/print/geometry-preflight.mjs)
 *
 * Implements E1.5, E1.6:
 * Enforces THREE distinct physical geometric checks:
 * 1. Bleed Extension (outward from trim to bleed boundary)
 * 2. Critical Content Safety Inset (inward from trim boundary)
 * 3. Crease / Fold Clearance (lateral distance from verified structural crease lines)
 */

import { getPressProfile } from './press-profiles.mjs';

export const GEOMETRY_SOURCE_AUTHORITY = {
  EXPLICIT_DXF_CAD: 'EXPLICIT_DXF_CAD',
  PDF_BOX_METRICS: 'PDF_BOX_METRICS',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  UNVERIFIED_ESTIMATE: 'UNVERIFIED_ESTIMATE',
};

/**
 * Evaluates Bleed Extension.
 * Background or edge-bleed elements must extend beyond the Trim boundary by the profile bleed requirement.
 */
export function evaluateBleedExtension({
  artworkBoxes = {},
  pressProfileId = 'ISO-OFFSET-COATED-300',
  dielineSource = GEOMETRY_SOURCE_AUTHORITY.PDF_BOX_METRICS,
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);
  const requiredBleedMm = profile.bleedRequirementMm ?? 3.0;

  // TrimBox vs BleedBox or MediaBox
  const { trimBox, bleedBox, mediaBox } = artworkBoxes;

  if (!trimBox || (!bleedBox && !mediaBox)) {
    return {
      status: 'unable',
      checkVerdict: 'BLEED_GEOMETRY_UNSPECIFIED',
      requiredBleedMm,
      measuredBleedMm: null,
      dielineSource,
      explanation: 'Artwork does not define explicit TrimBox and BleedBox PDF boundary boxes. Cannot verify physical bleed extension without dieline or trim metadata.',
    };
  }

  // Calculate bleed margins in mm (72 points = 25.4 mm => 1 pt = 0.352778 mm)
  const MM_PER_PT = 25.4 / 72;
  const outerBox = bleedBox || mediaBox;

  const leftBleedMm = Math.max(0, (trimBox.x1 - outerBox.x1) * MM_PER_PT);
  const bottomBleedMm = Math.max(0, (trimBox.y1 - outerBox.y1) * MM_PER_PT);
  const rightBleedMm = Math.max(0, (outerBox.x2 - trimBox.x2) * MM_PER_PT);
  const topBleedMm = Math.max(0, (outerBox.y2 - trimBox.y2) * MM_PER_PT);

  const minMeasuredBleed = Math.min(leftBleedMm, bottomBleedMm, rightBleedMm, topBleedMm);
  const roundedMinBleed = Math.round(minMeasuredBleed * 10) / 10;
  const passed = roundedMinBleed >= requiredBleedMm - 0.2; // 0.2mm tolerance for rounding

  return {
    status: passed ? 'match' : 'issue',
    verdict: passed ? 'BLEED_EXTENSION_SUFFICIENT' : 'BLEED_EXTENSION_DEFICIENT',
    checkVerdict: passed ? 'BLEED_PASS' : 'BLEED_DEFECT',
    requiredBleedMm,
    measuredBleedMm: roundedMinBleed,
    marginsMm: {
      left: Math.round(leftBleedMm * 10) / 10,
      right: Math.round(rightBleedMm * 10) / 10,
      top: Math.round(topBleedMm * 10) / 10,
      bottom: Math.round(bottomBleedMm * 10) / 10,
    },
    dielineSource,
    pressProfile: profile.profileId,
    explanation: passed
      ? `Bleed extension verified: Outer artwork extends ${roundedMinBleed} mm beyond trim boundary (meets approved ${profile.name} requirement of ≥ ${requiredBleedMm} mm).`
      : `Bleed extension defect: Measured artwork bleed is only ${roundedMinBleed} mm beyond trim. Required minimum is ${requiredBleedMm} mm for ${profile.name}. High risk of unprinted white substrate showing post-die-cutting.`,
  };
}

/**
 * Evaluates Critical Content Safety Inset.
 * Detects text, regulatory copy, or barcodes positioned too close to the trim cut line.
 */
export function evaluateCriticalContentSafety({
  textElements = [],
  trimBox = { x1: 0, y1: 0, x2: 100, y2: 100 },
  pressProfileId = 'ISO-OFFSET-COATED-300',
  dielineSource = GEOMETRY_SOURCE_AUTHORITY.PDF_BOX_METRICS,
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);
  const requiredSafetyInsetMm = profile.criticalTextSafetyInsetMm ?? 3.0;
  const MM_PER_PT = 25.4 / 72;

  const violations = [];

  for (const elem of textElements) {
    if (!elem.box) continue;
    // Calculate distance from element bounding box to nearest trim boundary
    // elem.box = [x1, y1, x2, y2]
    const distLeftMm = Math.max(0, (elem.box[0] - trimBox.x1) * MM_PER_PT);
    const distBottomMm = Math.max(0, (elem.box[1] - trimBox.y1) * MM_PER_PT);
    const distRightMm = Math.max(0, (trimBox.x2 - elem.box[2]) * MM_PER_PT);
    const distTopMm = Math.max(0, (trimBox.y2 - elem.box[3]) * MM_PER_PT);

    const minDistMm = Math.min(distLeftMm, distBottomMm, distRightMm, distTopMm);
    const roundedDist = Math.round(minDistMm * 10) / 10;

    if (roundedDist < requiredSafetyInsetMm) {
      violations.push({
        text: elem.text || 'Critical Text / Element',
        page: elem.page || 1,
        box: elem.box,
        measuredDistanceMm: roundedDist,
        requiredSafetyInsetMm,
        clearanceDeficitMm: Math.round((requiredSafetyInsetMm - roundedDist) * 10) / 10,
        nearestEdge: distLeftMm === minDistMm ? 'Left' : (distRightMm === minDistMm ? 'Right' : (distTopMm === minDistMm ? 'Top' : 'Bottom')),
      });
    }
  }

  const passed = violations.length === 0;

  return {
    status: passed ? 'match' : 'issue',
    verdict: passed ? 'TRIM_SAFETY_INSET_CLEARED' : 'CRITICAL_TEXT_TOO_CLOSE_TO_TRIM',
    checkVerdict: passed ? 'SAFETY_INSET_PASS' : 'SAFETY_INSET_DEFECT',
    requiredSafetyInsetMm,
    violations,
    dielineSource,
    pressProfile: profile.profileId,
    explanation: passed
      ? `Trim safety verified: All critical text and symbols maintain ≥ ${requiredSafetyInsetMm} mm inward clearance from die-cut trim lines.`
      : `Trim safety hazard: ${violations.length} critical text elements are within ${requiredSafetyInsetMm} mm of the die-cut trim boundary (e.g. "${violations[0]?.text}" at ${violations[0]?.measuredDistanceMm} mm from ${violations[0]?.nearestEdge} edge). Guillotine drift or die shift may trim off critical text.`,
  };
}

/**
 * Evaluates Crease / Fold Line Clearance.
 * Separate from trim safety: checks whether critical copy crosses or abuts a folding crease line.
 */
export function evaluateCreaseClearance({
  creaseLines = [],
  textElements = [],
  pressProfileId = 'ISO-OFFSET-COATED-300',
  dielineSource = GEOMETRY_SOURCE_AUTHORITY.EXPLICIT_DXF_CAD,
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);
  const requiredClearanceMm = profile.creaseClearanceMm ?? 1.5;
  const MM_PER_PT = 25.4 / 72;

  if (creaseLines.length === 0) {
    return {
      status: 'review',
      verdict: 'NO_CREASE_LINES_DEFINED',
      checkVerdict: 'CREASE_GEOMETRY_UNAVAILABLE',
      dielineSource,
      requiredClearanceMm,
      explanation: 'No structural crease lines available in dieline layers. Crease clearance cannot be determined without verified structural CAD/DXF crease paths.',
    };
  }

  const violations = [];

  for (const elem of textElements) {
    if (!elem.box) continue;
    // Check distance to each crease segment
    for (const crease of creaseLines) {
      // crease: { x1, y1, x2, y2, panelName }
      const [bx1, by1, bx2, by2] = elem.box;

      const minCx = Math.min(crease.x1, crease.x2);
      const maxCx = Math.max(crease.x1, crease.x2);
      const minCy = Math.min(crease.y1, crease.y2);
      const maxCy = Math.max(crease.y1, crease.y2);

      let distPt = 0;
      if (maxCx >= bx1 && minCx <= bx2 && maxCy >= by1 && minCy <= by2) {
        distPt = 0;
      } else {
        const corners = [
          [bx1, by1], [bx2, by1], [bx1, by2], [bx2, by2],
          [(bx1 + bx2) / 2, (by1 + by2) / 2],
        ];
        const dx = crease.x2 - crease.x1;
        const dy = crease.y2 - crease.y1;
        const lenSq = dx * dx + dy * dy;

        let minDist = Infinity;
        for (const [px, py] of corners) {
          let d = 0;
          if (lenSq === 0) {
            d = Math.hypot(px - crease.x1, py - crease.y1);
          } else {
            const t = Math.max(0, Math.min(1, ((px - crease.x1) * dx + (py - crease.y1) * dy) / lenSq));
            d = Math.hypot(px - (crease.x1 + t * dx), py - (crease.y1 + t * dy));
          }
          if (d < minDist) minDist = d;
        }
        distPt = minDist;
      }

      const distMm = distPt * MM_PER_PT;
      const roundedDist = Math.round(distMm * 10) / 10;

      if (roundedDist < requiredClearanceMm) {
        violations.push({
          text: elem.text || 'Artwork Element',
          box: elem.box,
          page: elem.page || 1,
          creaseName: crease.panelName || 'Score / Crease Rule',
          measuredDistanceMm: roundedDist,
          requiredClearanceMm,
        });
      }
    }
  }

  const passed = violations.length === 0;

  return {
    status: passed ? 'match' : 'issue',
    verdict: passed ? 'CREASE_CLEARANCE_SUFFICIENT' : 'TEXT_OVERLAPS_CREASE_LINE',
    checkVerdict: passed ? 'CREASE_PASS' : 'CREASE_DEFECT',
    requiredClearanceMm,
    violations,
    dielineSource,
    pressProfile: profile.profileId,
    explanation: passed
      ? `Crease clearance verified: Artwork elements maintain ≥ ${requiredClearanceMm} mm clearance from structural folding scores.`
      : `Fold crease hazard: ${violations.length} artwork elements are too close to or cross structural score lines (measured ${violations[0]?.measuredDistanceMm} mm vs required ${requiredClearanceMm} mm for ${profile.name}). Fiber crack and ink flaking risk along score line.`,
  };
}
