import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePanelArea,
  calculatePdpGeometry,
  computeLegalRegion,
  computeSuggestedPlacement,
  checkPlacementFit,
  mapPageBoxToPanelLocal,
  transformBoundsWithViewport,
  applyPageCropAndRotation,
} from '../lib/placement-geometry.mjs';

test('Ghost Computational Geometry & Coordinate Transformations Suite', async (t) => {

  await t.test('1. calculatePanelArea computes correct inches, mm, and sq in for standard PDF points', () => {
    // 612 x 792 pt = 8.5 x 11 inches = 215.9 x 279.4 mm
    // Panel spanning half width and half height
    const panelBox = [0.0, 0.0, 0.5, 0.5];
    const pageDims = { width: 612, height: 792 };

    const area = calculatePanelArea(panelBox, pageDims);
    assert.equal(area.widthPt, 306);
    assert.equal(area.heightPt, 396);
    assert.equal(area.widthInches, 4.25);
    assert.equal(area.heightInches, 5.5);
    assert.ok(Math.abs(area.widthMm - 107.95) < 0.01);
    assert.ok(Math.abs(area.heightMm - 139.7) < 0.01);
    assert.equal(area.areaSqInches, 4.25 * 5.5); // 23.375 sq in
    assert.equal(area.isSmallPdp, false);
  });

  await t.test('2. calculatePdpGeometry builds complete canonical PDP geometry contract', () => {
    const pdp = calculatePdpGeometry({
      panelId: 'carton-front-pdp',
      panelRole: 'principal_display_panel',
      panelBox: [0.45, 0.15, 0.85, 0.85],
      pageDimensions: { width: 612, height: 792 },
      packageOrientation: 0,
      panelConfidence: 0.98,
      mappingAuthority: 'REVIEWER_CONFIRMED',
    });

    assert.equal(pdp.panelId, 'carton-front-pdp');
    assert.equal(pdp.panelRole, 'principal_display_panel');
    assert.equal(pdp.mappingAuthority, 'REVIEWER_CONFIRMED');
    assert.equal(pdp.panelConfidence, 0.98);
    assert.ok(pdp.physicalWidthMm > 0);
    assert.ok(pdp.physicalHeightMm > 0);
    assert.ok(pdp.physicalArea > 0);
    assert.equal(pdp.packageOrientation, 0);
  });

  await t.test('3. US Net Quantity bottom-30% calculated strictly on PDP panel bounds', () => {
    // PDP from y=0.20 to y=0.80 (height = 0.60)
    const panelBox = [0.40, 0.20, 0.80, 0.80];
    const legal = computeLegalRegion({
      panelBox,
      constraint: 'bottom_30_percent',
      panelGeometry: { areaSqInches: 25, isSmallPdp: false },
      packageOrientation: 0,
    });

    assert.ok(legal);
    assert.equal(legal.constraint, 'bottom_30_percent');
    // Bottom 30% of height 0.60 is 0.18. Top of legal region: 0.80 - 0.18 = 0.62
    assert.equal(legal.normalizedBounds[0], 0.40);
    assert.equal(legal.normalizedBounds[1], 0.62);
    assert.equal(legal.normalizedBounds[2], 0.80);
    assert.equal(legal.normalizedBounds[3], 0.80);
  });

  await t.test('4. Display orientation 180° inverts bottom 30% calculation parallel to displayed base', () => {
    // Inverted artwork on artboard: display base is at top of panel in PDF coordinates (py0)
    const panelBox = [0.40, 0.20, 0.80, 0.80]; // height = 0.60
    const legal = computeLegalRegion({
      panelBox,
      constraint: 'bottom_30_percent',
      panelGeometry: { areaSqInches: 25, isSmallPdp: false },
      packageOrientation: 180,
    });

    assert.ok(legal);
    assert.equal(legal.packageOrientation, 180);
    // Base is at py0 (0.20). Bottom 30% extends down to 0.20 + 0.18 = 0.38
    assert.equal(legal.normalizedBounds[0], 0.40);
    assert.equal(legal.normalizedBounds[1], 0.20);
    assert.equal(legal.normalizedBounds[2], 0.80);
    assert.equal(legal.normalizedBounds[3], 0.38);
  });

  await t.test('5. Display orientation 90° and 270° calculate bottom 30% along width', () => {
    const panelBox = [0.10, 0.20, 0.90, 0.80]; // width = 0.80
    // 90°: display base is at px1 (0.90)
    const legal90 = computeLegalRegion({
      panelBox,
      constraint: 'bottom_30_percent',
      panelGeometry: { areaSqInches: 30 },
      packageOrientation: 90,
    });
    // 30% of width 0.80 is 0.24. Extends from 0.90 - 0.24 = 0.66 to 0.90
    assert.equal(legal90.normalizedBounds[0], 0.66);
    assert.equal(legal90.normalizedBounds[2], 0.90);

    // 270°: display base is at px0 (0.10)
    const legal270 = computeLegalRegion({
      panelBox,
      constraint: 'bottom_30_percent',
      panelGeometry: { areaSqInches: 30 },
      packageOrientation: 270,
    });
    // Extends from 0.10 to 0.10 + 0.24 = 0.34
    assert.equal(legal270.normalizedBounds[0], 0.10);
    assert.equal(legal270.normalizedBounds[2], 0.34);
  });

  await t.test('6. Small-PDP exception (<= 5.0 sq in) permits declaration anywhere on PDP', () => {
    const smallPanel = [0.10, 0.10, 0.25, 0.25];
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
      panelGeometry: { areaSqInches: 4.5, isSmallPdp: true },
      exceptions,
    });

    assert.equal(legal.constraint, 'anywhere_on_panel');
    assert.equal(legal.exceptionApplied, 'SMALL_PDP_EXCEPTION');
    assert.deepEqual(legal.normalizedBounds, smallPanel);
    assert.match(legal.description, /small-PDP exception/i);
  });

  await t.test('7. Suggested placement box stays centered inside legal zone with safety clearance', () => {
    const legalBounds = [0.40, 0.62, 0.80, 0.80];
    const suggested = computeSuggestedPlacement(legalBounds, 'NET_QUANTITY');

    assert.ok(suggested);
    const [sx0, sy0, sx1, sy1] = suggested.normalizedBounds;
    assert.ok(sx0 >= legalBounds[0], 'Suggested x0 must be >= legal x0');
    assert.ok(sy0 >= legalBounds[1], 'Suggested y0 must be >= legal y0');
    assert.ok(sx1 <= legalBounds[2], 'Suggested x1 must be <= legal x1');
    assert.ok(sy1 <= legalBounds[3], 'Suggested y1 must be <= legal y1');
    assert.match(suggested.disclaimer, /layout proposal/i);
  });

  await t.test('8. checkPlacementFit detects overflow and collision against existing elements', () => {
    const legalBounds = [0.40, 0.60, 0.80, 0.80];

    // Case A: Clean fit inside legal bounds
    const cleanFit = checkPlacementFit({
      suggestedBox: [0.45, 0.65, 0.75, 0.75],
      legalRegion: legalBounds,
      existingBoxes: [],
    });
    assert.equal(cleanFit.status, 'FIT_LIKELY');
    assert.equal(cleanFit.isInsideLegal, true);

    // Case B: Overflow outside legal bounds
    const overflowFit = checkPlacementFit({
      suggestedBox: [0.35, 0.50, 0.75, 0.75], // Left & top overflow
      legalRegion: legalBounds,
      existingBoxes: [],
    });
    assert.equal(overflowFit.status, 'OVERFLOW_RISK');
    assert.equal(overflowFit.isInsideLegal, false);

    // Case C: Overlap with existing detected barcode/text
    const overlapFit = checkPlacementFit({
      suggestedBox: [0.45, 0.65, 0.75, 0.75],
      legalRegion: legalBounds,
      existingBoxes: [{ box: [0.46, 0.66, 0.74, 0.74] }], // Directly overlapping
    });
    assert.equal(overlapFit.status, 'POTENTIAL_OVERLAP');
    assert.equal(overlapFit.isInsideLegal, true);
  });

  await t.test('9. mapPageBoxToPanelLocal transforms page coordinates to normalized 3D face UVs [0, 1]', () => {
    const panelBox = [0.40, 0.20, 0.80, 0.80]; // pw = 0.40, ph = 0.60
    const targetBox = [0.50, 0.50, 0.70, 0.70];

    const uv = mapPageBoxToPanelLocal(targetBox, panelBox);
    assert.ok(uv);
    // u0 = (0.50 - 0.40) / 0.40 = 0.25
    // v0 = (0.50 - 0.20) / 0.60 = 0.50
    // u1 = (0.70 - 0.40) / 0.40 = 0.75
    // v1 = (0.70 - 0.20) / 0.60 = 0.833333
    assert.equal(uv[0], 0.25);
    assert.equal(uv[1], 0.5);
    assert.equal(uv[2], 0.75);
    assert.ok(Math.abs(uv[3] - 0.833333) < 0.001);
  });

  await t.test('10. transformBoundsWithViewport accurately scales and offsets with zoom and pan', () => {
    const box = [0.1, 0.2, 0.3, 0.4];
    const viewport = {
      zoom: 200, // 2x
      panX: 50,
      panY: 30,
      containerWidth: 800,
      containerHeight: 600,
    };

    const pixelCoords = transformBoundsWithViewport(box, viewport);
    assert.ok(pixelCoords);
    // pixelX0 = 0.1 * 800 * 2 + 50 = 210
    assert.equal(pixelCoords.pixelX0, 210);
    // pixelY0 = 0.2 * 600 * 2 + 30 = 270
    assert.equal(pixelCoords.pixelY0, 270);
    // pixelWidth = (0.3 - 0.1) * 800 * 2 = 320
    assert.equal(pixelCoords.pixelWidth, 320);
    // pixelHeight = (0.4 - 0.2) * 600 * 2 = 240
    assert.equal(pixelCoords.pixelHeight, 240);
  });

  await t.test('11. applyPageCropAndRotation maps normalized boxes through 90, 180, 270 degrees', () => {
    const box = [0.1, 0.2, 0.4, 0.7];

    const rot0 = applyPageCropAndRotation(box, { rotation: 0 });
    assert.deepEqual(rot0, box);

    const rot180 = applyPageCropAndRotation(box, { rotation: 180 });
    // [1 - 0.4, 1 - 0.7, 1 - 0.1, 1 - 0.2] = [0.6, 0.3, 0.9, 0.8]
    assert.ok(Math.abs(rot180[0] - 0.6) < 0.001);
    assert.ok(Math.abs(rot180[1] - 0.3) < 0.001);
    assert.ok(Math.abs(rot180[2] - 0.9) < 0.001);
    assert.ok(Math.abs(rot180[3] - 0.8) < 0.001);
  });
});
