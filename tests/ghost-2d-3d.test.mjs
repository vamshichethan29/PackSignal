import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapPageBoxToPanelLocal,
  checkPlacementFit,
  computeLegalRegion,
  computeSuggestedPlacement,
  calculatePanelArea
} from '../lib/placement-geometry.mjs';
import {
  classifyDeclarationState,
  resolvePanelRoles,
  generateGhostRegions
} from '../lib/ghost-regions.mjs';

test('1. Canonical 2D ghost box maps to identical 3D face UV coordinates', () => {
  // Panel on page occupies [0.1, 0.2, 0.6, 0.8] (width = 0.5, height = 0.6)
  const panelBox = [0.1, 0.2, 0.6, 0.8];
  // Target placement box inside panel occupies [0.2, 0.5, 0.4, 0.7]
  const targetBox = [0.2, 0.5, 0.4, 0.7];

  const uv = mapPageBoxToPanelLocal(targetBox, panelBox);
  assert.ok(uv, 'UV coordinates returned');
  // (0.2 - 0.1)/0.5 = 0.2
  assert.equal(uv.u0, 0.2);
  // (0.5 - 0.2)/0.6 = 0.5
  assert.equal(uv.v0, 0.5);
  // (0.4 - 0.1)/0.5 = 0.6
  assert.equal(uv.u1, 0.6);
  // (0.7 - 0.2)/0.6 = 0.833333
  assert.equal(uv.v1, 0.833333);
});

test('2. Suggested placement inside bottom 30% of PDP produces valid 2D and 3D bounds', () => {
  const panelBox = [0.0, 0.0, 1.0, 1.0];
  const legal = computeLegalRegion({
    panelBox,
    constraint: 'bottom_30_percent',
    panelGeometry: { areaSqInches: 25, isSmallPdp: false }
  });

  assert.equal(legal.normalizedBounds[0], 0.0);
  assert.equal(legal.normalizedBounds[1], 0.7); // bottom 30% begins at y = 0.7
  assert.equal(legal.normalizedBounds[2], 1.0);
  assert.equal(legal.normalizedBounds[3], 1.0);

  const suggested = computeSuggestedPlacement(legal.normalizedBounds, 'NET_QUANTITY');
  assert.ok(suggested, 'Suggested placement generated');

  const fit = checkPlacementFit({
    suggestedBox: suggested.normalizedBounds,
    legalRegion: legal.normalizedBounds
  });

  assert.equal(fit.isInsideLegal, true);
  assert.equal(fit.status, 'FIT_LIKELY');
});

test('3. Ghost overlay handles unconfirmed PDP by classifying as PANEL_UNCONFIRMED', () => {
  const finding = {
    id: 'f-net-wt',
    field: 'net_quantity',
    status: 'issue',
    evidence: []
  };

  const review = {
    findings: [finding],
    panelZones: {} // No confirmed PDP
  };

  const placementRule = {
    requiredPanelRoles: ['principal_display_panel'],
    allowedPanelRoles: ['principal_display_panel']
  };

  const panelState = {
    pdpFace: null,
    authority: 'UNKNOWN',
    zones: {}
  };

  const state = classifyDeclarationState(finding, review, placementRule, panelState);
  assert.equal(state, 'PANEL_UNCONFIRMED');
});

test('4. generateGhostRegions derives 3D face UVs and links canonical finding ID', () => {
  const review = {
    id: 'rev-ghost-01',
    market: 'us',
    options: {
      completeArtwork: true,
      panelRolesConfirmed: true,
      panelZones: {
        front: { page: 1, box: [0.1, 0.1, 0.6, 0.9] }
      }
    },
    findings: [
      {
        id: 'f-net-wt-01',
        title: 'Net Quantity Missing',
        field: 'net_quantity',
        status: 'issue',
        observed: 'Not detected in extracted content',
        expected: '16 oz (454 g)',
        evidence: []
      }
    ]
  };

  const ghosts = generateGhostRegions({ review });
  assert.equal(ghosts.length, 1);
  const g = ghosts[0];

  assert.equal(g.findingId, 'f-net-wt-01');
  assert.equal(g.declarationType, 'NET_QUANTITY');
  assert.equal(g.selectedFace, 'front');
  assert.ok(g.legalRegion);
  assert.ok(g.suggestedPlacement);
  assert.ok(g.local3dBox, 'Has 3D face UV box');
  assert.equal(g.panelAuthority, 'REVIEWER_CONFIRMED');
});

test('5. Overflow risk detected when suggested box extends beyond legal bounds', () => {
  const legalRegion = [0.1, 0.7, 0.9, 1.0];
  const overflowingBox = [0.05, 0.65, 0.95, 1.05]; // Exceeds left, top, right, bottom

  const fit = checkPlacementFit({
    suggestedBox: overflowingBox,
    legalRegion
  });

  assert.equal(fit.isInsideLegal, false);
  assert.equal(fit.status, 'OVERFLOW_RISK');
  assert.ok(fit.warnings.length > 0);
});
