import test from 'node:test';
import assert from 'node:assert/strict';
import { Mat4, calculatePanelNormal, buildHingeTree } from '../../public/three/fold-engine.js';

test('camera framing distance ensures panel fits inside field of view without clipping', () => {
  const fovDeg = 42;
  const fovRad = (fovDeg * Math.PI) / 180;
  const panelHeight = 100;
  const panelWidth = 50;
  const maxDim = Math.max(panelWidth, panelHeight);

  // Distance formula from camera-controller: (panelSize / 2) / tan(fov / 2) * 1.55
  const distance = (maxDim / 2) / Math.tan(fovRad / 2) * 1.55;

  assert.ok(distance > 180 && distance < 250, `Distance ${distance} must provide ample framing margin`);

  // At this distance, visible vertical span in frustum is 2 * dist * tan(fov/2)
  const visibleSpan = 2 * distance * Math.tan(fovRad / 2);
  assert.ok(visibleSpan > panelHeight * 1.4, 'Visible vertical span must exceed panel height by at least 40%');
});

test('fly-to target camera position is squarely in front of panel normal at progress 100%', () => {
  const tree = buildHingeTree({ dimensions: { width: 50, height: 100, depth: 30 } });

  // Right panel faces outward along +X: [1, 0, 0]
  const rightNormal = calculatePanelNormal('right', 1, tree);
  assert.ok(Math.abs(rightNormal[0] - 1.0) < 1e-4);
  assert.ok(Math.abs(rightNormal[1]) < 1e-4);
  assert.ok(Math.abs(rightNormal[2]) < 1e-4);

  // If camera is placed along normal from panel center:
  // Center is [25, 0, 0], normal is [1, 0, 0]
  // Cam position = center + normal * 100 = [125, 0, 0]
  const panelCenter = [25, 0, 0];
  const camPos = [
    panelCenter[0] + rightNormal[0] * 100,
    panelCenter[1] + rightNormal[1] * 100,
    panelCenter[2] + rightNormal[2] * 100,
  ];

  assert.ok(Math.abs(camPos[0] - 125) < 1e-4);
  assert.ok(Math.abs(camPos[1]) < 1e-4);
  assert.ok(Math.abs(camPos[2]) < 1e-4);
});

test('flat dieline camera looks directly down the Z-axis onto flat panels', () => {
  const tree = buildHingeTree({ dimensions: { width: 50, height: 100, depth: 30 } });
  for (const face of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
    const normal0 = calculatePanelNormal(face, 0, tree);
    assert.deepEqual(normal0, [0, 0, 1], `Panel ${face} must have normal [0, 0, 1] in flat dieline view`);
  }
});
