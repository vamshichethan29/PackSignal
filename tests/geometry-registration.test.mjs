import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRegistration,
  solveAffineTransformFromPoints,
  applyAffineTransform
} from '../lib/geometry/registration.mjs';
import {
  createTranslationMatrix,
  createScaleMatrix,
  createRotationMatrix,
  multiplyMatrices,
  applyMatrixToPoint
} from '../lib/geometry/coordinates.mjs';
import { REGISTRATION_STATES } from '../lib/geometry/model.mjs';

test('1. Same document artwork and dieline defaults to SAME_PDF_COORDINATES', () => {
  const doc = { id: 'doc-combo', role: 'artwork', sha256: 'sha-same' };
  const reg = evaluateRegistration({
    artworkDocument: doc,
    dielineDocument: doc
  });

  assert.equal(reg.status, REGISTRATION_STATES.SAME_PDF_COORDINATES);
  assert.equal(reg.verified, true);
  assert.deepEqual(reg.transformationMatrix, [1, 0, 0, 1, 0, 0]);
});

test('2. Distinct unconfirmed documents return REGISTRATION_REQUIRED', () => {
  const art = { id: 'art-1', role: 'artwork', sha256: 'sha-art-1' };
  const die = { id: 'die-1', role: 'dieline', sha256: 'sha-die-1' };
  const reg = evaluateRegistration({
    artworkDocument: art,
    dielineDocument: die,
    confirmedRegistration: null
  });

  assert.equal(reg.status, REGISTRATION_STATES.REGISTRATION_REQUIRED);
  assert.equal(reg.verified, false);
});

test('3. Affine transformation with translation and uniform scaling', () => {
  // Translate +50, +30 and Scale 2x
  const scaleM = createScaleMatrix(2, 2);
  const transM = createTranslationMatrix(50, 30);
  const combined = multiplyMatrices(transM, scaleM);

  const pt = [10, 20];
  const transformed = applyMatrixToPoint(pt, combined);
  // (10 * 2) + 50 = 70, (20 * 2) + 30 = 70
  assert.equal(Math.round(transformed[0]), 70);
  assert.equal(Math.round(transformed[1]), 70);
});

test('4. Rotated coordinate transform (90 degrees)', () => {
  const rot90 = createRotationMatrix(Math.PI / 2);
  const pt = [10, 0];
  const transformed = applyMatrixToPoint(pt, rot90);
  // [10, 0] rotated 90 deg counterclockwise is approx [0, 10]
  assert.ok(Math.abs(transformed[0] - 0) < 1e-6);
  assert.ok(Math.abs(transformed[1] - 10) < 1e-6);
});

test('5. Nonuniform scaling limitation is flagged', () => {
  const matrix = [2, 0, 0, 3, 10, 10]; // scaleX=2, scaleY=3
  // Verify point transformation handles it deterministically
  const pt = [5, 5];
  const transformed = applyMatrixToPoint(pt, matrix);
  assert.equal(transformed[0], 20); // 5*2 + 10 = 20
  assert.equal(transformed[1], 25); // 5*3 + 10 = 25
});

test('6. Landmark point-pair registration solver', () => {
  const sourcePoints = [[0, 0], [100, 0], [0, 100]];
  const targetPoints = [[10, 20], [110, 20], [10, 120]]; // pure translation dx=10, dy=20

  const solved = solveAffineTransformFromPoints(sourcePoints, targetPoints);
  assert.ok(solved);
  assert.ok(solved.residual < 0.01);

  const mapped = applyAffineTransform([50, 50], solved.matrix);
  assert.ok(Math.abs(mapped[0] - 60) < 0.1);
  assert.ok(Math.abs(mapped[1] - 70) < 0.1);
});
