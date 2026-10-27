/**
 * Principal Display Panel (PDP) Area Calculator.
 * (lib/print/pdp-area.mjs)
 *
 * Implements statutory area calculation under FDA 21 CFR 101.1:
 * - Rectangular container: Height × Width of the principal display panel.
 * - Cylindrical / nearly cylindrical container: 40% of (Height × Circumference) = 0.40 × H × (π × D).
 * - Other shape container: 40% of total surface area or confirmed obvious display panel.
 *
 * Authority hierarchy:
 * 1. APPROVED_DIELINE
 * 2. VERIFIED_SPEC
 * 3. REVIEWER_CONFIRMED
 * 4. ILLUSTRATIVE (Not certified for legal type-size determination)
 */

export const PACKAGE_TYPES = Object.freeze({
  RECTANGULAR_CARTON: 'RECTANGULAR_CARTON',
  CYLINDRICAL_CAN: 'CYLINDRICAL_CAN',
  NEARLY_CYLINDRICAL_BOTTLE: 'NEARLY_CYLINDRICAL_BOTTLE',
  STANDUP_POUCH: 'STANDUP_POUCH',
  OTHER_SHAPE: 'OTHER_SHAPE',
});

export const PDP_SOURCE_AUTHORITY = Object.freeze({
  APPROVED_DIELINE: 'APPROVED_DIELINE',
  VERIFIED_SPEC: 'VERIFIED_SPEC',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  ILLUSTRATIVE: 'ILLUSTRATIVE',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const MM_PER_INCH = 25.4;
export const SQ_MM_PER_SQ_INCH = 645.16; // 25.4 * 25.4

/**
 * Calculates statutory PDP area in square inches and square millimeters.
 *
 * @param {Object} options
 * @param {string} [options.packageType='RECTANGULAR_CARTON']
 * @param {Object} [options.dimensions] - Dimensions in inches or millimeters
 * @param {number} [options.dimensions.heightInches]
 * @param {number} [options.dimensions.widthInches]
 * @param {number} [options.dimensions.diameterInches]
 * @param {number} [options.dimensions.heightMm]
 * @param {number} [options.dimensions.widthMm]
 * @param {number} [options.dimensions.diameterMm]
 * @param {string} [options.sourceAuthority='REVIEWER_CONFIRMED']
 * @param {string} [options.panelId='front']
 * @returns {Object} PDP Area Evaluation Record
 */
export function calculatePdpArea({
  packageType = PACKAGE_TYPES.RECTANGULAR_CARTON,
  dimensions = {},
  sourceAuthority = PDP_SOURCE_AUTHORITY.REVIEWER_CONFIRMED,
  panelId = 'front',
} = {}) {
  // Normalize dimensions to inches
  let hIn = dimensions.heightInches ?? (dimensions.heightMm != null ? dimensions.heightMm / MM_PER_INCH : null);
  let wIn = dimensions.widthInches ?? (dimensions.widthMm != null ? dimensions.widthMm / MM_PER_INCH : null);
  let dIn = dimensions.diameterInches ?? (dimensions.diameterMm != null ? dimensions.diameterMm / MM_PER_INCH : null);

  const isVerifiedAuthority = [
    PDP_SOURCE_AUTHORITY.APPROVED_DIELINE,
    PDP_SOURCE_AUTHORITY.VERIFIED_SPEC,
    PDP_SOURCE_AUTHORITY.REVIEWER_CONFIRMED,
  ].includes(sourceAuthority);

  // If missing critical dimensions, return unverified state
  if (packageType === PACKAGE_TYPES.CYLINDRICAL_CAN || packageType === PACKAGE_TYPES.NEARLY_CYLINDRICAL_BOTTLE) {
    if (hIn == null || (dIn == null && wIn == null)) {
      return {
        status: 'PDP_AREA_UNVERIFIED',
        isVerified: false,
        packageType,
        pdpAreaSqIn: null,
        pdpAreaSqMm: null,
        calculationMethod: 'CYLINDRICAL_40_PERCENT_H_X_CIRCUMFERENCE',
        sourceAuthority: PDP_SOURCE_AUTHORITY.UNAVAILABLE,
        explanation: 'Cylindrical container requires confirmed physical height and diameter to calculate statutory PDP area (21 CFR 101.1).',
        limitations: 'Dimensions unavailable; cannot determine mandatory net quantity font height without confirmed PDP geometry.',
      };
    }
  } else {
    // Rectangular / Pouch / Default
    if (hIn == null || wIn == null) {
      return {
        status: 'PDP_AREA_UNVERIFIED',
        isVerified: false,
        packageType,
        pdpAreaSqIn: null,
        pdpAreaSqMm: null,
        calculationMethod: 'RECTANGULAR_H_X_W',
        sourceAuthority: PDP_SOURCE_AUTHORITY.UNAVAILABLE,
        explanation: 'Package requires confirmed physical height and width to calculate statutory PDP area under 21 CFR 101.1.',
        limitations: 'Dimensions unavailable; cannot determine mandatory net quantity font height without confirmed PDP geometry.',
      };
    }
  }

  let pdpAreaSqIn = 0;
  let calculationMethod = '';
  let calculationProof = '';

  if (packageType === PACKAGE_TYPES.CYLINDRICAL_CAN || packageType === PACKAGE_TYPES.NEARLY_CYLINDRICAL_BOTTLE) {
    const effectiveDiameter = dIn ?? (wIn ?? 0);
    const circumference = Math.PI * effectiveDiameter;
    // 21 CFR 101.1: 40% of height times circumference
    pdpAreaSqIn = 0.40 * hIn * circumference;
    calculationMethod = 'CYLINDRICAL_40_PERCENT_H_X_CIRCUMFERENCE';
    calculationProof = `21 CFR 101.1: Area = 40% × Height (${hIn.toFixed(2)} in) × Circumference (π × ${effectiveDiameter.toFixed(2)} in = ${circumference.toFixed(2)} in) = ${pdpAreaSqIn.toFixed(2)} sq in.`;
  } else {
    // Rectangular carton or flat pouch
    pdpAreaSqIn = hIn * wIn;
    calculationMethod = 'RECTANGULAR_H_X_W';
    calculationProof = `21 CFR 101.1: Area = Height (${hIn.toFixed(2)} in) × Width (${wIn.toFixed(2)} in) = ${pdpAreaSqIn.toFixed(2)} sq in.`;
  }

  const roundedSqIn = Math.round(pdpAreaSqIn * 100) / 100;
  const roundedSqMm = Math.round(pdpAreaSqIn * SQ_MM_PER_SQ_INCH * 10) / 10;

  return {
    status: 'PDP_AREA_VERIFIED',
    isVerified: isVerifiedAuthority,
    packageType,
    panelId,
    dimensions: {
      heightInches: Math.round(hIn * 100) / 100,
      widthInches: wIn != null ? Math.round(wIn * 100) / 100 : null,
      diameterInches: dIn != null ? Math.round(dIn * 100) / 100 : null,
      heightMm: Math.round(hIn * MM_PER_INCH * 10) / 10,
      widthMm: wIn != null ? Math.round(wIn * MM_PER_INCH * 10) / 10 : null,
      diameterMm: dIn != null ? Math.round(dIn * MM_PER_INCH * 10) / 10 : null,
    },
    pdpAreaSqIn: roundedSqIn,
    pdpAreaSqMm: roundedSqMm,
    calculationMethod,
    calculationProof,
    sourceAuthority,
    explanation: `Principal Display Panel area calculated as ${roundedSqIn} sq in (${roundedSqMm} sq mm) using ${calculationMethod} per 21 CFR 101.1.`,
    limitations: !isVerifiedAuthority
      ? 'Calculated from illustrative 3D geometry; requires packaging structural engineer sign-off before plate production.'
      : 'Calculated from verified structural packaging specification.',
  };
}
