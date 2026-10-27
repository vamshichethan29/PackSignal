/**
 * PackSignal Packaging Geometry — Coordinate Systems & Matrix Transforms
 * (lib/geometry/coordinates.mjs)
 *
 * Implements Step 2: Coordinate system safety and conversions.
 * Supports explicit transformations between:
 * - DXF source coordinates
 * - PDF native coordinates (pt)
 * - Normalized viewport coordinates [0, 1]
 * - Rendered raster image pixels
 * - Millimeters where physically valid
 */

import { toMillimeters, normalizeUnitName } from './units.mjs';

/**
 * 2D Affine Transformation Matrix [a, b, c, d, tx, ty]
 * Corresponds to:
 * | a  c  tx |   | x |   | a*x + c*y + tx |
 * | b  d  ty | * | y | = | b*x + d*y + ty |
 * | 0  0  1  |   | 1 |   |       1        |
 */
export const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

export function createTranslationMatrix(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}

export function createScaleMatrix(sx, sy) {
  return [sx, 0, 0, sy, 0, 0];
}

export function createRotationMatrix(angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [cos, sin, -sin, cos, 0, 0];
}

export function multiplyMatrices(m1, m2) {
  const [a1, b1, c1, d1, tx1, ty1] = m1;
  const [a2, b2, c2, d2, tx2, ty2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * tx2 + c1 * ty2 + tx1,
    b1 * tx2 + d1 * ty2 + ty1
  ];
}

export function invertMatrix(m) {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) {
    return null; // Non-invertible
  }
  const invDet = 1.0 / det;
  return [
    d * invDet,
    -b * invDet,
    -c * invDet,
    a * invDet,
    (c * ty - d * tx) * invDet,
    (b * tx - a * ty) * invDet
  ];
}

/**
 * Applies a 2D affine matrix to a point [x, y].
 */
export function transformPoint(point, matrix = IDENTITY_MATRIX) {
  if (!Array.isArray(point) || point.length < 2) return [0, 0];
  const [x, y] = point;
  const [a, b, c, d, tx, ty] = matrix;
  return [
    a * x + c * y + tx,
    b * x + d * y + ty
  ];
}

export const applyMatrixToPoint = transformPoint;

/**
 * Applies a 2D affine matrix to a line segment [[x0, y0], [x1, y1]].
 */
export function transformSegment(segment, matrix = IDENTITY_MATRIX) {
  if (!Array.isArray(segment) || segment.length < 2) return [[0, 0], [0, 0]];
  return [
    transformPoint(segment[0], matrix),
    transformPoint(segment[1], matrix)
  ];
}

/**
 * Applies a 2D affine matrix to a polygon [[x, y], ...].
 */
export function transformPolygon(polygon, matrix = IDENTITY_MATRIX) {
  if (!Array.isArray(polygon)) return [];
  return polygon.map(pt => transformPoint(pt, matrix));
}

/**
 * Converts a point [x, y] from PDF native coordinates (points, Y bottom-to-top)
 * to PackSignal normalized coordinates [0, 1] (origin top-left, Y top-to-bottom).
 */
export function pdfToNormalized(point, pageBox, rotation = 0) {
  if (!Array.isArray(point) || point.length < 2) return [0, 0];
  const [px, py] = point;
  const [bx0, by0, bx1, by1] = pageBox || [0, 0, 612, 792];
  const bw = Math.max(1e-6, bx1 - bx0);
  const bh = Math.max(1e-6, by1 - by0);

  // Normalize relative to page box (PDF origin is bottom-left)
  let nx = (px - bx0) / bw;
  let ny = 1.0 - (py - by0) / bh;

  // Handle standard page rotation (0, 90, 180, 270)
  const rot = ((rotation % 360) + 360) % 360;
  if (rot === 90) {
    const tmp = nx;
    nx = ny;
    ny = 1.0 - tmp;
  } else if (rot === 180) {
    nx = 1.0 - nx;
    ny = 1.0 - ny;
  } else if (rot === 270) {
    const tmp = nx;
    nx = 1.0 - ny;
    ny = tmp;
  }

  return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))];
}

/**
 * Converts a normalized box [x0, y0, x1, y1] to PDF native points.
 */
export function normalizedToPdfBox(normBox, pageBox, rotation = 0) {
  const [nx0, ny0, nx1, ny1] = normBox;
  const [bx0, by0, bx1, by1] = pageBox || [0, 0, 612, 792];
  const bw = bx1 - bx0;
  const bh = by1 - by0;

  // Invert normalized top-left to PDF bottom-left
  const px0 = bx0 + nx0 * bw;
  const px1 = bx0 + nx1 * bw;
  const py0 = by0 + (1.0 - ny1) * bh;
  const py1 = by0 + (1.0 - ny0) * bh;

  return [px0, py0, px1, py1];
}

/**
 * Converts normalized [x, y] to rendered pixel coordinates.
 */
export function normalizedToRenderedPixels(point, pixelWidth, pixelHeight) {
  const [nx, ny] = point;
  return [
    Math.round(nx * pixelWidth),
    Math.round(ny * pixelHeight)
  ];
}

/**
 * Converts DXF native coordinates to millimeters if the source unit is physical.
 */
export function dxfToMillimeters(point, sourceUnit) {
  const [x, y] = point;
  const convX = toMillimeters(x, sourceUnit);
  const convY = toMillimeters(y, sourceUnit);

  if (!convX.ok || !convY.ok) {
    return {
      ok: false,
      error: convX.error || convY.error,
      reason: convX.reason || convY.reason,
      pointMm: null
    };
  }

  return {
    ok: true,
    pointMm: [convX.value, convY.value],
    unit: 'millimeters'
  };
}

/**
 * Converts a text region or bounding box across spaces.
 */
export function transformTextRegion(box, matrix = IDENTITY_MATRIX) {
  if (!Array.isArray(box) || box.length !== 4) return [0, 0, 0, 0];
  const [x0, y0, x1, y1] = box;
  const corners = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ];
  const transformed = corners.map(pt => transformPoint(pt, matrix));
  const xs = transformed.map(p => p[0]);
  const ys = transformed.map(p => p[1]);
  return [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys)
  ];
}
