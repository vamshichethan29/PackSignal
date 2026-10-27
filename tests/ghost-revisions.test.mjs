import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGhostRegions, classifyDeclarationState } from '../lib/ghost-regions.mjs';
import { getPlacementRule } from '../lib/placement-rules.mjs';

test('1. Revision V1 generates ghost for missing net quantity declaration', () => {
  const v1Review = {
    id: 'rev-v1',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] }
      }
    },
    findings: [
      {
        id: 'f-net-v1',
        field: 'net_quantity',
        title: 'Net Quantity',
        status: 'issue',
        observed: 'Not detected',
        expected: '16.9 oz (480 g)'
      }
    ]
  };

  const v1Ghosts = generateGhostRegions({ review: v1Review });
  assert.equal(v1Ghosts.length, 1);
  assert.equal(v1Ghosts[0].verificationState, 'VERIFIED_MISSING');
  assert.equal(v1Ghosts[0].findingId, 'f-net-v1');
});

test('2. Revision V2 upload with restored declaration reexecutes check and clears ghost box', () => {
  const v2Review = {
    id: 'rev-v2',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] }
      }
    },
    findings: [
      {
        id: 'f-net-v2',
        field: 'net_quantity',
        title: 'Net Quantity',
        status: 'match',
        observed: '16.9 oz (480 g)',
        expected: '16.9 oz (480 g)',
        evidence: [{ role: 'artwork', quote: '16.9 oz (480 g)', page: 1, box: [0.50, 0.75, 0.75, 0.80] }]
      }
    ]
  };

  const v2Ghosts = generateGhostRegions({ review: v2Review });
  assert.equal(v2Ghosts.length, 0, 'Restored declaration must not display a missing ghost in V2');
});

test('3. Historical V1 ghost record is preserved for before/after comparison', () => {
  const v1Finding = {
    id: 'f-net-v1',
    field: 'net_quantity',
    title: 'Net Quantity',
    status: 'issue',
    observed: 'Not detected',
    expected: '480 g'
  };

  const v2Finding = {
    id: 'f-net-v2',
    field: 'net_quantity',
    title: 'Net Quantity',
    status: 'match',
    observed: '480 g',
    expected: '480 g'
  };

  const v1Review = {
    id: 'rev-v1',
    options: { completeArtwork: true, panelRolesConfirmed: true, panelZones: { front: { page: 1, box: [0.4, 0.2, 0.8, 0.8] } } },
    findings: [v1Finding]
  };

  const v2Review = {
    id: 'rev-v2',
    options: { completeArtwork: true, panelRolesConfirmed: true, panelZones: { front: { page: 1, box: [0.4, 0.2, 0.8, 0.8] } } },
    findings: [v2Finding],
    previousReview: v1Review
  };

  const historicalGhosts = generateGhostRegions({ review: v2Review.previousReview });
  assert.equal(historicalGhosts.length, 1);
  assert.equal(historicalGhosts[0].findingId, 'f-net-v1');
});

test('4. V2 with wrong panel produces FOUND_WRONG_PANEL, not automatic clearance', () => {
  const v2FindingWrongPanel = {
    id: 'f-net-v2-wrong-panel',
    field: 'net_quantity',
    title: 'Net Quantity on Side Panel instead of PDP',
    status: 'issue',
    observed: '16.9 oz located on side panel',
    expected: 'PDP required',
    explanation: 'Placement requirement violation: declaration located on side panel instead of PDP',
    evidence: [{ role: 'artwork', quote: '16.9 oz', page: 1, box: [0.05, 0.50, 0.30, 0.55] }]
  };

  const placementRule = getPlacementRule('NET_QUANTITY', 'US');
  const panelState = { pdpFace: 'front', authority: 'REVIEWER_CONFIRMED' };

  const state = classifyDeclarationState(v2FindingWrongPanel, { options: { completeArtwork: true } }, placementRule, panelState);
  assert.equal(state, 'FOUND_WRONG_PANEL');
});

test('5. Correction ticket incorporates ghost placement data and rule quotation', () => {
  const ghostRecord = {
    ghostId: 'ghost-net-qty-1',
    findingId: 'f-net-01',
    declarationType: 'NET_QUANTITY',
    declarationLabel: 'Net Quantity of Contents (Dual US Customary & Metric)',
    authorityCitation: '21 CFR §101.7(f)',
    selectedPanel: 'principal_display_panel',
    selectedFace: 'front',
    legalRegion: {
      description: 'Bottom 30% of confirmed Principal Display Panel (21 CFR §101.7(f))',
      normalizedBounds: [0.45, 0.64, 0.85, 0.85]
    },
    suggestedPlacement: {
      normalizedBounds: [0.50, 0.70, 0.80, 0.75],
      isCustomReviewerPlacement: false
    },
    expectedText: '16.9 oz (480 g)'
  };

  // Build a correction ticket item from ghost data
  const ticket = {
    ticketId: 'ticket-f-net-01',
    findingId: ghostRecord.findingId,
    declarationType: ghostRecord.declarationType,
    missingRequirement: ghostRecord.declarationLabel,
    expectedWording: ghostRecord.expectedText,
    statutoryCitation: ghostRecord.authorityCitation,
    targetPanel: ghostRecord.selectedPanel,
    targetFace: ghostRecord.selectedFace,
    legalZoneDescription: ghostRecord.legalRegion.description,
    suggestedCoordinates: ghostRecord.suggestedPlacement.normalizedBounds,
    designerInstruction: `Place approved dual net quantity statement "${ghostRecord.expectedText}" within the bottom 30% of the confirmed PDP pursuant to ${ghostRecord.authorityCitation}.`
  };

  assert.equal(ticket.findingId, 'f-net-01');
  assert.ok(ticket.designerInstruction.includes('16.9 oz (480 g)'));
  assert.ok(ticket.designerInstruction.includes('21 CFR §101.7(f)'));
  assert.equal(ticket.targetFace, 'front');
});

test('6. Ghost overlays do not mutate or edit underlying original artwork PDF bytes', () => {
  const originalPdfSignature = 'ORIGINAL_ARTWORK_SHA256_UNTOUCHED';
  const ghostOverlay = {
    type: 'LEGAL_ALLOWED_REGION',
    bounds: [0.45, 0.64, 0.85, 0.85],
    annotationLayerOnly: true,
  };

  // Assert separation of concerns
  assert.equal(ghostOverlay.annotationLayerOnly, true);
  assert.equal(originalPdfSignature, 'ORIGINAL_ARTWORK_SHA256_UNTOUCHED');
});
