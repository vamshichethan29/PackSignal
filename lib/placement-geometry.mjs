/**
 * PackSignal — Computational Placement Geometry & Coordinate Systems
 * lib/placement-geometry.mjs
 *
 * Implements rigorous transformations between canonical artwork coordinates,
 * confirmed panel bounds, PDF points, physical millimeters, and 3D surface UVs.
 */

export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72.0;
export const MM_PER_POINT = MM_PER_INCH / POINTS_PER_INCH; // ~0.352778 mm

/**
 * Calculates panel physical area in square inches and square millimeters.
 *
 * @param {Array<number>} panelBox - Normalized [x0, y0, x1, y1] on page
 * @param {Object} pageDimensions - { width: number, height: number, unit?: string }
 */
export function calculatePanelArea(panelBox, pageDimensions = {}) {
  if (!Array.isArray(panelBox) || panelBox.length < 4) {
    return { areaSqInches: 0, areaSqMm: 0, widthMm: 0, heightMm: 0 };
  }

  const [x0, y0, x1, y1] = panelBox;
  const normW = Math.max(0, x1 - x0);
  const normH = Math.max(0, y1 - y0);

  // Default standard letter/artboard if not specified (in PDF points, 612x792 pt = 8.5x11 in)
  const pageWidthPt = pageDimensions.width || 612;
  const pageHeightPt = pageDimensions.height || 792;

  const widthPt = normW * pageWidthPt;
  const heightPt = normH * pageHeightPt;

  const widthIn = widthPt / POINTS_PER_INCH;
  const heightIn = heightPt / POINTS_PER_INCH;

  const widthMm = widthIn * MM_PER_INCH;
  const heightMm = heightIn * MM_PER_INCH;

  const areaSqInches = widthIn * heightIn;
  const areaSqMm = widthMm * heightMm;

  return {
    widthPt,
    heightPt,
    widthIn,
    heightIn,
    widthInches: widthIn,
    heightInches: heightIn,
    widthMm,
    heightMm,
    areaSqInches,
    areaSqMm,
    isSmallPdp: areaSqInches <= 5.0,
  };
}

/**
 * Computes canonical PDP geometry metadata contract (Phase 4).
 */
export function calculatePdpGeometry({
  panelId = 'front',
  panelRole = 'principal_display_panel',
  panelBox,
  pageDimensions = {},
  packageOrientation = 0,
  panelConfidence = 1.0,
  mappingAuthority = 'REVIEWER_CONFIRMED',
} = {}) {
  const area = calculatePanelArea(panelBox, pageDimensions);
  return {
    panelId,
    panelRole,
    physicalWidthMm: area.widthMm,
    physicalHeightMm: area.heightMm,
    physicalArea: area.areaSqMm,
    physicalAreaSqInches: area.areaSqInches,
    artworkRegion: panelBox,
    packageOrientation,
    panelConfidence,
    mappingAuthority,
    isSmallPdp: area.isSmallPdp,
  };
}

/**
 * Computes the statutory legal region for a given panel and placement constraint.
 *
 * @param {Object} params
 * @param {Array<number>} params.panelBox - Normalized [x0, y0, x1, y1] of panel
 * @param {string} params.constraint - e.g. 'bottom_30_percent' | 'panel_lower_region' | 'top_corner_region' | 'anywhere_on_panel'
 * @param {Object} params.panelGeometry - { areaSqInches, packageOrientation, ... }
 * @param {Array<Object>} [params.exceptions] - Rule exceptions
 * @param {number} [params.packageOrientation=0] - Package display orientation in degrees (0, 90, 180, 270)
 */
