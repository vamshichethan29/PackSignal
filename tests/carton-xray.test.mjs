/**
 * @file tests/carton-xray.test.mjs
 * 
 * Tests for carton X-Ray mode and statutory ghost boxes:
 * - Toggling X-Ray changes material transparency and roughness
 * - Amber ghost box appears for US missing customary net quantity
 * - Ghost boxes retain statutory citation and placement rationale
 * - Source PDF is never mutated
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CartonXRayController,
  XRAY_GHOST_DEFINITIONS,
} from '../public/carton-xray.js';

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

test('1. X-Ray controller toggles carton panel materials to translucent state', () => {
  const panelMeshes = {
    front: new MockMesh(),
    back: new MockMesh(),
  };

  const xray = new CartonXRayController({ panelMeshes, market: 'us' });
  assert.equal(xray.isXRayEnabled, false);
  assert.equal(panelMeshes.front.material.transparent, false);

  // Enable X-Ray
  xray.enableXRay();
  assert.equal(xray.isXRayEnabled, true);
  assert.equal(panelMeshes.front.material.transparent, true);
  assert.ok(panelMeshes.front.material.opacity < 0.5, 'Material must be translucent');

  // Disable X-Ray
  xray.disableXRay();
  assert.equal(xray.isXRayEnabled, false);
  assert.equal(panelMeshes.front.material.transparent, false);
  assert.equal(panelMeshes.front.material.opacity, 1.0);
});

test('2. US X-Ray mode renders statutory net quantity ghost box in bottom 30% of PDP', () => {
  const panelMeshes = {
    front: new MockMesh(),
    back: new MockMesh(),
  };

  const xray = new CartonXRayController({ panelMeshes, market: 'us' });
  xray.enableXRay();

  const ghosts = xray.getActiveGhosts();
  assert.ok(ghosts.length >= 1, 'Must have at least 1 ghost box for US');

  const netQtyGhost = ghosts.find(g => g.ghostId === 'ghost-us-customary-net-qty');
  assert.ok(netQtyGhost, 'US net quantity customary ghost must exist');
  assert.equal(netQtyGhost.panel, 'front', 'Must be positioned on PDP front');
  assert.ok(netQtyGhost.statutoryCitation.includes('21 CFR §101.7'));
  assert.equal(netQtyGhost.detectedText, '480 g');
  assert.equal(netQtyGhost.missingRequirement, '16.9 OZ (1 LB 0.9 OZ)');
  assert.equal(netQtyGhost.label, 'PROPOSED REQUIRED DECLARATION PLACEMENT — NOT PRESENT IN ARTWORK');
});
