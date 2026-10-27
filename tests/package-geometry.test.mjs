import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPackageGeometry,
  DIMENSION_UNITS,
} from '../public/packaging-3d/package-geometry.js';
import { GEOMETRY_STATUS } from '../public/packaging-3d/package-types.js';

test('1. Existing carton loads with 6 planar faces', () => {
  const carton = createPackageGeometry({ packageType: 'carton' });
  assert.equal(carton.packageType, 'carton');
  assert.deepEqual(carton.faces, ['front', 'back', 'left', 'right', 'top', 'bottom']);
  assert.ok(carton.dimensions.width > 0);
  assert.ok(carton.dimensions.height > 0);
  assert.ok(carton.dimensions.depth > 0);
});

test('3. Can geometry produces curved surfaces, rim, lid, tab, and base dome', () => {
  const can = createPackageGeometry({ packageType: 'can' });
  assert.equal(can.packageType, 'can');
  assert.ok(can.dimensions.radius > 0);
  assert.ok(can.dimensions.height > 0);
  assert.ok(can.dimensions.printableWrapWidth > 0);

  const surfaceIds = can.surfaces.map(s => s.id);
  assert.ok(surfaceIds.includes('body'));
  assert.ok(surfaceIds.includes('lid'));
  assert.ok(surfaceIds.includes('chime'));
  assert.ok(surfaceIds.includes('base'));
  assert.equal(can.surfaces[0].type, 'CYLINDRICAL_SURFACE');
});

test('4. Bottle geometry produces recognizable profile with neck, shoulder, and label wrap', () => {
  const bottle = createPackageGeometry({ packageType: 'bottle' });
  assert.equal(bottle.packageType, 'bottle');
  assert.ok(bottle.dimensions.radius > 0);
  assert.ok(bottle.dimensions.neckRadius > 0);
  assert.ok(bottle.dimensions.shoulderHeight > 0);

  const surfaceIds = bottle.surfaces.map(s => s.id);
  assert.ok(surfaceIds.includes('body'));
  assert.ok(surfaceIds.includes('label_wrap'));
  assert.ok(surfaceIds.includes('neck'));
  assert.ok(surfaceIds.includes('cap'));
});

test('5. Pouch geometry contains front/back surfaces, side seals, and bottom gusset', () => {
  const pouch = createPackageGeometry({ packageType: 'pouch' });
  assert.equal(pouch.packageType, 'pouch');
  assert.ok(pouch.dimensions.width > 0);
  assert.ok(pouch.dimensions.height > 0);
  assert.ok(pouch.dimensions.depth > 0);

  const surfaceIds = pouch.surfaces.map(s => s.id);
  assert.ok(surfaceIds.includes('front'));
  assert.ok(surfaceIds.includes('back'));
  assert.ok(surfaceIds.includes('bottom_gusset'));
  assert.ok(surfaceIds.includes('top_seal'));
  assert.ok(surfaceIds.includes('side_seals'));
});

test('6. Real package dimensions preserved when supplied from verified source', () => {
  const customDims = { width: 145, height: 215, depth: 60 };
  const verifiedCarton = createPackageGeometry({
    packageType: 'carton',
    dimensions: customDims,
    geometryStatus: GEOMETRY_STATUS.SOURCE_DERIVED,
    geometrySource: 'dxf',
  });
  assert.equal(verifiedCarton.dimensions.width, 145);
  assert.equal(verifiedCarton.dimensions.height, 215);
  assert.equal(verifiedCarton.dimensions.depth, 60);
  assert.equal(verifiedCarton.geometryVerified, true);
  assert.equal(verifiedCarton.geometryStatus, 'SOURCE_DERIVED');
});

test('7. Unknown dimensions marked illustrative with honest disclaimer', () => {
  const illustrativeCan = createPackageGeometry({
    packageType: 'can',
    geometryStatus: GEOMETRY_STATUS.PARAMETRIC_ILLUSTRATION,
  });
  assert.equal(illustrativeCan.geometryVerified, false);
  assert.equal(illustrativeCan.geometryStatus, 'PARAMETRIC_ILLUSTRATION');
  assert.ok(illustrativeCan.limitations.some(l => l.includes('Illustrative geometry')));
});
