/**
 * @file lib/pack-canvas/geometry-utils.mjs
 * 
 * PackSignal Phase 6 — Computational Geometry Utilities for Pack Canvas
 * 
 * Provides rigorous 2D geometric checks:
 * - Polygon bounds and area calculations
 * - AABB collision detection with configurable clearance gaps
 * - Panel safe zone containment validation
 * - Dimension-aware admissible region checking (prevents false area-only fits in narrow strips)
 */

export const MM_TO_PT = 25.4 / 72; // ~0.352778
export const PT_TO_MM = 72 / 25.4; // ~2.83465

/**
 * Checks if two 2D axis-aligned bounding boxes collide (with optional clearance margin).
 */
export function doBoxesCollide(boxA, boxB, clearanceMm = 0) {
  const aLeft = boxA.xMm - clearanceMm;
  const aRight = boxA.xMm + boxA.widthMm + clearanceMm;
  const aTop = boxA.yMm - clearanceMm;
  const aBottom = boxA.yMm + boxA.heightMm + clearanceMm;

  const bLeft = boxB.xMm;
  const bRight = boxB.xMm + boxB.widthMm;
  const bTop = boxB.yMm;
  const bBottom = boxB.yMm + boxB.heightMm;

  return !(aRight <= bLeft || aLeft >= bRight || aBottom <= bTop || aTop >= bBottom);
}

/**
 * Validates if a content block fits completely inside the panel safe area.
 */
export function isBlockContainedInPanel(block, panel, marginMm = 0) {
  const safeMargin = (panel.safeMarginMm || 2.0) + marginMm;
  const panelSafeRight = panel.widthMm - safeMargin;
  const panelSafeBottom = panel.heightMm - safeMargin;

  const blockRight = block.xMm + block.widthMm;
  const blockBottom = block.yMm + block.heightMm;

  return (
    block.xMm >= safeMargin &&
    block.yMm >= safeMargin &&
    blockRight <= panelSafeRight &&
    blockBottom <= panelSafeBottom
  );
}

/**
 * Checks if a block collides with any locked obstacles on the panel.
 */
export function findObstacleCollisions(block, lockedObstacles = []) {
  const collisions = [];

  for (const obstacle of lockedObstacles) {
    const clearance = obstacle.requiredClearanceMm || 1.5;
    if (doBoxesCollide(block, obstacle, clearance)) {
      collisions.push({
        obstacleId: obstacle.id,
        obstacleName: obstacle.name,
        obstacleType: obstacle.type || 'LOCKED_ASSET',
        requiredClearanceMm: clearance
      });
    }
  }

  return collisions;
}

/**
 * Dimension-aware feasibility check:
 * Determines whether a block of [widthMm, heightMm] can physically fit into any admissible
 * contiguous sub-region of the panel, avoiding locked obstacles.
 * 
 * CRITICAL RULE: A total free area of 500 mm² does NOT mean a 200 mm² block fits
 * if the remaining space is split into a 4 mm × 125 mm sliver!
 */
export function canBlockFitAdmissibleSpace(blockDim, panel, lockedObstacles = []) {
  const safeMargin = panel.safeMarginMm || 2.0;
  const safeW = panel.widthMm - safeMargin * 2;
  const safeH = panel.heightMm - safeMargin * 2;

  if (blockDim.widthMm > safeW || blockDim.heightMm > safeH) {
    return {
      canFit: false,
      reason: `Block dimensions (${blockDim.widthMm} × ${blockDim.heightMm} mm) exceed panel safe printable area (${safeW.toFixed(1)} × ${safeH.toFixed(1)} mm)`
    };
  }

  // Filter obstacles on this panel
  const panelObstacles = lockedObstacles.filter(o => o.panelId === panel.id);

  // If no obstacles, it fits if dimensions are <= safe dimensions
  if (panelObstacles.length === 0) {
    return { canFit: true };
  }

  // Check simple vertical skyline / slot fitting:
  // Sort obstacles by y coordinate to find available vertical windows
  const sortedObs = [...panelObstacles].sort((a, b) => a.yMm - b.yMm);

  let currentY = safeMargin;
  for (const obs of sortedObs) {
    const availableSlotHeight = obs.yMm - currentY - (obs.requiredClearanceMm || 1.5);
    if (availableSlotHeight >= blockDim.heightMm && safeW >= blockDim.widthMm) {
      return { canFit: true, suggestedY: currentY };
    }
    currentY = Math.max(currentY, obs.yMm + obs.heightMm + (obs.requiredClearanceMm || 1.5));
  }

  // Check remaining space below last obstacle
  const bottomSlotHeight = (panel.heightMm - safeMargin) - currentY;
  if (bottomSlotHeight >= blockDim.heightMm && safeW >= blockDim.widthMm) {
    return { canFit: true, suggestedY: currentY };
  }

  return {
    canFit: false,
    reason: `Locked brand art prevents any continuous contiguous space of ${blockDim.widthMm} × ${blockDim.heightMm} mm on ${panel.name}`
  };
}

/**
 * Calculates accurate polygon area for simple non-intersecting polygons.
 */
export function calculatePolygonAreaMm2(vertices = []) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }

  return Math.abs(area) / 2.0;
}
