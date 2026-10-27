/**
 * @file layout-state.mjs
 * 
 * Phase 6 — Pack Canvas: Layout State, Scenarios, Revisions, and Export Engine
 * 
 * Manages:
 * 1. Active canvas layout state (panels, locked zones, blocks, placements, space meters).
 * 2. Scenario switching (standard US corrected, controlled overflow, Indian FSSAI).
 * 3. Immutable revision snapshots and audit history.
 * 4. Exportable machine-readable layout proposal and print proof metadata.
 */

import crypto from 'crypto';
import { 
  PACK_PANELS, 
  LOCKED_BRAND_ZONES, 
  getCorrectedUSPackBlocks, 
  EXTRA_REQUIRED_ITEMS, 
  INDIA_REQUIRED_ITEMS, 
  calculateSpaceMeters 
} from '../pack-canvas.mjs';
import { solvePackLayout } from './layout-solver.mjs';
import { validateLayoutConstraints } from './layout-validator.mjs';
import { generateExplainableFixes, applyFixToBlocks, verifyAndApplyFix } from './layout-fixes.mjs';
import { createLayoutRecord, validateLayoutRecord, LAYOUT_STATUS } from './layout-schema.mjs';

// In-memory persistent revisions registry
const layoutRevisionsStore = new Map();

/**
 * Generates an end-to-end Pack Canvas layout state for a given scenario and options.
 */
export function buildLayoutState(options = {}) {
  const scenario = options.scenario || (options.overflowScenario ? 'overflow' : 'standard');
  const market = String(options.market || 'US').toUpperCase();
  const activeFix = options.activeFix || null;
  const reviewId = options.reviewId || 'REV-BERRY-CRUNCH-2026';
  const briefId = options.briefId || 'BRIEF-DF-BERRY-US-2026';

  const panels = PACK_PANELS;
  const lockedZones = LOCKED_BRAND_ZONES;

  // 1. Base content blocks
  let blocks = getCorrectedUSPackBlocks();

  // 2. Scenario specific adaptations
  if (market === 'IN' || scenario === 'india') {
    blocks = blocks.map(b => {
      if (b.category === 'NET_QUANTITY') {
        return {
          ...b,
          text: 'NET WT 480 g',
          citation: 'Legal Metrology Rule 12',
          name: 'Metric Net Quantity (Legal Metrology)'
        };
      }
      return b;
    });
    blocks = [...blocks, ...INDIA_REQUIRED_ITEMS];

    // Initial naive placement on back
    let inStackY = 38.0;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].panelId === 'panel-back') {
        blocks[i].yMm = Number(inStackY.toFixed(2));
        inStackY += blocks[i].heightMm + 2.5;
      }
    }
  } else if (scenario === 'overflow') {
    // Controlled reproducible overflow fixture
    blocks = [...blocks, ...EXTRA_REQUIRED_ITEMS];
    let stackY = 135.0;
    for (const b of EXTRA_REQUIRED_ITEMS) {
      const match = blocks.find(item => item.id === b.id);
      if (match) {
        match.yMm = stackY;
        match.xMm = 7.18;
        stackY += match.heightMm + 4.0;
      }
    }
  }

  // 3. Apply active fix if specified
  let fixVerification = null;
  if (activeFix) {
    fixVerification = verifyAndApplyFix(panels, lockedZones, blocks, activeFix);
    blocks = fixVerification.modifiedBlocks;
  }

  // 4. Solve 2D packing deterministic placement
  const solverResult = solvePackLayout(panels, lockedZones, blocks);

  // 5. Calculate space meters
  const spaceMeters = calculateSpaceMeters(panels, lockedZones, blocks);

  // 6. Independent validation
  const validation = validateLayoutConstraints(panels, lockedZones, solverResult.placedBlocks);

  // 7. Overflow analysis and explainable fixes
  const overflowPanel = spaceMeters.find(m => m.hasOverflow) || (solverResult.unplacedBlocks.length > 0 ? { panelId: solverResult.unplacedBlocks[0].panelId } : null);
  const hasOverflow = Boolean(overflowPanel) || solverResult.unplacedBlocks.length > 0;
  const suggestedFixes = hasOverflow 
    ? generateExplainableFixes(overflowPanel ? overflowPanel.panelId : 'panel-back', blocks, spaceMeters, lockedZones)
    : [];

  // 8. Canonical layout record
  const layoutStatus = hasOverflow 
    ? LAYOUT_STATUS.OVERFLOW 
    : (validation.valid ? LAYOUT_STATUS.PROPOSED : LAYOUT_STATUS.VALIDATION_FAILED);

  const canonicalRecord = createLayoutRecord({
    reviewId,
    briefId,
    documentId: 'DOC-BERRY-CRUNCH-CARTON-2026',
    documentSha256: '9f83a2185c7d8124b104928f8f2b7ec937b2d5d8e7c10b48a1b2496a847e65f1',
    market,
    packageType: 'Folding Carton / Cereal Box',
    physicalScaleAuthority: 'VERIFIED_ESKO_DIELINE',
    panels,
    lockedZones,
    contentBlocks: blocks,
    placements: solverResult.placements,
    constraintResults: validation.details,
    overflowResults: {
      hasOverflow,
      overflowPanelId: overflowPanel ? overflowPanel.panelId : null,
      unplacedCount: solverResult.unplacedBlocks.length,
      unplacedBlocks: solverResult.unplacedBlocks,
      verticalSpillMm: overflowPanel ? overflowPanel.verticalOverflowMm : 0
    },
    suggestedFixes,
    layoutStatus
  });

  return {
    success: true,
    scenario,
    market,
    activeFix,
    fixVerification,
    panels,
    lockedBrandZones: lockedZones,
    blocks,
    placements: solverResult.placements,
    placedBlocks: solverResult.placedBlocks,
    unplacedBlocks: solverResult.unplacedBlocks,
    spaceMeters,
    validation,
    hasOverflow,
    overflowPanelId: overflowPanel?.panelId || null,
    suggestedFixes,
    canonicalRecord
  };
}

