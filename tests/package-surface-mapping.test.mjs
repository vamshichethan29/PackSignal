import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapNormalizedToCarton,
  mapNormalizedToCan,
  mapCanPointToNormalized,
  mapNormalizedToBottleLabel,
  mapNormalizedToPouch,
  resolveFindingAnchor,
  mapGhostBoxToSurface,
  MAPPING_AUTHORITY,
  DEFAULT_DIMENSIONS,
} from '../public/package-surface-mapping.js';

test('1. Carton forward mapping projects (u, v) onto front face', () => {
  const frontCenter = mapNormalizedToCarton(0.5, 0.5, 'front');
  assert.equal(frontCenter.surface, 'front');
  assert.equal(frontCenter.point[0], 0); // x=0 at center
  assert.equal(frontCenter.point[1], 0); // y=0 at center
  assert.ok(frontCenter.point[2] > 0); // z > 0 (front facing +Z)
  assert.deepEqual(frontCenter.normal, [0, 0, 1]);
});

test('2. Carton forward mapping projects (u, v) onto all 6 faces correctly', () => {
  const faces = ['front', 'back', 'left', 'right', 'top', 'bottom'];
  for (const face of faces) {
    const res = mapNormalizedToCarton(0.5, 0.5, face);
    assert.equal(res.surface, face);
    assert.ok(Array.isArray(res.point) && res.point.length === 3);
    assert.ok(Array.isArray(res.normal) && res.normal.length === 3);
  }
});

test('3. Can cylindrical wrap maps u=0.5 to front center (+Z axis)', () => {
  const canCenter = mapNormalizedToCan(0.5, 0.5);
  assert.equal(canCenter.surface, 'cylinder_body');
  // At u=0.5 (with seamOffset 0.5), effectiveU = 1.0 (or 0.0), theta = 0 -> x=0, z=radius
  assert.ok(Math.abs(canCenter.point[0]) < 1e-6, `x should be 0, got ${canCenter.point[0]}`);
  assert.ok(Math.abs(canCenter.point[2] - DEFAULT_DIMENSIONS.can.radius) < 1e-6);
  assert.deepEqual(canCenter.normal, [0, 0, 1]);
});

test('4. Can 3D-to-2D reverse mapping accurately recovers (u, v)', () => {
  const testPoints = [
    { u: 0.5, v: 0.5 },
    { u: 0.25, v: 0.75 },
    { u: 0.8, v: 0.2 },
  ];

  for (const tp of testPoints) {
    const proj = mapNormalizedToCan(tp.u, tp.v);
    const rev = mapCanPointToNormalized(proj.point[0], proj.point[1], proj.point[2]);
    assert.ok(Math.abs(rev.u - tp.u) < 1e-4, `u mismatch: expected ${tp.u}, got ${rev.u}`);
    assert.ok(Math.abs(rev.v - tp.v) < 1e-4, `v mismatch: expected ${tp.v}, got ${rev.v}`);
  }
});

test('5. Bottle label mapping places label slightly proud of glass container body', () => {
  const labelProj = mapNormalizedToBottleLabel(0.5, 0.5);
  assert.equal(labelProj.surface, 'bottle_label');
  assert.ok(labelProj.point[2] > DEFAULT_DIMENSIONS.bottle.radius, 'Label must be placed slightly outside glass radius');
  assert.equal(labelProj.point[1], DEFAULT_DIMENSIONS.bottle.labelOffsetY);
});

test('6. Pouch geometry pillow formula provides maximum bulge at center and 0 at seals', () => {
  const centerPouch = mapNormalizedToPouch(0.5, 0.5, 'front');
  const edgePouch = mapNormalizedToPouch(0.0, 0.5, 'front');

  assert.ok(centerPouch.point[2] > edgePouch.point[2], 'Center must bulge more than seal edges');
  assert.ok(Math.abs(edgePouch.point[2] - 0.4) < 1e-6, 'Edge bulge must taper to flange base + tolerance');
});


test('7. Finding pin anchor resolution handles valid bounding boxes with correct 3D point', () => {
  const finding = {
    id: 'FND-NET-QTY',
    title: 'Net Quantity Statement',
    box: [0.3, 0.7, 0.7, 0.9],
    isVerified: true,
  };

  const anchor = resolveFindingAnchor(finding, 'carton', { face: 'front' });
  assert.equal(anchor.status, MAPPING_AUTHORITY.SOURCE_VERIFIED);
  assert.equal(anchor.findingId, 'FND-NET-QTY');
  assert.ok(anchor.point && anchor.point.length === 3);
  assert.equal(anchor.u, 0.5);
  assert.equal(anchor.v, 0.8);
});

test('8. Finding pin anchor resolution truthfully abstains when bounding box is absent', () => {
  const unlocatedFinding = {
    id: 'FND-UNLOCATED-1',
    title: 'Missing Address Declaration',
    // No box or bbox
  };

  const anchor = resolveFindingAnchor(unlocatedFinding, 'carton');
  assert.equal(anchor.status, MAPPING_AUTHORITY.UNMAPPED);
  assert.equal(anchor.findingId, 'FND-UNLOCATED-1');
  assert.ok(anchor.reason.includes('No 2D artwork bounding box'));
  assert.equal(anchor.point, undefined, 'Must not fabricate 3D coordinates for unlocated findings');
});

test('9. Ghost box projection maps 4 boundary corners and center to physical surface', () => {
  const ghostBox = [0.2, 0.3, 0.8, 0.7];
  const mappedGhost = mapGhostBoxToSurface(ghostBox, 'carton', { face: 'front' });

  assert.ok(mappedGhost);
  assert.equal(mappedGhost.corners.length, 4);
  assert.equal(mappedGhost.isProvisional, true);
  assert.ok(mappedGhost.center && mappedGhost.center.length === 3);
});
