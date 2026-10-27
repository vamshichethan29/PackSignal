import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkCircumferenceMatch,
  mapNormalizedToCylinder,
  mapCylinderToNormalized,
  mapNormalizedToPouch,
} from '../../public/three/coordinate-mapper.js';

test('checkCircumferenceMatch computes circumference and detects discrepancies with warning', () => {
  // Can diameter: 66mm. Circumference = PI * 66 = 207.35mm
  const matching = checkCircumferenceMatch(207.5, 66, 1.0);
  assert.equal(matching.match, true);
  assert.equal(matching.warning, null);

  // Mismatched label width: 180mm vs 207.35mm
  const mismatched = checkCircumferenceMatch(180, 66, 1.0);
  assert.equal(mismatched.match, false);
  assert.ok(mismatched.diffMm > 25);
  assert.ok(mismatched.warning.includes('differs from can circumference'));
});

test('mapNormalizedToCylinder maps [u, v] to 3D cylinder point and surface normal', () => {
  const radius = 33;
  const height = 115;

  // Front center: u=0.5, v=0.5 => theta=0, x=0, z=R, y=0
  const front = mapNormalizedToCylinder(0.5, 0.5, { radius, height, surfaceOffset: 0.5 });
  assert.ok(Math.abs(front.point[0]) < 1e-4, 'Front center X should be ~0');
  assert.ok(Math.abs(front.point[1]) < 1e-4, 'Vertical center Y should be ~0');
  assert.ok(Math.abs(front.point[2] - 33.5) < 1e-4, 'Front center Z should be radius + offset');
  assert.deepEqual(front.normal, [0, 0, 1], 'Front normal faces +Z');

  // Left side: u=0.25 => theta = -PI/2, x = -R, z = 0
  const left = mapNormalizedToCylinder(0.25, 0.5, { radius, height, surfaceOffset: 0 });
  assert.ok(Math.abs(left.point[0] - (-33)) < 1e-4, 'Left X should be -radius');
  assert.ok(Math.abs(left.point[2]) < 1e-4, 'Left Z should be 0');

  // Right side: u=0.75 => theta = +PI/2, x = +R, z = 0
  const right = mapNormalizedToCylinder(0.75, 0.5, { radius, height, surfaceOffset: 0 });
  assert.ok(Math.abs(right.point[0] - 33) < 1e-4, 'Right X should be +radius');
  assert.ok(Math.abs(right.point[2]) < 1e-4, 'Right Z should be 0');

  // Top (v=0) vs bottom (v=1)
  const top = mapNormalizedToCylinder(0.5, 0.0, { radius, height });
  const btm = mapNormalizedToCylinder(0.5, 1.0, { radius, height });
  assert.ok(top.point[1] > btm.point[1]);
  assert.equal(top.point[1] - btm.point[1], height);
});

test('mapCylinderToNormalized inverts 3D coordinates back to 2D [u, v] without distortion', () => {
  const radius = 33;
  const height = 115;

  const testPoints = [
    [0.1, 0.2],
    [0.35, 0.75],
    [0.5, 0.5],
    [0.8, 0.15],
  ];

  for (const [origU, origV] of testPoints) {
    const { point } = mapNormalizedToCylinder(origU, origV, { radius, height, surfaceOffset: 0 });
    const inverted = mapCylinderToNormalized(point[0], point[1], point[2], { height });
    assert.ok(Math.abs(inverted.u - origU) < 1e-3, `U coordinate should roundtrip (orig: ${origU}, got: ${inverted.u})`);
    assert.ok(Math.abs(inverted.v - origV) < 1e-3, `V coordinate should roundtrip (orig: ${origV}, got: ${inverted.v})`);
  }
});

test('mapNormalizedToPouch creates symmetric pillow curvature for front and back', () => {
  const width = 140;
  const height = 200;
  const depth = 60;

  const frontCenter = mapNormalizedToPouch(0.5, 0.5, { width, height, depth, inflation: 1.0, face: 'front' });
  const backCenter = mapNormalizedToPouch(0.5, 0.5, { width, height, depth, inflation: 1.0, face: 'back' });

  assert.equal(frontCenter.point[0], 0);
  assert.equal(backCenter.point[0], 0);
  assert.ok(frontCenter.point[2] > 0, 'Front protrudes in +Z');
  assert.ok(backCenter.point[2] < 0, 'Back protrudes in -Z');
  assert.equal(frontCenter.point[2], -backCenter.point[2], 'Front and back depth must be symmetric');

  // Side seam edges (u=0 and u=1) should taper near z=0
  const frontEdge = mapNormalizedToPouch(0.0, 0.5, { width, height, depth, inflation: 1.0, face: 'front' });
  assert.ok(frontEdge.point[2] < frontCenter.point[2] * 0.2, 'Side edges must be flattened at welds');
});
