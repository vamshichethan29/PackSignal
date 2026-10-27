/**
 * PackSignal Packaging Geometry — Segments & Structural Classifications
 * (lib/geometry/segments.mjs)
 *
 * Implements Step 3 & Step 9: Structural line classification and edge math.
 * Distinguishes CUT, CREASE, FOLD, GLUE, BLEED_GUIDE, and UNKNOWN lines.
 */

import { STRUCTURAL_CLASSIFICATIONS } from './model.mjs';

export { STRUCTURAL_CLASSIFICATIONS };

/**
 * Classifies an edge by CAD layer or linetype tokens.
 * Uses explicit semantic layer names only; never infers semantics from color alone.
 */
export function classifyStructuralEdge(layerName = '', linetype = '') {
  const normalize = str => String(str || '')
    .replace(/(?<=[a-z])(?=[A-Z])/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const words = new Set(`${normalize(layerName)} ${normalize(linetype)}`.split(/\s+/).filter(Boolean));
  const full = `${normalize(layerName)} ${normalize(linetype)}`;

  if (words.has('cut') || words.has('knife') || words.has('cutline') || words.has('cutting') ||
      full.includes('diecut') || full.includes('cutcontour') || full.includes('thrucut')) {
    return STRUCTURAL_CLASSIFICATIONS.CUT;
  }

  if (words.has('crease') || words.has('fold') || words.has('score') || words.has('bend') ||
      full.includes('creasing') || full.includes('scoring')) {
    return STRUCTURAL_CLASSIFICATIONS.CREASE;
  }

  if (words.has('glue') || words.has('adhesive') || full.includes('gluena') || full.includes('gluetab')) {
    return STRUCTURAL_CLASSIFICATIONS.GLUE;
  }

  if (words.has('perf') || words.has('perforation') || words.has('perforate')) {
    return STRUCTURAL_CLASSIFICATIONS.CREASE; // perforation functions as a weak fold/tear boundary
  }

  if (words.has('bleed') || words.has('bleedline') || words.has('margin')) {
    return STRUCTURAL_CLASSIFICATIONS.BLEED_GUIDE;
  }

  return STRUCTURAL_CLASSIFICATIONS.UNKNOWN;
}

/**
 * Classifies a segment or edge object and returns classification with points.
 */
export function classifyStructuralSegment(segment = {}) {
  const layer = segment.layer || segment.layerName || '';
  const linetype = segment.linetype || '';
  const structuralClassification = classifyStructuralEdge(layer, linetype);
  return {
    ...segment,
    structuralClassification,
    layer,
    points: segment.points || []
  };
}

/**
 * Filters segments to those matching trusted structural classifications.
 */
export function filterTrustedStructuralSegments(segments = []) {
  return segments.map(classifyStructuralSegment).filter(s =>
    s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.CUT ||
    s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.CREASE ||
    s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.FOLD ||
    s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.GLUE ||
    s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.PANEL_BOUNDARY
  );
}

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function pointDistance(p1, p2) {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

/**
 * Calculates length of a 2D line segment [[x0, y0], [x1, y1]].
 */
export function segmentLength(segment) {
  if (!Array.isArray(segment) || segment.length < 2) return 0;
  return pointDistance(segment[0], segment[1]);
}

/**
 * Computes minimum distance from a point to a line segment.
 */
export function pointToSegmentDistance(point, segment) {
  if (!Array.isArray(segment) || segment.length < 2) return Infinity;
  const [px, py] = point;
  const [x1, y1] = segment[0];
  const [x2, y2] = segment[1];

  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  // Projection scalar t onto the line
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Computes minimum distance between a 2D bounding box and a line segment.
 */
export function boxToSegmentDistance(box, segment) {
  const [x0, y0, x1, y1] = box;
  const corners = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ];

  // If segment intersects the box, distance is 0
  const [sx0, sy0] = segment[0];
  const [sx1, sy1] = segment[1];

  // Check if either segment endpoint is inside the box
  if ((sx0 >= x0 && sx0 <= x1 && sy0 >= y0 && sy0 <= y1) ||
      (sx1 >= x0 && sx1 <= x1 && sy1 >= y0 && sy1 <= y1)) {
    return 0;
  }

  let minDist = Infinity;
  // Point to segment for all 4 corners
  for (const corner of corners) {
    const d = pointToSegmentDistance(corner, segment);
    if (d < minDist) minDist = d;
  }

  // Box edges to segment endpoints
  const boxEdges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]]
  ];

  for (const edge of boxEdges) {
    const d0 = pointToSegmentDistance(segment[0], edge);
    const d1 = pointToSegmentDistance(segment[1], edge);
    minDist = Math.min(minDist, d0, d1);
  }

  return minDist;
}

/**
 * Measures shared collinear overlap length between two segments within tolerance.
 */
export function sharedSegmentOverlap(seg1, seg2, tolerance = 1e-4) {
  const [p1, p2] = seg1;
  const [p3, p4] = seg2;

  // Check if segments are collinear
  const dist3 = pointToSegmentDistance(p3, seg1);
  const dist4 = pointToSegmentDistance(p4, seg1);

  if (dist3 > tolerance && dist4 > tolerance) {
    return 0; // Not collinear/close enough
  }

  // Project points onto the axis of seg1
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return 0;

  const ux = dx / len;
  const uy = dy / len;

  const proj = p => (p[0] - p1[0]) * ux + (p[1] - p1[1]) * uy;

  const t1 = 0;
  const t2 = len;
  const t3 = proj(p3);
  const t4 = proj(p4);

  const seg2Min = Math.min(t3, t4);
  const seg2Max = Math.max(t3, t4);

  const overlapStart = Math.max(t1, seg2Min);
  const overlapEnd = Math.min(t2, seg2Max);

  const overlapLen = Math.max(0, overlapEnd - overlapStart);
  return overlapLen;
}
