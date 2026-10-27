/**
 * PackSignal Packaging Geometry — Bounded Layout-Fit Assessment Engine
 * (lib/geometry/layout-fit.mjs)
 *
 * Implements Step 16, 17, 18, 19, 20, 21, 22:
 * - Deterministic, bounded layout-fit feasibility estimation.
 * - Usable connected space calculation (accounts for obstacles and fragmentation).
 * - Word wrapping, line-count estimation, and font point size thresholds.
 * - Detects FIT_LIKELY, OVERFLOW_RISK, PLACEMENT_CONFLICT, NEEDS_REVIEW, UNABLE_TO_EVALUATE.
 * - Provides bounded, non-destructive practical design options.
 */

import { FIT_OUTCOMES } from './model.mjs';
import { POINTS_PER_MM } from './units.mjs';
import { boxToSegmentDistance } from './segments.mjs';

/**
 * Screens text spans against structural cut/crease boundary segments for clearance risks.
 */
export function screenLayoutFit({
  textSpans = [],
  panels = [],
  boundarySegments = [],
  minClearanceMm = 1.5
}) {
  const warnings = [];

  for (const span of textSpans) {
    const box = span.boxPt || span.box || [0, 0, 0, 0];

    for (const seg of boundarySegments) {
      const segPts = seg.points || (seg.p1 && seg.p2 ? [seg.p1, seg.p2] : null);
      if (!segPts) continue;

      const dist = boxToSegmentDistance(box, segPts);
      // If boundary is close to box or box crosses boundary
      if (dist < minClearanceMm * POINTS_PER_MM) {
        warnings.push({
          type: 'INSUFFICIENT_CLEARANCE',
          text: span.text,
          boundaryType: seg.type || seg.kind || 'cut',
          distance: dist,
          minClearanceMm
        });
      }
    }
  }

  return {
    hasRisks: warnings.length > 0,
    warnings
  };
}

/**
 * Standard Latin typography metrics approximation factors when embedded font metrics are absent.
 */
const DEFAULT_AVG_CHAR_WIDTH_RATIO = 0.52; // average glyph width ~ 0.52 * font_size
const DEFAULT_LINE_HEIGHT_RATIO = 1.25;    // standard leading 125%

/**
 * Calculates candidate usable rectangular sub-regions inside a safe panel region
 * by subtracting bounding boxes of design obstacles.
 */
export function computeUsableConnectedRegions(safeBox, obstacles = []) {
  if (!safeBox || safeBox.length !== 4) return [];
  const [sx0, sy0, sx1, sy1] = safeBox;
  const safeW = sx1 - sx0;
  const safeH = sy1 - sy0;

  if (safeW <= 0 || safeH <= 0) return [];

  // Filter obstacles that actually intersect this safe box
  const relevantObstacles = obstacles.filter(obs => {
    const [ox0, oy0, ox1, oy1] = obs.boundingBox || obs.box || [0, 0, 0, 0];
    return !(ox1 <= sx0 || ox0 >= sx1 || oy1 <= sy0 || oy0 >= sy1);
  });

  if (relevantObstacles.length === 0) {
    return [{
      box: [sx0, sy0, sx1, sy1],
      width: safeW,
      height: safeH,
      area: safeW * safeH
    }];
  }

  // Fragment the safe box along obstacle boundaries
  // Produce the largest candidate uninterrupted sub-rectangles (top, bottom, left, right of primary obstacle)
  const candidateRegions = [];
  const primaryObs = relevantObstacles[0].boundingBox || relevantObstacles[0].box;
  const [ox0, oy0, ox1, oy1] = primaryObs;

  // Space above obstacle
  if (oy0 > sy0) {
    candidateRegions.push({
      box: [sx0, sy0, sx1, oy0],
      width: safeW,
      height: oy0 - sy0,
      area: safeW * (oy0 - sy0)
    });
  }

  // Space below obstacle
  if (oy1 < sy1) {
    candidateRegions.push({
      box: [sx0, oy1, sx1, sy1],
      width: safeW,
      height: sy1 - oy1,
      area: safeW * (sy1 - oy1)
    });
  }

  // Space to left of obstacle
  if (ox0 > sx0) {
    candidateRegions.push({
      box: [sx0, sy0, ox0, sy1],
      width: ox0 - sx0,
      height: safeH,
      area: (ox0 - sx0) * safeH
    });
  }

  // Space to right of obstacle
  if (ox1 < sx1) {
    candidateRegions.push({
      box: [ox1, sy0, sx1, sy1],
      width: sx1 - ox1,
      height: safeH,
      area: (sx1 - ox1) * safeH
    });
  }

  // Filter out tiny slivers
  return candidateRegions
    .filter(r => r.width > 0.02 && r.height > 0.02)
    .sort((a, b) => b.area - a.area);
}

/**
 * Estimates text block dimensions in points given copy, available width in points, and font size in points.
 */
