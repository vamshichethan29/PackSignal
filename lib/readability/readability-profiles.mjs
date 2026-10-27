/**
 * Human Visual Acuity Profiles & Text Readability Screening Models.
 * (lib/readability/readability-profiles.mjs)
 *
 * Implements transparent, evidence-based visual screening heuristics:
 *
 * 1. Visual Acuity Fundamentals:
 *    - Standard 20/20 vision (1.0 decimal acuity, logMAR 0.0) can resolve 1 arcminute stroke width.
 *    - In standard 5×5 Snellen optotypes or typical typography, this corresponds to approximately:
 *        * 5.0 arcminutes: Theoretical minimum recognition threshold for isolated letters under bright light.
 *        * 8.0 - 10.0 arcminutes: Threshold for comfortable, fluent continuous reading.
 *        * > 12.0 arcminutes: Prominent, high-salience display typography.
 *
 * 2. Visual Profiles:
 *    - STANDARD_20_20: Corrected adult vision under typical supermarket shelf lighting (approx. 500 lux).
 *    - AGE_RELATED_40_PLUS: Presbyopic adult; reduced crystalline lens accommodation and pupillary miosis.
 *    - MILD_LOW_VISION: Mildly impaired visual acuity (~20/70 Snellen) without optical aids.
 *
 * 3. Screening Categories:
 *    - LOW_VISUAL_SIZE_RISK: Angular height >= comfortable reading threshold; contrast acceptable.
 *    - ELEVATED_READABILITY_RISK: Angular height between resolution threshold and comfortable reading threshold, or low contrast.
 *    - HIGH_READABILITY_RISK: Angular height below resolution threshold under the selected viewing profile.
 *    - INSUFFICIENT_DATA: Missing physical dimensions or obscured text.
 *
 * SCIENTIFIC & REGULATORY BOUNDARY:
 * These categories are engineering design screening categories. They are NOT legal
 * compliance verdicts, and they do NOT constitute clinically validated medical
 * visual acuity predictions for any individual shopper.
 */

export const READABILITY_RISK = Object.freeze({
  LOW_VISUAL_SIZE_RISK: 'LOW_VISUAL_SIZE_RISK',
  ELEVATED_READABILITY_RISK: 'ELEVATED_READABILITY_RISK',
  HIGH_READABILITY_RISK: 'HIGH_READABILITY_RISK',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA'
});

export const READABILITY_PROFILES = Object.freeze({
  STANDARD_20_20: {
    id: 'STANDARD_20_20',
    label: 'Standard Shopper (20/20 Vision)',
    snellenEquivalent: '20/20',
    decimalAcuity: 1.0,
    logMAR: 0.0,
    resolutionThresholdArcMin: 5.0,  // Critical minimum for letterform identification
    comfortableReadingArcMin: 10.0,  // Threshold for effortless continuous text reading
    description: 'Standard corrected adult visual acuity under retail shelf lighting (approx. 500 lux).',
    assumptions: 'Assumes 500 lux retail illumination, standard font stroke contrast, and upright orientation.',
    limitations: 'Screening heuristic based on standard geometric optics; individual acuity varies with glare, fatigue, and ocular health.'
  },
  AGE_RELATED_40_PLUS: {
    id: 'AGE_RELATED_40_PLUS',
    label: 'Age 40+ / Presbyopic Shopper',
    snellenEquivalent: '20/40',
    decimalAcuity: 0.5,
    logMAR: 0.3,
    resolutionThresholdArcMin: 8.0,
    comfortableReadingArcMin: 15.0,
    description: 'Presbyopic adult; accounts for age-related lens stiffening, reduced light transmission, and mild astigmatism.',
    assumptions: 'Assumes unmagnified retail viewing without reading glasses.',
    limitations: 'Average population curve; does not represent shoppers wearing progressive or bifocal corrective lenses.'
  },
  MILD_LOW_VISION: {
    id: 'MILD_LOW_VISION',
    label: 'Low Vision Shopper (20/70 Snellen)',
    snellenEquivalent: '20/70',
    decimalAcuity: 0.28,
    logMAR: 0.54,
    resolutionThresholdArcMin: 17.5,
    comfortableReadingArcMin: 28.0,
    description: 'Mild visual impairment; represents shoppers needing significantly larger angular text to identify characters.',
    assumptions: 'Assumes naked-eye viewing without smartphone magnification or handheld loupes.',
    limitations: 'Informational accessibility screening guide; not a substitute for clinical accessibility testing.'
  }
});

