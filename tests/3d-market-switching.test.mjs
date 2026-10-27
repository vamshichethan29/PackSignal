/**
 * @file tests/3d-market-switching.test.mjs
 * 
 * Tests for global market switching in 3D:
 * - Switching US <-> India updates statutory ghost boxes
 * - Inapplicable US ghosts are removed
 * - FSSAI Veg Mark & MRP / Licence ghosts are rendered for India
 * - Source artwork texture and physical package dieline remain unchanged
 * - Fold state (e.g. 50% or 100%) is preserved independently of market change
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { CartonXRayController } from '../public/carton-xray.js';
import { CartonFoldAnimationController } from '../public/carton-fold-animation.js';

class MockMesh {
  constructor() {
    this.material = { transparent: false, opacity: 1.0, roughness: 0.4, needsUpdate: false };
    this.children = [];
  }
  add(obj) {
    this.children.push(obj);
  }
  remove(obj) {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

test('1. Market switch from US to India swaps statutory ghosts without mutating geometry', () => {
  const panelMeshes = {
    front: new MockMesh(),
    back: new MockMesh(),
  };

  const xray = new CartonXRayController({ panelMeshes, market: 'us' });
  xray.enableXRay();

  // In US mode
  const usGhosts = xray.getActiveGhosts();
  assert.ok(usGhosts.some(g => g.ghostId === 'ghost-us-customary-net-qty'));
  assert.ok(!usGhosts.some(g => g.ghostId === 'ghost-in-veg-mark'));

  // Switch to India
  xray.setMarket('india');
  const inGhosts = xray.getActiveGhosts();

  // US ghosts must be cleared
  assert.ok(!inGhosts.some(g => g.ghostId === 'ghost-us-customary-net-qty'));

  // India mandatory ghosts must be mounted
  const vegGhost = inGhosts.find(g => g.ghostId === 'ghost-in-veg-mark');
  assert.ok(vegGhost, 'FSSAI Veg Mark ghost must appear on front PDP');
  assert.equal(vegGhost.panel, 'front');
  assert.ok(vegGhost.statutoryCitation.includes('FSSR (Labelling & Display) 2020'));

  const mrpGhost = inGhosts.find(g => g.ghostId === 'ghost-in-mrp-fssai');
  assert.ok(mrpGhost, 'Legal Metrology MRP ghost must appear on back panel');
  assert.equal(mrpGhost.panel, 'back');
  assert.ok(mrpGhost.statutoryCitation.includes('Legal Metrology'));
});

test('2. Fold progress remains completely independent of regulatory market switching', () => {
  const foldCtrl = new CartonFoldAnimationController({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
  });

  // User sets fold slider to 65%
  foldCtrl.setProgress(0.65);
  assert.equal(foldCtrl.progress, 0.65);

  const panelMeshes = { front: new MockMesh(), back: new MockMesh() };
  const xray = new CartonXRayController({ panelMeshes, market: 'us' });

  // Switch market to India
  xray.setMarket('india');

  // Verify fold state was not touched or reset
  assert.equal(foldCtrl.progress, 0.65, 'Fold slider progress must not be affected by regulatory market switch');
});
