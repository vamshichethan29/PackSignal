import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHingeTree, CARTON_FACES, calculateFoldTransforms } from '../../public/three/fold-engine.js';

test('carton geometry dimensions match input DXF or user specifications exactly', () => {
  const dimensions = { width: 50, height: 100, depth: 30 };
  const tree = buildHingeTree({ dimensions });

  assert.equal(tree.panels.front.width, 50);
  assert.equal(tree.panels.front.height, 100);
  assert.equal(tree.panels.right.width, 30);
  assert.equal(tree.panels.right.height, 100);
  assert.equal(tree.panels.back.width, 50);
  assert.equal(tree.panels.back.height, 100);
  assert.equal(tree.panels.left.width, 30);
  assert.equal(tree.panels.left.height, 100);
  assert.equal(tree.panels.top.width, 50);
  assert.equal(tree.panels.top.height, 30);
  assert.equal(tree.panels.bottom.width, 50);
  assert.equal(tree.panels.bottom.height, 30);
});

test('crease connectivity: every child panel shares an exact crease line with its parent', () => {
  const dimensions = { width: 40, height: 80, depth: 25 };
  const tree = buildHingeTree({ dimensions });

  // Front -> Right crease:
  // Front right edge is at X = +20, Right hinge on front is at [20, 0, 0]
  assert.deepEqual(tree.panels.right.hingeOnParent, [20, 0, 0]);

  // Front -> Left crease:
  // Front left edge is at X = -20
  assert.deepEqual(tree.panels.left.hingeOnParent, [-20, 0, 0]);

  // Front -> Top crease:
  // Front top edge is at Y = +40
  assert.deepEqual(tree.panels.top.hingeOnParent, [0, 40, 0]);

  // Front -> Bottom crease:
  // Front bottom edge is at Y = -40
  assert.deepEqual(tree.panels.bottom.hingeOnParent, [0, -40, 0]);

  // Right -> Back crease:
  // Right outer edge is at distance depth/2 = 12.5 from right panel center
  assert.deepEqual(tree.panels.back.hingeOnParent, [12.5, 0, 0]);
});

test('surface area conservation: total area of 6 panels equals surface area of closed box', () => {
  const width = 50, height = 100, depth = 30;
  const tree = buildHingeTree({ dimensions: { width, height, depth } });

  const totalPanelArea = CARTON_FACES.reduce((sum, face) => {
    const p = tree.panels[face];
    return sum + (p.width * p.height);
  }, 0);

  const expectedSurfaceArea = 2 * (width * height + width * depth + height * depth);
  assert.equal(totalPanelArea, expectedSurfaceArea);
});
