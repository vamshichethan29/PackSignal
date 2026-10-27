/**
 * PackSignal Physical Prepress — Dieline Geometry Extraction & Authority Model
 * (lib/prepress/dieline-geometry.mjs)
 *
 * Implements Upgrade #46 Phases 7, 8, 9, 10, 11:
 * Resolves structural dieline geometry (Cut, Crease, Fold, Glue, Bleed, Safe Zone, Decorative, Unclassified)
 * with explicit provenance, units (PDF points, mm), and source authority tracking.
 */

export const DIELINE_SOURCE_AUTHORITY = {
  SOURCE_VERIFIED: 'SOURCE_VERIFIED', // Explicit DXF layer or verified PDF spot color (CutContour, DieCut, Crease)
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED', // Reviewer-verified dieline mapping
  INFERRED: 'INFERRED', // Inferred from PDF page boxes (TrimBox / BleedBox)
  UNAVAILABLE: 'UNAVAILABLE', // No structural dieline available
};

export const PATH_CLASSIFICATIONS = {
  CUT: 'CUT', // Outer guillotine or rotary cutting line (Solid Red)
  CREASE: 'CREASE', // Folding score / bend line (Blue Dashed)
  FOLD: 'FOLD', // Alias for folding lines
  PERFORATION: 'PERFORATION',
  GLUE: 'GLUE', // Glue regions
  GLUE_TAB: 'GLUE', // Alias
  BLEED_LIMIT: 'BLEED_LIMIT', // Required outward bleed extension band (Cyan)
  SAFE_ZONE: 'SAFE_ZONE', // Inward critical content safety zone (Amber)
  DECORATIVE: 'DECORATIVE', // Decorative art strokes — must NOT be treated as cuts/creases
  UNCLASSIFIED: 'UNCLASSIFIED',
};

export const MM_PER_PT = 25.4 / 72.0;

/**
 * Converts PDF points to millimeters (1 pt = 25.4/72 mm = 0.352778 mm).
 */
export function pointsToMm(ptValue) {
  return Number.isFinite(ptValue) ? Math.round(ptValue * MM_PER_PT * 100) / 100 : null;
}

/**
 * Converts millimeters to PDF points.
 */
export function mmToPoints(mmValue) {
  return Number.isFinite(mmValue) ? (mmValue / MM_PER_PT) : null;
}

/**
 * Builds or normalizes a structured dieline model from available artwork documents,
 * CAD DXF layers, or standard PDF page boundary boxes.
 *
 * @param {Object} options
 * @param {Object} [options.dxfDieline] - Parsed DXF dieline containing layers and polylines
 * @param {Object} [options.pdfBoxes] - MediaBox, CropBox, TrimBox, BleedBox
 * @param {Array<Object>} [options.spotPaths] - Paths rendered in spot colors (e.g. CutContour)
 * @param {string} [options.authority] - Known authority level
 */
