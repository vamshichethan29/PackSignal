/**
 * PackSignal Physical Prepress — Total Area Coverage (TAC) & Separation Radar
 * (lib/prepress/tac-analysis.mjs)
 *
 * Implements Upgrade #46 Phases 2, 3, 4, 5, 6:
 * Mathematical TAC = C + M + Y + K, color evidence authority provenance,
 * separation-aware overprint/knockout semantics, and artwork-aligned ink density hotspots.
 */

import { getPressProfile } from './press-profiles.mjs';

export const COLOR_EVIDENCE_AUTHORITY = {
  MEASURED_FROM_SOURCE: 'MEASURED_FROM_SOURCE',
  PROFILE_CONVERTED_ESTIMATE: 'PROFILE_CONVERTED_ESTIMATE',
  SIMULATED_OUTPUT_SEPARATIONS: 'SIMULATED_OUTPUT_SEPARATIONS',
  UNSUPPORTED_COLOR_SPACE: 'UNSUPPORTED_COLOR_SPACE',
  UNABLE_TO_MEASURE_TAC: 'UNABLE_TO_MEASURE_TAC',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
};

export const HOTSPOT_SEVERITY = {
  COMPLIANT: 'GREEN',
  WARNING: 'AMBER',
  CRITICAL: 'RED',
  UNEVALUATED: 'GRAY',
};

/**
 * Calculates TAC percentage for a 4-color CMYK tuple (each channel in range 0..100).
 * Mathematical definition: TAC = C + M + Y + K
 */
export function calculateTac(c = 0, m = 0, y = 0, k = 0) {
  const cPct = Math.max(0, Math.min(100, Number(c) || 0));
  const mPct = Math.max(0, Math.min(100, Number(m) || 0));
  const yPct = Math.max(0, Math.min(100, Number(y) || 0));
  const kPct = Math.max(0, Math.min(100, Number(k) || 0));
  return Math.round(cPct + mPct + yPct + kPct);
}

/**
 * Evaluates ink density measurements against an approved press profile.
 *
 * @param {Object} options
 * @param {Array<Object>} options.samples - Array of color separation samples or regions
 * @param {string|Object} [options.pressProfileId='ISO-OFFSET-COATED-300']
 * @param {string} [options.sourceColorSpace='DeviceCMYK']
 * @param {boolean} [options.isIccConverted=false]
 * @param {Array<Object|string>} [options.spotColors=[]]
 */
