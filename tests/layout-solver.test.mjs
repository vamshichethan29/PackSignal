/**
 * @file layout-solver.test.mjs
 * 
 * Unit tests for deterministic 2D constrained layout solver and obstacle avoidance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { solvePackLayout } from '../lib/pack-canvas/layout-solver.mjs';
import { PACK_PANELS, LOCKED_BRAND_ZONES, getCorrectedUSPackBlocks, EXTRA_REQUIRED_ITEMS } from '../lib/pack-canvas.mjs';

test('Layout Solver: Deterministic placement places all standard US blocks without collision', () => {
  const blocks = getCorrectedUSPackBlocks();
  const result = solvePackLayout(PACK_PANELS, LOCKED_BRAND_ZONES, blocks);

  assert.equal(result.solverStatus, 'FEASIBLE');
  assert.equal(result.unplacedBlocks.length, 0, 'All standard blocks must be placed');
  assert.equal(result.placedBlocks.length, blocks.length);

  // Placed blocks must carry dieline coordinates in millimeters
  for (const b of result.placedBlocks) {
    assert.ok(b.dielineXmm > 0);
    assert.ok(b.dielineYmm > 0);
    assert.ok(b.widthMm > 0);
    assert.ok(b.heightMm > 0);
  }
});

test('Layout Solver: Obstacle avoidance prevents placement over locked brand logo', () => {
  const logoObstacle = LOCKED_BRAND_ZONES.find(z => z.id === 'lock-pdp-logo');
  assert.ok(logoObstacle);

  const testBlocks = [
    {
      id: 'test-overlapping-block',
      name: 'Test Marketing Banner',
      panelId: 'panel-front',
      category: 'MARKETING_CLAIM',
      mandatory: false,
      text: 'BEST SELLER',
      widthMm: 120.0,
      heightMm: 20.0,
      xMm: 11.44,
      yMm: 12.0 // Directly overlapping logo at y: 8-36
    }
  ];

  const result = solvePackLayout(PACK_PANELS, LOCKED_BRAND_ZONES, testBlocks);

  // The solver must step down below the obstacle or flag collision
  const placed = result.placedBlocks.find(b => b.id === 'test-overlapping-block');
  if (placed) {
    assert.ok(placed.yMm >= logoObstacle.yMm + logoObstacle.heightMm, 'Must be pushed below locked logo');
  }
});

test('Layout Solver: Detects unplaced blocks when panel space is completely exhausted', () => {
  // Overload Back panel with oversized and extra items
  const baseBlocks = getCorrectedUSPackBlocks();
  const oversizedBlocks = [
    ...baseBlocks,
    ...EXTRA_REQUIRED_ITEMS,
    {
      id: 'massive-unfittable-block',
      name: 'Massive Legal Notice',
      panelId: 'panel-back',
      category: 'STATE_COMPLIANCE',
      mandatory: true,
      text: 'Repeated long text '.repeat(50),
      widthMm: 135.0,
      heightMm: 95.0,
      yMm: 120.0
    }
  ];

  const result = solvePackLayout(PACK_PANELS, LOCKED_BRAND_ZONES, oversizedBlocks);
  assert.ok(result.unplacedBlocks.length > 0, 'Massive block must not fit and be tracked in unplaced queue');
  assert.ok(result.unplacedBlocks.some(b => b.id === 'massive-unfittable-block'));
});
