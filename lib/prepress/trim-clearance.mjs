/**
 * PackSignal Physical Prepress — Bleed Extension, Trim Safety & Crease Clearance
 * (lib/prepress/trim-clearance.mjs)
 *
 * Implements Upgrade #46 Phases 8, 9, 10, 11:
 * Three separate, deterministic geometry evaluations:
 * 1. Bleed Extension (outward from cut/trim line to outer bleed limit)
 * 2. Critical Content Trim Safety (inward from cut/trim line to live text/logos)
 * 3. Crease Clearance (lateral distance to structural score/crease lines)
 */

import { getPressProfile } from './press-profiles.mjs';
import { DIELINE_SOURCE_AUTHORITY, MM_PER_PT } from './dieline-geometry.mjs';

/**
 * Calculates shortest Euclidean distance from a 2D point [px, py] to a line segment [x1, y1] -> [x2, y2].
 */
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Calculates minimum distance from a bounding box [bx1, by1, bx2, by2] to a line segment.
 */
export function boxToSegmentDistance(box, segment) {
  const [bx1, by1, bx2, by2] = box;
  const { x1, y1, x2, y2 } = segment;

  // If segment intersects the interior of the box: distance is 0
  const minSegX = Math.min(x1, x2);
  const maxSegX = Math.max(x1, x2);
  const minSegY = Math.min(y1, y2);
  const maxSegY = Math.max(y1, y2);

  if (maxSegX >= bx1 && minSegX <= bx2 && maxSegY >= by1 && minSegY <= by2) {
    return 0;
  }

  // Sample 4 box corners and edge centers
  const samplePoints = [
    [bx1, by1], [bx2, by1], [bx1, by2], [bx2, by2],
    [(bx1 + bx2) / 2, by1], [(bx1 + bx2) / 2, by2],
    [bx1, (by1 + by2) / 2], [bx2, (by1 + by2) / 2],
  ];

  let minDist = Infinity;
  for (const [px, py] of samplePoints) {
    const d = pointToSegmentDistance(px, py, x1, y1, x2, y2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * CHECK A: Bleed Extension Evaluation
 * Verifies that background/edge artwork extends outward from the trim line by the profile requirement.
 */
export function evaluateBleedExtension({
  artworkBoxes = {},
  pressProfileId = 'ISO-OFFSET-COATED-300',
  dielineSource = DIELINE_SOURCE_AUTHORITY.INFERRED,
  outerArtworkBounds = null,
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);
  const requiredBleedMm = profile.bleedRequirementMm ?? profile.bleedExtensionMm ?? 3.0;

  const { trimBox, trim, bleedBox, bleed, mediaBox, media, cropBox, crop } = artworkBoxes;

  const effectiveTrimRaw = trimBox || trim || cropBox || crop;
  const effectiveOuterRaw = outerArtworkBounds || bleedBox || bleed || mediaBox || media;

  if (!effectiveTrimRaw) {
    return {
      status: 'unable',
      verdict: 'BLEED_GEOMETRY_UNSPECIFIED',
      checkVerdict: 'UNABLE',
      requiredBleedMm,
      measuredBleedMm: null,
      deficitMm: null,
      dielineSource,
      pressProfile: profile.profileId,
      marginsMm: null,
      explanation: 'Artwork does not define explicit TrimBox and BleedBox PDF boundary boxes. Cannot verify physical bleed extension without dieline or trim metadata.',
      verificationLimitations: 'Missing structural TrimBox and BleedBox page boundary headers.',
    };
  }

  // Extract rect coordinates
  function getRectBounds(rect, fallback) {
    if (!rect) return fallback || { x1: 0, y1: 0, x2: 100, y2: 100 };
    if (Array.isArray(rect)) return { x1: rect[0], y1: rect[1], x2: rect[2], y2: rect[3] };
    const x1 = rect.x0 !== undefined ? rect.x0 : (rect.x1 !== undefined ? rect.x1 : 0);
    const y1 = rect.y0 !== undefined ? rect.y0 : (rect.y1 !== undefined ? rect.y1 : 0);
    const x2 = rect.x1 !== undefined && rect.x0 !== undefined ? rect.x1 : (rect.x2 !== undefined ? rect.x2 : 100);
    const y2 = rect.y1 !== undefined && rect.y0 !== undefined ? rect.y1 : (rect.y2 !== undefined ? rect.y2 : 100);
    return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), x2: Math.max(x1, x2), y2: Math.max(y1, y2) };
  }

  const trimBounds = getRectBounds(effectiveTrimRaw);
  const outerBounds = getRectBounds(effectiveOuterRaw, trimBounds);

  // Compute margins in PDF points on all 4 sides (outward extension)
  const leftPt = Math.max(0, trimBounds.x1 - outerBounds.x1);
  const rightPt = Math.max(0, outerBounds.x2 - trimBounds.x2);
  const bottomPt = Math.max(0, trimBounds.y1 - outerBounds.y1);
  const topPt = Math.max(0, outerBounds.y2 - trimBounds.y2);

  const minMarginPt = Math.min(leftPt, rightPt, bottomPt, topPt);
  const measuredBleedMm = Math.round(minMarginPt * MM_PER_PT * 10) / 10;
  const deficitMm = Math.max(0, Math.round((requiredBleedMm - measuredBleedMm) * 10) / 10);

  const marginsMm = {
    left: Math.round(leftPt * MM_PER_PT * 10) / 10,
    right: Math.round(rightPt * MM_PER_PT * 10) / 10,
    bottom: Math.round(bottomPt * MM_PER_PT * 10) / 10,
    top: Math.round(topPt * MM_PER_PT * 10) / 10,
  };

  const passed = deficitMm === 0;

  return {
    status: passed ? 'match' : 'issue',
    verdict: passed ? 'BLEED_EXTENSION_SUFFICIENT' : 'BLEED_EXTENSION_DEFICIENT',
    checkVerdict: passed ? 'BLEED_EXTENSION_PASS' : 'BLEED_EXTENSION_DEFECT',
    requiredBleedMm,
    measuredBleedMm,
    deficitMm,
    marginsMm,
    marginBreakdownMm: marginsMm,
    dielineSource,
    pressProfile: profile.profileId,
    explanation: passed
      ? `Bleed extension verified: Background artwork extends ${measuredBleedMm} mm outward from cut boundaries (meets approved ${profile.name} requirement of ≥ ${requiredBleedMm} mm).`
      : `Insufficient bleed extension at cut boundary: Measured bleed of ${measuredBleedMm} mm fails the ${profile.name} requirement of ≥ ${requiredBleedMm} mm (deficiency: ${deficitMm} mm). Risk of white unprinted paper flashing after rotary die cutting.`,
    verificationLimitations: dielineSource === DIELINE_SOURCE_AUTHORITY.INFERRED
      ? 'Evaluated using PDF page box margins (TrimBox vs BleedBox/MediaBox). Verify against physical CAD dieline.'
      : 'Evaluated against verified die-cut boundary geometry.',
  };
}

/**
 * CHECK B: Critical Content Trim Safety Inset Evaluation
 * Verifies that mandatory text, logos, barcodes, and regulatory copy maintain required inward clearance.
 */
export function evaluateTrimSafety({
  elements = [],
  cutSegments = [],
  trimBox = null,
  pdfBoxes = {},
  pressProfileId = 'ISO-OFFSET-COATED-300',
  dielineSource = DIELINE_SOURCE_AUTHORITY.INFERRED,
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);
  const requiredSafetyInsetMm = profile.trimSafetyMm ?? profile.trimSafetyInsetMm ?? profile.criticalTextSafetyInsetMm ?? 3.0;

  let segments = cutSegments;
  if (!segments || segments.length === 0) {
    const effectiveTrim = trimBox || pdfBoxes.trimBox || pdfBoxes.trim || pdfBoxes.cropBox || pdfBoxes.crop;
    if (effectiveTrim) {
      const x1 = effectiveTrim.x0 !== undefined ? effectiveTrim.x0 : (effectiveTrim.x1 ?? effectiveTrim[0] ?? 0);
      const y1 = effectiveTrim.y0 !== undefined ? effectiveTrim.y0 : (effectiveTrim.y1 ?? effectiveTrim[1] ?? 0);
      const x2 = effectiveTrim.x1 !== undefined && effectiveTrim.x0 !== undefined ? effectiveTrim.x1 : (effectiveTrim.x2 ?? effectiveTrim[2] ?? 100);
      const y2 = effectiveTrim.y1 !== undefined && effectiveTrim.y0 !== undefined ? effectiveTrim.y1 : (effectiveTrim.y2 ?? effectiveTrim[3] ?? 100);

      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      segments = [
        { x1: minX, y1: minY, x2: maxX, y2: minY, edge: 'top' },
        { x1: maxX, y1: minY, x2: maxX, y2: maxY, edge: 'right' },
        { x1: maxX, y1: maxY, x2: minX, y2: maxY, edge: 'bottom' },
        { x1: minX, y1: maxY, x2: minX, y2: minY, edge: 'left' },
      ];
    }
  }

  if (!segments || segments.length === 0) {
    return {
      status: 'unable',
      verdict: 'TRIM_SAFETY_UNSPECIFIED_DIELINE',
      checkVerdict: 'UNABLE',
      requiredSafetyInsetMm,
      minObservedClearanceMm: null,
      violations: [],
      dielineSource,
      pressProfile: profile.profileId,
      explanation: 'No cutting path or TrimBox boundary available to evaluate critical content safety insets.',
    };
  }

  const violations = [];
  let minObservedClearanceMm = Infinity;

  for (const elem of elements) {
    if (!elem.box) continue;

    // Distinguish background fills / intentional bleed from critical text and logos
    const isBackground = elem.isBackground || elem.role === 'background_fill' || elem.role === 'bleed_fill';
    if (isBackground) continue;

    // Must be critical text, outlined text, logo, or barcode
    const isCritical = elem.isCritical !== false && (
      elem.text || elem.role === 'critical_text' || elem.role === 'logo' || elem.role === 'barcode' || elem.type === 'text'
    );
    if (!isCritical) continue;

    const [bx1, by1, bx2, by2] = elem.box;

    // Compute minimum distance to all cut segments
    let minElemDistPt = Infinity;
    let closestSegment = null;

    for (const seg of segments) {
      const dPt = boxToSegmentDistance([bx1, by1, bx2, by2], seg);
      if (dPt < minElemDistPt) {
        minElemDistPt = dPt;
        closestSegment = seg;
      }
    }

    const distMm = Math.round(minElemDistPt * MM_PER_PT * 10) / 10;
    if (distMm < minObservedClearanceMm) {
      minObservedClearanceMm = distMm;
    }

    if (distMm < requiredSafetyInsetMm) {
      const shortfallMm = Math.round((requiredSafetyInsetMm - distMm) * 10) / 10;
      violations.push({
        id: `trim-safety-${violations.length + 1}`,
        text: elem.text || elem.label || 'Critical Text / Logo',
        page: elem.page || 1,
        box: elem.box,
        measuredDistanceMm: distMm,
        requiredSafetyInsetMm,
        shortfallMm,
        clearanceDeficitMm: shortfallMm,
        nearestEdge: closestSegment?.edge || 'Trim Cut Line',
        objectType: elem.role || (elem.text ? 'Critical Live Text' : 'Brand Logo'),
        sourceAuthority: dielineSource,
      });
    }
  }

  if (minObservedClearanceMm === Infinity) {
    minObservedClearanceMm = requiredSafetyInsetMm; // No critical elements found near edge
  }

  const passed = violations.length === 0;

  return {
    status: passed ? 'match' : 'issue',
    verdict: passed ? 'TRIM_SAFETY_INSET_CLEARED' : 'CRITICAL_TEXT_TOO_CLOSE_TO_TRIM',
    checkVerdict: passed ? 'TRIM_SAFETY_PASS' : 'TRIM_SAFETY_DEFECT',
    requiredSafetyInsetMm,
    minObservedClearanceMm,
    violations,
    dielineSource,
    pressProfile: profile.profileId,
    explanation: passed
      ? `Trim safety verified: All critical live text and brand logos maintain ≥ ${requiredSafetyInsetMm} mm inward clearance from cutting edges (meets ${profile.name} requirement).`
      : `Critical text enters the trim safety zone: ${violations.length} critical element(s) violate the ${requiredSafetyInsetMm} mm inward safety margin for ${profile.name}. Closest element "${violations[0]?.text}" is only ${violations[0]?.measuredDistanceMm} mm from cut line (shortfall: ${violations[0]?.shortfallMm} mm). Cutting variation risks truncating text.`,
    verificationLimitations: dielineSource === DIELINE_SOURCE_AUTHORITY.INFERRED
      ? 'Trim boundaries inferred from PDF TrimBox. Check against physical die layout before cutting.'
      : 'Evaluated against verified die-cut vector contours.',
  };
}

/**
 * CHECK C: Crease / Fold Clearance Evaluation
 * Separates folding creases from outer cut lines.
 * Checks whether critical copy is positioned dangerously close to a structural score/fold.
 */
export function evaluateCreaseClearance({
  elements = [],
  creaseLines = [],
  pressProfileId = 'ISO-OFFSET-COATED-300',
  dielineSource = DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);
  const requiredClearanceMm = profile.creaseClearanceMm ?? 1.5;

  // If press profile specifies 0 mm crease clearance (e.g. cylindrical aluminum can decoration)
  if (requiredClearanceMm === 0.0) {
    return {
      status: 'not_applicable',
      verdict: 'CREASE_CHECK_NOT_APPLICABLE',
      checkVerdict: 'NOT_APPLICABLE',
      requiredClearanceMm: 0.0,
      dielineSource,
      pressProfile: profile.profileId,
      explanation: `${profile.name} uses seamless cylindrical or non-folding decoration; folding crease clearance does not apply.`,
    };
  }

  if (!creaseLines || creaseLines.length === 0) {
    return {
      status: 'review',
      verdict: 'NO_CREASE_LINES_DEFINED',
      checkVerdict: 'UNABLE',
      requiredClearanceMm,
      minObservedClearanceMm: null,
      minObservedMm: null,
      violations: [],
      dielineSource,
      pressProfile: profile.profileId,
      explanation: 'No structural crease lines defined in dieline layers. Cannot evaluate fold clearance without structural scores.',
      verificationLimitations: 'Requires CAD dieline with designated CREASE/SCORE layers.',
    };
  }

  const violations = [];
  let minObservedClearanceMm = Infinity;

  for (const elem of elements) {
    if (!elem.box) continue;

    // Graphics designed intentionally to span folds (e.g. background flood) are exempt
    if (elem.spansCreaseIntentional === true || elem.isBackground || elem.role === 'background_fill') {
      continue;
    }

    const isCritical = elem.isCritical !== false && (
      elem.text || elem.role === 'critical_text' || elem.role === 'logo' || elem.role === 'barcode' || elem.type === 'text'
    );
    if (!isCritical) continue;

    const [bx1, by1, bx2, by2] = elem.box;

    for (const crease of creaseLines) {
      const dPt = boxToSegmentDistance([bx1, by1, bx2, by2], crease);
      const distMm = Math.round(dPt * MM_PER_PT * 10) / 10;

      if (distMm < minObservedClearanceMm) {
        minObservedClearanceMm = distMm;
      }

      if (distMm < requiredClearanceMm) {
        const shortfallMm = Math.round((requiredClearanceMm - distMm) * 10) / 10;
        violations.push({
          id: `crease-clearance-${violations.length + 1}`,
          text: elem.text || elem.label || 'Critical Content',
          page: elem.page || 1,
          box: elem.box,
          measuredDistanceMm: distMm,
          requiredClearanceMm,
          shortfallMm,
          creaseName: crease.name || crease.panelName || crease.id || 'Folding Score',
          objectType: elem.role || 'Live Text',
          sourceAuthority: dielineSource,
        });
      }
    }
  }

  if (minObservedClearanceMm === Infinity) {
    minObservedClearanceMm = requiredClearanceMm;
  }

  const passed = violations.length === 0;
  const isOverlap = violations.some(v => v.measuredDistanceMm === 0.0);

  return {
    status: passed ? 'match' : 'issue',
    verdict: passed
      ? 'CREASE_CLEARANCE_SUFFICIENT'
      : (isOverlap ? 'TEXT_OVERLAPS_CREASE_LINE' : 'CRITICAL_CONTENT_CROSSES_CREASE'),
    checkVerdict: passed ? 'CREASE_CLEARANCE_PASS' : 'CREASE_CLEARANCE_DEFECT',
    requiredClearanceMm,
    minObservedClearanceMm,
    minObservedMm: minObservedClearanceMm,
    violations,
    dielineSource,
    pressProfile: profile.profileId,
    explanation: passed
      ? `Crease clearance verified: All critical live text and brand logos maintain ≥ ${requiredClearanceMm} mm lateral clearance from structural folding scores (${profile.name}).`
      : `Fold crease hazard: ${violations.length} critical element(s) violate the ${requiredClearanceMm} mm clearance requirement for ${profile.name}. Closest element "${violations[0]?.text}" is only ${violations[0]?.measuredDistanceMm} mm from fold (shortfall: ${violations[0]?.shortfallMm} mm). Board cracking and score distortion risk.`,
    verificationLimitations: 'Evaluated against structural CAD score lines. Board caliper and score channel width may require additional clearance.',
  };
}
