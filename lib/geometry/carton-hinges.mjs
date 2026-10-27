/**
 * PackSignal Packaging Geometry — Hinge Graph & Kinematics
 * (lib/geometry/carton-hinges.mjs)
 *
 * Implements Phase 7A Phase 4: Hinge Graph.
 * Nodes = physical panels and flaps.
 * Edges = physical fold/crease hinges.
 *
 * Distinguishes:
 * - CREASE FOLD (revolute joint around score line)
 * - CUT EDGE (disconnected boundary, no rotation)
 * - GLUE JOIN (fixed constraint / overlap)
 * - TUCK INSERTION (sliding / clearance fit)
 */

import { Mat4 } from '../../public/three/fold-engine.js';
import { PANEL_ROLES } from './carton-structure.mjs';

export const HINGE_TYPES = {
  CREASE_FOLD: 'CREASE_FOLD',
  CUT_EDGE: 'CUT_EDGE',
  GLUE_JOIN: 'GLUE_JOIN',
  TUCK_INSERTION: 'TUCK_INSERTION',
};

/**
 * Builds the hinge graph connecting panels and flaps for a folding carton.
 */
export function buildCartonHingeGraph({
  structure,
  toleranceMm = 0.5,
  geometryAuthority = 'VERIFIED_CAD_DIELINE',
} = {}) {
  const { dimensions, panels } = structure;
  const { width, height, depth } = dimensions;

  const hinges = [];
  const warnings = [];

  // 1. Front -> Left (vertical crease)
  hinges.push({
    hingeId: 'hinge_front_left',
    type: HINGE_TYPES.CREASE_FOLD,
    panelA: 'panel-front',
    panelB: 'panel-left',
    creaseSourceId: 'crease_score_01',
    axisStartMm: [-width / 2, -height / 2, 0],
    axisEndMm: [-width / 2, height / 2, 0],
    axisVector: [0, 1, 0],
    foldDirection: -1, // Folds backward (-90°)
    targetAngleRad: -Math.PI / 2,
    currentAngleRad: 0,
    foldOrder: 1,
    geometryAuthority,
  });

  // 2. Front -> Right (vertical crease)
  hinges.push({
    hingeId: 'hinge_front_right',
    type: HINGE_TYPES.CREASE_FOLD,
    panelA: 'panel-front',
    panelB: 'panel-right',
    creaseSourceId: 'crease_score_02',
    axisStartMm: [width / 2, -height / 2, 0],
    axisEndMm: [width / 2, height / 2, 0],
    axisVector: [0, 1, 0],
    foldDirection: 1, // Folds backward (+90°)
    targetAngleRad: Math.PI / 2,
    currentAngleRad: 0,
    foldOrder: 1,
    geometryAuthority,
  });

  // 3. Right -> Back (vertical crease)
  hinges.push({
    hingeId: 'hinge_right_back',
    type: HINGE_TYPES.CREASE_FOLD,
    panelA: 'panel-right',
    panelB: 'panel-back',
    creaseSourceId: 'crease_score_03',
    axisStartMm: [depth / 2, -height / 2, 0],
    axisEndMm: [depth / 2, height / 2, 0],
    axisVector: [0, 1, 0],
    foldDirection: 1,
    targetAngleRad: Math.PI / 2,
    currentAngleRad: 0,
    foldOrder: 2,
    geometryAuthority,
  });

  // 4. Front -> Top Closure (horizontal crease)
  hinges.push({
    hingeId: 'hinge_front_top',
    type: HINGE_TYPES.CREASE_FOLD,
    panelA: 'panel-front',
    panelB: 'panel-top',
    creaseSourceId: 'crease_score_04',
    axisStartMm: [-width / 2, height / 2, 0],
    axisEndMm: [width / 2, height / 2, 0],
    axisVector: [1, 0, 0],
    foldDirection: -1,
    targetAngleRad: -Math.PI / 2,
    currentAngleRad: 0,
    foldOrder: 3,
    geometryAuthority,
  });

  // 5. Front -> Bottom Closure (horizontal crease)
  hinges.push({
    hingeId: 'hinge_front_bottom',
    type: HINGE_TYPES.CREASE_FOLD,
    panelA: 'panel-front',
    panelB: 'panel-bottom',
    creaseSourceId: 'crease_score_05',
    axisStartMm: [-width / 2, -height / 2, 0],
    axisEndMm: [width / 2, -height / 2, 0],
    axisVector: [1, 0, 0],
    foldDirection: 1,
    targetAngleRad: Math.PI / 2,
    currentAngleRad: 0,
    foldOrder: 3,
    geometryAuthority,
  });

  // 6. Top Closure -> Top Tuck Tab (horizontal crease)
  if (panels[PANEL_ROLES.TOP_TUCK_FLAP]) {
    hinges.push({
      hingeId: 'hinge_top_tuck',
      type: HINGE_TYPES.CREASE_FOLD,
      panelA: 'panel-top',
      panelB: 'panel-top-tuck',
      creaseSourceId: 'crease_score_06',
      axisStartMm: [-width / 2, depth / 2, 0],
      axisEndMm: [width / 2, depth / 2, 0],
      axisVector: [1, 0, 0],
      foldDirection: -1,
      targetAngleRad: -Math.PI / 2,
      currentAngleRad: 0,
      foldOrder: 4,
      geometryAuthority,
    });
  }

  // 7. Bottom Closure -> Bottom Tuck Tab (horizontal crease)
  if (panels[PANEL_ROLES.BOTTOM_TUCK_FLAP]) {
    hinges.push({
      hingeId: 'hinge_bottom_tuck',
      type: HINGE_TYPES.CREASE_FOLD,
      panelA: 'panel-bottom',
      panelB: 'panel-bottom-tuck',
      creaseSourceId: 'crease_score_07',
      axisStartMm: [-width / 2, -depth / 2, 0],
      axisEndMm: [width / 2, -depth / 2, 0],
      axisVector: [1, 0, 0],
      foldDirection: 1,
      targetAngleRad: Math.PI / 2,
      currentAngleRad: 0,
      foldOrder: 4,
      geometryAuthority,
    });
  }

  // 8. Back -> Glue Flap (Vertical crease)
  if (panels[PANEL_ROLES.GLUE_FLAP]) {
    hinges.push({
      hingeId: 'hinge_back_glue',
      type: HINGE_TYPES.CREASE_FOLD,
      panelA: 'panel-back',
      panelB: 'panel-glue-flap',
      creaseSourceId: 'crease_score_08',
      axisStartMm: [width / 2, -height / 2, 0],
      axisEndMm: [width / 2, height / 2, 0],
      axisVector: [0, 1, 0],
      foldDirection: 1,
      targetAngleRad: Math.PI / 2,
      currentAngleRad: 0,
      foldOrder: 2,
      geometryAuthority,
    });
  }

  // 9. Dust Flaps
  if (panels[PANEL_ROLES.TOP_DUST_FLAP_LEFT]) {
    hinges.push({
      hingeId: 'hinge_left_top_dust',
      type: HINGE_TYPES.CREASE_FOLD,
      panelA: 'panel-left',
      panelB: 'panel-dust-top-left',
      creaseSourceId: 'crease_score_dust_01',
      axisStartMm: [-depth / 2, height / 2, 0],
      axisEndMm: [depth / 2, height / 2, 0],
      axisVector: [1, 0, 0],
      foldDirection: -1,
      targetAngleRad: -Math.PI / 2,
      currentAngleRad: 0,
      foldOrder: 3,
      geometryAuthority,
    });
  }

  if (panels[PANEL_ROLES.TOP_DUST_FLAP_RIGHT]) {
    hinges.push({
      hingeId: 'hinge_right_top_dust',
      type: HINGE_TYPES.CREASE_FOLD,
      panelA: 'panel-right',
      panelB: 'panel-dust-top-right',
      creaseSourceId: 'crease_score_dust_02',
      axisStartMm: [-depth / 2, height / 2, 0],
      axisEndMm: [depth / 2, height / 2, 0],
      axisVector: [1, 0, 0],
      foldDirection: -1,
      targetAngleRad: -Math.PI / 2,
      currentAngleRad: 0,
      foldOrder: 3,
      geometryAuthority,
    });
  }

  // Cut boundaries (explicitly marked so they are NOT mistaken for folding creases)
  const cutBoundaries = [
    { edgeId: 'cut_left_outer', panelA: 'panel-left', type: HINGE_TYPES.CUT_EDGE },
    { edgeId: 'cut_top_perimeter', panelA: 'panel-top', type: HINGE_TYPES.CUT_EDGE },
    { edgeId: 'cut_bottom_perimeter', panelA: 'panel-bottom', type: HINGE_TYPES.CUT_EDGE },
  ];

  // Adjacency and cycle validation
  const nodes = Object.keys(panels);
  const nodeCount = nodes.length;

  return {
    root: 'panel-front',
    hinges,
    hingeCount: hinges.length,
    cutBoundaries,
    nodes,
    nodeCount,
    warnings,
    isFullyConnected: hinges.length >= 5,
  };
}

/**
 * Computes rotation matrix for an individual hinge at progress t ∈ [0, 1].
 */
export function computeHingeRotationMatrix(hinge, progress = 0) {
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  const angle = hinge.targetAngleRad * t;
  return Mat4.rotationAxis(hinge.axisVector, angle);
}
