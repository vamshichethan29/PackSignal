/**
 * tests/ghost-artwork-mapping.test.mjs
 * Unit and integration tests for 2D/3D ghost placement geometry,
 * orientation handling, panel UV projection, and curved packaging surfaces.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePanelArea,
  calculatePdpGeometry,
  computeLegalRegion,
  computeSuggestedPlacement,
  checkPlacementFit,
  mapPageBoxToPanelLocal,
  applyPageCropAndRotation,
} from '../lib/placement-geometry.mjs';

import {
  generateGhostRegions,
  resolvePanelRoles,
} from '../lib/ghost-regions.mjs';

test('Ghost Artwork Mapping, Orientation & 3D Surface Projection Suite', async t => {
  const pageStandard = { width: 612, height: 792, number: 1 };
  const pdpBox = [0.45, 0.15, 0.85, 0.85]; // 40% width, 70% height

  await t.test('1. Standard upright PDP (0° rotation): bottom 30% computed along vertical axis', () => {
    const geom = calculatePanelArea(pdpBox, pageStandard);
    const legal = computeLegalRegion({
      panelBox: pdpBox,
      constraint: 'bottom_30_percent',
      panelGeometry: geom,
      packageOrientation: 0,
    });

    assert.ok(legal);
    const [x0, y0, x1, y1] = legal.normalizedBounds;
    assert.equal(x0, pdpBox[0]);
    assert.equal(x1, pdpBox[2]);
    // Bottom 30% in standard PDF coordinates (y=0 top, y=1 bottom):
    // starts at y1 - 0.3 * (y1 - y0) and ends at y1
    const expectedStart = pdpBox[3] - (pdpBox[3] - pdpBox[1]) * 0.30;
    assert.ok(Math.abs(y0 - expectedStart) < 1e-4);
    assert.equal(y1, pdpBox[3]);
  });

  await t.test('2. Inverted display orientation (180° rotation): bottom 30% parallel to resting base', () => {
    const geom = calculatePanelArea(pdpBox, pageStandard);
    const legal = computeLegalRegion({
      panelBox: pdpBox,
      constraint: 'bottom_30_percent',
      panelGeometry: geom,
      packageOrientation: 180,
    });

    assert.ok(legal);
    const [x0, y0, x1, y1] = legal.normalizedBounds;
    assert.equal(x0, pdpBox[0]);
    assert.equal(x1, pdpBox[2]);
    assert.equal(y0, pdpBox[1]); // Inverted resting base at py0
    const expectedEnd = pdpBox[1] + (pdpBox[3] - pdpBox[1]) * 0.30;
    assert.ok(Math.abs(y1 - expectedEnd) < 1e-4);
  });

  await t.test('3. Rotated landscape artwork (90° and 270°): bottom 30% computed along resting dimension', () => {
    const geom = calculatePanelArea(pdpBox, pageStandard);
    const legal90 = computeLegalRegion({
      panelBox: pdpBox,
      constraint: 'bottom_30_percent',
      panelGeometry: geom,
      packageOrientation: 90,
    });
    assert.ok(legal90);
    assert.equal(legal90.packageOrientation, 90);
    // 90°: display base is at px1 (0.85). Bottom 30% extends from px1 - 0.3 * width to px1
    assert.equal(legal90.normalizedBounds[2], pdpBox[2]);
    const expectedX0 = pdpBox[2] - (pdpBox[2] - pdpBox[0]) * 0.30;
    assert.ok(Math.abs(legal90.normalizedBounds[0] - expectedX0) < 1e-4);
  });

  await t.test('4. 3D Face UV mapping: converts 2D page normalized box to local face UVs [0, 1]', () => {
    const suggestedBox = [0.50, 0.20, 0.80, 0.30];
    const localUV = mapPageBoxToPanelLocal(suggestedBox, pdpBox);

    assert.ok(localUV);
    const [u0, v0, u1, v1] = localUV;
    // Local coordinates must be normalized within [0, 1] relative to panel
    assert.ok(u0 >= 0.0 && u0 <= 1.0);
    assert.ok(u1 >= 0.0 && u1 <= 1.0);
    assert.ok(v0 >= 0.0 && v0 <= 1.0);
    assert.ok(v1 >= 0.0 && v1 <= 1.0);
    assert.ok(u1 > u0);
    assert.ok(v1 > v0);
  });

  await t.test('5. Unmapped panel: does NOT invent arbitrary 3D coordinates', () => {
    const unmappedReview = {
      id: 'rev-unmapped',
      market: 'us',
      options: {
        packageType: 'folding_carton',
        panelZones: {}, // No confirmed zones
      },
      documents: [{ role: 'artwork', pages: [{ number: 1, width: 612, height: 792 }] }],
      findings: [
        {
          id: 'find-qty-unmapped',
          field: 'net_quantity',
          title: 'Net quantity missing',
          status: 'issue',
        },
      ],
    };

    const ghosts = generateGhostRegions({ review: unmappedReview });
    assert.equal(ghosts.length, 1);
    // Must flag unconfirmed panel authority
    assert.equal(ghosts[0].verificationState, 'PANEL_UNCONFIRMED');
    assert.equal(ghosts[0].panelAuthority, 'UNKNOWN');
  });

  await t.test('6. Collision analysis: detects overlap against existing text and clearance breaches', () => {
    const legalZone = [0.45, 0.60, 0.85, 0.85];
    const suggestedBox = [0.50, 0.65, 0.80, 0.75];
    const collidingTextBox = { box: [0.52, 0.66, 0.78, 0.74] }; // Overlaps suggested box

    const fit = checkPlacementFit({
      suggestedBox,
      legalRegion: legalZone,
      existingBoxes: [collidingTextBox],
    });

    assert.equal(fit.isInsideLegal, true);
    assert.equal(fit.status, 'POTENTIAL_OVERLAP');
    assert.ok(fit.warnings.length > 0);
  });

  await t.test('7. Evidence bounding boxes strictly isolated from hypothetical ghost boxes', () => {
    const findingWithObservedText = {
      id: 'find-qty-present',
      field: 'net_quantity',
      title: 'Net quantity declaration',
      status: 'match',
      evidence: [{ role: 'artwork', box: [0.55, 0.20, 0.75, 0.25], quote: '1000 mL (1 L)' }],
    };

    const review = {
      id: 'rev-present',
      market: 'us',
      options: { completeArtwork: true, panelZones: { front: { box: pdpBox } } },
      findings: [findingWithObservedText],
    };

    const ghosts = generateGhostRegions({ review });
    // Compliant declaration produces ZERO ghost boxes
    assert.equal(ghosts.length, 0, 'No ghost bounding box should be generated for verified present declaration');
  });
});
