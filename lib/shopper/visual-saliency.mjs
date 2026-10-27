/**
 * PackSignal — Phase 6A: 3-Second Glance Visual Saliency Model
 * Low-level feature-based attention proxy (Itti-Koch-Niebur style feature integration),
 * mandatory declaration spatial overlap analysis, and rigorous scientific disclaimers.
 *
 * (lib/shopper/visual-saliency.mjs)
 */

import { MODEL_DISCLAIMERS } from './experience-schema.mjs';

export const SALIENCY_MODEL_VERSION = '2026.04-saliency-proxy-v1';

/**
 * Standard simulated packaging attention zones for carton face analysis.
 * Derived from typical consumer packaging hierarchy:
 * Brand Mark / Hero Title -> Imagery / Color Accents -> Claims / Badges -> Body Declarations
 */
export const DEFAULT_PACKAGING_SALIENT_REGIONS = Object.freeze([
  {
    id: 'sal-brand-hero',
    name: 'Brand Logo & Product Hero Header',
    panelId: 'PDP',
    bounds: { x: 0.15, y: 0.08, width: 0.70, height: 0.22 },
    predictedSaliency: 0.92, // High contrast, large typography, central placement
    factors: ['LARGE_TYPOGRAPHY', 'HIGH_LUMINANCE_CONTRAST', 'PRIMARY_POSITION'],
    description: 'Primary focal point attracting immediate gaze fixation.'
  },
  {
    id: 'sal-hero-graphic',
    name: 'Hero Graphic & Fruit Vignette',
    panelId: 'PDP',
    bounds: { x: 0.12, y: 0.32, width: 0.76, height: 0.35 },
    predictedSaliency: 0.88, // Rich color saturation, complex organic edges
    factors: ['COLOR_SATURATION', 'EDGE_COMPLEXITY', 'ILLUSTRATIVE_DEPTH'],
    description: 'High sensory appeal illustration with high chromatic contrast.'
  },
  {
    id: 'sal-claim-callout',
    name: 'Front Claims & Dietary Highlights',
    panelId: 'PDP',
    bounds: { x: 0.10, y: 0.70, width: 0.80, height: 0.15 },
    predictedSaliency: 0.64, // Medium size, contrasting banner/text
    factors: ['ISOLATED_CLUSTER', 'ACCENT_COLOR'],
    description: 'Secondary focal area often scanned during retail appraisal.'
  },
  {
    id: 'sal-info-panel-title',
    name: 'Nutrition Facts Heading & Barlines',
    panelId: 'INFOPANEL',
    bounds: { x: 0.08, y: 0.05, width: 0.84, height: 0.12 },
    predictedSaliency: 0.58, // Bold black rule lines, strong geometric structure
    factors: ['HIGH_BLACK_WHITE_CONTRAST', 'RECOGNIZABLE_RECTILINEAR_SHAPE'],
    description: 'High local contrast but typically searched intentionally rather than spontaneous glance.'
  },
  {
    id: 'sal-body-text-zone',
    name: 'Ingredients & Corporate Address Density',
    panelId: 'INFOPANEL',
    bounds: { x: 0.08, y: 0.55, width: 0.84, height: 0.38 },
    predictedSaliency: 0.22, // Uniform low-frequency texture, small glyphs
    factors: ['UNIFORM_TEXTURE', 'LOW_CHROMATIC_DISTINCTION'],
    description: 'Visually quiet reading zone; requires active search rather than automatic glance capture.'
  }
]);

/**
 * Calculates spatial 2D bounding box intersection over area (IoA).
 * Box format: { x, y, width, height } normalized 0.0 to 1.0.
 */
export function calculateBoxOverlap(boxA, boxB) {
  if (!boxA || !boxB) return 0.0;

  const left = Math.max(boxA.x, boxB.x);
  const top = Math.max(boxA.y, boxB.y);
  const right = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const bottom = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  if (right <= left || bottom <= top) {
    return 0.0;
  }

  const intersectionArea = (right - left) * (bottom - top);
  const areaA = boxA.width * boxA.height;
  if (areaA <= 0) return 0.0;

  return Math.min(1.0, intersectionArea / areaA);
}

/**
 * Evaluates predicted visual attention for packaging zones and computes overlap with mandatory items.
 */
export function computeVisualSaliencyAnalysis({
  artworkId = 'art-dancing-fish',
  panelId = 'PDP',
  salientRegions = DEFAULT_PACKAGING_SALIENT_REGIONS,
  mandatoryItems = [],
  imageResolution = { width: 1200, height: 1600 }
} = {}) {
  const panelSalient = salientRegions.filter(
    (r) => !r.panelId || r.panelId === panelId || panelId === 'ALL'
  );

  // Analyze each mandatory item against the saliency map
  const itemOverlaps = mandatoryItems.map((item) => {
    const itemBox = item.actualTextGeometry || item.bounds || { x: 0.1, y: 0.5, width: 0.8, height: 0.1 };
    const targetPanel = item.panelId;
    const candidateRegions = targetPanel
      ? salientRegions.filter((r) => !r.panelId || r.panelId === targetPanel)
      : salientRegions;
    
    let maxOverlap = 0.0;
    let overlappingRegion = null;

    for (const region of candidateRegions) {
      const overlap = calculateBoxOverlap(itemBox, region.bounds);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        overlappingRegion = region;
      }
    }

    const predictedScore = overlappingRegion ? overlappingRegion.predictedSaliency : 0.25;
    let attentionCategory = 'QUIET_ZONE';
    if (predictedScore >= 0.70) {
      attentionCategory = 'HIGH_PREDICTED_ATTENTION';
    } else if (predictedScore >= 0.45) {
      attentionCategory = 'MODERATE_ATTENTION';
    }

    return {
      requirementId: item.requirementId || item.id,
      name: item.name || item.declaration,
      panelId: item.panelId || panelId,
      itemBounds: itemBox,
      maxOverlapFraction: Number(maxOverlap.toFixed(2)),
      nearestSalientRegionId: overlappingRegion ? overlappingRegion.id : null,
      nearestSalientRegionName: overlappingRegion ? overlappingRegion.name : 'Unclassified Background',
      predictedSaliencyScore: Number(predictedScore.toFixed(2)),
      attentionCategory,
      interpretationNote: attentionCategory === 'QUIET_ZONE'
        ? 'Located in a visually quiet region. Shoppers seeking this declaration must read actively; it does not capture automatic peripheral glance.'
        : 'Overlaps a high-predicted-salience region likely to attract initial visual fixation.'
    };
  });

  return {
    artworkId,
    panelId,
    modelVersion: SALIENCY_MODEL_VERSION,
    imageResolution,
    isAttentionProxy: true,
    salientRegions: panelSalient,
    mandatoryItemOverlaps: itemOverlaps,
    limitations: [
      MODEL_DISCLAIMERS.VISUAL_SALIENCY,
      'Relative prominence is estimated from optical contrast and layout weight; personal shopping goals and deliberate information seeking override automatic saliency.'
    ],
    disclaimer: 'Illustrative 3-second glance attention proxy. Does not measure actual human eye movements.'
  };
}
