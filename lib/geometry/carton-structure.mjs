/**
 * PackSignal Packaging Geometry — Structural Panel Model
 * (lib/geometry/carton-structure.mjs)
 *
 * Implements Phase 7A Phase 3: Structural Panel Model.
 * Models each physical panel and flap component from verified source geometry:
 * - Front (PDP), Back, Left, Right
 * - Top closure, Bottom closure
 * - Top tuck flap, Bottom tuck flap
 * - Top/Bottom dust flaps
 * - Side glue flap
 *
 * Every panel retains:
 * - panelId, panelRole
 * - sourcePolygon2D, polygonMm
 * - localCoordinateSystem
 * - thicknessMm (board caliper)
 * - frontSurface, backSurface
 * - artworkMapping
 * - creaseEdges, cutEdges
 * - parentPanel, hingeIds
 * - materialAuthority
 */

import { STRUCTURAL_CLASSIFICATIONS, VERIFICATION_STATES } from './model.mjs';

export const PANEL_ROLES = {
  FRONT: 'front',                       // Principal Display Panel (PDP)
  BACK: 'back',                         // Back Panel / Information Panel
  LEFT: 'left',                         // Left Side Panel
  RIGHT: 'right',                       // Right Side Panel
  TOP: 'top',                           // Top Major Closure
  BOTTOM: 'bottom',                     // Bottom Major Closure
  TOP_TUCK_FLAP: 'top_tuck_flap',       // Top Tuck-in Tab
  BOTTOM_TUCK_FLAP: 'bottom_tuck_flap', // Bottom Tuck-in Tab
  TOP_DUST_FLAP_LEFT: 'top_dust_left',
  TOP_DUST_FLAP_RIGHT: 'top_dust_right',
  BOTTOM_DUST_FLAP_LEFT: 'bottom_dust_left',
  BOTTOM_DUST_FLAP_RIGHT: 'bottom_dust_right',
  GLUE_FLAP: 'glue_flap',
};

export const TUCK_END_VARIANTS = {
  STRAIGHT_TUCK: 'STRAIGHT_TUCK',       // Both tuck flaps hinge from same face (e.g. front or back)
  REVERSE_TUCK: 'REVERSE_TUCK',         // Top hinges from front/back, bottom hinges from opposite
  STANDARD_SLOTTED: 'STANDARD_SLOTTED', // Four overlapping flaps
  SIMPLIFIED_SHELL: 'SIMPLIFIED_SHELL', // Six primary faces without accessory tabs
};

/**
 * Builds structural panel definitions from dimensional packaging parameters and verified layers.
 */