export function computeLegalRegion({
  panelBox,
  constraint = 'bottom_30_percent',
  panelGeometry = {},
  exceptions = [],
  packageOrientation = 0,
}) {
  if (!Array.isArray(panelBox) || panelBox.length < 4) {
    return null;
  }

  const [px0, py0, px1, py1] = panelBox;
  const pWidth = px1 - px0;
  const pHeight = py1 - py0;

  let activeConstraint = constraint;
  let exceptionApplied = null;

  // Evaluate exceptions (e.g. Small PDP <= 5 sq inches exempt from bottom 30%)
  for (const ex of exceptions) {
    if (typeof ex.condition === 'function' && ex.condition(panelGeometry)) {
      activeConstraint = ex.alternateConstraint || 'anywhere_on_panel';
      exceptionApplied = ex;
      break;
    }
  }

  let legalBounds;
  let description;

  const round6 = (num) => Math.round(num * 1e6) / 1e6;
  const orientation = ((packageOrientation || panelGeometry.packageOrientation || panelGeometry.rotation || 0) % 360 + 360) % 360;

  switch (activeConstraint) {
    case 'bottom_30_percent': {
      // Calculate bottom 30% parallel to the base as designed to be displayed
      if (orientation === 180) {
        // Display base is at top of panel on PDF artboard
        const legalBottom = round6(py0 + 0.30 * pHeight);
        legalBounds = [round6(px0), round6(py0), round6(px1), legalBottom];
      } else if (orientation === 90) {
        // Display base is at right edge of panel on PDF artboard
        const legalLeft = round6(px0 + 0.70 * pWidth);
        legalBounds = [legalLeft, round6(py0), round6(px1), round6(py1)];
      } else if (orientation === 270) {
        // Display base is at left edge of panel on PDF artboard
        const legalRight = round6(px0 + 0.30 * pWidth);
        legalBounds = [round6(px0), round6(py0), legalRight, round6(py1)];
      } else {
        // Standard upright (orientation === 0): base is at bottom of panel (py1)
        const topOffset = 0.70 * pHeight;
        const legalTop = round6(py0 + topOffset);
        legalBounds = [round6(px0), legalTop, round6(px1), round6(py1)];
      }
      description = 'Statutory placement: Bottom 30% of Principal Display Panel (21 CFR §101.7 & §101.105)';
      break;
    }

    case 'panel_lower_region': {
      // Lower half / bottom region of panel (e.g. for Information Panel addresses)
      const topOffset = 0.50 * pHeight;
      const legalTop = round6(py0 + topOffset);
      legalBounds = [round6(px0), legalTop, round6(px1), round6(py1)];
      description = 'Statutory placement: Information panel lower declaration area (21 CFR §101.2 & §101.5)';
      break;
    }

    case 'top_corner_region': {
      // Top corner (e.g. FSSAI Veg mark)
      const cornerW = pWidth * 0.35;
      const cornerH = pHeight * 0.25;
      legalBounds = [round6(px0), round6(py0), round6(px0 + cornerW), round6(py0 + cornerH)];
      description = 'Statutory placement: Principal Display Panel top corner (FSSAI Reg §2.2.2)';
      break;
    }

    case 'anywhere_on_panel':
    default: {
      legalBounds = [round6(px0), round6(py0), round6(px1), round6(py1)];
      description = exceptionApplied
        ? `Statutory placement: Any location on PDP permitted under small-PDP exception (${exceptionApplied.id || 'SMALL_PDP_EXCEPTION'})`
        : 'Permitted anywhere within the confirmed panel';
      break;
    }
  }

  return {
    constraint: activeConstraint,
    originalConstraint: constraint,
    exceptionApplied: exceptionApplied ? (exceptionApplied.id || exceptionApplied) : null,
    normalizedBounds: legalBounds,
    description,
    packageOrientation: orientation,
  };
}

/**
 * Computes an optional designer suggested placement box located inside the legal region.
 * This is an optional layout proposal, NOT a statutory mandate.
 *
 * @param {Array<number>} legalBounds - [x0, y0, x1, y1] of legal region
 * @param {string} declarationType - 'NET_QUANTITY' | 'MANUFACTURER_ADDRESS' | 'VEG_MARK'
 */
