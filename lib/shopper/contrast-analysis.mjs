/**
 * PackSignal — Phase 6A: Contrast & Packaging Accessibility Analysis
 * Relative luminance calculation, WCAG 2.2 digital heuristics vs packaging press disclaimers,
 * and strict separation of digital contrast heuristics from FDA statutory requirements.
 *
 * (lib/shopper/contrast-analysis.mjs)
 */

import {
  CONTRAST_BENCHMARKS,
  MODEL_DISCLAIMERS
} from './experience-schema.mjs';

export const CONTRAST_MODEL_VERSION = '2026.04-wcag-packaging-v1';

/**
 * Converts sRGB 8-bit channel (0-255) to linear relative luminance component.
 */
export function sRGBChannelToLinear(channel255) {
  const c = Math.max(0, Math.min(255, channel255)) / 255.0;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculates relative luminance for an RGB color (each 0-255).
 * Formula: L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin
 */
export function calculateRelativeLuminance(r, g, b) {
  const rLin = sRGBChannelToLinear(r);
  const gLin = sRGBChannelToLinear(g);
  const bLin = sRGBChannelToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Parses hex color '#RRGGBB' or '#RGB' to [r, g, b].
 */
export function parseHexColor(hexStr) {
  if (!hexStr || typeof hexStr !== 'string') return null;
  let clean = hexStr.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((ch) => ch + ch).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Calculates the contrast ratio between two colors (hex string or [r, g, b]).
 * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 >= L2.
 */
export function calculateContrastRatio(colorA, colorB) {
  const rgbA = Array.isArray(colorA) ? colorA : parseHexColor(colorA);
  const rgbB = Array.isArray(colorB) ? colorB : parseHexColor(colorB);

  if (!rgbA || !rgbB) {
    return {
      ratio: null,
      isValid: false,
      reason: 'Invalid color specification'
    };
  }

  const lumA = calculateRelativeLuminance(rgbA[0], rgbA[1], rgbA[2]);
  const lumB = calculateRelativeLuminance(rgbB[0], rgbB[1], rgbB[2]);

  const l1 = Math.max(lumA, lumB);
  const l2 = Math.min(lumA, lumB);

  const ratio = (l1 + 0.05) / (l2 + 0.05);
  return {
    ratio: Number(ratio.toFixed(2)),
    lumA: Number(lumA.toFixed(4)),
    lumB: Number(lumB.toFixed(4)),
    isValid: true
  };
}

/**
 * Evaluates contrast against WCAG digital heuristics and packaging benchmarks.
 * STRICT: Does NOT declare FDA violation based solely on WCAG numbers.
 */
export function evaluateTextContrast({
  declarationName = 'Required Declaration',
  foregroundColor,
  backgroundColor,
  isLargeText = false, // >= 18pt or >= 14pt bold
  backgroundType = 'SOLID', // 'SOLID', 'GRADIENT', 'PHOTOGRAPHIC', 'COMPLEX'
  statutoryRule = 'FDA 21 CFR 101.15 (Conspicuousness)'
} = {}) {
  // If background is photographic or complex pattern without separable color
  if (backgroundType === 'PHOTOGRAPHIC' || backgroundType === 'COMPLEX') {
    return {
      declarationName,
      status: 'CANNOT_DETERMINE_RELIABLY',
      contrastRatio: null,
      backgroundType,
      heuristicCategory: CONTRAST_BENCHMARKS.PACKAGING_CONTRAST_HEURISTIC,
      reason: 'Text is placed over photographic or variable background; localized raster sampling produces high color variance.',
      remediationSuggestion: 'Ensure a solid or semi-opaque bounding pill/box is placed beneath mandatory regulatory text.',
      statutoryRule,
      legalStatus: 'REVIEW_REQUIRED_VISUAL_INSPECTION',
      limitations: [
        MODEL_DISCLAIMERS.CONTRAST_ANALYSIS,
        'Cannot compute singular contrast ratio on photographic textures without spatial luminance map.'
      ]
    };
  }

  const res = calculateContrastRatio(foregroundColor, backgroundColor);
  if (!res.isValid) {
    return {
      declarationName,
      status: 'CANNOT_DETERMINE_RELIABLY',
      contrastRatio: null,
      heuristicCategory: CONTRAST_BENCHMARKS.PACKAGING_CONTRAST_HEURISTIC,
      reason: res.reason,
      statutoryRule,
      legalStatus: 'REVIEW_REQUIRED_COLOR_EXTRACTION'
    };
  }

  const ratio = res.ratio;
  const wcagNormalThreshold = 4.5;
  const wcagLargeThreshold = 3.0;
  const targetThreshold = isLargeText ? wcagLargeThreshold : wcagNormalThreshold;

  const passesWcagDigitalHeuristic = ratio >= targetThreshold;

  // Evaluate gradient risk
  let gradientNote = null;
  if (backgroundType === 'GRADIENT') {
    gradientNote = 'Background contains a color gradient; worst-case sampled ratio reported.';
  }

  return {
    declarationName,
    status: passesWcagDigitalHeuristic ? 'PASSES_DIGITAL_HEURISTIC' : 'POTENTIAL_LOW_CONTRAST',
    contrastRatio: ratio,
    isLargeText,
    targetThreshold,
    passesWcagDigitalHeuristic,
    backgroundType,
    gradientNote,
    heuristicCategory: CONTRAST_BENCHMARKS.PACKAGING_CONTRAST_HEURISTIC,
    legalDistinction: {
      statutoryRule,
      ruleText: 'US FDA 21 CFR 101.15 requires conspicuousness and prominent contrast with background, but does NOT codify WCAG 2.2 digital ratios.',
      legalTypographyNote: 'Digital WCAG ratios are informational design heuristics, not direct FDA codifications.'
    },
    suggestedFix: !passesWcagDigitalHeuristic ? {
      optionTitle: 'Enhance Text-to-Background Contrast',
      rationale: `Current estimated ratio is ${ratio}:1, below the ${targetThreshold}:1 digital accessibility benchmark.`,
      action: 'Increase background lightness or place a solid backing shape behind mandatory declarations.'
    } : null,
    limitations: [MODEL_DISCLAIMERS.CONTRAST_ANALYSIS]
  };
}
