import test from 'node:test';
import assert from 'node:assert/strict';
import { Scan3DTwin, GEOMETRY_AUTHORITIES } from '../public/scan-3d-twin.js';

test('1. Progressive 3D Twin registers captured faces while keeping unseen faces blank', () => {
  // Mock container
  const container = { innerHTML: '' };
  const twin = new Scan3DTwin(container);

  assert.equal(twin.faceTextures.front, null);
  assert.equal(twin.faceTextures.back, null);
  assert.equal(twin.geometryAuthority, GEOMETRY_AUTHORITIES.ILLUSTRATIVE_SHELL);

  // Capture front
  twin.updateFaceTexture('front', '/samples/campus/front.png');
  assert.equal(twin.faceTextures.front, '/samples/campus/front.png');
  assert.equal(twin.faceTextures.back, null); // Unscanned back remains null!

  // Front artwork does NOT clone onto uncaptured back panel
  assert.notEqual(twin.faceTextures.back, twin.faceTextures.front);
  assert.match(container.innerHTML, /1 of 6 faces textured/i);
});

test('2. Calibrated scale upgrades geometry authority to Reference-Scaled', () => {
  const container = { innerHTML: '' };
  const twin = new Scan3DTwin(container);

  assert.equal(twin.geometryAuthority, GEOMETRY_AUTHORITIES.ILLUSTRATIVE_SHELL);

  twin.updateScale({ valid: true, pxPerMm: 10 });
  assert.equal(twin.geometryAuthority, GEOMETRY_AUTHORITIES.REFERENCE_SCALED);
  assert.match(container.innerHTML, /Reference-Scaled Twin/i);

  twin.updateScale({ valid: false });
  assert.equal(twin.geometryAuthority, GEOMETRY_AUTHORITIES.ILLUSTRATIVE_SHELL);
});
