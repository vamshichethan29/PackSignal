import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDeclarationState,
  resolvePanelRoles,
  generateGhostRegions,
} from '../lib/ghost-regions.mjs';
import {
  calculatePanelArea,
  computeLegalRegion,
  computeSuggestedPlacement,
  checkPlacementFit,
  mapPageBoxToPanelLocal,
} from '../lib/placement-geometry.mjs';

test('1. Correct legal region generated from rule data for Net Quantity', () => {
  const panelBox = [0.40, 0.20, 0.80, 0.80]; // PDP width 0.40, height 0.60
  const legal = computeLegalRegion({
    panelBox,
    constraint: 'bottom_30_percent',
    panelGeometry: { areaSqInches: 25, isSmallPdp: false },
  });

  assert.ok(legal);
  assert.equal(legal.constraint, 'bottom_30_percent');
  // Bottom 30% of height 0.60 is 0.18. Top offset: 0.80 - 0.18 = 0.62
  assert.equal(legal.normalizedBounds[1], 0.62);
  assert.equal(legal.normalizedBounds[3], 0.80);
  assert.match(legal.description, /21 CFR §101.7/i);
});

test('2. Bottom-30% calculation uses actual PDP bounds, not full PDF page', () => {
  const arbitraryPanel = [0.10, 0.50, 0.50, 0.90]; // Height 0.40
  const legal = computeLegalRegion({
    panelBox: arbitraryPanel,
    constraint: 'bottom_30_percent',
    panelGeometry: { areaSqInches: 15, isSmallPdp: false },
  });

  // Bottom 30% of height 0.40 is 0.12. Top bound: 0.90 - 0.12 = 0.78
  assert.equal(legal.normalizedBounds[0], 0.10);
  assert.equal(legal.normalizedBounds[1], 0.78);
  assert.equal(legal.normalizedBounds[2], 0.50);
  assert.equal(legal.normalizedBounds[3], 0.90);
});

test('3. Small-PDP exception handled when area <= 5.0 sq in', () => {
  const smallPanel = [0.10, 0.10, 0.30, 0.30];
  const exceptions = [
    {
      id: 'SMALL_PDP_EXCEPTION',
      citation: '21 CFR §101.7(f)',
      condition: (geom) => geom.areaSqInches <= 5.0,
      alternateConstraint: 'anywhere_on_panel',
    }
  ];

  const legal = computeLegalRegion({
    panelBox: smallPanel,
    constraint: 'bottom_30_percent',
    panelGeometry: { areaSqInches: 4.2, isSmallPdp: true },
    exceptions,
  });

  assert.equal(legal.exceptionApplied, 'SMALL_PDP_EXCEPTION');
  assert.deepEqual(legal.normalizedBounds, smallPanel);
});

test('4. Manufacturer details are not PDP-only by default', () => {
  const review = {
    id: 'rev-address-test',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
        back: { page: 1, box: [0.05, 0.15, 0.40, 0.85] },
      }
    },
    findings: [
      {
        id: 'f-mfr-address',
        field: 'business_details',
        title: 'Missing Manufacturer Address',
        status: 'issue',
        observed: 'Not detected in extracted content',
        expected: 'Dancing Fish Foods Inc.',
      }
    ]
  };

  const ghosts = generateGhostRegions({ review });
  assert.equal(ghosts.length, 1);
  const addressGhost = ghosts[0];
  assert.ok(addressGhost.applicablePanels.includes('information_panel'));
  assert.ok(addressGhost.applicablePanels.includes('principal_display_panel'));
  assert.equal(addressGhost.selectedPanel, 'information_panel');
});

test('5. Multiple allowed panels supported with candidates', () => {
  const review = {
    id: 'rev-multi-panel',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] },
        back: { page: 1, box: [0.05, 0.15, 0.40, 0.85] },
      }
    },
    findings: [
      {
        id: 'f-mfr',
        field: 'manufacturer',
        title: 'Manufacturer information',
        status: 'issue',
        observed: 'Not detected',
        expected: 'Portland, OR',
      }
    ]
  };

  const ghosts = generateGhostRegions({ review });
  assert.equal(ghosts.length, 1);
  assert.ok(ghosts[0].candidateRegions.length >= 2, 'Should provide both PDP and info panel candidate regions');
});

test('6. Unsupported rule handled without claiming definitive missing declaration', () => {
  const finding = {
    id: 'f-unsupported',
    rule: { supported: false },
    method: 'review_input_gap',
    status: 'unable',
    title: 'Custom uncompiled rule',
  };

  const state = classifyDeclarationState(finding, {}, null, {});
  assert.equal(state, 'RULE_UNSUPPORTED');
});

test('7. Unconfirmed PDP handled with PANEL_UNCONFIRMED', () => {
  const finding = {
    id: 'f-net-qty',
    field: 'net_quantity',
    title: 'Net Quantity',
    status: 'issue',
    observed: 'Not detected',
    expected: '480 g',
  };

  const placementRule = { requiredPanelRoles: ['principal_display_panel'] };
  const panelState = { pdpFace: null, authority: 'UNKNOWN' };

  const state = classifyDeclarationState(finding, {}, placementRule, panelState);
  assert.equal(state, 'PANEL_UNCONFIRMED');
});

