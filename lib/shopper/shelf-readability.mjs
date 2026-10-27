/**
 * PackSignal — Phase 6A: Shelf-Distance Readability Model
 * Computational optics, angular retinal projection, threshold crossing detector,
 * and strict separation of legal typography compliance from shopper readability.
 *
 * (lib/shopper/shelf-readability.mjs)
 */

import {
  READABILITY_THRESHOLDS,
  MODEL_DISCLAIMERS
} from './experience-schema.mjs';

export const SHELF_READABILITY_MODEL_VERSION = '2026.04-optics-v1';

export const ARC_MINUTES_PER_DEGREE = 60.0;
export const MM_PER_CM = 10.0;

/**
 * Standard viewing distance boundaries (cm).
 */
export const DISTANCE_BOUNDS_CM = Object.freeze({
  MIN: 30.0,      // 30 cm (~12 inches / close consumer holding inspection)
  MAX: 200.0,     // 200 cm (2 meters / supermarket aisle shelf view)
  DEFAULT: 60.0,  // 60 cm (~24 inches / arm's length shopping viewing distance)
  KEY_POINTS: [30.0, 50.0, 75.0, 100.0, 150.0, 200.0]
});

/**
 * Visual profiles with documented perceptual angular thresholds (in arcminutes).
 * Standard 20/20 Snellen vision: 1 arcmin stroke width, 5 arcmin letter height threshold.
 */
export const VISUAL_PROFILES = Object.freeze({
  STANDARD_20_20: {
    id: 'STANDARD_20_20',
    name: 'Standard Visual Acuity (20/20 Snellen)',
    acuityArcmin: 1.0,
    thresholdArcmin: 5.0,       // Critical threshold for letter identification
    comfortableArcmin: 7.0,     // Fluent, effortless reading threshold
    contrastSensitivity: 1.0,   // Standard Pelli-Robson equivalent
    description: 'Empirical benchmark based on 20/20 Snellen visual acuity under 500 lux retail lighting.'
  },
  LOW_VISION_ILLUSTRATIVE: {
    id: 'LOW_VISION_ILLUSTRATIVE',
    name: 'Illustrative Low-Vision Profile',
    acuityArcmin: 2.0,          // ~20/40 to 20/60 visual acuity
    thresholdArcmin: 8.5,       // Elevated threshold due to reduced spatial acuity
    comfortableArcmin: 12.0,
    contrastSensitivity: 0.65,  // Reduced contrast sensitivity
    mildBlurPx: 1.5,
    description: 'Illustrative profile modeling reduced apparent visual acuity and contrast sensitivity.'
  }
});

/**
 * Calculates physical angular size subtended by a glyph at distance d.
 *
 * Formula:
 *   theta_rad = 2 * Math.atan(h / (2 * (d * 10)))
 *
 * @param {number} heightMm - Physical glyph height in millimeters
 * @param {number} distanceCm - Viewing distance in centimeters
 * @returns {object} { radians, degrees, arcminutes, heightMm, distanceCm }
 */
export function calculateAngularSize(heightMm, distanceCm) {
  if (typeof heightMm !== 'number' || heightMm <= 0 || !Number.isFinite(heightMm)) {
    return {
      radians: 0,
      degrees: 0,
      arcminutes: 0,
      heightMm: heightMm || 0,
      distanceCm: distanceCm || 0,
      isValid: false
    };
  }

  if (typeof distanceCm !== 'number' || distanceCm <= 0 || !Number.isFinite(distanceCm)) {
    return {
      radians: 0,
      degrees: 0,
      arcminutes: 0,
      heightMm,
      distanceCm: distanceCm || 0,
      isValid: false
    };
  }

  const distanceMm = distanceCm * MM_PER_CM;
  const radians = 2.0 * Math.atan(heightMm / (2.0 * distanceMm));
  const degrees = radians * (180.0 / Math.PI);
  const arcminutes = degrees * ARC_MINUTES_PER_DEGREE;

  return {
    radians,
    degrees,
    arcminutes: Number(arcminutes.toFixed(2)),
    heightMm,
    distanceCm,
    distanceMm,
    isValid: true
  };
}