export function computeSuggestedPlacement(legalBounds, declarationType = 'NET_QUANTITY') {
  if (!Array.isArray(legalBounds) || legalBounds.length < 4) return null;

  const [lx0, ly0, lx1, ly1] = legalBounds;
  const lWidth = lx1 - lx0;
  const lHeight = ly1 - ly0;

  // Internal safety clearance margins (10% horizontally, 15% vertically)
  const marginX = lWidth * 0.10;
  const marginY = lHeight * 0.15;

  let suggestedW;
  let suggestedH;
  let suggestedX;
  let suggestedY;

  if (declarationType === 'NET_QUANTITY') {
    // A clean, horizontal strip centered in the legal zone
    suggestedW = lWidth * 0.75;
    suggestedH = Math.min(lHeight * 0.45, 0.05); // ~5% page height
    suggestedX = lx0 + (lWidth - suggestedW) / 2;
    suggestedY = ly1 - suggestedH - marginY; // rested toward bottom of legal region
  } else if (declarationType === 'MANUFACTURER_ADDRESS') {
    suggestedW = lWidth * 0.80;
    suggestedH = Math.min(lHeight * 0.50, 0.065);
    suggestedX = lx0 + (lWidth - suggestedW) / 2;
    suggestedY = ly1 - suggestedH - marginY;
  } else if (declarationType === 'VEG_MARK') {
    // Square icon
    const side = Math.min(lWidth * 0.5, lHeight * 0.5, 0.04);
    suggestedW = side;
    suggestedH = side;
    suggestedX = lx0 + marginX;
    suggestedY = ly0 + marginY;
  } else {
    suggestedW = lWidth * 0.70;
    suggestedH = lHeight * 0.40;
    suggestedX = lx0 + marginX;
    suggestedY = ly0 + marginY;
  }

  return {
    normalizedBounds: [
      Math.max(0, suggestedX),
      Math.max(0, suggestedY),
      Math.min(1, suggestedX + suggestedW),
      Math.min(1, suggestedY + suggestedH),
    ],
    isCustomReviewerPlacement: false,
    disclaimer: 'Suggested layout proposal for designer review — not an exact statutory coordinate.',
  };
}

/**
 * Validates whether a proposed placement box stays inside the legal allowed region
 * and checks for collision/overlap with existing content.
 *
 * @param {Object} params
 * @param {Array<number>} params.suggestedBox - [x0, y0, x1, y1]
 * @param {Array<number>} params.legalRegion - [x0, y0, x1, y1]
 * @param {Array<Object>} [params.existingBoxes] - Array of existing text/evidence boxes on this page
 */
export function checkPlacementFit({
  suggestedBox,
  legalRegion,
  existingBoxes = [],
}) {
  if (!suggestedBox || !legalRegion) {
    return {
      status: 'UNABLE_TO_ESTIMATE',
      fitState: 'UNABLE_TO_ESTIMATE',
      isInsideLegal: false,
      isInsideLegalRegion: false,
      warnings: ['Missing geometry parameters']
    };
  }

  const [sx0, sy0, sx1, sy1] = suggestedBox;
  const [lx0, ly0, lx1, ly1] = legalRegion;

  const warnings = [];

  // 1. Boundary / Overflow check
  const tolerance = 0.002; // Small floating-point tolerance
  const overflowsLeft = sx0 < lx0 - tolerance;
  const overflowsRight = sx1 > lx1 + tolerance;
  const overflowsTop = sy0 < ly0 - tolerance;
  const overflowsBottom = sy1 > ly1 + tolerance;

  if (overflowsLeft || overflowsRight || overflowsTop || overflowsBottom) {
    warnings.push('Placement box extends outside the statutory permitted legal region.');
    return {
      status: 'OVERFLOW_RISK',
      fitState: 'OVERFLOW_RISK',
      isInsideLegal: false,
      isInsideLegalRegion: false,
      warnings,
    };
  }

  // 2. Collision / Overlap check against existing elements
  let maxOverlapArea = 0;
  for (const item of existingBoxes) {
    const box = item.box || item;
    if (!Array.isArray(box) || box.length < 4) continue;

    const [bx0, by0, bx1, by1] = box;
    const ix0 = Math.max(sx0, bx0);
    const iy0 = Math.max(sy0, by0);
    const ix1 = Math.min(sx1, bx1);
    const iy1 = Math.min(sy1, by1);

    if (ix1 > ix0 && iy1 > iy0) {
      const overlapW = ix1 - ix0;
      const overlapH = iy1 - iy0;
      const overlapArea = overlapW * overlapH;
      maxOverlapArea = Math.max(maxOverlapArea, overlapArea);
    }
  }

  const sArea = (sx1 - sx0) * (sy1 - sy0);
  if (sArea > 0 && maxOverlapArea / sArea > 0.15) {
    warnings.push('Suggested placement potentially overlaps existing package text or barcode.');
    return {
      status: 'POTENTIAL_OVERLAP',
      fitState: 'POTENTIAL_OVERLAP',
      isInsideLegal: true,
      isInsideLegalRegion: true,
      warnings,
    };
  }

  return {
    status: 'FIT_LIKELY',
    fitState: 'FIT_LIKELY',
    isInsideLegal: true,
    isInsideLegalRegion: true,
    warnings: [],
  };
}

