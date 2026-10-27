/**
 * Visual Angle & Retinal Projection Calculator for Packaging Typography.
 * (lib/readability/visual-angle.mjs)
 *
 * Implements physically consistent angular-size calculations for packaging text:
 *
 * Exact optical projection formula:
 *   theta = 2 * atan((h * cos(phi)) / (2 * d))
 *
 * Where:
 *   h   = physical glyph height (mm)
 *   d   = viewing distance (mm)
 *   phi = surface normal angle relative to line of sight (radians, 0 = perpendicular)
 *
 * Converts between:
 *   - Radians
 *   - Degrees (deg = rad * 180 / PI)
 *   - Arcminutes (arcmin = deg * 60)
 *   - Arcseconds (arcsec = arcmin * 60)
 *
 * In addition:
 *   Small-angle approximation: theta_approx = (h * cos(phi)) / d (radians)
 *   For typical reading distances (d >> h), theta ≈ theta_approx.
 *   Doubling the distance halves the subtended angular size.
 *
 * Important Scientific Boundaries:
 *   Visual angle is a geometrical input to human vision models, not a sole predictor
 *   of legibility. Contrast, stroke thickness, font x-height, illumination,
 *   and individual acuity are independent factors.
 */

export const ARC_MINUTES_PER_DEGREE = 60.0;
export const ARC_SECONDS_PER_DEGREE = 3600.0;
export const MM_PER_CM = 10.0;
export const MM_PER_METER = 1000.0;
export const MM_PER_INCH = 25.4;
export const PT_TO_MM = 25.4 / 72.0;

/**
 * Standard distance boundary constants (cm).
 */
export const DISTANCE_BOUNDS_CM = Object.freeze({
  MIN: 30.0,    // 30 cm (arm's length / close inspection)
  MAX: 200.0,   // 200 cm (2 meters / typical retail aisle shelf view)
  DEFAULT: 100.0, // 100 cm (1 meter / standard shopping standing distance)
  STEP: 10.0,    // Standard slider step
  FINE_STEP: 1.0 // Keyboard fine step
});

/**
 * Common shelf viewing distance presets.
 */
export const DISTANCE_PRESETS_CM = Object.freeze([
  { cm: 30,  meters: 0.30, label: '30 cm',  scenario: 'Handheld Close Inspection' },
  { cm: 50,  meters: 0.50, label: '50 cm',  scenario: 'Reading at Arm\'s Length' },
  { cm: 75,  meters: 0.75, label: '75 cm',  scenario: 'Close Shelf Browse' },
  { cm: 100, meters: 1.00, label: '1 m',    scenario: 'Standard Standing Distance (Default)' },
  { cm: 125, meters: 1.25, label: '1.25 m', scenario: 'Aisle Cart Perspective' },
  { cm: 150, meters: 1.50, label: '1.5 m',  scenario: 'Mid-Aisle Glance' },
  { cm: 175, meters: 1.75, label: '1.75 m', scenario: 'Opposite Shelf Browse' },
  { cm: 200, meters: 2.00, label: '2 m',    scenario: 'Supermarket Aisle Transition' }
]);

/**
 * Calculates subtended visual angle from physical glyph height and viewing distance.
 *
 * @param {Object} params
 * @param {number} params.physicalHeightMm - Measured letter height in millimeters (must be > 0)
 * @param {number} [params.distanceCm] - Viewing distance in centimeters (30 - 200)
 * @param {number} [params.distanceMm] - Viewing distance in millimeters (alternative to distanceCm)
 * @param {number} [params.viewingAngleRad=0] - Angle of incidence off-normal (0 = perpendicular)
 * @param {number} [params.viewingAngleDeg] - Angle in degrees (alternative to viewingAngleRad)
 * @param {string} [params.measurementMethod='NATIVE_CHARACTER_GEOMETRY']
 * @returns {Object} Angular geometry record
 */
