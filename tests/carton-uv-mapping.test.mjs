/**
 * @file tests/carton-uv-mapping.test.mjs
 * 
 * Tests for carton UV coordinate mapping:
 * - Proper UV transformation (offset and repeat)
 * - Debug mode overlays: Panel IDs, UV grid, face orientation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CartonTextureMapper,
  PANEL_TEXTURE_LAYOUTS,
} from '../public/carton-texture-mapping.js';
import { CARTON_FACES } from '../public/three/fold-engine.js';

test('1. UV coordinates produce valid positive bounding scales within [0, 1]', () => {
  const mapper = new CartonTextureMapper();

  for (const face of CARTON_FACES) {
    const mapping = mapper.getFaceMapping(face);
    const { offset, repeat } = mapping.uvTransform;

    assert.ok(offset[0] >= 0 && offset[0] <= 1.0, `Face ${face} U-offset must be within [0, 1]`);
    assert.ok(offset[1] >= 0 && offset[1] <= 1.0, `Face ${face} V-offset must be within [0, 1]`);
    assert.ok(repeat[0] > 0 && repeat[0] <= 1.0, `Face ${face} U-scale must be positive and <= 1.0`);
    assert.ok(repeat[1] > 0 && repeat[1] <= 1.0, `Face ${face} V-scale must be positive and <= 1.0`);
    assert.ok(offset[0] + repeat[0] <= 1.001, `Face ${face} must not exceed right edge`);
    assert.ok(offset[1] + repeat[1] <= 1.001, `Face ${face} must not exceed bottom edge`);
  }
});

test('2. Debug overlays enable diagnostic inspection of UV layout and panel tags', () => {
  const mapper = new CartonTextureMapper();
  mapper.setDebugOption('showPanelIds', true);
  mapper.setDebugOption('showUvGrid', true);
  mapper.setDebugOption('showFaceOrientation', true);

  assert.equal(mapper.debugOptions.showPanelIds, true);
  assert.equal(mapper.debugOptions.showUvGrid, true);
  assert.equal(mapper.debugOptions.showFaceOrientation, true);

  // Mock 2D canvas context to verify renderDebugOverlay execution without errors
  const drawnOperations = [];
  const mockCtx = {
    save: () => drawnOperations.push('save'),
    restore: () => drawnOperations.push('restore'),
    fillRect: (...args) => drawnOperations.push(['fillRect', ...args]),
    fillText: (...args) => drawnOperations.push(['fillText', ...args]),
    beginPath: () => drawnOperations.push('beginPath'),
    moveTo: (...args) => drawnOperations.push(['moveTo', ...args]),
    lineTo: (...args) => drawnOperations.push(['lineTo', ...args]),
    stroke: () => drawnOperations.push('stroke'),
  };

  mapper.renderDebugOverlay(mockCtx, 300, 300, 'front');
  assert.ok(drawnOperations.length > 10, 'Must invoke canvas drawing commands for debug overlay');
  assert.ok(drawnOperations.some(op => Array.isArray(op) && op[0] === 'fillText' && op[1].includes('FRONT PANEL')));
});
