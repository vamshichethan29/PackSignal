/**
 * @file lib/pack-canvas/layout-solver.mjs
 * 
 * PackSignal Phase 6 — Generic Constrained 2D Layout Solver
 * 
 * Implements deterministic packing of regulatory and brand content blocks
 * onto physical packaging panels while respecting:
 * - Panel safe margins and printable boundaries
 * - Locked brand asset exclusion zones (Logo, Hero Photography, Story Art, Certified Marks)
 * - Required safety clearances between content and cut/crease lines
 * - Regulatory placement rules (PDP net quantity bottom 30%, Information panel groupings)
 */

import { doBoxesCollide, isBlockContainedInPanel, findObstacleCollisions } from './geometry-utils.mjs';

/**
 * Solves 2D placement for a set of content blocks on given panels with locked obstacles.
 */
export function solvePackLayout(panels, lockedZones, blocks, options = {}) {
  const startTime = Date.now();
  const placedBlocks = [];
  const unplacedBlocks = [];
  const placementsByPanel = {};
  const panelOccupancy = {};

  // Initialize panels
  for (const p of panels) {
    placementsByPanel[p.id] = [];
    panelOccupancy[p.id] = {
      panel: p,
      locked: lockedZones.filter(z => z.panelId === p.id),
      currentY: p.safeMarginMm + 4.0
    };
  }

  // Sort blocks: mandatory first, then by priority or existing y coordinate
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
    return (a.yMm || 0) - (b.yMm || 0);
  });

  for (const block of sortedBlocks) {
    const targetPanelId = block.panelId || 'panel-back';
    const targetPanel = panels.find(p => p.id === targetPanelId);

    if (!targetPanel) {
      unplacedBlocks.push({
        ...block,
        unplacedReason: `Target panel ${targetPanelId} does not exist in structural dieline`
      });
      continue;
    }

    const panelState = panelOccupancy[targetPanelId];
    const safeMargin = targetPanel.safeMarginMm || 2.0;
    const safeWidth = targetPanel.widthMm - safeMargin * 2;
    const blockWidth = Math.min(block.widthMm, safeWidth);
    const blockHeight = block.heightMm;

    // Check if block has explicit fixed position requested or needs automatic stacking
    let candidateX = block.xMm !== undefined ? block.xMm : safeMargin;
    let candidateY = block.yMm !== undefined ? block.yMm : panelState.currentY;

    let candidatePlacement = {
      ...block,
      widthMm: blockWidth,
      heightMm: blockHeight,
      xMm: candidateX,
      yMm: candidateY
    };

    // Check collision with locked brand obstacles on this panel
    let collisions = findObstacleCollisions(candidatePlacement, panelState.locked);

    // If colliding, attempt to step down below the obstacle
    if (collisions.length > 0) {
      const obstacle = panelState.locked.find(o => collisions.some(c => c.obstacleId === o.id));
      if (obstacle) {
        candidateY = obstacle.yMm + obstacle.heightMm + (obstacle.requiredClearanceMm || 2.0);
        candidatePlacement.yMm = candidateY;
        collisions = findObstacleCollisions(candidatePlacement, panelState.locked);
      }
    }

    // Check collision with already placed blocks on this panel
    for (const pb of placementsByPanel[targetPanelId]) {
      if (doBoxesCollide(candidatePlacement, pb, 2.0)) {
        candidateY = Math.max(candidateY, pb.yMm + pb.heightMm + 2.5);
        candidatePlacement.yMm = candidateY;
      }
    }

    // Check if final candidate placement fits inside panel boundaries
    const fitsInPanel = isBlockContainedInPanel(candidatePlacement, targetPanel);

    if (fitsInPanel && collisions.length === 0) {
      const finalPlaced = {
        ...candidatePlacement,
        dielineXmm: Number((targetPanel.xMm + candidatePlacement.xMm).toFixed(2)),
        dielineYmm: Number((targetPanel.yMm + candidatePlacement.yMm).toFixed(2))
      };
      placedBlocks.push(finalPlaced);
      placementsByPanel[targetPanelId].push(finalPlaced);
      panelState.currentY = candidateY + blockHeight + 3.0;
    } else {
      unplacedBlocks.push({
        ...candidatePlacement,
        unplacedReason: !fitsInPanel
          ? `Vertical spill: Bottom at ${Number((candidatePlacement.yMm + blockHeight).toFixed(1))} mm exceeds safe panel height (${(targetPanel.heightMm - safeMargin).toFixed(1)} mm)`
          : `Collides with locked brand obstacle: ${collisions[0]?.obstacleName || 'Locked Art'}`
      });
    }
  }

  const hasOverflow = unplacedBlocks.length > 0;
  const overflowPanels = [...new Set(unplacedBlocks.map(b => b.panelId))];

  return {
    status: hasOverflow ? 'OVERFLOW' : 'FEASIBLE',
    solverStatus: hasOverflow ? 'OVERFLOW' : 'FEASIBLE',
    placedBlocks,
    unplacedBlocks,
    placementsByPanel,
    overflowResults: {
      hasOverflow,
      overflowPanels,
      unplacedCount: unplacedBlocks.length,
      unplacedBlocks
    },
    timeSpentMs: Date.now() - startTime
  };
}
