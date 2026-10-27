/**
 * PackSignal 3D Coordinate Mapper (public/three/coordinate-mapper.js)
 * Mathematical coordinate projections between 2D artwork space and 3D packaging surfaces:
 * - Cylindrical projection for Beverage Cans and Bottles
 * - Parameterized pillow surface mapping for Flexible Stand-up Pouches
 * - Rigid face transformations for Folding Cartons
 * - Circumference vs label width validation
 */

/**
 * Validates whether physical label width matches cylinder circumference within tolerance.
 *
 * @param {number} labelWidthMm - Physical width of the label in mm
 * @param {number} diameterMm - Can or bottle diameter in mm
 * @param {number} [toleranceMm=2.0] - Permissible discrepancy in mm
 * @returns {{ match: boolean, expectedCircumferenceMm: number, diffMm: number, warning?: string }}
 */
export function checkCircumferenceMatch(labelWidthMm, diameterMm, toleranceMm = 2.0) {
  const expectedCircumferenceMm = Math.PI * diameterMm;
  const diffMm = Math.abs(labelWidthMm - expectedCircumferenceMm);
  const match = diffMm <= toleranceMm;

  return {
    match,
    expectedCircumferenceMm: Number(expectedCircumferenceMm.toFixed(2)),
    diffMm: Number(diffMm.toFixed(2)),
    warning: match
      ? null
      : `Label width (${labelWidthMm}mm) differs from can circumference (${expectedCircumferenceMm.toFixed(1)}mm) by ${diffMm.toFixed(1)}mm. Review wrap placement.`,
  };
}

/**
 * Maps normalized 2D artwork coordinates [u, v] to 3D cylindrical coordinates.
 *
 * Convention:
 * - u in [0, 1] maps horizontally across the label.
 * - u = 0.5 corresponds to theta = 0 (front facing camera along +Z).
 * - u = 0 starts at the back seam (theta = -PI + seamAngle).
 * - u = 1 ends at the back seam (theta = +PI + seamAngle).
 * - v in [0, 1] maps vertically from top (v=0) to bottom (v=1).
 *
 * @param {number} u - Horizontal coordinate in [0, 1]
 * @param {number} v - Vertical coordinate in [0, 1] (0 top, 1 bottom)
 * @param {Object} options
 * @param {number} options.radius - Cylinder radius in mm
 * @param {number} options.height - Cylinder active height in mm
 * @param {number} [options.seamAngle=0] - Angular offset of seam in radians
 * @param {number} [options.yCenter=0] - Vertical center in 3D world space
 * @param {number} [options.surfaceOffset=0.4] - Offset outward from cylinder surface
 * @param {number} [options.wrapSpan=1.0] - Fraction of 360° wrapped (1.0 = full wrap)
 * @returns {{ point: [number, number, number], normal: [number, number, number], theta: number }}
 */
export function mapNormalizedToCylinder(u, v, {
  radius,
  height,
  seamAngle = 0,
  yCenter = 0,
  surfaceOffset = 0.4,
  wrapSpan = 1.0,
} = {}) {
  const R = radius + surfaceOffset;
  // Compute angle around Y axis
  // Center (u=0.5) is at front (+Z)
  const angularSpan = wrapSpan * 2 * Math.PI;
  const theta = (u - 0.5) * angularSpan + seamAngle;

  const x = R * Math.sin(theta);
  const z = R * Math.cos(theta);
  // v=0 is top, v=1 is bottom
  const y = yCenter + (0.5 - v) * height;

  const normal = [Math.sin(theta), 0, Math.cos(theta)];

  return {
    point: [x, y, z],
    normal,
    theta,
  };
}

/**
 * Inverts cylindrical 3D coordinates [x, y, z] back to normalized 2D artwork [u, v].
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {Object} options
 * @param {number} options.height
 * @param {number} [options.seamAngle=0]
 * @param {number} [options.yCenter=0]
 * @param {number} [options.wrapSpan=1.0]
 * @returns {{ u: number, v: number }}
 */
export function mapCylinderToNormalized(x, y, z, {
  height,
  seamAngle = 0,
  yCenter = 0,
  wrapSpan = 1.0,
} = {}) {
  let theta = Math.atan2(x, z) - seamAngle;
  // Normalize theta to [-PI, PI]
  while (theta < -Math.PI) theta += 2 * Math.PI;
  while (theta > Math.PI) theta -= 2 * Math.PI;

  const angularSpan = wrapSpan * 2 * Math.PI;
  const u = (theta / angularSpan) + 0.5;
  const v = 0.5 - ((y - yCenter) / height);

  return {
    u: Math.max(0, Math.min(1, u)),
    v: Math.max(0, Math.min(1, v)),
  };
}

/**
 * Maps normalized 2D artwork coordinates [u, v] to 3D Stand-up Pouch surface.
 *
 * @param {number} u - Horizontal coordinate in [0, 1]
 * @param {number} v - Vertical coordinate in [0, 1] (0 top, 1 bottom)
 * @param {Object} options
 * @param {number} options.width - Pouch total width
 * @param {number} options.height - Pouch total height
 * @param {number} options.depth - Maximum depth at gusset
 * @param {number} [options.inflation=1.0] - Inflation factor 0.0 (flat) to 1.0 (full)
 * @param {string} [options.face='front'] - 'front' (+Z) or 'back' (-Z)
 * @param {number} [options.surfaceOffset=0.5]
 * @returns {{ point: [number, number, number], normal: [number, number, number] }}
 */
export function mapNormalizedToPouch(u, v, {
  width,
  height,
  depth,
  inflation = 1.0,
  face = 'front',
  surfaceOffset = 0.5,
} = {}) {
  const isFront = face === 'front';
  const sign = isFront ? 1 : -1;
  const D = depth * Math.max(0, Math.min(1, inflation));

  const x = (u - 0.5) * width;
  const y = (0.5 - v) * height;

  const nx = (2 * x) / width;
  const ny = (y + height / 2) / height;

  // Soft pillow curvature
  const xFactor = Math.max(0, 1 - nx * nx);
  const yFactor = Math.sin((1 - Math.max(0, Math.min(1, ny))) * Math.PI * 0.85);

  const z = sign * (D * 0.5 * xFactor * yFactor + surfaceOffset);
  const normal = [0, 0, sign];

  return {
    point: [x, y, z],
    normal,
  };
}
