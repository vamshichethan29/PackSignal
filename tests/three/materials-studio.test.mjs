import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUBSTRATES,
  FINISHES,
  FinishingEffectsManager,
} from '../../public/three/materials/finishes.js';
import {
  validateMaskBox,
  validatePolygon,
  MASK_PROVENANCE,
} from '../../public/three/materials/finish-mask.js';
import {
  FOIL_PRESETS,
  configureFoilMaterial,
} from '../../public/three/materials/metallic-foil.js';
import {
  SPOT_UV_DEFAULTS,
  configureSpotUvMaterial,
} from '../../public/three/materials/spot-uv.js';
import {
  RELIEF_PRESETS,
  configureReliefMaterial,
} from '../../public/three/materials/relief-effects.js';

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
  MeshBasicMaterial: MockMaterial,
  AmbientLight: MockLight,
  DirectionalLight: MockLight,
  PointLight: MockLight,
  CanvasTexture: MockCanvasTexture,
  ClampToEdgeWrapping: 1000,
  DoubleSide: 2,
};

test('validateMaskBox clamps coordinates within normalized [0, 1] range', () => {
  const box1 = validateMaskBox([-0.5, 0.1, 1.5, 0.8]);
  assert.deepEqual(box1, [0, 0.1, 1, 0.8]);

  const box2 = validateMaskBox([0.8, 0.9, 0.2, 0.3]);
  assert.deepEqual(box2, [0.2, 0.3, 0.8, 0.9]);

  const fallback = validateMaskBox(null);
  assert.equal(fallback.length, 4);
});

test('validatePolygon rejects malformed inputs and clamps points', () => {
  assert.equal(validatePolygon(null), null);
  assert.equal(validatePolygon([[0.1, 0.1]]), null); // < 3 points
  assert.equal(validatePolygon([[0.1, 0.1], [0.2, 0.2]]), null); // < 3 points

  const poly = validatePolygon([
    [-0.2, 0.1],
    [0.5, 1.2],
    [0.9, 0.4],
  ]);
  assert.ok(poly);
  assert.equal(poly.length, 3);
  assert.deepEqual(poly[0], [0, 0.1]);
  assert.deepEqual(poly[1], [0.5, 1]);
});

test('Spot UV material maintains zero metalness and high specular clearcoat', () => {
  const mat = new MockMaterial();
  const maskTex = new MockCanvasTexture({});

  configureSpotUvMaterial(mat, maskTex, 0.95);
  assert.equal(mat.metalness, 0.0, 'Spot UV varnish must be non-metallic');
  assert.equal(mat.clearcoat, 0.95);
  assert.equal(mat.clearcoatRoughness, SPOT_UV_DEFAULTS.clearcoatRoughness);
  assert.equal(mat.clearcoatMap, maskTex);
});

test('Metallic foil presets configure high metalness and low roughness', () => {
  const goldMat = new MockMaterial();
  configureFoilMaterial(goldMat, 'gold_foil', null);
  assert.equal(goldMat.metalness, FOIL_PRESETS.gold_foil.metalness);
  assert.equal(goldMat.roughness, FOIL_PRESETS.gold_foil.roughness);

  const silverMat = new MockMaterial();
  configureFoilMaterial(silverMat, 'silver_foil', null);
  assert.equal(silverMat.metalness, FOIL_PRESETS.silver_foil.metalness);
  assert.equal(silverMat.roughness, FOIL_PRESETS.silver_foil.roughness);
});

test('Relief effects support positive scale for emboss and negative scale for deboss', () => {
  const embossMat = new MockMaterial();
  configureReliefMaterial(embossMat, { id: 'height_tex' }, 'emboss_preview');
  assert.equal(embossMat.bumpScale, 1.2, 'Embossing must have positive bumpScale');

  const debossMat = new MockMaterial();
  configureReliefMaterial(debossMat, { id: 'height_tex' }, 'deboss_preview');
  assert.equal(debossMat.bumpScale, -1.2, 'Debossing must have negative bumpScale');
});

test('FinishingEffectsManager toggleOriginal switches between original and finished rendering', () => {
  const mgr = new FinishingEffectsManager(mockTHREE);
  const mesh = new MockMesh(new MockMaterial({ map: { id: 'art_map' } }));

  mgr.activeSubstrate = 'matte_paperboard';
  mgr.activeFinish = 'spot_uv';

  // Normal finished render
  mgr.showOriginalOnly = false;
  mgr.applyFinishingToMesh(mesh);
  assert.equal(mesh.material.clearcoat, 1.0);

  // Toggle original comparison
  mgr.toggleOriginal(true);
  mgr.applyFinishingToMesh(mesh);
  assert.equal(mesh.material.clearcoat, 0.0, 'Original comparison must disable clearcoat finish');

  // Toggle back
  mgr.toggleOriginal(false);
  mgr.applyFinishingToMesh(mesh);
  assert.equal(mesh.material.clearcoat, 1.0);
});

test('FinishingEffectsManager toggleMaskOverlay shows high-contrast mask', () => {
  const mgr = new FinishingEffectsManager(mockTHREE);
  const mesh = new MockMesh(new MockMaterial({ map: { id: 'art_map' } }));

  mgr.maskTexture = new MockCanvasTexture({});
  mgr.toggleMaskOverlay(true);
  const mat = mgr.applyFinishingToMesh(mesh);

  assert.equal(mat instanceof mockTHREE.MeshBasicMaterial, true);
  assert.equal(mat.map, mgr.maskTexture);
});

test('FinishingEffectsManager manages serializable finish layers', () => {
  const mgr = new FinishingEffectsManager(mockTHREE);

  const layer1 = mgr.addFinishLayer({
    id: 'fin-001',
    type: 'spot_uv',
    surfaceId: 'front',
    provenance: MASK_PROVENANCE.REVIEWER_DEFINED,
  });

  assert.equal(mgr.getFinishStack().length, 1);
  assert.equal(mgr.getFinishStack()[0].id, 'fin-001');

  mgr.toggleFinishLayer('fin-001', false);
  assert.equal(mgr.getFinishStack()[0].enabled, false);

  mgr.removeFinishLayer('fin-001');
  assert.equal(mgr.getFinishStack().length, 0);
});

test('FinishingEffectsManager light sweep controls and animation', () => {
  const mgr = new FinishingEffectsManager(mockTHREE);
  const scene = new MockScene();

  mgr.setupLighting(scene, 'rotating_highlight');
  assert.ok(mgr.orbitLight);

  mgr.startLightSweep();
  assert.equal(mgr.lightSweepActive, true);

  const initialAngle = mgr.orbitAngle;
  mgr.updateLightAnimation(0.1);
  assert.ok(mgr.orbitAngle > initialAngle);

  mgr.pauseLightSweep();
  assert.equal(mgr.lightSweepActive, false);

  mgr.resetLightSweep();
  assert.equal(mgr.orbitAngle, 0);
});

test('FINISHES dictionary disclaimers warn of visual approximation', () => {
  const finishes = ['spot_uv', 'gold_foil', 'silver_foil', 'emboss_preview', 'deboss_preview'];
  for (const f of finishes) {
    const fin = FINISHES[f];
    assert.ok(fin, `Finish ${f} must exist`);
    assert.ok(fin.disclaimer.includes('Visual finish approximation'));
  }
});
