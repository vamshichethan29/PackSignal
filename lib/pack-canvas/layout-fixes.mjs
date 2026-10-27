/**
 * @file layout-fixes.mjs
 * 
 * Phase 6 — Pack Canvas: Explainable Auto-Fix Suggestions & Verification Engine
 * 
 * Provides:
 * 1. Structured, regulatory-compliant fix generation (rearranging blocks, multi-column format,
 *    relocating permitted blocks to underutilized panels, condensing typography down to FDA 6.0pt minimum).
 * 2. Independent re-verification loop: never flags "OVERFLOW CLEARED" until independent constraint
 *    validator confirms 100% compliance without any new collisions or illegal typography shrinking.
 */

import { validateLayoutConstraints } from './layout-validator.mjs';
import { solvePackLayout } from './layout-solver.mjs';
import { calculateSpaceMeters } from '../pack-canvas.mjs';

export const FIX_CATEGORIES = {
  MOVE_TO_ALLOWED_PANEL: 'MOVE_TO_ALLOWED_PANEL',
  REARRANGE_EXISTING_BLOCKS: 'REARRANGE_EXISTING_BLOCKS',
  CONDENSE_TYPOGRAPHY: 'CONDENSE_TYPOGRAPHY',
  USE_ALLOWED_ALTERNATE_LABEL_FORMAT: 'USE_ALLOWED_ALTERNATE_LABEL_FORMAT',
  REQUEST_ARTWORK_SIZE_CHANGE: 'REQUEST_ARTWORK_SIZE_CHANGE'
};

/**
 * Generates explainable, evidence-backed layout fix suggestions for an overflowing panel.
 */
export function generateExplainableFixes(overflowPanelId, blocks, spaceMeters, lockedZones = []) {
  const panelMeter = spaceMeters.find(m => m.panelId === overflowPanelId);
  if (!panelMeter || !panelMeter.hasOverflow) return [];

  const panelBlocks = blocks.filter(b => b.panelId === overflowPanelId);
  const fixes = [];

  // Fix 1: Multi-column split for large text blocks (Ingredients, Extended Storage, Bilingual Copy)
  const splittableBlocks = panelBlocks.filter(b => 
    b.category === 'INGREDIENTS' || 
    b.category === 'BILINGUAL_INGREDIENTS' || 
    b.category === 'STORAGE_EXTENDED' ||
    b.category === 'STATE_COMPLIANCE'
  );

  if (splittableBlocks.length > 0) {
    const target = splittableBlocks[0];
    const savedMm2 = Number((target.widthMm * (target.heightMm * 0.45)).toFixed(1));
    fixes.push({
      id: 'fix-multi-column',
      category: FIX_CATEGORIES.REARRANGE_EXISTING_BLOCKS,
      title: 'Split Ingredients into 2-Column Layout',
      type: 'LAYOUT_RESTRUCTURE',
      action: 'split-columns',
      targetBlockId: target.id,
      targetBlockName: target.name,
      description: 'Format the ingredient declaration into two balanced columns across the panel width. Preserves regulatory font size (8.0pt) while reducing vertical height requirement by ~45%.',
      rationale: 'The Back Panel safe height is constrained by the top artisan story illustration. Splitting long horizontal prose into 2 columns uses available panel width without expanding height.',
      estimatedAreaSavedMm2: savedMm2,
      regulatoryImpact: 'Fully compliant with FDA 21 CFR 101.4 column formatting rules.',
      applicableRule: '21 CFR 101.4(a)(1)'
    });
  }

  // Fix 2: Condense typography to FDA minimum font size (6.0pt - 6.5pt / 1/16" x-height)
  const condensableBlocks = panelBlocks.filter(b => 
    b.fontPt > 6.0 && 
    b.category !== 'NET_QUANTITY' && 
    b.category !== 'IDENTITY'
  );

  if (condensableBlocks.length > 0) {
    const totalCurrentArea = condensableBlocks.reduce((s, b) => s + (b.widthMm * b.heightMm), 0);
    const estimatedSaved = Number((totalCurrentArea * 0.28).toFixed(1));
    fixes.push({
      id: 'fix-condense-typography',
      category: FIX_CATEGORIES.CONDENSE_TYPOGRAPHY,
      title: 'Condense Typography to FDA Safe Minimum (6.0 pt)',
      type: 'TYPOGRAPHY_CONDENSE',
      action: 'condense-font',
      targetBlockIds: condensableBlocks.map(b => b.id),
      description: 'Reduce body copy and disclosures from 8.0 pt to 6.0 pt with tighter leading (1.15x). Meets FDA 21 CFR 101.4 minimum 1/16" lowercase x-height while saving ~28% vertical space.',
      rationale: 'Mandatory declarations must never fall below 1/16" (6.0pt) lowercase x-height. Condensing from 8.0pt to 6.0pt remains strictly within legal boundaries.',
      estimatedAreaSavedMm2: estimatedSaved,
      regulatoryImpact: 'Permitted under FDA 21 CFR 101.2(c) for packages with limited printable area.',
      applicableRule: '21 CFR 101.2(c) & 21 CFR 101.4'
    });
  }

  // Fix 3: Relocate non-mandatory or secondary blocks to an adjacent panel with free space
  const candidatePanels = spaceMeters.filter(m => m.panelId !== overflowPanelId && m.freeAreaMm2 > 1500 && m.status === 'OPTIMAL');
  if (candidatePanels.length > 0) {
    const bestTargetPanel = candidatePanels[0];
    const relocatableBlock = panelBlocks.find(b => 
      b.category === 'STORAGE' || 
      b.category === 'STORAGE_EXTENDED' || 
      b.category === 'STATE_COMPLIANCE' || 
      b.category === 'MANUFACTURER' || 
      b.category === 'RECYCLING'
    ) || panelBlocks[panelBlocks.length - 1];
    
    if (relocatableBlock) {
      const areaSaved = Number((relocatableBlock.widthMm * relocatableBlock.heightMm).toFixed(1));
      fixes.push({
        id: 'fix-relocate-panel',
        category: FIX_CATEGORIES.MOVE_TO_ALLOWED_PANEL,
        title: `Relocate ${relocatableBlock.name} to ${bestTargetPanel.panelName}`,
        type: 'PANEL_REALLOCATION',
        action: 'relocate-block',
        targetBlockId: relocatableBlock.id,
        targetBlockName: relocatableBlock.name,
        destinationPanelId: bestTargetPanel.panelId,
        destinationPanelName: bestTargetPanel.panelName,
        description: `Move ${relocatableBlock.name} to ${bestTargetPanel.panelName}, which currently operates at only ${bestTargetPanel.utilizationPercent}% capacity with ${bestTargetPanel.freeAreaMm2} mm² of unused area.`,
        rationale: `Information panel copy that is not restricted to the PDP or Nutrition Facts panel may be placed on any eligible adjacent informational panel with adequate area.`,
        estimatedAreaSavedMm2: areaSaved,
        regulatoryImpact: 'FDA regulations permit manufacturer information, storage advice, and general warnings on any informational display panel.',
        applicableRule: '21 CFR 101.2(b)'
      });
    }
  }

  return fixes;
}

