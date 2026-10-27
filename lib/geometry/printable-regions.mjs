/**
 * PackSignal Packaging Geometry — Printable & Safe Copy Regions
 * (lib/geometry/printable-regions.mjs)
 *
 * Implements Step 10: Derived printable and safe copy regions.
 * Distinguishes:
 * - Panel Geometry: Total structural extent of the carton panel.
 * - Printable Region: Material area where ink can be deposited (minus glue and bleed boundaries).
 * - Safe Copy Region: Verified area for critical legal/branding text (minus cut margins and crease clearances).
 */

import { computeBoundingBox } from './model.mjs';
import { pointInPolygon, isPolygonContained } from './polygons.mjs';

export const DEFAULT_CUT_MARGIN_MM = 2.0;    // Standard prepress 2mm cut setback
export const DEFAULT_CREASE_MARGIN_MM = 1.5; // Standard 1.5mm fold line setback

/**
 * Derives a candidate printable region and safe copy region for a panel.
 * Supports explicit glue exclusions and margins.
 */
export function computePanelPrintableRegion({
  panel,
  pageDimensionsMm = null,
  cutMarginMm = DEFAULT_CUT_MARGIN_MM,
  creaseMarginMm = DEFAULT_CREASE_MARGIN_MM,
  glueExclusionZones = [],
  lockedObstacles = [],
  tolerance = 1e-4
}) {
  const [px0, py0, px1, py1] = panel.boundingBox;
  const poly = panel.polygon || [];

  // If physical dimensions in mm are known, convert margins to normalized space [0, 1]
  const isPhysical = px1 > 1.5 || py1 > 1.5;
  let insetX = Math.max(cutMarginMm, creaseMarginMm);
  let insetY = Math.max(cutMarginMm, creaseMarginMm);

  if (!isPhysical) {
    let normCutMarginX = 0.01;
    let normCutMarginY = 0.01;
    let normCreaseMarginX = 0.008;
    let normCreaseMarginY = 0.008;

    if (pageDimensionsMm && pageDimensionsMm.width > 0 && pageDimensionsMm.height > 0) {
      normCutMarginX = cutMarginMm / pageDimensionsMm.width;
      normCutMarginY = cutMarginMm / pageDimensionsMm.height;
      normCreaseMarginX = creaseMarginMm / pageDimensionsMm.width;
      normCreaseMarginY = creaseMarginMm / pageDimensionsMm.height;
    }
    insetX = Math.max(normCutMarginX, normCreaseMarginX);
    insetY = Math.max(normCutMarginY, normCreaseMarginY);
  }

  const safeBox = [
    px0 + insetX,
    py0 + insetY,
    px1 - insetX,
    py1 - insetY
  ];

  // Validate that panel is large enough to have a positive safe region
  const safeWidth = safeBox[2] - safeBox[0];
  const safeHeight = safeBox[3] - safeBox[1];
  const hasPositiveSafeRegion = safeWidth > 0 && safeHeight > 0;

  // Compute safe polygon by insetting vertices toward the centroid
  const safePolygon = [];
  if (hasPositiveSafeRegion && poly.length >= 3) {
    const cx = (px0 + px1) / 2;
    const cy = (py0 + py1) / 2;
    const halfW = (px1 - px0) / 2;
    const halfH = (py1 - py0) / 2;

    const scaleX = halfW > 0 ? Math.max(0, (halfW - insetX) / halfW) : 1;
    const scaleY = halfH > 0 ? Math.max(0, (halfH - insetY) / halfH) : 1;

    for (const pt of poly) {
      const sx = cx + (pt[0] - cx) * scaleX;
      const sy = cy + (pt[1] - cy) * scaleY;
      safePolygon.push([sx, sy]);
    }
  }

  // Find intersecting glue exclusion zones
  const activeGlueExclusions = glueExclusionZones.filter(glue => {
    const [gx0, gy0, gx1, gy1] = glue.boundingBox || (glue.polygon ? computeBoundingBox(glue.polygon) : [0, 0, 0, 0]);
    return !(gx1 <= px0 || gx0 >= px1 || gy1 <= py0 || gy0 >= py1);
  });

  // Limitations and notes
  const limitations = [
    'Derived safe region uses standard prepress setbacks (2.0mm cut margin, 1.5mm crease setback).',
    'Does not certify print production readiness or substrate stretching/creep.'
  ];

  if (!hasPositiveSafeRegion) {
    limitations.push(`Panel dimensions (${(px1 - px0).toFixed(4)} x ${(py1 - py0).toFixed(4)}) are too narrow to provide positive safe copy clearance.`);
  }

  return {
    panelId: panel.panelId,
    face: panel.face,
    panelBounds: panel.boundingBox,
    panelPolygon: poly,
    safeCopyBox: hasPositiveSafeRegion ? safeBox : null,
    safeCopyPolygon: safePolygon.length >= 3 ? safePolygon : null,
    hasPositiveSafeRegion,
    cutMarginMm,
    creaseMarginMm,
    activeGlueExclusions,
    lockedObstacles,
    limitations
  };
}

/**
 * Convenience wrapper for printable region evaluation matching test signatures.
 */
export function computePrintableRegion({
  panelPolygon,
  cutSetbackMm = DEFAULT_CUT_MARGIN_MM,
  creaseSetbackMm = DEFAULT_CREASE_MARGIN_MM,
  exclusionZones = []
}) {
  const panel = {
    panelId: 'panel-eval',
    face: 'generic',
    polygon: panelPolygon,
    boundingBox: computeBoundingBox(panelPolygon)
  };

  const res = computePanelPrintableRegion({
    panel,
    cutMarginMm: cutSetbackMm,
    creaseMarginMm: creaseSetbackMm,
    glueExclusionZones: exclusionZones
  });

  if (!res.hasPositiveSafeRegion) {
    return {
      status: 'UNABLE_TO_EVALUATE',
      limitations: res.limitations
    };
  }

  return {
    status: 'VALID',
    safePolygon: res.safeCopyPolygon,
    safeBoundingBox: res.safeCopyBox,
    exclusionZonesApplied: res.activeGlueExclusions.length,
    limitations: res.limitations
  };
}

/**
 * Computes maximum usable connected sub-box avoiding obstacles.
 */
export function computeUsableConnectedSpace(safeBox, obstacles = []) {
  const [minX, minY, maxX, maxY] = safeBox;
  let maxW = maxX - minX;
  let maxH = maxY - minY;
  let isFragmented = false;

  for (const obs of obstacles) {
    const obBox = obs.box || obs.boundingBox || [0, 0, 0, 0];
    const ox0 = Math.max(minX, obBox[0]);
    const ox1 = Math.min(maxX, obBox[2]);
    if (ox1 > ox0) {
      isFragmented = true;
      const leftWidth = ox0 - minX;
      const rightWidth = maxX - ox1;
      maxW = Math.max(leftWidth, rightWidth);
    }
  }

  return {
    maxWidth: maxW,
    maxHeight: maxH,
    isFragmented
  };
}
