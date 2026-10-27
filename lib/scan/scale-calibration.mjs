/**
 * PackSignal — Scale Calibration Engine (lib/scan/scale-calibration.mjs)
 * Phase 10A: Calibrates physical millimeter packaging scale using a standard ID-1 reference card
 * (85.60 mm × 53.98 mm).
 * 
 * Strict Privacy Guidelines:
 * - Encourages blank non-financial calibration targets.
 * - Detects and warns against photographing credit/debit card numbers or CVV.
 * - Enforces coplanarity validation: rejects scale when card is held much closer or at a steep angle.
 */

export const ID1_CARD_NOMINAL_MM = {
  width: 85.60,
  height: 53.98,
  aspectRatio: 85.60 / 53.98, // ~1.5858
};

/**
 * Validates whether the reference card target contains sensitive financial patterns (PAN, CVV, expiry).
 */
export function checkFinancialCardPrivacyRisk(ocrText = '') {
  const norm = String(ocrText).replace(/[\s-]/g, '');

  // Check for 15-16 digit numbers matching payment card patterns (Luhn or simple 16-digit run)
  const hasPossiblePan = /\b(?:\d{4}){4}\b|\b\d{15,16}\b/.test(norm);
  const hasCvvMention = /\bcvv\b|\bcvc\b|\bsecurity\s*code\b/i.test(ocrText);
  const hasCardholderName = /cardholder|valid\s*thru|member\s*since/i.test(ocrText);

  if (hasPossiblePan || hasCvvMention || hasCardholderName) {
    return {
      privacyRisk: true,
      severity: 'WARNING',
      message: 'Privacy Warning: Financial payment card detected. Please use a blank calibration target or cover cardholder numbers.',
      recommendedAction: 'RETAKE_WITH_BLANK_TARGET',
    };
  }

  return {
    privacyRisk: false,
    severity: 'CLEAN',
    message: 'Reference target approved (no personal financial identifiers detected).',
  };
}

/**
 * Computes pixels per millimeter from detected reference card bounding box.
 * Validates coplanarity and perspective.
 */
export function calibratePhysicalScale(cardBox, options = {}) {
  if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
    return {
      valid: false,
      authority: 'UNKNOWN_GEOMETRY',
      error: 'Invalid or missing card bounding box for calibration.',
    };
  }

  const observedRatio = cardBox.width / cardBox.height;
  const ratioDelta = Math.abs(observedRatio - ID1_CARD_NOMINAL_MM.aspectRatio);

  // Depth / coplanar sanity check:
  // If card is held closer to the camera, it occupies a disproportionately large area of the frame.
  const frameWidth = options.frameWidth || 1200;
  const frameHeight = options.frameHeight || 1600;
  const cardArea = cardBox.width * cardBox.height;
  const frameArea = frameWidth * frameHeight;
  const cardFrameFraction = cardArea / Math.max(1, frameArea);

  if (cardFrameFraction > 0.40) {
    return {
      valid: false,
      authority: 'UNKNOWN_GEOMETRY',
      error: 'Calibration rejected: Reference card is held too close to the lens and is not coplanar with packaging surface.',
      suggestedAction: 'Place card flat on carton face at carton depth.',
    };
  }

  // Reject steep perspective tilt (> 25% aspect ratio deviation)
  if (ratioDelta > 0.40) {
    return {
      valid: false,
      authority: 'UNKNOWN_GEOMETRY',
      error: `Card aspect ratio (${observedRatio.toFixed(2)}) deviates excessively from ID-1 standard (1.59). Ensure target is resting flat.`,
      ratioDelta: round(ratioDelta, 3),
    };
  }

  const pxPerMmX = cardBox.width / ID1_CARD_NOMINAL_MM.width;
  const pxPerMmY = cardBox.height / ID1_CARD_NOMINAL_MM.height;
  const pxPerMm = (pxPerMmX + pxPerMmY) / 2;

  // Estimated error in mm/px
  const errorPercent = ratioDelta / ID1_CARD_NOMINAL_MM.aspectRatio;

  return {
    valid: true,
    authority: 'REFERENCE_SCALED_APPROXIMATE_TWIN',
    targetType: 'ID_1_CALIBRATION_CARD',
    nominalDimensionsMm: ID1_CARD_NOMINAL_MM,
    pxPerMm: round(pxPerMm, 3),
    mmPerPx: round(1 / pxPerMm, 4),
    confidence: round(Math.max(0.60, 1.0 - errorPercent), 2),
    estimatedErrorMm: round(errorPercent * 2.0, 2),
    detectedBox: {
      widthPx: cardBox.width,
      heightPx: cardBox.height,
      observedAspectRatio: round(observedRatio, 3),
    },
    coplanarVerified: true,
  };
}

function round(val, dec = 2) {
  const f = Math.pow(10, dec);
  return Math.round(val * f) / f;
}
