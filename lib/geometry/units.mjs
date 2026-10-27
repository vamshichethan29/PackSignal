/**
 * PackSignal Packaging Geometry — Physical Units & Conversions
 * (lib/geometry/units.mjs)
 *
 * Implements Step 2: Physical unit safety and explicit conversions.
 * Avoids guessing or inferring false physical measurements.
 */

export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72.0;
export const MM_PER_POINT = MM_PER_INCH / POINTS_PER_INCH; // ~0.352778 mm
export const POINTS_PER_MM = POINTS_PER_INCH / MM_PER_INCH; // ~2.834646 pt

export const PHYSICAL_CONVERSIONS = {
  millimeters: 1.0,
  millimeter: 1.0,
  mm: 1.0,
  centimeters: 10.0,
  centimeter: 10.0,
  cm: 10.0,
  meters: 1000.0,
  meter: 1000.0,
  m: 1000.0,
  inches: MM_PER_INCH,
  inch: MM_PER_INCH,
  in: MM_PER_INCH,
  feet: MM_PER_INCH * 12.0,
  foot: MM_PER_INCH * 12.0,
  ft: MM_PER_INCH * 12.0,
  points: MM_PER_POINT,
  point: MM_PER_POINT,
  pt: MM_PER_POINT,
  mils: MM_PER_INCH * 0.001,
  mil: MM_PER_INCH * 0.001
};

export const UNIT_STATUS = {
  VERIFIED_PHYSICAL: 'VERIFIED_PHYSICAL',
  UNIT_UNVERIFIED: 'UNIT_UNVERIFIED',
  DIMENSIONLESS: 'DIMENSIONLESS'
};

/**
 * Normalizes unit string name to canonical format.
 */
export function normalizeUnitName(unit) {
  const clean = String(unit || '').toLowerCase().trim();
  if (['mm', 'millimeter', 'millimeters'].includes(clean)) return 'millimeters';
  if (['cm', 'centimeter', 'centimeters'].includes(clean)) return 'centimeters';
  if (['in', 'inch', 'inches'].includes(clean)) return 'inches';
  if (['pt', 'point', 'points'].includes(clean)) return 'points';
  if (['ft', 'foot', 'feet'].includes(clean)) return 'feet';
  if (['mil', 'mils'].includes(clean)) return 'mils';
  if (['m', 'meter', 'meters'].includes(clean)) return 'meters';
  if (['px', 'pixel', 'pixels'].includes(clean)) return 'pixels';
  if (['unitless', 'drawing units', 'drawing_units'].includes(clean)) return 'drawing_units';
  return clean || 'unknown';
}

/**
 * Checks if a unit has a verified physical conversion to millimeters.
 */
export function isPhysicalUnit(unit) {
  const norm = normalizeUnitName(unit);
  return Boolean(PHYSICAL_CONVERSIONS[norm]);
}

/**
 * Converts a measurement value from a source unit to millimeters.
 * If units are not verified physical units, throws or returns error status.
 */
export function toMillimeters(value, sourceUnit) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'INVALID_NUMBER', value: null, unit: 'millimeters' };
  }
  const norm = normalizeUnitName(sourceUnit);
  const factor = PHYSICAL_CONVERSIONS[norm];
  if (!factor) {
    return {
      ok: false,
      error: UNIT_STATUS.UNIT_UNVERIFIED,
      reason: `Unit "${sourceUnit}" cannot be converted to millimeters without verified physical scale.`,
      value: null,
      unit: 'millimeters'
    };
  }
  return {
    ok: true,
    value: num * factor,
    unit: 'millimeters',
    sourceUnit: norm
  };
}

/**
 * Converts millimeters to a target unit.
 */
export function fromMillimeters(valueMm, targetUnit) {
  const num = Number(valueMm);
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'INVALID_NUMBER', value: null };
  }
  const norm = normalizeUnitName(targetUnit);
  const factor = PHYSICAL_CONVERSIONS[norm];
  if (!factor) {
    return {
      ok: false,
      error: UNIT_STATUS.UNIT_UNVERIFIED,
      reason: `Target unit "${targetUnit}" is not a recognized physical unit.`,
      value: null
    };
  }
  return {
    ok: true,
    value: num / factor,
    unit: norm
  };
}

/**
 * Converts PDF native points (1/72 in) to millimeters.
 */
export function pdfPointsToMillimeters(points) {
  return toMillimeters(points, 'points');
}

/**
 * Converts millimeters to PDF native points (1/72 in).
 */
export function millimetersToPdfPoints(mm) {
  return fromMillimeters(mm, 'points');
}
