/**
 * PackSignal Packaging Geometry & Layout Intelligence — Canonical Data Model
 * (lib/geometry/model.mjs)
 *
 * Implements Step 1 of Phase 4: Canonical versioned geometry representation.
 */

import { createHash } from 'node:crypto';

export const GEOMETRY_SCHEMA_VERSION = 'packsignal-geometry/v1';

export const SOURCE_TYPES = {
  DXF_VECTOR: 'DXF_VECTOR',
  PDF_VECTOR: 'PDF_VECTOR',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  SOURCE_SPECIFICATION: 'SOURCE_SPECIFICATION',
  ILLUSTRATIVE: 'ILLUSTRATIVE'
};

export const GEOMETRY_TYPES = {
  POINT: 'POINT',
  SEGMENT: 'SEGMENT',
  POLYLINE: 'POLYLINE',
  POLYGON: 'POLYGON',
  RECTANGLE: 'RECTANGLE',
  REGION: 'REGION',
  TEXT_BLOCK: 'TEXT_BLOCK'
};

export const STRUCTURAL_CLASSIFICATIONS = {
  CUT: 'CUT',
  CREASE: 'CREASE',
  FOLD: 'FOLD',
  GLUE: 'GLUE',
  PANEL_BOUNDARY: 'PANEL_BOUNDARY',
  BLEED_GUIDE: 'BLEED_GUIDE',
  SAFE_MARGIN: 'SAFE_MARGIN',
  EXCLUSION_ZONE: 'EXCLUSION_ZONE',
  UNKNOWN: 'UNKNOWN'
};

export const VERIFICATION_STATES = {
  EXPLICITLY_LABELED: 'EXPLICITLY_LABELED',
  GEOMETRIC_CANDIDATE: 'GEOMETRIC_CANDIDATE',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  AMBIGUOUS: 'AMBIGUOUS',
  UNRESOLVED: 'UNRESOLVED',
  REJECTED: 'REJECTED'
};

export const PANEL_VERIFICATION_STATES = VERIFICATION_STATES;

export const REGISTRATION_STATES = {
  REGISTERED_SAME_SPACE: 'REGISTERED_SAME_SPACE',
  SAME_PDF_COORDINATES: 'REGISTERED_SAME_SPACE',
  REGISTERED_TRANSFORM: 'REGISTERED_TRANSFORM',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  REGISTRATION_REQUIRED: 'REGISTRATION_REQUIRED',
  UNREGISTERED: 'UNREGISTERED'
};

export const FIT_OUTCOMES = {
  FIT_LIKELY: 'FIT_LIKELY',
  OVERFLOW_RISK: 'OVERFLOW_RISK',
  PLACEMENT_CONFLICT: 'PLACEMENT_CONFLICT',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  UNABLE_TO_EVALUATE: 'UNABLE_TO_EVALUATE'
};

export const CARTON_FACES = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
  'flap',
  'glue_tab',
  'unknown_panel'
];

/**
 * Creates a unique geometry ID from its source attributes and coordinate points
 */
export function createGeometryId(sourceDocumentId, geometryType, points, disambiguator = '') {
  const seed = `${sourceDocumentId}:${geometryType}:${JSON.stringify(points)}:${disambiguator}`;
  return `geom_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

/**
 * Bounding box calculation for 2D points [[x, y], ...]
 */
export function computeBoundingBox(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return [0, 0, 0, 0];
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const [x, y] = pt;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  return [minX, minY, maxX, maxY];
}

/**
 * Creates a canonical geometric entity.
 */
export function createGeometricEntity({
  geometryId = null,
  sourceDocumentId = '',
  sourceDocumentHash = '',
  sourcePage = 1,
  sourceType = SOURCE_TYPES.DXF_VECTOR,
  sourceLayer = '',
  coordinateSystem = 'NORMALIZED',
  unit = 'millimeters',
  geometryType = GEOMETRY_TYPES.POLYGON,
  points = [],
  structuralClassification = STRUCTURAL_CLASSIFICATIONS.UNKNOWN,
  detectionMethod = 'algorithmic_extraction',
  verificationState = VERIFICATION_STATES.GEOMETRIC_CANDIDATE,
  limitations = [],
  metadata = {}
}) {
  const validPoints = Array.isArray(points) ? points : [];
  const bBox = computeBoundingBox(validPoints);
  const id = geometryId || createGeometryId(sourceDocumentId, geometryType, validPoints, sourceLayer);

  return {
    geometryId: id,
    sourceDocumentId: String(sourceDocumentId || ''),
    sourceDocumentHash: String(sourceDocumentHash || ''),
    sourcePage: Number(sourcePage) || 1,
    sourceType,
    sourceLayer: String(sourceLayer || ''),
    coordinateSystem, // 'DXF_NATIVE' | 'PDF_POINTS' | 'NORMALIZED' | 'PIXELS' | 'MILLIMETERS'
    unit,             // 'millimeters' | 'inches' | 'points' | 'pixels' | 'drawing_units'
    geometryType,
    structuralClassification,
    points: validPoints,
    boundingBox: bBox,
    detectionMethod,
    verificationState,
    limitations: Array.isArray(limitations) ? limitations : [limitations].filter(Boolean),
    metadata: { ...metadata }
  };
}