/**
 * Calculates the exact distance in cm where a glyph of height h subtends threshold theta.
 *
 * Inversion of theta = 2 * atan(h / (2 * d_mm)):
 *   tan(theta_rad / 2) = h / (2 * d_mm)
 *   d_mm = h / (2 * tan(theta_rad / 2))
 *   d_cm = d_mm / 10
 */
export function calculateThresholdCrossingDistanceCm(heightMm, thresholdArcmin) {
  if (!heightMm || heightMm <= 0 || !thresholdArcmin || thresholdArcmin <= 0) {
    return null;
  }
  const thresholdDeg = thresholdArcmin / ARC_MINUTES_PER_DEGREE;
  const thresholdRad = thresholdDeg * (Math.PI / 180.0);
  const halfRad = thresholdRad / 2.0;
  const dMm = heightMm / (2.0 * Math.tan(halfRad));
  const dCm = dMm / MM_PER_CM;
  return Number(dCm.toFixed(1));
}

/**
 * Evaluates the readability category of an angular height against a visual profile.
 */
export function evaluateReadabilityCategory(arcminutes, profile = VISUAL_PROFILES.STANDARD_20_20) {
  if (typeof arcminutes !== 'number' || arcminutes <= 0) {
    return READABILITY_THRESHOLDS.INSUFFICIENT_MEASUREMENT;
  }

  const { thresholdArcmin, comfortableArcmin } = profile;
  if (arcminutes >= (comfortableArcmin || thresholdArcmin * 1.3)) {
    return READABILITY_THRESHOLDS.ABOVE_MODELED_THRESHOLD;
  }
  if (arcminutes >= thresholdArcmin) {
    return READABILITY_THRESHOLDS.NEAR_MODELED_THRESHOLD;
  }
  return READABILITY_THRESHOLDS.BELOW_MODELED_THRESHOLD;
}

/**
 * Evaluates an entire required item inventory at a specific viewing distance.
 */
export function evaluateRequiredItemsReadability({
  items = [],
  distanceCm = DISTANCE_BOUNDS_CM.DEFAULT,
  profile = VISUAL_PROFILES.STANDARD_20_20,
  market = 'US'
}) {
  const clampedDistance = Math.max(DISTANCE_BOUNDS_CM.MIN, Math.min(DISTANCE_BOUNDS_CM.MAX, Number(distanceCm) || DISTANCE_BOUNDS_CM.DEFAULT));

  const evaluatedItems = items.map((item) => {
    // Missing items cannot be evaluated for physical readability
    if (item.isMissingContent || !item.actualTextGeometry && !item.physicalHeightMm) {
      return {
        ...item,
        viewingDistanceCm: clampedDistance,
        modelThreshold: profile.thresholdArcmin,
        readabilityEstimate: READABILITY_THRESHOLDS.INSUFFICIENT_MEASUREMENT,
        angularCalculation: null,
        statusNote: 'Missing declaration — reported as missing content finding, not text illegibility.'
      };
    }

    const heightMm = Number(item.physicalHeightMm) || 0;
    const angularCalc = calculateAngularSize(heightMm, clampedDistance);
    const readabilityEstimate = evaluateReadabilityCategory(angularCalc.arcminutes, profile);
    const crossingDistanceCm = calculateThresholdCrossingDistanceCm(heightMm, profile.thresholdArcmin);

    return {
      requirementId: item.requirementId || `req-${item.id || Math.random().toString(36).slice(2, 7)}`,
      findingId: item.findingId || null,
      documentId: item.documentId || 'doc-artwork',
      panelId: item.panelId || 'PDP',
      name: item.name || item.declaration || 'Mandatory Declaration',
      sourceText: item.sourceText || '',
      actualTextGeometry: item.actualTextGeometry || null,
      physicalHeightMm: heightMm,
      widthMm: item.widthMm || null,
      contrastMeasurement: item.contrastMeasurement || null,
      viewingDistanceCm: clampedDistance,
      modelThresholdArcmin: profile.thresholdArcmin,
      angularCalculation: angularCalc,
      readabilityEstimate,
      crossingDistanceCm,
      legalTypographyStatus: item.legalTypographyStatus || 'COMPLIANT_STATUTORY_HEIGHT',
      limitations: [MODEL_DISCLAIMERS.SHELF_READABILITY]
    };
  });

  return evaluatedItems;
}

