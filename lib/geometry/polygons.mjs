/**
 * PackSignal Packaging Geometry — Polygons & Topological Validation
 * (lib/geometry/polygons.mjs)
 *
 * Implements Step 5: Robust polygon calculations and topology validation.
 * Supports arbitrary nonrectangular closed polygons.
 */

import { computeBoundingBox } from './model.mjs';

/**
 * Calculates signed area of a 2D polygon using the Shoelace formula.
 * Positive = Counter-Clockwise (CCW), Negative = Clockwise (CW).
 */
export function polygonSignedArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return area / 2.0;
}

/**
 * Absolute polygon area.
 */
export function polygonArea(points) {
  return Math.abs(polygonSignedArea(points));
}

/**
 * Calculates the perimeter of a closed polygon.
 */
export function polygonPerimeter(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let perimeter = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j][0] - points[i][0];
    const dy = points[j][1] - points[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

/**
 * Checks if a point [x, y] is inside a polygon using ray-casting.
 * Returns true if inside, false if outside.
 */
export function pointInPolygon(point, polygon, onBoundaryInclusive = true) {
  if (!Array.isArray(point) || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }
  const [px, py] = point;
  let inside = false;
  const n = polygon.length;
  const epsilon = 1e-9;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    // Check if point is directly on the segment boundary
    if (onBoundaryInclusive) {
      const minX = Math.min(xi, xj) - epsilon;
      const maxX = Math.max(xi, xj) + epsilon;
      const minY = Math.min(yi, yj) - epsilon;
      const maxY = Math.max(yi, yj) + epsilon;

      if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
        const cross = (py - yi) * (xj - xi) - (px - xi) * (yj - yi);
        if (Math.abs(cross) < epsilon) {
          return true; // Exactly on boundary
        }
      }
    }

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi + 1e-30) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks whether two line segments [p1, p2] and [p3, p4] properly intersect.
 */
export function segmentsIntersect(p1, p2, p3, p4, allowEndpointTouch = true) {
  function ccw(a, b, c) {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  }

  const s1 = ccw(p1, p3, p4) !== ccw(p2, p3, p4);
  const s2 = ccw(p1, p2, p3) !== ccw(p1, p2, p4);

  if (allowEndpointTouch) {
    return s1 && s2;
  }

  // Strict interior intersection
  if (!s1 || !s2) return false;
  const eps = 1e-9;
  const d1 = Math.hypot(p1[0] - p3[0], p1[1] - p3[1]);
  const d2 = Math.hypot(p1[0] - p4[0], p1[1] - p4[1]);
  const d3 = Math.hypot(p2[0] - p3[0], p2[1] - p3[1]);
  const d4 = Math.hypot(p2[0] - p4[0], p2[1] - p4[1]);
  return d1 > eps && d2 > eps && d3 > eps && d4 > eps;
}

/**
 * Checks if a polygon self-intersects.
 */
export function isPolygonSelfIntersecting(points) {
  if (!Array.isArray(points) || points.length < 4) return false;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      if ((i === 0 && j === n - 1) || Math.abs(i - j) <= 1) continue;
      const p3 = points[j];
      const p4 = points[(j + 1) % n];

      if (segmentsIntersect(p1, p2, p3, p4, false)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Snaps polygon endpoints within tolerance and removes duplicate or collinear points.
 */
export function cleanPolygonVertices(points, tolerance = 1e-4) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const cleaned = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;

    if (cleaned.length === 0) {
      cleaned.push([pt[0], pt[1]]);
      continue;
    }

    const prev = cleaned[cleaned.length - 1];
    const dist = Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
    if (dist > tolerance) {
      cleaned.push([pt[0], pt[1]]);
    }
  }

  // If first and last point are identical within tolerance, drop the last duplicate
  if (cleaned.length >= 2) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= tolerance) {
      cleaned.pop();
    }
  }

  return cleaned;
}

/**
 * Validates a candidate polygon.
 */
export function validatePolygon(points, options = {}) {
  const minArea = options.minArea ?? 1e-5;
  const snapTolerance = options.snapTolerance ?? 1e-4;

  const cleaned = cleanPolygonVertices(points, snapTolerance);
  const limitations = [];

  if (cleaned.length < 3) {
    return {
      valid: false,
      closed: false,
      area: 0,
      perimeter: 0,
      points: cleaned,
      boundingBox: [0, 0, 0, 0],
      limitations: ['Polygon has fewer than 3 unique non-collinear vertices.']
    };
  }

  const area = polygonArea(cleaned);
  if (area < minArea) {
    limitations.push(`Polygon area (${area.toFixed(6)}) is below minimum threshold (${minArea}).`);
  }

  const selfIntersects = isPolygonSelfIntersecting(cleaned);
  if (selfIntersects) {
    limitations.push('Polygon contains self-intersecting boundary edges.');
  }

  const perimeter = polygonPerimeter(cleaned);
  const bbox = computeBoundingBox(cleaned);

  return {
    valid: limitations.length === 0,
    closed: true,
    area,
    perimeter,
    points: cleaned,
    boundingBox: bbox,
    limitations
  };
}

/**
 * Tests whether polygon A is completely inside polygon B.
 */
export function isPolygonContained(polyA, polyB) {
  if (!Array.isArray(polyA) || !Array.isArray(polyB) || polyA.length < 3 || polyB.length < 3) {
    return false;
  }

  // Quick bounding box rejection
  const [ax0, ay0, ax1, ay1] = computeBoundingBox(polyA);
  const [bx0, by0, bx1, by1] = computeBoundingBox(polyB);
  const eps = 1e-6;

  if (ax0 < bx0 - eps || ay0 < by0 - eps || ax1 > bx1 + eps || ay1 > by1 + eps) {
    return false;
  }

  // All vertices of polyA must be inside polyB
  for (const pt of polyA) {
    if (!pointInPolygon(pt, polyB, true)) {
      return false;
    }
  }

  // No edges of polyA may cross polyB's edges
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (segmentsIntersect(a1, a2, b1, b2, false)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Tests whether a bounding box [x0, y0, x1, y1] intersects or is contained in a polygon.
 */
export function boxPolygonIntersection(box, polygon) {
  const [x0, y0, x1, y1] = box;
  const boxPoly = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ];

  // Quick bounding box check
  const [px0, py0, px1, py1] = computeBoundingBox(polygon);
  if (x1 < px0 || x0 > px1 || y1 < py0 || y0 > py1) {
    return { intersects: false, fullyContained: false, fullyOutside: true };
  }

  const cornersInside = boxPoly.filter(pt => pointInPolygon(pt, polygon, true)).length;
  const fullyContained = cornersInside === 4 && isPolygonContained(boxPoly, polygon);

  // Check if any edge crosses
  let edgeCross = false;
  for (let i = 0; i < 4; i++) {
    const b1 = boxPoly[i];
    const b2 = boxPoly[(i + 1) % 4];
    for (let j = 0; j < polygon.length; j++) {
      const p1 = polygon[j];
      const p2 = polygon[(j + 1) % polygon.length];
      if (segmentsIntersect(b1, b2, p1, p2, true)) {
        edgeCross = true;
        break;
      }
    }
    if (edgeCross) break;
  }

  const intersects = cornersInside > 0 || edgeCross || pointInPolygon(polygon[0], boxPoly, true);
  return {
    intersects,
    fullyContained,
    fullyOutside: !intersects,
    cornersInside
  };
}