/**
 * Saves a layout revision snapshot to memory and returns revision metadata.
 */
export function saveLayoutRevision(state, author = 'Senior Packaging Reviewer', notes = '') {
  const revisionId = `REV-PACK-CANVAS-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  
  const snapshot = {
    revisionId,
    timestamp,
    author,
    notes,
    scenario: state.scenario,
    market: state.market,
    activeFix: state.activeFix,
    layoutStatus: state.canonicalRecord?.layoutStatus || (state.hasOverflow ? 'OVERFLOW' : 'PROPOSED'),
    totalBlocks: state.blocks.length,
    placedCount: state.placedBlocks.length,
    unplacedCount: state.unplacedBlocks.length,
    validationPassed: state.validation?.valid ?? false,
    spaceMeters: state.spaceMeters,
    checksum: crypto.createHash('sha256').update(JSON.stringify(state.canonicalRecord)).digest('hex')
  };

  layoutRevisionsStore.set(revisionId, snapshot);

  return snapshot;
}

/**
 * Retrieves all saved layout revisions for audit inspection.
 */
export function getSavedLayoutRevisions() {
  return Array.from(layoutRevisionsStore.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Generates an export layout proposal manifest suitable for prepress sign-off.
 */
export function generateLayoutProposalExport(state) {
  const generatedAt = new Date().toISOString();
  const sha256 = crypto.createHash('sha256').update(JSON.stringify(state.canonicalRecord)).digest('hex');

  return {
    exportType: 'PACKSIGNAL_PACK_CANVAS_PROPOSAL_V1',
    generatedAt,
    sha256,
    disclaimer: 'PROPOSED PHYSICAL LAYOUT — Requires Prepress & Regulatory Authorization prior to plate-making.',
    specification: {
      package: 'Dancing Fish Berry Crunch Granola Folding Carton',
      dielineSource: 'ESKO CAD ArtiosCAD Cut/Crease Vector Geometry',
      physicalScale: '1:1 True-Scale Physical Millimeters (Calibrated)',
      market: state.market,
      scenario: state.scenario,
      activeFix: state.activeFix
    },
    panelMetrics: state.spaceMeters.map(m => ({
      panelId: m.panelId,
      panelName: m.panelName,
      totalAreaMm2: m.totalAreaMm2,
      safeAreaMm2: m.safeAreaMm2,
      availableAreaMm2: m.availableAreaMm2,
      consumedAreaMm2: m.consumedAreaMm2,
      freeAreaMm2: m.freeAreaMm2,
      utilizationPercent: `${m.utilizationPercent}%`,
      status: m.status,
      verticalOverflowMm: m.verticalOverflowMm
    })),
    placedBlocksSummary: state.placedBlocks.map(b => ({
      id: b.id,
      name: b.name,
      panelId: b.panelId,
      dimensionsMm: `${b.widthMm} × ${b.heightMm}`,
      fontPt: b.fontPt,
      citation: b.citation || 'N/A',
      coordinatesMm: `x: ${b.xMm}, y: ${b.yMm}`
    })),
    lockedZonesSummary: state.lockedBrandZones.map(z => ({
      id: z.id,
      name: z.name,
      type: z.type,
      panelId: z.panelId,
      lockedReason: z.lockedReason
    })),
    validationReport: {
      passed: state.validation?.valid ?? false,
      failedChecks: state.validation?.failedChecks ?? [],
      constraintCount: state.validation?.details?.length ?? 0
    }
  };
}
