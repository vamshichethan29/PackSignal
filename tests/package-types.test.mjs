import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PACKAGE_TYPES,
  PACKAGE_TYPE_ALIASES,
  GEOMETRY_STATUS,
  FINISH_MASK_MODES,
  normalizePackageType,
  getPackageTypeMetadata,
} from '../public/packaging-3d/package-types.js';

test('Package Types: Normalizes all 4 supported packaging types and common aliases', () => {
  assert.equal(normalizePackageType('carton'), 'carton');
  assert.equal(normalizePackageType('folding_carton'), 'carton');
  assert.equal(normalizePackageType('cereal_box'), 'carton');

  assert.equal(normalizePackageType('can'), 'can');
  assert.equal(normalizePackageType('soda_can'), 'can');
  assert.equal(normalizePackageType('beverage can'), 'can');
  assert.equal(normalizePackageType('aluminium_can'), 'can');

  assert.equal(normalizePackageType('bottle'), 'bottle');
  assert.equal(normalizePackageType('glass bottle'), 'bottle');
  assert.equal(normalizePackageType('bottle_label'), 'bottle');

  assert.equal(normalizePackageType('pouch'), 'pouch');
  assert.equal(normalizePackageType('standup_pouch'), 'pouch');
  assert.equal(normalizePackageType('foil-pouch'), 'pouch');
});

test('Package Types: Provides correct metadata and physical capability flags', () => {
  const cartonMeta = getPackageTypeMetadata('carton');
  assert.equal(cartonMeta.canonicalName, 'Folding Carton');
  assert.equal(cartonMeta.supportsFolding, true);
  assert.equal(cartonMeta.supportsGusset, false);

  const canMeta = getPackageTypeMetadata('can');
  assert.equal(canMeta.canonicalName, 'Aluminium Soda Can');
  assert.equal(canMeta.substrateCategory, 'METAL');
  assert.equal(canMeta.supportsWrap, true);

  const bottleMeta = getPackageTypeMetadata('bottle');
  assert.equal(bottleMeta.canonicalName, 'Glass Bottle');
  assert.equal(bottleMeta.substrateCategory, 'GLASS');
  assert.equal(bottleMeta.defaultMaterial, 'CLEAR_GLASS');

  const pouchMeta = getPackageTypeMetadata('pouch');
  assert.equal(pouchMeta.canonicalName, 'Stand-Up Foil Pouch');
  assert.equal(pouchMeta.supportsGusset, true);
  assert.equal(pouchMeta.substrateCategory, 'FLEXIBLE_FILM');
});

test('Package Types: Canonical geometry statuses distinguish source-derived from illustrative', () => {
  assert.equal(GEOMETRY_STATUS.SOURCE_DERIVED, 'SOURCE_DERIVED');
  assert.equal(GEOMETRY_STATUS.PARAMETRIC_ILLUSTRATION, 'PARAMETRIC_ILLUSTRATION');
  assert.equal(FINISH_MASK_MODES.SOURCE_VERIFIED, 'SOURCE_VERIFIED');
  assert.equal(FINISH_MASK_MODES.ILLUSTRATIVE_PREVIEW, 'ILLUSTRATIVE_PREVIEW');
});
