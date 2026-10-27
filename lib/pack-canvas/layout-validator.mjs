/**
 * @file lib/pack-canvas/layout-validator.mjs
 * 
 * PackSignal Phase 6 — Independent Layout Constraint Validator
 * 
 * Validates a solved or proposed layout independently from the solver.
 * Enforces:
 * - All mandatory blocks are placed
 * - Placements are contained strictly within safe boundaries
 * - Zero overlap with locked brand artwork
 * - Zero mutual overlap between content blocks
 * - PDP Net Quantity placement in bottom 30% of PDP
 * - Minimum font size adherence (no illegal font shrinkage below legal minimums)
 */

import { doBoxesCollide, isBlockContainedInPanel, findObstacleCollisions } from './geometry-utils.mjs';
import { validateRegulatoryFontMinimum } from './text-measurement.mjs';

/**
 * Independently validates a layout state.
 */
export function validateLayoutConstraints(panels, lockedZones, placedBlocks, mandatoryBlocks = []) {
  const violatedConstraints = [];
  let verifiedCount = 0;

  // 1. Mandatory presence check: ensure all mandatory blocks were placed
  const placedIds = new Set(placedBlocks.map(b => b.id));
  for (const mBlock of mandatoryBlocks) {
    if (!placedIds.has(mBlock.id)) {
      violatedConstraints.push({
        type: 'MISSING_MANDATORY_BLOCK',
        severity: 'CRITICAL',
        blockId: mBlock.id,
        blockName: mBlock.name,
        citation: mBlock.citation || 'Statutory Requirement',
        message: `Mandatory block "${mBlock.name}" (${mBlock.citation || 'Regulatory'}) was not placed on the package.`
      });
    } else {
      verifiedCount++;
    }
  }

  // 2. Panel containment and obstacle collision checks
  for (let i = 0; i < placedBlocks.length; i++) {
    const block = placedBlocks[i];
    const panel = panels.find(p => p.id === block.panelId);

    if (!panel) {
      violatedConstraints.push({
        type: 'INVALID_PANEL',
        severity: 'CRITICAL',
        blockId: block.id,
        message: `Block "${block.name}" references non-existent panel: ${block.panelId}`
      });
      continue;
    }

    // A. Boundary containment check
    if (!isBlockContainedInPanel(block, panel)) {
      violatedConstraints.push({
        type: 'OUT_OF_BOUNDS',
        severity: 'CRITICAL',
        blockId: block.id,
        panelId: panel.id,
        message: `Block "${block.name}" spills outside ${panel.name} safe margins (Y: ${block.yMm}mm, H: ${block.heightMm}mm)`
      });
    } else {
      verifiedCount++;
    }

    // B. Collision with locked brand obstacles
    const panelLocked = lockedZones.filter(z => z.panelId === panel.id);
    const obstacleCollisions = findObstacleCollisions(block, panelLocked);
    if (obstacleCollisions.length > 0) {
      violatedConstraints.push({
        type: 'LOCKED_ART_COLLISION',
        severity: 'CRITICAL',
        blockId: block.id,
        obstacleId: obstacleCollisions[0].obstacleId,
        message: `Block "${block.name}" collides with locked brand asset "${obstacleCollisions[0].obstacleName}"`
      });
    } else {
      verifiedCount++;
    }

    // C. Mutual overlap between content blocks
    for (let j = i + 1; j < placedBlocks.length; j++) {
      const otherBlock = placedBlocks[j];
      if (block.panelId === otherBlock.panelId && doBoxesCollide(block, otherBlock, 0.5)) {
        violatedConstraints.push({
          type: 'MUTUAL_BLOCK_COLLISION',
          severity: 'HIGH',
          blockIdA: block.id,
          blockIdB: otherBlock.id,
          message: `Block "${block.name}" overlaps with block "${otherBlock.name}" on ${panel.name}`
        });
      }
    }

    // D. PDP Net Quantity position check (21 CFR 101.7: bottom 30% of PDP)
    if (block.category === 'NET_QUANTITY' && block.panelId === 'panel-front') {
      const bottomThresholdMm = panel.heightMm * (1 - 0.30); // bottom 30% begins at 70% height
      if (block.yMm < bottomThresholdMm) {
        violatedConstraints.push({
          type: 'PDP_PLACEMENT_VIOLATION',
          severity: 'HIGH',
          blockId: block.id,
          citation: '21 CFR 101.7(f)',
          message: `Net Quantity must be located in bottom 30% of PDP (Y >= ${bottomThresholdMm.toFixed(1)}mm; placed at ${block.yMm}mm)`
        });
      } else {
        verifiedCount++;
      }
    }

    // E. Minimum font size validation
    if (block.fontPt) {
      const fontCheck = validateRegulatoryFontMinimum(block.category, block.fontPt);
      if (!fontCheck.compliant) {
        violatedConstraints.push({
          type: 'ILLEGAL_FONT_SHRINKAGE',
          severity: 'CRITICAL',
          blockId: block.id,
          citation: fontCheck.citation,
          message: `Block "${block.name}" font size (${block.fontPt}pt) shrunk below statutory minimum (${fontCheck.requiredMinPt}pt)`
        });
      } else {
        verifiedCount++;
      }
    }
  }

  const isValid = violatedConstraints.length === 0;
  return {
    valid: isValid,
    isValid,
    violatedConstraints,
    details: violatedConstraints,
    failedChecks: violatedConstraints,
    verifiedCheckCount: verifiedCount
  };
}