/**
 * Classifies the readability risk of a text region based on subtended visual angle and profile.
 *
 * @param {Object} params
 * @param {number} params.angularHeightArcMin - Subtended letter height in arcminutes
 * @param {string} [params.profileId='STANDARD_20_20']
 * @param {Object} [params.contrastRecord] - Contrast analysis record from text-contrast.mjs
 * @param {boolean} [params.isMandatory=false] - Whether this is a legally required label element
 * @returns {Object} Risk classification record
 */
export function classifyReadabilityRisk({
  angularHeightArcMin,
  profileId = 'STANDARD_20_20',
  contrastRecord = null,
  isMandatory = false
} = {}) {
  const profile = READABILITY_PROFILES[profileId] || READABILITY_PROFILES.STANDARD_20_20;

  if (angularHeightArcMin == null || !Number.isFinite(angularHeightArcMin) || angularHeightArcMin <= 0) {
    return {
      riskLevel: READABILITY_RISK.INSUFFICIENT_DATA,
      profileId: profile.id,
      angularHeightArcMin: null,
      explanation: 'Angular size could not be computed due to missing physical dimensions.',
      recommendation: 'Verify physical packaging dimensions and native PDF font geometry.',
      thresholds: {
        resolutionThresholdArcMin: profile.resolutionThresholdArcMin,
        comfortableReadingArcMin: profile.comfortableReadingArcMin
      }
    };
  }

  const arcMin = Math.round(angularHeightArcMin * 100) / 100;
  const isBelowResolution = arcMin < profile.resolutionThresholdArcMin;
  const isBelowComfort = arcMin < profile.comfortableReadingArcMin;
  const hasLowContrast = contrastRecord && contrastRecord.contrastRatio != null && contrastRecord.contrastRatio < 3.0;

  let riskLevel;
  let explanation;
  let recommendation;

  if (isBelowResolution) {
    riskLevel = READABILITY_RISK.HIGH_READABILITY_RISK;
    explanation = (
      `Angular height (${arcMin} arcmin) is below the ${profile.label} resolution threshold ` +
      `(${profile.resolutionThresholdArcMin} arcmin). Most shoppers under this profile will struggle to distinguish individual letterforms.`
    );
    recommendation = isMandatory
      ? 'Increase physical type height, move to front panel, or optimize letter-spacing to prevent consumer dropout at this shelf distance.'
      : 'Consider increasing type size or visual contrast if key marketing claim is intended for aisle browsing.';
  } else if (isBelowComfort || hasLowContrast) {
    riskLevel = READABILITY_RISK.ELEVATED_READABILITY_RISK;
    explanation = hasLowContrast
      ? `Angular height (${arcMin} arcmin) meets resolution limit, but low contrast ratio (${contrastRecord.contrastRatio}:1) creates elevated reading fatigue.`
      : `Angular height (${arcMin} arcmin) is above resolution threshold (${profile.resolutionThresholdArcMin} arcmin) but below comfortable reading size (${profile.comfortableReadingArcMin} arcmin).`;
    recommendation = hasLowContrast
      ? 'Improve text-to-background contrast or add an opaque backing box.'
      : 'Readable with deliberate inspection; increase letter height for effortless glanceability.';
  } else {
    riskLevel = READABILITY_RISK.LOW_VISUAL_SIZE_RISK;
    explanation = (
      `Angular height (${arcMin} arcmin) exceeds the comfortable reading threshold ` +
      `(${profile.comfortableReadingArcMin} arcmin) under the ${profile.label} profile.`
    );
    recommendation = 'Letter height is well-proportioned for this viewing distance.';
  }

  return {
    riskLevel,
    profileId: profile.id,
    profileLabel: profile.label,
    snellenEquivalent: profile.snellenEquivalent,
    angularHeightArcMin: arcMin,
    explanation,
    recommendation,
    thresholds: {
      resolutionThresholdArcMin: profile.resolutionThresholdArcMin,
      comfortableReadingArcMin: profile.comfortableReadingArcMin
    },
    contrastFactored: Boolean(contrastRecord?.contrastRatio != null),
    limitations: profile.limitations
  };
}