export function resolveDielineGeometry({
  dxfDieline = null,
  pdfBoxes = {},
  spotPaths = [],
  authority = null,
} = {}) {
  // 1. Explicit DXF structural CAD input (Highest confidence: SOURCE_VERIFIED)
  if (dxfDieline && (dxfDieline.cutPaths?.length || dxfDieline.creases?.length)) {
    const cutPaths = (dxfDieline.cutPaths || []).map(p => ({
      ...p,
      type: PATH_CLASSIFICATIONS.CUT,
      classification: PATH_CLASSIFICATIONS.CUT,
      strokeColor: '#ef4444', // Red solid
      style: 'solid',
    }));

    const creasePaths = (dxfDieline.creases || []).map(p => ({
      ...p,
      type: PATH_CLASSIFICATIONS.CREASE,
      classification: PATH_CLASSIFICATIONS.CREASE,
      strokeColor: '#3b82f6', // Blue dashed
      style: 'dashed',
    }));

    const glueAreas = (dxfDieline.glueAreas || []).map(g => ({
      ...g,
      type: PATH_CLASSIFICATIONS.GLUE,
      classification: PATH_CLASSIFICATIONS.GLUE,
    }));

    return {
      authority: DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
      sourceType: 'EXPLICIT_DXF_CAD',
      dielineHash: dxfDieline.hash || 'dxf-cad-source',
      cutPaths,
      creasePaths,
      glueAreas,
      panels: dxfDieline.panels || [],
      isVerified: true,
      dimensionsMm: dxfDieline.dimensionsMm || null,
      explanation: 'Dieline geometry extracted directly from verified CAD/DXF engineering layers (Cut and Crease).',
    };
  }

  // 2. Verified PDF Spot-Color Paths (e.g. CutContour, DieCut, Crease)
  if (spotPaths && spotPaths.length > 0) {
    const cuts = spotPaths.filter(p => /cut|trim|contour/i.test(p.spotName || p.name || ''));
    const creases = spotPaths.filter(p => /crease|fold|score/i.test(p.spotName || p.name || ''));

    if (cuts.length > 0 || creases.length > 0) {
      return {
        authority: DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
        sourceType: 'PDF_SPOT_COLOR_PATHS',
        dielineHash: 'pdf-spot-dieline',
        cutPaths: cuts.map(p => ({ ...p, type: PATH_CLASSIFICATIONS.CUT, classification: PATH_CLASSIFICATIONS.CUT, style: 'solid', strokeColor: '#ef4444' })),
        creasePaths: creases.map(p => ({ ...p, type: PATH_CLASSIFICATIONS.CREASE, classification: PATH_CLASSIFICATIONS.CREASE, style: 'dashed', strokeColor: '#3b82f6' })),
        glueAreas: [],
        panels: [],
        isVerified: true,
        explanation: 'Dieline paths identified from verified PDF spot color separations (CutContour / Crease).',
      };
    }
  }

  // 3. Fallback: Inferred from standard PDF TrimBox / BleedBox / MediaBox
  const { trimBox, trim, bleedBox, bleed, cropBox, crop, mediaBox, media } = pdfBoxes;
  const effectiveTrim = trimBox || trim || cropBox || crop;
  const effectiveBleed = bleedBox || bleed || mediaBox || media;

  if (effectiveTrim) {
    const x1 = effectiveTrim.x1 ?? effectiveTrim[0] ?? 0;
    const y1 = effectiveTrim.y1 ?? effectiveTrim[1] ?? 0;
    const x2 = effectiveTrim.x2 ?? effectiveTrim[2] ?? 100;
    const y2 = effectiveTrim.y2 ?? effectiveTrim[3] ?? 100;

    // Build 4 rectangular trim/cut segments
    const cutPaths = [
      { x1, y1, x2, y2: y1, edge: 'top', type: PATH_CLASSIFICATIONS.CUT, classification: PATH_CLASSIFICATIONS.CUT, style: 'solid', strokeColor: '#ef4444' },
      { x1: x2, y1, x2, y2, edge: 'right', type: PATH_CLASSIFICATIONS.CUT, classification: PATH_CLASSIFICATIONS.CUT, style: 'solid', strokeColor: '#ef4444' },
      { x1: x2, y1: y2, x2: x1, y2, edge: 'bottom', type: PATH_CLASSIFICATIONS.CUT, classification: PATH_CLASSIFICATIONS.CUT, style: 'solid', strokeColor: '#ef4444' },
      { x1, y1: y2, x2: x1, y2: y1, edge: 'left', type: PATH_CLASSIFICATIONS.CUT, classification: PATH_CLASSIFICATIONS.CUT, style: 'solid', strokeColor: '#ef4444' },
    ];

    const inferredAuthority = authority === DIELINE_SOURCE_AUTHORITY.REVIEWER_CONFIRMED
      ? DIELINE_SOURCE_AUTHORITY.REVIEWER_CONFIRMED
      : DIELINE_SOURCE_AUTHORITY.INFERRED;

    return {
      authority: inferredAuthority,
      sourceType: 'PDF_PAGE_BOXES',
      dielineHash: 'pdf-box-inferred',
      cutPaths,
      creasePaths: [], // No folding creases in plain page boxes
      glueAreas: [],
      panels: [{ name: 'Primary Artwork Face', box: [x1, y1, x2, y2] }],
      isVerified: inferredAuthority === DIELINE_SOURCE_AUTHORITY.REVIEWER_CONFIRMED,
      dimensionsMm: {
        width: pointsToMm(Math.abs(x2 - x1)),
        height: pointsToMm(Math.abs(y2 - y1)),
      },
      explanation: inferredAuthority === DIELINE_SOURCE_AUTHORITY.REVIEWER_CONFIRMED
        ? 'Trim outline verified by reviewer based on PDF TrimBox.'
        : 'Inferred rectangular trim boundary from standard PDF TrimBox header. Check against production CAD dieline before cutting.',
    };
  }

  // 4. Unavailable
  return {
    authority: DIELINE_SOURCE_AUTHORITY.UNAVAILABLE,
    sourceType: 'NONE',
    dielineHash: null,
    cutPaths: [],
    creasePaths: [],
    glueAreas: [],
    panels: [],
    isVerified: false,
    explanation: 'No structural dieline, CAD DXF layer, or PDF TrimBox headers available for this artwork.',
  };
}
