import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFoldGeometry,
  buildHingeTree,
  calculateFoldTransforms,
  calculatePanelNormal,
  mapArtworkPointToPanel,
  CARTON_FACES,
} from '../../public/three/fold-engine.js';

const EPSILON = 1e-4;
const isClose = (a, b, tol = EPSILON) => Math.abs(a - b) <= tol;
const pointsClose = (p1, p2, tol = EPSILON) => p1.every((val, i) => isClose(val, p2[i], tol));

test('validateFoldGeometry enforces valid positive dimensions and detects flaws', () => {
  assert.equal(validateFoldGeometry(null).ok, false);
  assert.equal(validateFoldGeometry({}).ok, false);
  assert.equal(validateFoldGeometry({ dimensions: { width: 0, height: 100, depth: 30 } }).ok, false);
  assert.equal(validateFoldGeometry({ dimensions: { width: 50, height: -10, depth: 30 } }).ok, false);
  assert.equal(validateFoldGeometry({ dimensions: { width: 50, height: 100, depth: 30 } }).ok, true);
});

test('buildHingeTree constructs a 6-face tree with front as root and correct dimensions', () => {
  const tree = buildHingeTree({ dimensions: { width: 50, height: 100, depth: 30 } });
  assert.equal(tree.root, 'front');
  assert.equal(Object.keys(tree.panels).length, 6);
  for (const face of CARTON_FACES) {
    assert.ok(tree.panels[face], `Face ${face} must exist in tree`);
  }
  assert.equal(tree.panels.front.width, 50);
  assert.equal(tree.panels.front.height, 100);
  assert.equal(tree.panels.right.width, 30);
  assert.equal(tree.panels.top.height, 30);
});

test('at progress 0%, all panels are flat in the dieline plane and normals face +Z', () => {
  const tree = buildHingeTree({ dimensions: { width: 60, height: 120, depth: 40 } });
  const transforms = calculateFoldTransforms(tree, 0);

  for (const face of CARTON_FACES) {
    const mat = transforms[face];
    const center = mat.transformPoint([0, 0, 0]);
    assert.ok(isClose(center[2], 0), `Panel ${face} Z coordinate must be 0 in flat view, got ${center[2]}`);

    const normal = calculatePanelNormal(face, 0, tree);
    assert.ok(pointsClose(normal, [0, 0, 1]), `Panel ${face} normal must be [0,0,1] in flat view, got ${normal}`);
  }
});

test('at progress 100%, panels form a closed rectangular box centered at origin with outward normals', () => {
  const width = 50, height = 100, depth = 30;
  const tree = buildHingeTree({ dimensions: { width, height, depth } });
  const transforms = calculateFoldTransforms(tree, 1);

  const expectedCenters = {
    front: [0, 0, depth / 2],
    back: [0, 0, -depth / 2],
    left: [-width / 2, 0, 0],
    right: [width / 2, 0, 0],
    top: [0, height / 2, 0],
    bottom: [0, -height / 2, 0],
  };

  const expectedNormals = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
  };

  for (const face of CARTON_FACES) {
    const center = transforms[face].transformPoint([0, 0, 0]);
    assert.ok(
      pointsClose(center, expectedCenters[face]),
      `Panel ${face} center mismatch at 100%: expected ${expectedCenters[face]}, got ${center}`
    );

    const normal = calculatePanelNormal(face, 1, tree);
    assert.ok(
      pointsClose(normal, expectedNormals[face]),
      `Panel ${face} normal mismatch at 100%: expected ${expectedNormals[face]}, got ${normal}`
    );
  }
});

test('intermediate fold progress (25%, 50%, 75%) transforms continuously without singularity', () => {
  const tree = buildHingeTree({ dimensions: { width: 50, height: 100, depth: 30 } });

  const progressSteps = [0.25, 0.5, 0.75];
  for (const t of progressSteps) {
    const transforms = calculateFoldTransforms(tree, t);
    for (const face of CARTON_FACES) {
      const center = transforms[face].transformPoint([0, 0, 0]);
      assert.ok(center.every(Number.isFinite), `Panel ${face} center must be finite at t=${t}`);

      const normal = calculatePanelNormal(face, t, tree);
      assert.ok(normal.every(Number.isFinite), `Panel ${face} normal must be finite at t=${t}`);
      const len = Math.hypot(...normal);
      assert.ok(isClose(len, 1), `Panel ${face} normal must be unit length at t=${t}`);
    }
  }
});

test('mapArtworkPointToPanel maps 2D artwork coordinates to panel-local 3D points', () => {
  const panelZone = { page: 1, box: [0.1, 0.2, 0.6, 0.8] }; // width: 0.5, height: 0.6
  const panelDimensions = { width: 50, height: 60 };

  // Center of the panel zone in artwork [0.35, 0.5]
  const centerMapped = mapArtworkPointToPanel([0.35, 0.5], panelZone, panelDimensions);
  assert.equal(centerMapped.inside, true);
  assert.ok(isClose(centerMapped.u, 0.5));
  assert.ok(isClose(centerMapped.v, 0.5));
  assert.ok(pointsClose(centerMapped.localPoint, [0, 0, 0.5]));

  // Top-left corner of the panel zone [0.1, 0.2]
  const tlMapped = mapArtworkPointToPanel([0.1, 0.2], panelZone, panelDimensions);
  assert.equal(tlMapped.inside, true);
  assert.ok(isClose(tlMapped.u, 0));
  assert.ok(isClose(tlMapped.v, 0));
  assert.ok(pointsClose(tlMapped.localPoint, [-25, 30, 0.5]));

  // Point outside panel zone
  const outsideMapped = mapArtworkPointToPanel([0.9, 0.9], panelZone, panelDimensions);
  assert.equal(outsideMapped.inside, false);
});