export function estimateTextBlockDimensions({
  copyText = '',
  availableWidthPt = 100,
  fontSizePt = 8.0,
  charWidthRatio = DEFAULT_AVG_CHAR_WIDTH_RATIO,
  lineHeightRatio = DEFAULT_LINE_HEIGHT_RATIO
}) {
  const words = String(copyText || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { widthPt: 0, heightPt: 0, lineCount: 0, lines: [] };
  }

  const avgCharWidth = fontSizePt * charWidthRatio;
  const lineHeightPt = fontSizePt * lineHeightRatio;

  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = word.length * avgCharWidth;
    const spaceWidth = avgCharWidth;

    if (currentLine.length === 0) {
      currentLine.push(word);
      currentLineWidth = wordWidth;
    } else if (currentLineWidth + spaceWidth + wordWidth <= availableWidthPt) {
      currentLine.push(word);
      currentLineWidth += spaceWidth + wordWidth;
    } else {
      lines.push(currentLine.join(' '));
      currentLine = [word];
      currentLineWidth = wordWidth;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  const totalHeightPt = lines.length * lineHeightPt;
  const maxLineWidthPt = Math.min(availableWidthPt, Math.max(...lines.map(l => l.length * avgCharWidth)));

  return {
    widthPt: maxLineWidthPt,
    heightPt: totalHeightPt,
    lineCount: lines.length,
    lines,
    lineHeightPt
  };
}

/**
 * Assesses whether a required piece of packaging copy fits inside a designated panel region.
 */
export function assessLayoutFit({
  panelPrintableRegion,
  requiredCopy = '',
  minimumFontSizePt = 6.0,
  pageDimensionsMm = { width: 300, height: 200 },
  existingObstacles = [],
  fontMetrics = null,
  options = {}
}) {
  if (!panelPrintableRegion?.safeCopyBox) {
    return {
      outcome: FIT_OUTCOMES.UNABLE_TO_EVALUATE,
      confidence: 'LOW',
      reasons: ['No positive safe copy region available on this panel.'],
      recommendations: ['Review panel dimensions and cut setbacks.']
    };
  }

  // Complex shaping script check (Arabic, Indic scripts requiring complex shaping)
  const hasComplexScript = /[\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F]/u.test(requiredCopy);
  if (hasComplexScript) {
    return {
      outcome: FIT_OUTCOMES.NEEDS_REVIEW,
      confidence: 'MEDIUM',
      reasons: ['Copy contains complex non-Latin scripts requiring specialized font shaping engines not available in 2D dieline estimation.'],
      recommendations: ['Inspect rendered typography manually in the 2D viewer before release.']
    };
  }

  const safeBox = panelPrintableRegion.safeCopyBox;
  const usableRegions = computeUsableConnectedRegions(safeBox, existingObstacles);

  if (usableRegions.length === 0) {
    return {
      outcome: FIT_OUTCOMES.PLACEMENT_CONFLICT,
      confidence: 'HIGH',
      reasons: ['Safe copy region is entirely blocked by existing design obstacles or exclusion zones.'],
      recommendations: [
        'Move conflicting design elements or barcodes outside the copy zone.',
        'Request an approved alternate panel placement.'
      ]
    };
  }

  // Convert best usable region to physical points (pt)
  const bestRegion = usableRegions[0];
  const pageWidthPt = pageDimensionsMm.width * POINTS_PER_MM;
  const pageHeightPt = pageDimensionsMm.height * POINTS_PER_MM;

  const availableWidthPt = bestRegion.width * pageWidthPt;
  const availableHeightPt = bestRegion.height * pageHeightPt;

  // Evaluate fit at the source-specified minimum font size
  const textMeasurement = estimateTextBlockDimensions({
    copyText: requiredCopy,
    availableWidthPt,
    fontSizePt: minimumFontSizePt,
    charWidthRatio: fontMetrics?.avgCharWidthRatio || DEFAULT_AVG_CHAR_WIDTH_RATIO,
    lineHeightRatio: fontMetrics?.lineHeightRatio || DEFAULT_LINE_HEIGHT_RATIO
  });

  const widthOverflow = textMeasurement.widthPt > availableWidthPt;
  const heightOverflow = textMeasurement.heightPt > availableHeightPt;

  let outcome = FIT_OUTCOMES.FIT_LIKELY;
  const reasons = [];
  const recommendations = [];

  if (heightOverflow || widthOverflow) {
    outcome = FIT_OUTCOMES.OVERFLOW_RISK;
    reasons.push(
      `Required copy (${requiredCopy.length} chars) measured at minimum required ${minimumFontSizePt} pt requires ` +
      `${textMeasurement.widthPt.toFixed(1)} pt x ${textMeasurement.heightPt.toFixed(1)} pt (${textMeasurement.lineCount} lines), ` +
      `exceeding available connected space (${availableWidthPt.toFixed(1)} pt x ${availableHeightPt.toFixed(1)} pt).`
    );

    recommendations.push(
      `Consider increasing the available width of the copy area by at least ${Math.round((textMeasurement.widthPt - availableWidthPt) / POINTS_PER_MM)} mm.`,
      `Review line wrapping or reduce surrounding decorative elements without modifying approved text.`,
      `Check whether company rules allow placing this copy on an alternate panel.`
    );
  } else {
    reasons.push(
      `Copy fits within available space at minimum ${minimumFontSizePt} pt: requires ` +
      `${textMeasurement.widthPt.toFixed(1)} pt x ${textMeasurement.heightPt.toFixed(1)} pt across ${textMeasurement.lineCount} line(s). ` +
      `Available region: ${availableWidthPt.toFixed(1)} pt x ${availableHeightPt.toFixed(1)} pt.`
    );
  }

  return {
    outcome,
    panelId: panelPrintableRegion.panelId,
    face: panelPrintableRegion.face,
    requiredCopyLength: requiredCopy.length,
    minimumFontSizePt,
    estimatedWidthPt: textMeasurement.widthPt,
    estimatedHeightPt: textMeasurement.heightPt,
    estimatedLineCount: textMeasurement.lineCount,
    availableWidthPt,
    availableHeightPt,
    usableRegionBox: bestRegion.box,
    reasons,
    recommendations,
    limitations: [
      fontMetrics ? 'Measured using candidate font metrics.' : 'Measured using standard Latin average character width approximation (0.52 ratio).',
      'Layout feasibility is a bounded prepress estimate and does not replace human typography review.'
    ]
  };
}
