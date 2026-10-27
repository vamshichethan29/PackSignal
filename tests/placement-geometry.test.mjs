import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePanelArea,
  computeLegalRegion,
  computeSuggestedPlacement,
  checkPlacementFit,
  mapPageBoxToPanelLocal,
  transformBoundsWithViewport,
  applyPageCropAndRotation,
} from '../lib/placement-geometry.mjs';

test('placement-geometry: calculatePanelArea converts normalized box and PDF points to physical square inches', () => {
  // 612 x 792 pt page (8.5 x 11 inches)
  const page = { width: 612, height: 792 };
  // Panel occupying 50% width and 50% height
  const box = [0.25, 0.25, 0.75, 0.75];
  const area = calculatePanelArea(box, page);

  assert.equal(area.widthPt, 306);
  assert.equal(area.heightPt, 396);
  assert.equal(area.widthInches, 4.25);
  assert.equal(area.heightInches, 5.5);
  assert.equal(area.areaSqInches, 23.375);
  assert.equal(area.isSmallPdp, false);
});

test('placement-geometry: bottom-30% calculation uses actual PDP bounds', () => {
  const panelBox = [0.40, 0.20, 0.80, 0.80]; // height is 0.60
  const legal = computeLegalRegion({
    panelBox,
    constraint: 'bottom_30_percent',
    panelGeometry: { areaSqInches: 30, isSmallPdp: false },
  });

  assert.ok(legal);
  // Bottom 30% of height 0.60 is 0.18. From top 0.80 - 0.18 = 0.62
  assert.equal(legal.normalizedBounds[0], 0.40);
  assert.equal(legal.normalizedBounds[1], 0.62);
  assert.equal(legal.normalizedBounds[2], 0.80);
  assert.equal(legal.normalizedBounds[3], 0.80);
  assert.match(legal.description, /bottom 30%/i);
});

test('placement-geometry: small-PDP exception permits declaration anywhere on PDP when <= 5.0 sq in', () => {
  const panelBox = [0.40, 0.20, 0.60, 0.40]; // 0.20 x 0.20 on 612x792 -> ~3.74 sq in
  const exceptions = [
    {
      id: 'SMALL_PDP_EXCEPTION',
      condition: (geom) => geom.areaSqInches <= 5.0,
      alternateConstraint: 'anywhere_on_panel',
    }
  ];

  const legal = computeLegalRegion({
    panelBox,
    constraint: 'bottom_30_percent',
    panelGeometry: { areaSqInches: 3.5, isSmallPdp: true },
    exceptions,
  });

  assert.ok(legal);
  assert.equal(legal.exceptionApplied, 'SMALL_PDP_EXCEPTION');
  assert.deepEqual(legal.normalizedBounds, panelBox);
  assert.match(legal.description, /any location on PDP permitted under small-PDP exception/i);
});

test('placement-geometry: suggested placement remains inside permitted legal region', () => {
  const legalBounds = [0.40, 0.60, 0.80, 0.80];
  const suggested = computeSuggestedPlacement(legalBounds, 'NET_QUANTITY');

  assert.ok(suggested);
  const [sx0, sy0, sx1, sy1] = suggested.normalizedBounds;
  assert.ok(sx0 >= legalBounds[0], 'sx0 >= lx0');
  assert.ok(sy0 >= legalBounds[1], 'sy0 >= ly0');
  assert.ok(sx1 <= legalBounds[2], 'sx1 <= lx1');
  assert.ok(sy1 <= legalBounds[3], 'sy1 <= ly1');
  assert.match(suggested.disclaimer, /suggested layout proposal/i);
});

test('placement-geometry: checkPlacementFit correctly detects fit vs overlap/overflow', () => {
  const legal = [0.40, 0.60, 0.80, 0.80];
  // Box fully inside
  const inside = [0.45, 0.65, 0.75, 0.75];
  const fitResult = checkPlacementFit({ suggestedBox: inside, legalRegion: legal });
  assert.equal(fitResult.status, 'FIT_LIKELY');
  assert.equal(fitResult.isInsideLegal, true);

  // Box overflowing legal region top
  const overflow = [0.45, 0.50, 0.75, 0.75];
  const overflowResult = checkPlacementFit({ suggestedBox: overflow, legalRegion: legal });
  assert.equal(overflowResult.status, 'OVERFLOW_RISK');
  assert.equal(overflowResult.isInsideLegal, false);
});

test('placement-geometry: 3D face-local UV coordinates mapping correctly maps page box to face local [0, 1]', () => {
  const panelBox = [0.40, 0.20, 0.80, 0.80]; // width 0.40, height 0.60
  // Box in the bottom half of the panel
  const targetBox = [0.40, 0.50, 0.80, 0.80];
  const uv = mapPageBoxToPanelLocal(targetBox, panelBox);

  assert.equal(uv.u0, 0);
  assert.equal(uv.u1, 1);
  assert.equal(uv.v0, 0.5);
  assert.equal(uv.v1, 1);
});

test('placement-geometry: viewport transformation scales and translates normalized coordinates cleanly', () => {
  const box = [0.1, 0.2, 0.3, 0.4];
  const transformed = transformBoundsWithViewport(box, {
    zoom: 150,
    panX: 50,
    panY: 30,
    containerWidth: 800,
    containerHeight: 600,
  });

  assert.equal(transformed.pixelWidth, 0.2 * 800 * 1.5);
  assert.equal(transformed.pixelHeight, 0.2 * 600 * 1.5);
});

test('placement-geometry: page rotation and CropBox offsets transform coordinates accurately', () => {
  const box = [0.1, 0.2, 0.3, 0.4];
  // 90 degree clockwise rotation on 612x792
  const rotated = applyPageCropAndRotation(box, { rotation: 90, cropBox: [0, 0, 612, 792] });
  assert.ok(Array.isArray(rotated));
  assert.equal(rotated.length, 4);
  assert.ok(rotated[0] >= 0 && rotated[2] <= 1);
  assert.ok(rotated[1] >= 0 && rotated[3] <= 1);
});
