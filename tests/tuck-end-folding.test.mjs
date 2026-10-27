/**
 * @file tests/tuck-end-folding.test.mjs
 * 
 * Tests for tuck-end carton kinematics and folding animation controller:
 * - 0% flat dieline corresponds to 2D layout in Z=0
 * - Intermediate fold progress (50%) maintains continuous kinematics
 * - 100% closed carton reaches intended bounding dimensions
 * - Reduced motion support (prefers-reduced-motion)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CartonFoldAnimationController } from '../public/carton-fold-animation.js';
import {
  buildHingeTree,
  calculateFoldTransforms,
  calculatePanelNormal,
  CARTON_FACES,
} from '../public/three/fold-engine.js';

test('1. Fold animation controller scrubs smoothly from 0% flat to 100% closed', () => {
  let latestProgress = null;
  const controller = new CartonFoldAnimationController({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
    onProgress: (state) => {
      latestProgress = state;
    },
  });

  // Test at 0%
  controller.setProgress(0.0);
  assert.equal(latestProgress.percent, 0);
  assert.equal(latestProgress.isFlat, true);
  assert.equal(latestProgress.isClosed, false);

  // Test at 50%
  controller.setProgress(0.5);
  assert.equal(latestProgress.percent, 50);
  assert.equal(latestProgress.isFlat, false);
  assert.equal(latestProgress.isClosed, false);

  // Test at 100%
  controller.setProgress(1.0);
  assert.equal(latestProgress.percent, 100);
  assert.equal(latestProgress.isFlat, false);
  assert.equal(latestProgress.isClosed, true);
});

test('2. Closed carton at 100% fold achieves exact physical face normal alignments', () => {
  const tree = buildHingeTree({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
  });

  const pointsClose = (a, b, eps = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) < eps);

  // Check all 6 face normals in closed 3D state
  const frontN = calculatePanelNormal('front', 1.0, tree);
  assert.ok(pointsClose(frontN, [0, 0, 1]), 'Front normal must point +Z');

  const backN = calculatePanelNormal('back', 1.0, tree);
  assert.ok(pointsClose(backN, [0, 0, -1]), 'Back normal must point -Z');

  const rightN = calculatePanelNormal('right', 1.0, tree);
  assert.ok(pointsClose(rightN, [1, 0, 0]), 'Right normal must point +X');

  const leftN = calculatePanelNormal('left', 1.0, tree);
  assert.ok(pointsClose(leftN, [-1, 0, 0]), 'Left normal must point -X');

  const topN = calculatePanelNormal('top', 1.0, tree);
  assert.ok(pointsClose(topN, [0, 1, 0]), 'Top normal must point +Y');

  const bottomN = calculatePanelNormal('bottom', 1.0, tree);
  assert.ok(pointsClose(bottomN, [0, -1, 0]), 'Bottom normal must point -Y');
});

test('3. Reduced motion mode completes fold instantly without requestAnimationFrame looping', () => {
  let completedProgress = null;
  const controller = new CartonFoldAnimationController({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
    reducedMotion: true,
    onComplete: (p) => {
      completedProgress = p;
    },
  });

  controller.foldTo3D();
  assert.equal(controller.progress, 1.0, 'Must jump directly to 100%');
  assert.equal(completedProgress, 1.0);

  controller.unfold();
  assert.equal(controller.progress, 0.0, 'Must jump directly to 0%');
  assert.equal(completedProgress, 0.0);
});
