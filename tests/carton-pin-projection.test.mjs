import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectFindingToScreen,
  projectFindingPins,
  rotatePointByPose,
  panelPointToLocal3D,
  FACE_NORMALS,
} from '../public/carton-pin-projection.js';

test('5 & 6. Screen-scale badge projection provides exact screen coordinates without perspective elongation', () => {
  const result = projectFindingToScreen({
    panelPoint: { u: 0.5, v: 0.5 },
    panelId: 'front',
    cartonDims: { width: 200, height: 300, depth: 60 },
    cartonPose: { angle: 0, tilt: 0 },
    sceneBounds: { width: 500, height: 400 },
    perspective: 900,
  });

  // At angle 0, tilt 0:
  // Center of front face is at originX = 250, originY = 180 (45% of 400)
  assert.equal(result.visible, true);
  assert.equal(result.screenX, 250);
  assert.equal(result.screenY, 180);
  assert.equal(result.depth, 30); // half depth = 30
});

test('17. Back-facing pins are hidden and not displayed through the carton', () => {
  // When carton is facing front (angle = 0, tilt = 0):
  // Back face normal points to -Z, normalZ is -1.0 <= 0.05
  const backPin = projectFindingToScreen({
    panelPoint: { u: 0.5, v: 0.5 },
    panelId: 'back',
    cartonDims: { width: 200, height: 300, depth: 60 },
    cartonPose: { angle: 0, tilt: 0 },
  });

  assert.equal(backPin.visible, false, 'Back face pins must be hidden when facing front');
  assert.ok(backPin.normalZ < 0);

  // When carton rotates 180 degrees:
  // Back face normal now points to +Z, normalZ is +1.0 > 0.05
  const backPinRotated = projectFindingToScreen({
    panelPoint: { u: 0.5, v: 0.5 },
    panelId: 'back',
    cartonDims: { width: 200, height: 300, depth: 60 },
    cartonPose: { angle: 180, tilt: 0 },
  });

  assert.equal(backPinRotated.visible, true, 'Back face pins must be visible when carton is turned 180°');
  assert.ok(backPinRotated.normalZ > 0);

  // And front face becomes hidden when rotated 180 degrees
  const frontPinRotated = projectFindingToScreen({
    panelPoint: { u: 0.5, v: 0.5 },
    panelId: 'front',
    cartonDims: { width: 200, height: 300, depth: 60 },
    cartonPose: { angle: 180, tilt: 0 },
  });
  assert.equal(frontPinRotated.visible, false, 'Front face pins must be hidden when turned 180°');
});

test('22. Top and bottom supported faces use correct normals and tilt thresholds', () => {
  // When rotated around X (tilt = 78°): Bottom face normal (0, 1, 0) rotates into +Z
  const bottomTilted = projectFindingToScreen({
    panelPoint: { u: 0.5, v: 0.5 },
    panelId: 'bottom',
    cartonDims: { width: 200, height: 300, depth: 60 },
    cartonPose: { angle: 0, tilt: 78 },
  });
  assert.equal(bottomTilted.visible, true, 'Bottom face must be visible when carton is tilted upward');

  // When rotated around X (tilt = -78°): Top face normal (0, -1, 0) rotates into +Z
  const topTilted = projectFindingToScreen({
    panelPoint: { u: 0.5, v: 0.5 },
    panelId: 'top',
    cartonDims: { width: 200, height: 300, depth: 60 },
    cartonPose: { angle: 0, tilt: -78 },
  });
  assert.equal(topTilted.visible, true, 'Top face must be visible when carton is tilted downward');
});

test('31. Viewport resize recomputes badge positions proportionally', () => {
  const pin = {
    normalizedPanelPoint: { u: 0.5, v: 0.5 },
    panelId: 'front',
  };

  const pose = { angle: 0, tilt: 0 };
  const dims = { width: 200, height: 300, depth: 60 };

  // Viewport A: 500 x 400
  const projA = projectFindingPins([pin], {
    cartonDims: dims,
    cartonPose: pose,
    sceneBounds: { width: 500, height: 400 },
  });

  // Viewport B: 800 x 600
  const projB = projectFindingPins([pin], {
    cartonDims: dims,
    cartonPose: pose,
    sceneBounds: { width: 800, height: 600 },
  });

  assert.equal(projA[0].screenX, 250);
  assert.equal(projA[0].screenY, 180);

  assert.equal(projB[0].screenX, 400);
  assert.equal(projB[0].screenY, 270);
});
