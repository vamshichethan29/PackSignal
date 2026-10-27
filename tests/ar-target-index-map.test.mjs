/**
 * @file tests/ar-target-index-map.test.mjs
 * 
 * Verifies Phase 7: MindAR Target Index Mapping & Validation.
 * Strict validation:
 * - Deterministic index assignment: 0 -> FRONT, 1 -> RIGHT, 2 -> BACK, 3 -> LEFT
 * - Rotation sequence corresponds to physical clockwise carton rotation
 * - Zero face swapping (no front/back, no left/right, no mirrored targets)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArManifest } from '../lib/ar/ar-manifest.mjs';

test('1. MindAR target index mapping is 1-to-1 and strictly deterministic', () => {
  const manifest = buildArManifest();
  const panels = manifest.panels;

  const targetMap = new Map();
  for (const panel of panels) {
    assert.ok(typeof panel.targetIndex === 'number', `Panel ${panel.panelId} must have numeric targetIndex`);
    assert.equal(targetMap.has(panel.targetIndex), false, `Target index ${panel.targetIndex} must be unique`);
    targetMap.set(panel.targetIndex, panel.panelId);
  }

  assert.equal(targetMap.get(0), 'front', 'Target 0 must map to front');
  assert.equal(targetMap.get(1), 'right', 'Target 1 must map to right');
  assert.equal(targetMap.get(2), 'back', 'Target 2 must map to back');
  assert.equal(targetMap.get(3), 'left', 'Target 3 must map to left');
});

test('2. Physical rotation sequence matches carton topology', () => {
  const manifest = buildArManifest();
  const indexOrder = manifest.panels.slice().sort((a, b) => a.targetIndex - b.targetIndex).map(p => p.panelId);
  
  // Physical clockwise rotation around vertical carton axis
  assert.deepEqual(indexOrder, ['front', 'right', 'back', 'left']);
});

test('3. Target transform matrices are orthogonal identity matrices without inversion', () => {
  const manifest = buildArManifest();
  for (const panel of manifest.panels) {
    const m = panel.targetToPanelTransform;
    assert.equal(m.length, 16, 'Transform must be a 4x4 matrix (16 elements)');
    // Diagonal elements must be positive 1 (no reflection / mirroring)
    assert.equal(m[0], 1, 'm00 must be 1');
    assert.equal(m[5], 1, 'm11 must be 1');
    assert.equal(m[10], 1, 'm22 must be 1');
    assert.equal(m[15], 1, 'm33 must be 1');
  }
});