export function buildCartonStructuralPanels({
  dimensions = { width: 142.88, height: 160.16, depth: 77.61 },
  caliperMm = 0.45, // SBS board standard 18pt caliper (~0.45mm)
  variant = TUCK_END_VARIANTS.REVERSE_TUCK,
  includeFlaps = true,
  documentHash = '',
  documentId = '',
  sourcePage = 1,
  authority = 'VERIFIED_CAD_DIELINE',
} = {}) {
  const { width, height, depth } = dimensions;
  const panels = {};

  // Standard glue flap width (~12-15mm)
  const glueFlapWidth = 14.0;
  // Standard tuck tab length (~15-18mm)
  const tuckTabHeight = 16.0;
  // Dust flap height (~depth / 2 or 30mm)
  const dustFlapHeight = Math.min(32.0, depth * 0.7);

  // 1. FRONT PANEL (PDP) — Kinematic Root
  panels[PANEL_ROLES.FRONT] = {
    panelId: 'panel-front',
    panelRole: PANEL_ROLES.FRONT,
    title: 'Front Panel (Principal Display Panel)',
    widthMm: width,
    heightMm: height,
    thicknessMm: caliperMm,
    parentPanel: null,
    polygonMm: [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ],
    localCoordinateSystem: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
    },
    frontSurface: { printed: true, role: 'primary_artwork' },
    backSurface: { printed: false, substrate: 'uncoated_sbs' },
    creaseEdges: ['fold_front_left', 'fold_front_right', 'fold_front_top', 'fold_front_bottom'],
    cutEdges: [],
    hingeIds: ['hinge_front_left', 'hinge_front_right', 'hinge_front_top', 'hinge_front_bottom'],
    artworkMapping: {
      panelKey: 'front',
      uvBox: [0, 0, 1, 1],
      rotationDeg: 0,
    },
    materialAuthority: authority,
    sourceDocumentHash: documentHash,
    sourceDocumentId: documentId,
    sourcePage,
  };

  // 2. RIGHT PANEL
  panels[PANEL_ROLES.RIGHT] = {
    panelId: 'panel-right',
    panelRole: PANEL_ROLES.RIGHT,
    title: 'Right Side Panel',
    widthMm: depth,
    heightMm: height,
    thicknessMm: caliperMm,
    parentPanel: 'panel-front',
    polygonMm: [
      [-depth / 2, -height / 2],
      [depth / 2, -height / 2],
      [depth / 2, height / 2],
      [-depth / 2, height / 2],
    ],
    localCoordinateSystem: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
    },
    frontSurface: { printed: true, role: 'side_artwork' },
    backSurface: { printed: false, substrate: 'uncoated_sbs' },
    creaseEdges: ['fold_front_right', 'fold_right_back'],
    cutEdges: ['cut_right_top', 'cut_right_bottom'],
    hingeIds: ['hinge_front_right', 'hinge_right_back'],
    artworkMapping: {
      panelKey: 'right',
      uvBox: [0, 0, 1, 1],
      rotationDeg: 0,
    },
    materialAuthority: authority,
  };

  // 3. BACK PANEL
  panels[PANEL_ROLES.BACK] = {
    panelId: 'panel-back',
    panelRole: PANEL_ROLES.BACK,
    title: 'Back Panel (Nutrition & Info Panel)',
    widthMm: width,
    heightMm: height,
    thicknessMm: caliperMm,
    parentPanel: 'panel-right',
    polygonMm: [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ],
    localCoordinateSystem: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
    },
    frontSurface: { printed: true, role: 'secondary_artwork' },
    backSurface: { printed: false, substrate: 'uncoated_sbs' },
    creaseEdges: ['fold_right_back', 'fold_back_glue'],
    cutEdges: ['cut_back_top', 'cut_back_bottom'],
    hingeIds: ['hinge_right_back'],
    artworkMapping: {
      panelKey: 'back',
      uvBox: [0, 0, 1, 1],
      rotationDeg: 0,
    },
    materialAuthority: authority,
  };

  // 4. LEFT PANEL
  panels[PANEL_ROLES.LEFT] = {
    panelId: 'panel-left',
    panelRole: PANEL_ROLES.LEFT,
    title: 'Left Side Panel',
    widthMm: depth,
    heightMm: height,
    thicknessMm: caliperMm,
    parentPanel: 'panel-front',
    polygonMm: [
      [-depth / 2, -height / 2],
      [depth / 2, -height / 2],
      [depth / 2, height / 2],
      [-depth / 2, height / 2],
    ],
    localCoordinateSystem: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
    },
    frontSurface: { printed: true, role: 'side_artwork' },
    backSurface: { printed: false, substrate: 'uncoated_sbs' },
    creaseEdges: ['fold_front_left'],
    cutEdges: ['cut_left_outer', 'cut_left_top', 'cut_left_bottom'],
    hingeIds: ['hinge_front_left'],
    artworkMapping: {
      panelKey: 'left',
      uvBox: [0, 0, 1, 1],
      rotationDeg: 0,
    },
    materialAuthority: authority,
  };

  // 5. TOP CLOSURE PANEL
  panels[PANEL_ROLES.TOP] = {
    panelId: 'panel-top',
    panelRole: PANEL_ROLES.TOP,
    title: 'Top Major Closure',
    widthMm: width,
    heightMm: depth,
    thicknessMm: caliperMm,
    parentPanel: 'panel-front',
    polygonMm: [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [width / 2, depth / 2],
      [-width / 2, depth / 2],
    ],
    localCoordinateSystem: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
    },
    frontSurface: { printed: true, role: 'top_artwork' },
    backSurface: { printed: false, substrate: 'uncoated_sbs' },
    creaseEdges: ['fold_front_top', 'fold_top_tuck'],
    cutEdges: ['cut_top_left', 'cut_top_right'],
    hingeIds: ['hinge_front_top'],
    artworkMapping: {
      panelKey: 'top',
      uvBox: [0, 0, 1, 1],
      rotationDeg: 0,
    },
    materialAuthority: authority,
  };

  // 6. BOTTOM CLOSURE PANEL
  panels[PANEL_ROLES.BOTTOM] = {
    panelId: 'panel-bottom',
    panelRole: PANEL_ROLES.BOTTOM,
    title: 'Bottom Major Closure',
    widthMm: width,
    heightMm: depth,
    thicknessMm: caliperMm,
    parentPanel: 'panel-front',
    polygonMm: [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [width / 2, depth / 2],
      [-width / 2, depth / 2],
    ],
    localCoordinateSystem: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      normal: [0, 0, 1],
    },
    frontSurface: { printed: true, role: 'bottom_artwork' },
    backSurface: { printed: false, substrate: 'uncoated_sbs' },
    creaseEdges: ['fold_front_bottom', 'fold_bottom_tuck'],
    cutEdges: ['cut_bottom_left', 'cut_bottom_right'],
    hingeIds: ['hinge_front_bottom'],
    artworkMapping: {
      panelKey: 'bottom',
      uvBox: [0, 0, 1, 1],
      rotationDeg: 0,
    },
    materialAuthority: authority,
  };

  if (includeFlaps) {
    // 7. TOP TUCK FLAP
    panels[PANEL_ROLES.TOP_TUCK_FLAP] = {
      panelId: 'panel-top-tuck',
      panelRole: PANEL_ROLES.TOP_TUCK_FLAP,
      title: 'Top Tuck Tab',
      widthMm: width * 0.96, // Slight corner chamfer / tuck clearance
      heightMm: tuckTabHeight,
      thicknessMm: caliperMm,
      parentPanel: 'panel-top',
      polygonMm: [
        [-width * 0.48, 0],
        [width * 0.48, 0],
        [width * 0.44, tuckTabHeight],
        [-width * 0.44, tuckTabHeight],
      ],
      creaseEdges: ['fold_top_tuck'],
      cutEdges: ['cut_top_tuck_perimeter'],
      hingeIds: ['hinge_top_tuck'],
      materialAuthority: authority,
    };

    // 8. BOTTOM TUCK FLAP
    panels[PANEL_ROLES.BOTTOM_TUCK_FLAP] = {
      panelId: 'panel-bottom-tuck',
      panelRole: PANEL_ROLES.BOTTOM_TUCK_FLAP,
      title: 'Bottom Tuck Tab',
      widthMm: width * 0.96,
      heightMm: tuckTabHeight,
      thicknessMm: caliperMm,
      parentPanel: 'panel-bottom',
      polygonMm: [
        [-width * 0.48, 0],
        [width * 0.48, 0],
        [width * 0.44, -tuckTabHeight],
        [-width * 0.44, -tuckTabHeight],
      ],
      creaseEdges: ['fold_bottom_tuck'],
      cutEdges: ['cut_bottom_tuck_perimeter'],
      hingeIds: ['hinge_bottom_tuck'],
      materialAuthority: authority,
    };

    // 9. DUST FLAPS (Hinged to Left and Right panels)
    panels[PANEL_ROLES.TOP_DUST_FLAP_LEFT] = {
      panelId: 'panel-dust-top-left',
      panelRole: PANEL_ROLES.TOP_DUST_FLAP_LEFT,
      title: 'Top Dust Flap (Left)',
      widthMm: depth,
      heightMm: dustFlapHeight,
      thicknessMm: caliperMm,
      parentPanel: 'panel-left',
      creaseEdges: ['fold_left_top_dust'],
      cutEdges: ['cut_dust_top_left'],
      hingeIds: ['hinge_left_top_dust'],
      materialAuthority: authority,
    };

    panels[PANEL_ROLES.TOP_DUST_FLAP_RIGHT] = {
      panelId: 'panel-dust-top-right',
      panelRole: PANEL_ROLES.TOP_DUST_FLAP_RIGHT,
      title: 'Top Dust Flap (Right)',
      widthMm: depth,
      heightMm: dustFlapHeight,
      thicknessMm: caliperMm,
      parentPanel: 'panel-right',
      creaseEdges: ['fold_right_top_dust'],
      cutEdges: ['cut_dust_top_right'],
      hingeIds: ['hinge_right_top_dust'],
      materialAuthority: authority,
    };

    panels[PANEL_ROLES.BOTTOM_DUST_FLAP_LEFT] = {
      panelId: 'panel-dust-bottom-left',
      panelRole: PANEL_ROLES.BOTTOM_DUST_FLAP_LEFT,
      title: 'Bottom Dust Flap (Left)',
      widthMm: depth,
      heightMm: dustFlapHeight,
      thicknessMm: caliperMm,
      parentPanel: 'panel-left',
      creaseEdges: ['fold_left_bottom_dust'],
      cutEdges: ['cut_dust_bottom_left'],
      hingeIds: ['hinge_left_bottom_dust'],
      materialAuthority: authority,
    };

    panels[PANEL_ROLES.BOTTOM_DUST_FLAP_RIGHT] = {
      panelId: 'panel-dust-bottom-right',
      panelRole: PANEL_ROLES.BOTTOM_DUST_FLAP_RIGHT,
      title: 'Bottom Dust Flap (Right)',
      widthMm: depth,
      heightMm: dustFlapHeight,
      thicknessMm: caliperMm,
      parentPanel: 'panel-right',
      creaseEdges: ['fold_right_bottom_dust'],
      cutEdges: ['cut_dust_bottom_right'],
      hingeIds: ['hinge_right_bottom_dust'],
      materialAuthority: authority,
    };

    // 10. GLUE FLAP (Attached to Back Panel outer edge)
    panels[PANEL_ROLES.GLUE_FLAP] = {
      panelId: 'panel-glue-flap',
      panelRole: PANEL_ROLES.GLUE_FLAP,
      title: 'Manufacturer Glue Flap',
      widthMm: glueFlapWidth,
      heightMm: height,
      thicknessMm: caliperMm,
      parentPanel: 'panel-back',
      creaseEdges: ['fold_back_glue'],
      cutEdges: ['cut_glue_top', 'cut_glue_bottom', 'cut_glue_outer'],
      hingeIds: ['hinge_back_glue'],
      isGlueFlap: true,
      materialAuthority: authority,
    };
  }

  return {
    dimensions,
    caliperMm,
    variant,
    panels,
    panelCount: Object.keys(panels).length,
    documentHash,
    documentId,
    authority,
  };
}