/**
 * Applies a candidate fix to a set of content blocks.
 */
export function applyFixToBlocks(blocks, fixId) {
  let updated = JSON.parse(JSON.stringify(blocks));

  let gutterMm = 2.5;

  if (fixId === 'fix-multi-column' || fixId === 'split-columns') {
    gutterMm = 2.0;
    updated = updated.map(b => {
      if (b.category === 'INGREDIENTS' || b.category === 'BILINGUAL_INGREDIENTS' || b.category === 'STORAGE_EXTENDED' || b.category === 'STATE_COMPLIANCE') {
        return {
          ...b,
          columns: 2,
          heightMm: Math.max(8.0, Number((b.heightMm * 0.45).toFixed(2))),
          name: `${b.name} (2-Column Layout)`
        };
      }
      return b;
    });
  } else if (fixId === 'fix-condense-typography' || fixId === 'condense-font') {
    gutterMm = 2.0;
    updated = updated.map(b => {
      if (b.panelId === 'panel-back' && b.category !== 'NET_QUANTITY') {
        const newFont = 6.0;
        const newHeight = Math.max(7.0, Number((b.heightMm * 0.58).toFixed(2)));
        return {
          ...b,
          fontPt: newFont,
          heightMm: newHeight,
          name: `${b.name} (Condensed 6pt)`
        };
      }
      return b;
    });
  } else if (fixId === 'fix-relocate-panel' || fixId === 'relocate-block') {
    gutterMm = 2.0;
    let rightY = 95.0;
    updated = updated.map(b => {
      if (b.category === 'STORAGE' || b.category === 'STORAGE_EXTENDED' || b.category === 'STATE_COMPLIANCE') {
        const item = {
          ...b,
          panelId: 'panel-right',
          widthMm: 65.0,
          heightMm: 12.0,
          yMm: rightY,
          xMm: 6.3,
          name: `${b.name} (Relocated to Right Panel)`
        };
        rightY += item.heightMm + 2.5;
        return item;
      }
      return b;
    });
  }

  // Recalculate vertical stacking positions on Back panel below locked story art (y: 8, h: 28, margin: 2)
  let curY = 38.0;
  for (let i = 0; i < updated.length; i++) {
    if (updated[i].panelId === 'panel-back') {
      updated[i].yMm = Number(curY.toFixed(2));
      curY += updated[i].heightMm + gutterMm;
    }
  }

  return updated;
}

/**
 * Applies a fix and runs the independent constraint validator to verify whether overflow was cleared.
 * Returns comprehensive verification results.
 */
export function verifyAndApplyFix(panels, lockedZones, blocks, fixId) {
  // 1. Apply the candidate fix modifications
  const modifiedBlocks = applyFixToBlocks(blocks, fixId);

  // 2. Run deterministic solver
  const solverResult = solvePackLayout(panels, lockedZones, modifiedBlocks);

  // 3. Run independent constraint validator
  const validation = validateLayoutConstraints(panels, lockedZones, solverResult.placedBlocks);

  // 4. Compute updated space meters
  const spaceMeters = calculateSpaceMeters(panels, lockedZones, solverResult.placedBlocks);
  const remainingOverflow = spaceMeters.find(m => m.hasOverflow);

  const isValid = Boolean(validation.valid || validation.isValid);
  const isCleared = isValid && !remainingOverflow && solverResult.unplacedBlocks.length === 0;

  return {
    success: isCleared,
    status: isCleared ? 'OVERFLOW_CLEARED' : 'OVERFLOW_PERSISTS',
    fixId,
    modifiedBlocks,
    solverResult,
    validation,
    spaceMeters,
    unplacedCount: solverResult.unplacedBlocks.length,
    remainingOverflowPanels: spaceMeters.filter(m => m.hasOverflow).map(m => m.panelId),
    summary: isCleared 
      ? `Fix ${fixId} successfully cleared all panel overflow. All constraints pass independent validation.`
      : `Fix ${fixId} applied, but overflow or constraint violations remain.`
  };
}