export function evaluateTacCoverage({
  samples = [],
  pressProfileId = 'ISO-OFFSET-COATED-300',
  sourceColorSpace = 'DeviceCMYK',
  isIccConverted = false,
  spotColors = [],
} = {}) {
  const profile = (pressProfileId && typeof pressProfileId === 'object') ? pressProfileId : getPressProfile(pressProfileId);
  const tacLimit = profile.maximumTAC || profile.tacLimitPercent || profile.tacLimit || 300;

  // Determine color evidence authority
  let authority = COLOR_EVIDENCE_AUTHORITY.MEASURED_FROM_SOURCE;
  let authorityNote = 'CMYK separations measured directly from native PDF vector/raster objects.';

  if (sourceColorSpace === 'DeviceRGB' || sourceColorSpace === 'sRGB') {
    if (isIccConverted) {
      authority = COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE;
      authorityNote = `Measured from RGB source converted via ICC profile (${profile.iccProfileReference || profile.iccProfileId}). Values represent a conversion-dependent estimate, not native press plates.`;
    } else {
      authority = COLOR_EVIDENCE_AUTHORITY.UNSUPPORTED_COLOR_SPACE;
      authorityNote = 'CMYK separation data could not be reliably evaluated for this artwork.';
    }
  } else if (!samples || samples.length === 0) {
    authority = COLOR_EVIDENCE_AUTHORITY.INSUFFICIENT_EVIDENCE;
    authorityNote = 'No measurable color regions or raster separations found in provided artwork.';
  }

  // If RGB and not converted, return honest unmeasured status
  if (authority === COLOR_EVIDENCE_AUTHORITY.UNSUPPORTED_COLOR_SPACE || authority === COLOR_EVIDENCE_AUTHORITY.UNABLE_TO_MEASURE_TAC) {
    return {
      status: 'review',
      verdict: 'TAC_EVALUATION_BLOCKED_RGB',
      checkVerdict: 'UNABLE',
      pressProfile: profile.profileId,
      pressProfileName: profile.name,
      tacLimit,
      tacLimitPercent: tacLimit,
      maximumTAC: tacLimit,
      peakTac: null,
      authority,
      authorityNote,
      hotspots: [],
      spotColors: (spotColors || []).map(s => s.name || s),
      coverageSummary: {
        totalEvaluatedRegions: 0,
        compliantRegions: 0,
        warningRegions: 0,
        exceededRegions: 0,
        uncertainOverprintRegions: 0,
      },
      explanation: 'CMYK separation data could not be reliably evaluated for this artwork.',
      verificationLimitations: 'Source artwork contains DeviceRGB without embedded output intent ICC profile. Real press separation requires CMYK plates.',
    };
  }

  const hotspots = [];
  let peakTac = 0;
  let peakSample = null;
  let compliantCount = 0;
  let warningCount = 0;
  let exceededCount = 0;
  let uncertainOverprintCount = 0;

  for (const s of samples) {
    // If sample contains CMYK channels
    const c = Math.max(0, Math.min(100, Number(s.c ?? s.cyan ?? 0)));
    const m = Math.max(0, Math.min(100, Number(s.m ?? s.magenta ?? 0)));
    const y = Math.max(0, Math.min(100, Number(s.y ?? s.yellow ?? 0)));
    const k = Math.max(0, Math.min(100, Number(s.k ?? s.black ?? 0)));

    // Detect rich black: e.g. K >= 85% and C + M + Y >= 30%
    const isRichBlack = k >= 85 && (c + m + y) >= 30;

    // Overprint handling
    const compositingMode = s.compositingMode || (s.overprint ? 'OVERPRINT' : (s.transparency ? 'TRANSPARENCY_BLENDING' : 'KNOCKOUT'));
    const isOverprintUncertain = s.overprintUncertain === true || (s.overprint && s.overlapping && !s.effectiveSeparations);
    if (isOverprintUncertain) {
      uncertainOverprintCount++;
    }

    const measuredTac = calculateTac(c, m, y, k);
    if (measuredTac > peakTac) {
      peakTac = measuredTac;
      peakSample = s;
    }

    let severity = HOTSPOT_SEVERITY.COMPLIANT;
    // Warning if within 8% of limit or conversion estimate
    if (measuredTac > tacLimit) {
      severity = HOTSPOT_SEVERITY.CRITICAL;
      exceededCount++;
    } else if (measuredTac >= tacLimit * 0.92 || authority === COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE || isOverprintUncertain) {
      severity = HOTSPOT_SEVERITY.WARNING;
      warningCount++;
    } else {
      compliantCount++;
    }

    // Include hotspot if it exceeds limit or is in warning range
    if (severity === HOTSPOT_SEVERITY.CRITICAL || severity === HOTSPOT_SEVERITY.WARNING) {
      const excess = Math.max(0, measuredTac - tacLimit);
      hotspots.push({
        id: `tac-hotspot-${hotspots.length + 1}`,
        documentId: s.documentId || 'artwork-primary',
        page: s.page || 1,
        artworkVersion: s.artworkVersion || 'v1',
        box: s.box || [0.1, 0.1, 0.3, 0.3], // Normalized [x1, y1, x2, y2]
        boundingBox: s.boundingBox || s.box || [0.1, 0.1, 0.3, 0.3],
        colorSpace: s.colorSpace || sourceColorSpace,
        CMYKValues: { c, m, y, k },
        channels: { c, m, y, k },
        TACPercent: measuredTac,
        measuredTac,
        profileLimitPercent: tacLimit,
        maximumTAC: tacLimit,
        limit: tacLimit,
        excessPercentagePoints: excess,
        difference: measuredTac - tacLimit,
        severity,
        pressProfile: profile.profileId,
        colorProfile: profile.iccProfileReference || profile.iccProfileId || 'ISOcoated_v2_eci.icc',
        authority,
        sourceObject: s.objectType || 'Vector / Image Solid',
        sourceObjectIds: s.sourceObjectIds || [s.objectId || `obj-${hotspots.length + 1}`],
        isRichBlack,
        compositingMode,
        overprintUncertain: isOverprintUncertain,
        measurementMethod: s.measurementMethod || (authority === COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE ? 'icc_profile_transformed_rgb' : 'pdf_native_cmyk_object_stream'),
        confidenceLimitations: isOverprintUncertain
          ? 'Combined ink coverage uncertain — overprint/compositing analysis required.'
          : (authority === COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE
            ? 'Values derived from RGB-to-CMYK profile transform; inspect physical separations before plate engraving.'
            : 'Measured from digital artwork; final press dot gain (TVI) may further increase wet ink density.'),
        limitations: isOverprintUncertain
          ? 'Combined ink coverage uncertain — overprint/compositing analysis required.'
          : (authority === COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE
            ? 'Values derived from RGB-to-CMYK profile transform; inspect physical separations before plate engraving.'
            : 'Measured from digital artwork; final press dot gain (TVI) may further increase wet ink density.'),
      });
    }
  }

  const hasExceeded = exceededCount > 0;
  const isReviewRequired = authority === COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE || uncertainOverprintCount > 0;
  const hasWarning = warningCount > 0 || isReviewRequired;

  return {
    status: hasExceeded ? 'issue' : (isReviewRequired ? 'review' : 'match'),
    verdict: hasExceeded ? 'TAC_LIMIT_EXCEEDED' : (hasWarning ? 'TAC_NEAR_LIMIT_OR_ESTIMATE' : 'TAC_WITHIN_LIMIT'),
    pressProfile: profile.profileId,
    pressProfileName: profile.name,
    tacLimit,
    tacLimitPercent: tacLimit,
    maximumTAC: tacLimit,
    peakTac,
    peakChannels: peakSample ? { c: peakSample.c, m: peakSample.m, y: peakSample.y, k: peakSample.k } : null,
    authority,
    authorityNote,
    hotspots,
    spotColors: (spotColors || []).map(s => s.name || s),
    coverageSummary: {
      totalEvaluatedRegions: samples.length,
      compliantRegions: compliantCount,
      warningRegions: warningCount,
      exceededRegions: exceededCount,
      uncertainOverprintRegions: uncertainOverprintCount,
    },
    explanation: hasExceeded
      ? `Total Area Coverage violation: Peak ink density of ${peakTac}% exceeds the approved ${profile.name} limit (${tacLimit}%) by +${peakTac - tacLimit} percentage points. Ink pooling, drying delay, and set-off marking risk.`
      : (hasWarning
        ? (uncertainOverprintCount > 0
          ? 'Combined ink coverage uncertain — overprint/compositing analysis required.'
          : `Total Area Coverage caution: Peak ink density of ${peakTac}% is near the ${tacLimit}% limit of ${profile.name} (${authorityNote}).`)
        : `Total Area Coverage verified: Peak ink density of ${peakTac}% complies with the approved ${profile.name} limit (≤ ${tacLimit}%).`),
  };
}