/**
 * Identifies the FIRST required item to cross the modeled readability threshold as distance increases.
 * Handles ties, unknown measurements, and out-of-range cases.
 */
export function identifyFirstThresholdCrossingItem({
  items = [],
  profile = VISUAL_PROFILES.STANDARD_20_20,
  minDistanceCm = DISTANCE_BOUNDS_CM.MIN,
  maxDistanceCm = DISTANCE_BOUNDS_CM.MAX
}) {
  const validItems = items.filter(
    (item) => !item.isMissingContent && typeof item.physicalHeightMm === 'number' && item.physicalHeightMm > 0
  );

  if (validItems.length === 0) {
    return {
      status: 'CANNOT_DETERMINE_RELIABLY',
      reason: 'No measurable physical text heights available in the required item inventory.',
      firstItem: null,
      crossingDistanceCm: null,
      tiedItems: [],
      model: profile,
      modelVersion: SHELF_READABILITY_MODEL_VERSION,
      estimateDisclaimer: MODEL_DISCLAIMERS.SHELF_READABILITY
    };
  }

  // Calculate crossing distance for each item
  const candidates = validItems.map((item) => {
    const crossingDist = calculateThresholdCrossingDistanceCm(item.physicalHeightMm, profile.thresholdArcmin);
    return {
      item,
      crossingDistanceCm: crossingDist
    };
  }).filter((c) => c.crossingDistanceCm !== null);

  // Filter to items that cross between minDistanceCm and maxDistanceCm
  // Note: An item that crosses at < minDistanceCm is already below threshold across entire test range!
  const inRangeCandidates = candidates.filter((c) => c.crossingDistanceCm <= maxDistanceCm);

  if (inRangeCandidates.length === 0) {
    return {
      status: 'NO_THRESHOLD_CROSSING_IN_RANGE',
      reason: `All evaluated mandatory items maintain angular sizes above ${profile.thresholdArcmin} arcmin across ${minDistanceCm}–${maxDistanceCm} cm.`,
      firstItem: null,
      crossingDistanceCm: null,
      tiedItems: [],
      model: profile,
      modelVersion: SHELF_READABILITY_MODEL_VERSION,
      estimateDisclaimer: MODEL_DISCLAIMERS.SHELF_READABILITY
    };
  }

  // Sort ascending by crossing distance (lowest distance crosses first)
  inRangeCandidates.sort((a, b) => a.crossingDistanceCm - b.crossingDistanceCm);

  const minCrossing = inRangeCandidates[0].crossingDistanceCm;
  // Check for ties within 0.5 cm
  const tied = inRangeCandidates.filter((c) => Math.abs(c.crossingDistanceCm - minCrossing) <= 0.5);

  const primary = tied[0].item;
  const angularAtCrossing = calculateAngularSize(primary.physicalHeightMm, minCrossing);

  return {
    status: 'FIRST_ITEM_IDENTIFIED',
    firstItem: {
      requirementId: primary.requirementId,
      name: primary.name || primary.declaration,
      panelId: primary.panelId,
      sourceText: primary.sourceText,
      physicalHeightMm: primary.physicalHeightMm,
      contrastMeasurement: primary.contrastMeasurement
    },
    crossingDistanceCm: minCrossing,
    angularHeightArcminAtCrossing: angularAtCrossing.arcminutes,
    isAlreadyBelowAtMin: minCrossing < minDistanceCm,
    hasTie: tied.length > 1,
    tiedItems: tied.map((t) => ({
      requirementId: t.item.requirementId,
      name: t.item.name || t.item.declaration,
      physicalHeightMm: t.item.physicalHeightMm,
      crossingDistanceCm: t.crossingDistanceCm
    })),
    numericalCalculation: {
      formula: 'd_crossing = h / (2 * tan(theta_threshold / 2))',
      heightMm: primary.physicalHeightMm,
      thresholdArcmin: profile.thresholdArcmin,
      resultDistanceCm: minCrossing
    },
    model: {
      name: profile.name,
      id: profile.id,
      thresholdArcmin: profile.thresholdArcmin,
      version: SHELF_READABILITY_MODEL_VERSION
    },
    estimateDisclaimer: 'Modeled readability estimate, not a measured human reading result.'
  };
}