export function calculateVisualAngle({
  physicalHeightMm,
  distanceCm,
  distanceMm,
  viewingAngleRad = 0,
  viewingAngleDeg = null,
  measurementMethod = 'NATIVE_CHARACTER_GEOMETRY'
} = {}) {
  // Validate physical height
  const h = Number(physicalHeightMm);
  if (!Number.isFinite(h) || h <= 0) {
    return {
      status: 'INSUFFICIENT_DATA',
      physicalHeightMm: null,
      distanceMm: null,
      distanceCm: null,
      angularHeightRad: null,
      angularHeightDeg: null,
      angularHeightArcMin: null,
      measurementMethod,
      explanation: 'Invalid or missing physical glyph height (mm). Cannot compute visual angle.'
    };
  }

  // Resolve distance in mm and cm
  let dMm = null;
  if (distanceMm != null && Number.isFinite(Number(distanceMm)) && Number(distanceMm) > 0) {
    dMm = Number(distanceMm);
  } else if (distanceCm != null && Number.isFinite(Number(distanceCm)) && Number(distanceCm) > 0) {
    dMm = Number(distanceCm) * MM_PER_CM;
  } else {
    dMm = DISTANCE_BOUNDS_CM.DEFAULT * MM_PER_CM;
  }
  const dCm = dMm / MM_PER_CM;
  const dM = dMm / MM_PER_METER;

  // Resolve viewing angle (radians)
  let phi = Number(viewingAngleRad);
  if (viewingAngleDeg != null && Number.isFinite(Number(viewingAngleDeg))) {
    phi = (Number(viewingAngleDeg) * Math.PI) / 180.0;
  }
  if (!Number.isFinite(phi)) phi = 0;

  // Account for surface normal slant (cosine foreshortening)
  const cosPhi = Math.max(0, Math.cos(phi));
  const effectiveHeightMm = h * cosPhi;

  // Exact formula: theta = 2 * atan(h_eff / (2 * d))
  const thetaRad = 2.0 * Math.atan(effectiveHeightMm / (2.0 * dMm));
  const thetaDeg = (thetaRad * 180.0) / Math.PI;
  const thetaArcMin = thetaDeg * ARC_MINUTES_PER_DEGREE;
  const thetaArcSec = thetaDeg * ARC_SECONDS_PER_DEGREE;

  // Small-angle approximation: theta ≈ h_eff / d
  const approxRad = effectiveHeightMm / dMm;
  const approxArcMin = (approxRad * 180.0 / Math.PI) * ARC_MINUTES_PER_DEGREE;

  return {
    status: 'VERIFIED',
    physicalHeightMm: Math.round(h * 1000) / 1000,
    effectiveHeightMm: Math.round(effectiveHeightMm * 1000) / 1000,
    distanceMm: Math.round(dMm * 10) / 10,
    distanceCm: Math.round(dCm * 10) / 10,
    distanceMeters: Math.round(dM * 100) / 100,
    viewingAngleRad: Math.round(phi * 10000) / 10000,
    viewingAngleDeg: Math.round((phi * 180.0 / Math.PI) * 10) / 10,
    angularHeightRad: thetaRad,
    angularHeightDeg: Math.round(thetaDeg * 10000) / 10000,
    angularHeightArcMin: Math.round(thetaArcMin * 100) / 100,
    angularHeightArcSec: Math.round(thetaArcSec * 10) / 10,
    smallAngleApproximationArcMin: Math.round(approxArcMin * 100) / 100,
    smallAngleDeltaPercent: Math.abs((thetaArcMin - approxArcMin) / thetaArcMin) * 100,
    measurementMethod,
    formula: 'theta = 2 * atan((h * cos(phi)) / (2 * d))',
    assumptions: 'Planar optical projection onto standard retinal plane. Geometric visual angle only; does not predict neural contrast or individual optical aberrations.'
  };
}

/**
 * Calculates the required physical glyph height (mm) to subtend a target visual angle at distance d.
 * Useful for prepress designers sizing mandatory copy for target shelf distances.
 *
 * h = 2 * d * tan(theta / 2)
 *
 * @param {number} targetArcMin - Target subtended angle in arcminutes (e.g. 5.0 for standard limit)
 * @param {number} distanceCm - Viewing distance in centimeters
 * @returns {number} Required height in millimeters
 */
export function calculateRequiredHeightMmForArcMin(targetArcMin, distanceCm) {
  if (!targetArcMin || !distanceCm || distanceCm <= 0) return null;
  const thetaDeg = targetArcMin / ARC_MINUTES_PER_DEGREE;
  const thetaRad = (thetaDeg * Math.PI) / 180.0;
  const dMm = distanceCm * MM_PER_CM;
  const hMm = 2.0 * dMm * Math.tan(thetaRad / 2.0);
  return Math.round(hMm * 1000) / 1000;
}

/**
 * Converts nominal font points (pt) to estimated physical glyph heights.
 * Note: Nominal font size represents the em-square, NOT the uppercase or lowercase printed letter!
 *
 * Typically:
 * - Cap height ≈ 0.70 × nominal pt
 * - Lowercase "x" / "o" (x-height) ≈ 0.50 × nominal pt
 *
 * @param {number} nominalPt
 * @param {string} [glyphType='lowercase_o'] - 'capital', 'lowercase_o', 'em_box'
 * @returns {number} Estimated height in mm
 */
export function nominalPtToEstimatedMm(nominalPt, glyphType = 'lowercase_o') {
  if (!nominalPt || nominalPt <= 0) return null;
  const emMm = nominalPt * PT_TO_MM;
  if (glyphType === 'em_box') return Math.round(emMm * 1000) / 1000;
  if (glyphType === 'capital') return Math.round(emMm * 0.70 * 1000) / 1000;
  return Math.round(emMm * 0.50 * 1000) / 1000;
}
