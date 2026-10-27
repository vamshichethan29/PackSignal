import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PACKAGE_TYPES,
  PACKAGE_MODELS,
  getPackageModel,
  getAllPackageTypes,
  validatePackageModelSchema,
} from '../public/package-model-registry.js';

test('1. Package model registry loads all four package types', () => {
  const types = getAllPackageTypes();
  assert.equal(types.length, 4);
  assert.ok(types.includes('CARTON'));
  assert.ok(types.includes('CAN'));
  assert.ok(types.includes('BOTTLE'));
  assert.ok(types.includes('POUCH'));
});

test('2. Each registered model exposes the exact Upgrade #48 Phase 1 schema', () => {
  const expectedKeys = [
    'packageType',
    'geometry',
    'dimensions',
    'surfaceRegions',
    'uvMapping',
    'materialSlots',
    'artworkMapping',
    'mappingAuthority',
    'cameraTargets',
    'findingAnchors',
  ];

  for (const type of getAllPackageTypes()) {
    const model = getPackageModel(type);
    assert.ok(model, `Model ${type} must exist`);

    const schemaValidation = validatePackageModelSchema(model);
    assert.equal(
      schemaValidation.valid,
      true,
      `Model ${type} failed schema validation: ${schemaValidation.missing?.join(', ')}`
    );

    for (const key of expectedKeys) {
      assert.ok(key in model, `Model ${type} must have key "${key}"`);
    }
  }
});

test('3. Folding carton model exposes 6 planar faces and verified structural dimensions', () => {
  const carton = getPackageModel('CARTON');
  assert.equal(carton.packageType, 'CARTON');
  assert.equal(carton.geometry.type, 'RECTANGULAR_FOLDING_BOX');
  assert.equal(carton.geometry.faceCount, 6);
  assert.deepEqual(carton.uvMapping.faces, ['front', 'back', 'left', 'right', 'top', 'bottom']);
  assert.ok(carton.dimensions.width > 0);
  assert.ok(carton.dimensions.height > 0);
  assert.ok(carton.dimensions.depth > 0);
  assert.ok(carton.materialSlots[0].supportedPresets.includes('SBS_WHITE_CARD'));
  assert.ok(carton.materialSlots[0].supportedPresets.includes('KRAFT_PAPER'));
});

test('4. Aluminium can model exposes cylindrical printable wall, lid, chime, and base', () => {
  const can = getPackageModel('CAN');
  assert.equal(can.packageType, 'CAN');
  assert.equal(can.geometry.type, 'CYLINDER_CAN');
  assert.ok(can.dimensions.radius > 0);
  assert.ok(can.dimensions.height > 0);
  assert.ok(can.dimensions.printableWrapWidth > 0);
  // Printable wrap circumference = 2 * PI * r
  const expectedCirc = 2 * Math.PI * can.dimensions.radius;
  assert.ok(Math.abs(can.dimensions.printableWrapWidth - expectedCirc) < 0.1);

  const regionIds = can.surfaceRegions.map(r => r.id);
  assert.ok(regionIds.includes('body'));
  assert.ok(regionIds.includes('chime'));
  assert.ok(regionIds.includes('lid'));
  assert.ok(regionIds.includes('base'));
  assert.equal(can.materialSlots[0].defaultMaterial, 'ALUMINIUM');
});

test('5. Glass bottle model separates label cylinder from transparent glass container body', () => {
  const bottle = getPackageModel('BOTTLE');
  assert.equal(bottle.packageType, 'BOTTLE');
  assert.equal(bottle.geometry.type, 'LATHED_BOTTLE');
  assert.ok(bottle.dimensions.radius > 0);
  assert.ok(bottle.dimensions.height > 0);
  assert.ok(bottle.geometry.labelRadiusOffset > 0, 'Label radius offset prevents z-fighting');

  const regionIds = bottle.surfaceRegions.map(r => r.id);
  assert.ok(regionIds.includes('body'));
  assert.ok(regionIds.includes('label_wrap'));
  assert.equal(bottle.materialSlots[0].defaultMaterial, 'GLASS');
  assert.equal(bottle.materialSlots[1].defaultMaterial, 'SBS_WHITE_CARD');
});

test('6. Stand-up pouch model contains front, back, bottom gusset, and seal flanges', () => {
  const pouch = getPackageModel('POUCH');
  assert.equal(pouch.packageType, 'POUCH');
  assert.equal(pouch.geometry.type, 'CURVED_PILLOW_POUCH');
  assert.ok(pouch.dimensions.width > 0);
  assert.ok(pouch.dimensions.height > 0);
  assert.ok(pouch.dimensions.depth > 0);
  assert.ok(pouch.geometry.sealBorderMm > 0);
  assert.ok(pouch.geometry.gussetDepth > 0);

  const regionIds = pouch.surfaceRegions.map(r => r.id);
  assert.ok(regionIds.includes('front'));
  assert.ok(regionIds.includes('back'));
  assert.ok(regionIds.includes('bottom_gusset'));
  assert.equal(pouch.materialSlots[0].defaultMaterial, 'FOIL_LAMINATE');
});


test('7. Camera targets provide front, back, left, right, top views for all models', () => {
  for (const type of getAllPackageTypes()) {
    const model = getPackageModel(type);
    assert.ok(model.cameraTargets.front, `${type} missing front camera target`);
    assert.ok(model.cameraTargets.back, `${type} missing back camera target`);
    assert.ok(model.cameraTargets.left, `${type} missing left camera target`);
    assert.ok(model.cameraTargets.right, `${type} missing right camera target`);
    assert.ok(model.cameraTargets.top, `${type} missing top camera target`);
    assert.ok(model.cameraTargets.reset || model.cameraTargets.default, `${type} missing reset/default camera target`);
  }
});

