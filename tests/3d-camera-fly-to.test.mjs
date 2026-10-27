/**
 * @file tests/3d-camera-fly-to.test.mjs
 * 
 * Tests for camera fly-to navigation:
 * - Proper outward normal vector calculation
 * - Clearance distance calculation to avoid interior clipping
 * - Finding focus and sequential navigation (next / previous)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CartonCameraNavigationController } from '../public/carton-camera-navigation.js';
import { buildHingeTree } from '../public/three/fold-engine.js';

test('1. Camera fly-to calculates perpendicular vantage point facing outward panel normal', async () => {
  const tree = buildHingeTree({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
  });

  const mockCamera = {
    position: { x: 300, y: 200, z: 300 },
  };
  const mockControls = {
    target: { x: 0, y: 0, z: 0 },
    update: () => {},
  };

  let selectedFindingRecord = null;
  const nav = new CartonCameraNavigationController({
    camera: mockCamera,
    controls: mockControls,
    hingeTree: tree,
    findingFocusDistance: 200,
    onFindingSelected: (f) => {
      selectedFindingRecord = f;
    },
  });

  const testFinding = {
    id: 'f-pdp-claim',
    title: 'Good Source of Fiber',
    panel: 'front',
    x: 0.5,
    y: 0.3,
  };

  // Fly to front PDP finding in 0ms (immediate test mode)
  await nav.flyToFinding(testFinding, 1.0, 0);

  assert.equal(nav.activeFindingId, 'f-pdp-claim');
  assert.equal(selectedFindingRecord.id, 'f-pdp-claim');

  // For front panel, outward normal is +Z [0, 0, 1].
  // Camera Z must be positive and >= 200mm away, ensuring it is outside the carton
  assert.ok(mockCamera.position.z >= 200, 'Camera Z must be outside front face to prevent clipping');
});

test('2. Sequential finding navigation moves reliably through finding list', async () => {
  const mockCamera = { position: { x: 0, y: 0, z: 0 } };
  const mockControls = { target: { x: 0, y: 0, z: 0 }, update: () => {} };

  const findings = [
    { id: 'f-1', panel: 'front', x: 0.5, y: 0.5 },
    { id: 'f-2', panel: 'back', x: 0.5, y: 0.5 },
    { id: 'f-3', panel: 'right', x: 0.5, y: 0.5 },
  ];

  const nav = new CartonCameraNavigationController({
    camera: mockCamera,
    controls: mockControls,
  });
  nav.setFindingList(findings);

  // Navigate next: should select f-1
  await nav.nextFinding(1.0);
  assert.equal(nav.activeFindingId, 'f-1');

  // Navigate next: should select f-2
  await nav.nextFinding(1.0);
  assert.equal(nav.activeFindingId, 'f-2');

  // Navigate previous: should return to f-1
  await nav.previousFinding(1.0);
  assert.equal(nav.activeFindingId, 'f-1');
});
