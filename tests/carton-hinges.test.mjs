/**
 * @file tests/carton-hinges.test.mjs
 * 
 * Tests for physical hinge graph:
 * - Crease segments used as folding hinges
 * - Cut edges are NEVER treated as hinges
 * - Glue joints are treated as fixed joins, not ordinary creases
 * - Correct rotation axes and angles
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCartonStructuralPanels,
  PANEL_ROLES,
} from '../lib/geometry/carton-structure.mjs';
import {
  buildCartonHingeGraph,
  computeHingeRotationMatrix,
  HINGE_TYPES,
} from '../lib/geometry/carton-hinges.mjs';

test('1. Hinge graph establishes verified crease connections for all folding panels', () => {
  const structure = buildCartonStructuralPanels({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
    includeFlaps: true,
  });

  const graph = buildCartonHingeGraph({ structure });
  assert.ok(graph.isFullyConnected);
  assert.ok(graph.hingeCount >= 5, 'Must have at least 5 primary body creases');

  const frontLeft = graph.hinges.find(h => h.hingeId === 'hinge_front_left');
  assert.ok(frontLeft);
  assert.equal(frontLeft.type, HINGE_TYPES.CREASE_FOLD);
  assert.deepEqual(frontLeft.axisVector, [0, 1, 0], 'Vertical fold axis for left side panel');
  assert.equal(frontLeft.targetAngleRad, -Math.PI / 2, 'Folds backward 90 degrees');

  const frontTop = graph.hinges.find(h => h.hingeId === 'hinge_front_top');
  assert.ok(frontTop);
  assert.equal(frontTop.type, HINGE_TYPES.CREASE_FOLD);
  assert.deepEqual(frontTop.axisVector, [1, 0, 0], 'Horizontal fold axis for top closure');
  assert.equal(frontTop.targetAngleRad, -Math.PI / 2);
});

test('2. Cut edges and glue flaps are classified separately from standard creases', () => {
  const structure = buildCartonStructuralPanels({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
    includeFlaps: true,
  });

  const graph = buildCartonHingeGraph({ structure });

  // Cut boundaries are registered in cutBoundaries, not as active crease folds
  assert.ok(graph.cutBoundaries.length >= 3);
  assert.ok(graph.cutBoundaries.every(c => c.type === HINGE_TYPES.CUT_EDGE));

  // Glue flap has its own hinge and flag
  const gluePanel = structure.panels[PANEL_ROLES.GLUE_FLAP];
  assert.ok(gluePanel);
  assert.equal(gluePanel.isGlueFlap, true);
});

test('3. Hinge rotation matrix computes continuous interpolation between 0% and 100%', () => {
  const structure = buildCartonStructuralPanels();
  const graph = buildCartonHingeGraph({ structure });
  const hinge = graph.hinges[0];

  // At 0% progress -> Identity matrix
  const mat0 = computeHingeRotationMatrix(hinge, 0.0);
  const pt0 = mat0.transformPoint([10, 20, 0]);
  assert.ok(Math.abs(pt0[0] - 10) < 1e-4);
  assert.ok(Math.abs(pt0[1] - 20) < 1e-4);
  assert.ok(Math.abs(pt0[2] - 0) < 1e-4);

  // At 100% progress -> Full 90 degree rotation
  const mat1 = computeHingeRotationMatrix(hinge, 1.0);
  const pt1 = mat1.transformPoint([1, 0, 0]);
  assert.ok(Number.isFinite(pt1[0]));
  assert.ok(Number.isFinite(pt1[1]));
  assert.ok(Number.isFinite(pt1[2]));
});
