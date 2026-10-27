import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUBSTRATES,
  FINISHES,
  FinishingEffectsManager,
} from '../../public/three/materials/finishes.js';

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

class MockMaterial {
  constructor(opts = {}) {
    Object.assign(this, opts);
    this.needsUpdate = false;
  }
  dispose() {}
}

class MockMesh {
  constructor(material) {
    this.material = material;
  }
}

class MockLight {
  constructor(color, intensity) {
    this.color = color;
    this.intensity = intensity;
    this.position = new MockVector3();
  }
  dispose() {}
}

class MockScene {
  constructor() {
    this.children = [];
  }
  add(obj) { this.children.push(obj); }
  remove(obj) {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) this.children.splice(idx, 1);
  }
}

class MockCanvasTexture {
  constructor(canvas) {
    this.canvas = canvas;
    this.needsUpdate = false;
    this.wrapS = 1000;
    this.wrapT = 1000;
  }
  dispose() {}
}

const mockTHREE = {
  MeshPhysicalMaterial: MockMaterial,
  MeshStandardMaterial: MockMaterial,
  AmbientLight: MockLight,
  DirectionalLight: MockLight,
  PointLight: MockLight,
  CanvasTexture: MockCanvasTexture,
  ClampToEdgeWrapping: 1000,
  DoubleSide: 2,
};

test('SUBSTRATES dictionary defines all 5 prepress packaging substrates with physical properties', () => {
  const expectedSubstrates = ['matte_paperboard', 'gloss_paperboard', 'white_plastic', 'clear_plastic', 'aluminum'];
  for (const id of expectedSubstrates) {
    const sub = SUBSTRATES[id];
    assert.ok(sub, `Substrate ${id} must be defined`);
    assert.ok(typeof sub.label === 'string');
    assert.ok(typeof sub.roughness === 'number');
    assert.ok(typeof sub.metalness === 'number');
  }

  // Clear plastic should be transparent with transmission
  assert.equal(SUBSTRATES.clear_plastic.transparent, true);
  assert.ok(SUBSTRATES.clear_plastic.transmission > 0.8);

  // Aluminum should have high metalness
  assert.ok(SUBSTRATES.aluminum.metalness > 0.9);
});

test('FINISHES dictionary defines spot UV, gold foil, silver foil, and emboss preview with disclaimer notes', () => {
  const expectedFinishes = ['none', 'spot_uv', 'gold_foil', 'silver_foil', 'emboss_preview'];
  for (const id of expectedFinishes) {
    const fin = FINISHES[id];
    assert.ok(fin, `Finish ${id} must be defined`);
    assert.ok(typeof fin.label === 'string');
    if (id !== 'none') {
      assert.ok(fin.disclaimer.includes('Visual finish approximation'), `Finish ${id} must include honest disclaimer`);
    }
  }

  assert.equal(FINISHES.spot_uv.clearcoat, 1.0);
  assert.ok(FINISHES.gold_foil.foilColor);
  assert.ok(FINISHES.silver_foil.foilColor);
});

test('FinishingEffectsManager sets up studio lighting presets', () => {
  const mgr = new FinishingEffectsManager(mockTHREE);
  const scene = new MockScene();

  // 1. Studio softbox
  mgr.setupLighting(scene, 'studio_softbox');
  assert.ok(mgr.lights.length >= 3, 'Softbox must have ambient, key, fill, and rim');
  assert.equal(scene.children.length, mgr.lights.length);

  // 2. Neutral daylight
  mgr.setupLighting(scene, 'neutral_daylight');
  assert.ok(mgr.lights.length >= 2, 'Daylight has ambient and sun');

  // 3. Rotating highlight
  mgr.setupLighting(scene, 'rotating_highlight');
  assert.ok(mgr.orbitLight, 'Rotating highlight includes orbiting point light');
  const initialZ = mgr.orbitLight.position.z;
  mgr.updateLightAnimation(0.5);
  assert.notEqual(mgr.orbitLight.position.z, initialZ, 'Light animation updates orbit position');
});

test('FinishingEffectsManager applies substrates and finishes to mesh material', () => {
  const mgr = new FinishingEffectsManager(mockTHREE);
  const mesh = new MockMesh(new MockMaterial({ map: { id: 'artwork_tex' } }));

  // Set Matte Paperboard
  mgr.activeSubstrate = 'matte_paperboard';
  mgr.activeFinish = 'none';
  mgr.applyFinishingToMesh(mesh);

  assert.equal(mesh.material.roughness, SUBSTRATES.matte_paperboard.roughness);
  assert.equal(mesh.material.metalness, SUBSTRATES.matte_paperboard.metalness);

  // Set Spot UV
  mgr.activeFinish = 'spot_uv';
  mgr.spotUvIntensity = 0.8;
  mgr.applyFinishingToMesh(mesh);
  assert.equal(mesh.material.clearcoat, 0.8);
  assert.equal(mesh.material.clearcoatRoughness, 0.04);

  // Set Gold Foil
  mgr.activeFinish = 'gold_foil';
  mgr.applyFinishingToMesh(mesh);
  assert.equal(mesh.material.metalness, 0.96);
  assert.equal(mesh.material.roughness, 0.18);
});
