/**
 * Packaging Typography Contrast & Color Separation Screening Module.
 * (lib/readability/text-contrast.mjs)
 *
 * Implements:
 * 1. Text-to-background relative luminance and contrast ratio estimation.
 * 2. RGB, CMYK, and Spot Color luminance approximations.
 * 3. Handling uncertain/unknown contrast conditions without guessing.
 * 4. Clear boundary between WCAG digital accessibility screening and physical print law.
 *
 * CRITICAL REGULATORY NOTICE:
 * WCAG (Web Content Accessibility Guidelines) 2.1 is an internationally recognized
 * digital web standard. It is NOT a binding physical packaging labeling regulation
 * under US FDA 21 CFR or EU FIC 1169/2011. While FDA requires label information to be
 * "prominently placed... with such conspicuousness as to render it likely to be read",
 * it does NOT prescribe numeric 4.5:1 / 3:1 luminance contrast ratios.
 * WCAG metrics are provided as an optional visual screening reference only.
 */

export const CONTRAST_THRESHOLDS = Object.freeze({
  WCAG_AA_NORMAL_TEXT: 4.5,
  WCAG_AA_LARGE_TEXT: 3.0,
  WCAG_AAA_NORMAL_TEXT: 7.0,
  WCAG_AAA_LARGE_TEXT: 4.5,
  PREPRESS_PRINT_WARNING_THRESHOLD: 2.5
});

/**
 * Gamma-expands standard sRGB color component [0, 1] to linear luminance component.
 *
 * @param {number} c - sRGB component in [0, 1]
 * @returns {number} Linear component
 */
export function sRGBToLinear(c) {
  const val = Math.max(0, Math.min(1, c));
  return val <= 0.04045
    ? val / 12.92
    : Math.pow((val + 0.055) / 1.055, 2.4);
}

/**
 * Calculates standard relative luminance from sRGB components.
 * L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
 *
 * @param {Object} color - { r, g, b } in range [0, 255] or [0, 1]
 * @returns {number} Relative luminance in [0, 1]
 */
export function calculateRelativeLuminance(color) {
  if (!color || typeof color !== 'object') return null;

  let r = Number(color.r ?? 0);
  let g = Number(color.g ?? 0);
  let b = Number(color.b ?? 0);

  // Normalize 0-255 range to 0-1 if values exceed 1
  if (r > 1 || g > 1 || b > 1) {
    r /= 255.0;
    g /= 255.0;
    b /= 255.0;
  }

  const rLin = sRGBToLinear(r);
  const gLin = sRGBToLinear(g);
  const bLin = sRGBToLinear(b);

  const L = 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  return Math.round(L * 10000) / 10000;
}

/**
 * Computes contrast ratio between two relative luminances.
 * ratio = (L1 + 0.05) / (L2 + 0.05), where L1 is lighter (L1 >= L2).
 *
 * @param {number|Object} fg - Foreground luminance or color object
 * @param {number|Object} bg - Background luminance or color object
 * @returns {Object} Contrast evaluation record
 */
export function calculateContrastRatio(fg, bg) {
  const lFg = typeof fg === 'number' ? fg : calculateRelativeLuminance(fg);
  const lBg = typeof bg === 'number' ? bg : calculateRelativeLuminance(bg);

  if (lFg == null || lBg == null || isNaN(lFg) || isNaN(lBg)) {
    return {
      status: 'UNCERTAIN',
      contrastRatio: null,
      method: 'COLOR_UNRESOLVED',
      explanation: 'Foreground or background color could not be deterministically determined from artwork stream.',
      regulatoryNotice: 'WCAG contrast ratio is an optional digital screening metric, not binding packaging law.'
    };
  }

  const l1 = Math.max(lFg, lBg);
  const l2 = Math.min(lFg, lBg);
  const ratio = (l1 + 0.05) / (l2 + 0.05);
  const roundedRatio = Math.round(ratio * 100) / 100;

  return {
    status: 'VERIFIED',
    contrastRatio: roundedRatio,
    foregroundLuminance: lFg,
    backgroundLuminance: lBg,
    isDarkOnLight: lFg < lBg,
    isLightOnDark: lFg >= lBg,
    screeningClassification: roundedRatio >= 4.5
      ? 'ROBUST_CONTRAST'
      : (roundedRatio >= 3.0 ? 'MODERATE_CONTRAST' : 'LOW_CONTRAST_RISK'),
    wcagAANormalTextPass: roundedRatio >= CONTRAST_THRESHOLDS.WCAG_AA_NORMAL_TEXT,
    wcagAALargeTextPass: roundedRatio >= CONTRAST_THRESHOLDS.WCAG_AA_LARGE_TEXT,
    regulatoryNotice: 'Screen contrast screening reference only. Printed packaging visibility depends on ink opacity, substrate reflectance, and lighting.'
  };
}

/**
 * Converts CMYK ink density fractions [0, 1] to approximate sRGB color for preview screening.
 *
 * @param {number} c - Cyan [0, 1]
 * @param {number} m - Magenta [0, 1]
 * @param {number} y - Yellow [0, 1]
 * @param {number} k - Black [0, 1]
 * @returns {Object} { r, g, b } in [0, 255]
 */
export function cmykToApproximateRgb(c = 0, m = 0, y = 0, k = 0) {
  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));
  return { r: Math.max(0, r), g: Math.max(0, g), b: Math.max(0, b) };
}

/**
 * Estimates text-to-background contrast for a text run record from PDF prepress evidence.
 *
 * @param {Object} textRun - Text run from native font inspector or prepress
 * @param {Object} [pageColorContext] - Color spaces, spot colors, or raster substrate data
 * @returns {Object} Contrast analysis record
 */
export function estimateTextRunContrast(textRun, pageColorContext = {}) {
  if (!textRun) {
    return {
      status: 'UNCERTAIN',
      contrastRatio: null,
      method: 'NO_TEXT_RUN',
      explanation: 'No text run provided for contrast estimation.'
    };
  }

  // 1. Check if explicit RGB or CMYK fill color was extracted from PDF text operators
  let fgColor = null;
  if (textRun.fillColorRgb) {
    fgColor = textRun.fillColorRgb;
  } else if (textRun.fillColorCmyk) {
    const { c, m, y, k } = textRun.fillColorCmyk;
    fgColor = cmykToApproximateRgb(c, m, y, k);
  }

  // 2. Check if background color was sampled or identified
  let bgColor = textRun.backgroundColorRgb || pageColorContext.defaultSubstrateRgb || null;

  // If substrate is unverified white carton board (common default)
  if (!bgColor && pageColorContext.assumeWhiteSubstrate) {
    bgColor = { r: 255, g: 255, b: 255 };
  }

  if (!fgColor || !bgColor) {
    return {
      status: 'UNCERTAIN',
      contrastRatio: null,
      method: 'ESTIMATED_UNKNOWN',
      explanation: 'Background color compositing under vector text cannot be deterministically isolated without full raster rendering.',
      limitations: 'Vector PDF stream contains layered graphic objects; automated color separation cannot certify contrast without press color proof.',
      regulatoryNotice: 'WCAG screen contrast is an optional digital screening guideline, NOT a binding physical packaging print law or FDA requirement.'
    };
  }

  const contrastResult = calculateContrastRatio(fgColor, bgColor);
  return {
    ...contrastResult,
    foregroundColor: fgColor,
    backgroundColor: bgColor,
    method: 'COMPUTED_FROM_PDF_OPERATORS'
  };
}
