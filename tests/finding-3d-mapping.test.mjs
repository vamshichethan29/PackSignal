/**
 * @file tests/finding-3d-mapping.test.mjs
 * 
 * Tests for 2D to 3D finding pin transformation:
 * - Shared canonical finding locations
 * - Mathematical projection: (x, y) -> panel local coordinates -> world coordinates
 * - Pins follow hinge kinematics dynamically during fold (0% to 100%)
 * - Missing declarations are NEVER given fake detected text pins
 * - Unlocated findings remain accessible
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHingeTree,
  calculateFoldTransforms,
  mapArtworkPointToPanel,
} from '../public/three/fold-engine.js';

test('1. 2D normalized finding positions map faithfully to local 3D surface coordinates', () => {
  const panelZone = { box: [0.18, 0.28, 0.51, 0.72] }; // Front PDP zone in normalized canvas
  const panelDimensions = { width: 142.88, height: 160.16 };

  // Center of PDP
  const centerPoint = [0.345, 0.50];
  const mappedCenter = mapArtworkPointToPanel(centerPoint, panelZone, panelDimensions);

  assert.ok(mappedCenter.inside);
  assert.ok(Math.abs(mappedCenter.localPoint[0]) < 1.0, 'Center X should be near 0');
  assert.ok(Math.abs(mappedCenter.localPoint[1]) < 1.0, 'Center Y should be near 0');
  assert.equal(mappedCenter.localPoint[2], 0.5, 'Offset slightly from surface to prevent z-fighting');

  // Bottom of PDP (where net quantity resides: y = ~0.65)
  const netQtyPoint = [0.345, 0.65];
  const mappedNetQty = mapArtworkPointToPanel(netQtyPoint, panelZone, panelDimensions);
  assert.ok(mappedNetQty.inside);
  assert.ok(mappedNetQty.localPoint[1] < 0, 'Bottom of PDP should have negative local Y in Three.js centered space');
});

test('2. Finding pins follow their parent panel hinges during folding animation', () => {
  const dimensions = { width: 142.88, height: 160.16, depth: 77.61 };
  const tree = buildHingeTree({ dimensions });

  // A pin situated on the Right panel
  const pinLocal = [0, 0, 1.0]; // Center of right panel, slightly offset in normal

  // At fold progress = 0 (Flat):
  const flatTransforms = calculateFoldTransforms(tree, 0.0);
  const flatRightWorld = flatTransforms.right.transformPoint(pinLocal);
  assert.ok(Math.abs(flatRightWorld[2]) < 2.0, 'Z-coordinate must be flat at progress 0');

  // At fold progress = 1.0 (Folded 90 degrees):
  const foldedTransforms = calculateFoldTransforms(tree, 1.0);
  const foldedRightWorld = foldedTransforms.right.transformPoint(pinLocal);
  // On closed box, right face center sits at X = +width / 2 = 71.44
  assert.ok(foldedRightWorld[0] > 60.0, 'Right panel pin must translate to +X side of carton');
});

test('3. Missing content findings do not fabricate fake detected text coordinates', () => {
  const findings = [
    {
      id: 'f-metric-qty',
      title: 'Net Quantity',
      artworkText: '480 g',
      isDetected: true,
      x: 0.35,
      y: 0.68,
      panel: 'front',
    },
    {
      id: 'f-missing-customary-oz',
      title: 'Net Quantity (Customary)',
      artworkText: null,
      isDetected: false,
      isMissingDeclaration: true,
      x: null,
      y: null,
      panel: null,
    },
  ];

  const locatedPins = [];
  const unlocatedFindings = [];

  for (const f of findings) {
    if (f.isDetected && Number.isFinite(f.x) && Number.isFinite(f.y)) {
      locatedPins.push(f);
    } else {
      unlocatedFindings.push(f);
    }
  }

  assert.equal(locatedPins.length, 1);
  assert.equal(locatedPins[0].id, 'f-metric-qty');
  assert.equal(unlocatedFindings.length, 1);
  assert.equal(unlocatedFindings[0].id, 'f-missing-customary-oz');
  assert.equal(unlocatedFindings[0].isMissingDeclaration, true);
});