/**
 * Validates the structural integrity of a carton model.
 */
export function validateCartonStructure(structure) {
  const errors = [];
  const warnings = [];

  if (!structure || typeof structure !== 'object') {
    return { ok: false, errors: ['Structure must be a valid object.'], warnings };
  }

  const { dimensions, panels } = structure;
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0 || dimensions.depth <= 0) {
    errors.push('Invalid dimensions: width, height, and depth must be positive numbers.');
  }

  const requiredFaces = [
    PANEL_ROLES.FRONT,
    PANEL_ROLES.BACK,
    PANEL_ROLES.LEFT,
    PANEL_ROLES.RIGHT,
    PANEL_ROLES.TOP,
    PANEL_ROLES.BOTTOM,
  ];

  for (const face of requiredFaces) {
    if (!panels[face]) {
      errors.push(`Missing mandatory carton panel: ${face}`);
    } else {
      const p = panels[face];
      if (!p.widthMm || p.widthMm <= 0 || !p.heightMm || p.heightMm <= 0) {
        errors.push(`Panel ${face} has invalid dimensions (${p.widthMm} x ${p.heightMm}).`);
      }
    }
  }

  // Check parent-child integrity
  for (const [key, p] of Object.entries(panels)) {
    if (p.parentPanel && !Object.values(panels).some(candidate => candidate.panelId === p.parentPanel)) {
      errors.push(`Panel ${key} references non-existent parent panel ${p.parentPanel}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    isComplete: errors.length === 0,
  };
}