/**
 * Maps a canonical 2D panel-local coordinate into 3D face coordinates (UV [0, 1]).
 *
 * @param {Array<number>} targetBox - [x0, y0, x1, y1] on page
 * @param {Array<number>} panelBox - [px0, py0, px1, py1] on page
 */
export function mapPageBoxToPanelLocal(targetBox, panelBox) {
  if (!targetBox || !panelBox) return null;
  const [tx0, ty0, tx1, ty1] = targetBox;
  const [px0, py0, px1, py1] = panelBox;

  const pw = Math.max(0.0001, px1 - px0);
  const ph = Math.max(0.0001, py1 - py0);

  const round6 = (num) => Math.round(num * 1e6) / 1e6;
  const u0 = round6((tx0 - px0) / pw);
  const v0 = round6((ty0 - py0) / ph);
  const u1 = round6((tx1 - px0) / pw);
  const v1 = round6((ty1 - py0) / ph);

  const res = [u0, v0, u1, v1];
  res.u0 = u0;
  res.v0 = v0;
  res.u1 = u1;
  res.v1 = v1;
  return res;
}

/**
 * Transforms normalized coordinates to 2D viewport pixels given zoom, pan, and canvas size.
 */
export function transformBoundsWithViewport(box, viewport = {}) {
  if (!Array.isArray(box)) return null;
  const [x0, y0, x1, y1] = box;
  const zoom = (viewport.zoom || 100) / 100;
  const panX = viewport.panX || 0;
  const panY = viewport.panY || 0;
  const width = viewport.containerWidth || 800;
  const height = viewport.containerHeight || 600;

  const pixelX0 = x0 * width * zoom + panX;
  const pixelY0 = y0 * height * zoom + panY;
  const pixelWidth = (x1 - x0) * width * zoom;
  const pixelHeight = (y1 - y0) * height * zoom;

  return {
    pixelX0,
    pixelY0,
    pixelWidth,
    pixelHeight,
    pixelX1: pixelX0 + pixelWidth,
    pixelY1: pixelY0 + pixelHeight,
  };
}

/**
 * Applies page CropBox offset and page rotation to normalized coordinates.
 */
export function applyPageCropAndRotation(box, page = {}) {
  if (!Array.isArray(box)) return null;
  let [x0, y0, x1, y1] = box;
  const rot = (page.rotation || 0) % 360;

  if (rot === 90) {
    const nx0 = 1 - y1;
    const ny0 = x0;
    const nx1 = 1 - y0;
    const ny1 = x1;
    return [Math.min(nx0, nx1), Math.min(ny0, ny1), Math.max(nx0, nx1), Math.max(ny0, ny1)];
  } else if (rot === 180) {
    return [1 - x1, 1 - y1, 1 - x0, 1 - y0];
  } else if (rot === 270) {
    const nx0 = y0;
    const ny0 = 1 - x1;
    const nx1 = y1;
    const ny1 = 1 - x0;
    return [Math.min(nx0, nx1), Math.min(ny0, ny1), Math.max(nx0, nx1), Math.max(ny0, ny1)];
  }

  return [x0, y0, x1, y1];
}