test('8. Missing artwork coverage produces POSSIBLY_MISSING, preventing false certainty', () => {
  const finding = {
    id: 'f-partial-ocr',
    field: 'net_quantity',
    title: 'Net Quantity Check',
    status: 'unable',
    observed: 'Not detected in blurry image',
    expected: '500 g',
  };

  const review = { options: { completeArtwork: false } };
  const placementRule = { requiredPanelRoles: ['principal_display_panel'] };
  const panelState = { pdpFace: 'front', authority: 'REVIEWER_CONFIRMED' };

  const state = classifyDeclarationState(finding, review, placementRule, panelState);
  assert.equal(state, 'POSSIBLY_MISSING');
});

test('9. Correct declaration prevents ghost generation (FOUND_IN_ALLOWED_PANEL)', () => {
  const review = {
    id: 'rev-matched',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
    },
    findings: [
      {
        id: 'f-net-match',
        field: 'net_quantity',
        title: 'Net Quantity of Contents',
        status: 'match',
        observed: '16.9 oz (480 g)',
        expected: '16.9 oz (480 g)',
        evidence: [{ role: 'artwork', quote: '16.9 oz (480 g)', page: 1, box: [0.50, 0.72, 0.75, 0.77] }]
      }
    ]
  };

  const ghosts = generateGhostRegions({ review });
  assert.equal(ghosts.length, 0, 'Matched finding must not generate a missing-declaration ghost');
});

test('10. Wrong-panel declaration produces FOUND_WRONG_PANEL', () => {
  const finding = {
    id: 'f-wrong-panel',
    field: 'net_quantity',
    title: 'Net Quantity found on Side Panel instead of PDP',
    status: 'issue',
    observed: '480 g located on side panel',
    expected: 'PDP required',
    explanation: 'Placement requirement violation: statement located on side panel',
    evidence: [{ role: 'artwork', quote: '480 g', page: 1, box: [0.05, 0.50, 0.30, 0.55] }]
  };

  const review = { options: { completeArtwork: true } };
  const placementRule = { requiredPanelRoles: ['principal_display_panel'] };
  const panelState = { pdpFace: 'front', authority: 'REVIEWER_CONFIRMED' };

  const state = classifyDeclarationState(finding, review, placementRule, panelState);
  assert.equal(state, 'FOUND_WRONG_PANEL');
});

test('11. Normalized coordinates remain valid [0, 1] without fabricated values', () => {
  const review = {
    id: 'rev-norm-coords',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: { front: { page: 1, box: [0.20, 0.10, 0.80, 0.90] } }
    },
    findings: [
      {
        id: 'f-norm-net',
        field: 'net_quantity',
        title: 'Net Quantity',
        status: 'issue',
        observed: 'Not detected',
        expected: '480 g'
      }
    ]
  };

  const [ghost] = generateGhostRegions({ review });
  assert.ok(ghost);
  const [lx0, ly0, lx1, ly1] = ghost.legalRegion.normalizedBounds;
  assert.ok(lx0 >= 0 && lx0 <= 1);
  assert.ok(ly0 >= 0 && ly0 <= 1);
  assert.ok(lx1 >= 0 && lx1 <= 1);
  assert.ok(ly1 >= 0 && ly1 <= 1);
  assert.ok(lx1 > lx0);
  assert.ok(ly1 > ly0);
});

test('12. Suggested placement remains inside permitted legal region', () => {
  const legal = [0.20, 0.60, 0.80, 0.90];
  const suggested = computeSuggestedPlacement(legal, 'NET_QUANTITY');
  const fit = checkPlacementFit({ suggestedBox: suggested.normalizedBounds, legalRegion: legal });

  assert.equal(fit.status, 'FIT_LIKELY');
  assert.equal(fit.isInsideLegal, true);
});

test('13. Legal region is immutable and does not change when custom placement is adjusted', () => {
  const review = {
    id: 'rev-custom-drag',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
    },
    findings: [
      {
        id: 'f-drag-test',
        field: 'net_quantity',
        title: 'Net Quantity',
        status: 'issue',
        observed: 'Not detected',
        expected: '480 g'
      }
    ]
  };

  const defaultGhost = generateGhostRegions({ review })[0];
  const customBox = [0.50, 0.70, 0.80, 0.75];
  const customGhost = generateGhostRegions({
    review,
    customPlacements: { [defaultGhost.ghostId]: customBox }
  })[0];

  assert.deepEqual(defaultGhost.legalRegion.normalizedBounds, customGhost.legalRegion.normalizedBounds, 'Legal region must remain unchanged');
  assert.deepEqual(customGhost.suggestedPlacement.normalizedBounds, customBox, 'Suggested proposal adopts user adjustment');
  assert.equal(customGhost.suggestedPlacement.isCustomReviewerPlacement, true);
});

test('14. Ghost link explicitly references actual finding and check ID', () => {
  const review = {
    id: 'rev-link-check',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: { front: { page: 1, box: [0.45, 0.15, 0.85, 0.85] } }
    },
    findings: [
      {
        id: 'FINDING-NET-1234',
        rule: { id: 'RULE-NET-US' },
        field: 'net_quantity',
        title: 'Net Quantity Missing',
        status: 'issue',
        observed: 'Not detected',
        expected: '480 g'
      }
    ]
  };

  const [ghost] = generateGhostRegions({ review });
  assert.equal(ghost.findingId, 'FINDING-NET-1234');
  assert.equal(ghost.checkId, 'RULE-NET-US');
});
