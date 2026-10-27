/**
 * PackSignal — Phase 6A: Shelf Angular Size Unit Tests
 * Asserts trigonometric correctness of the optical retinal projection formula,
 * unit conversions between mm/cm/arcmin, and independence of physical print height.
 *
 * (tests/shelf-angular-size.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateAngularSize,
  calculateThresholdCrossingDistanceCm
} from '../lib/shopper/shelf-readability.mjs';

test('Shelf Angular Size Optics & Math', async (t) => {
  await t.test('1. Exact formula calculates angular height accurately at 60 cm for 1.8 mm text', () => {
    // h = 1.8 mm, d = 60 cm = 600 mm
    // theta_rad = 2 * atan(1.8 / 1200) = 2 * atan(0.0015) = 2 * 0.0014999988 = 0.003 rad
    // theta_deg = 0.003 * 180 / PI = 0.171887 deg
    // theta_arcmin = 0.171887 * 60 = 10.313 arcmin
    const res = calculateAngularSize(1.8, 60.0);
    assert.equal(res.isValid, true);
    assert.ok(Math.abs(res.arcminutes - 10.31) <= 0.05, `Expected ~10.31 arcmin, got ${res.arcminutes}`);
  });

  await t.test('2. Doubling viewing distance from 50 cm to 100 cm approximately halves angular size', () => {
    const at50 = calculateAngularSize(3.0, 50.0);
    const at100 = calculateAngularSize(3.0, 100.0);

    const ratio = at50.arcminutes / at100.arcminutes;
    assert.ok(Math.abs(ratio - 2.0) <= 0.02, `Expected ratio ~2.0, got ${ratio}`);
  });

  await t.test('3. Physical printed glyph height h remains strictly invariant as distance changes', () => {
    const at30 = calculateAngularSize(2.5, 30.0);
    const at150 = calculateAngularSize(2.5, 150.0);

    assert.equal(at30.heightMm, 2.5);
    assert.equal(at150.heightMm, 2.5);
    assert.equal(at30.heightMm, at150.heightMm);
  });

  await t.test('4. Threshold crossing distance inversion accurately solves for target arcmin', () => {
    const targetArcmin = 5.0; // standard threshold
    const heightMm = 1.8;
    const crossingDistCm = calculateThresholdCrossingDistanceCm(heightMm, targetArcmin);

    // Verify back-calculation
    const angularAtCrossing = calculateAngularSize(heightMm, crossingDistCm);
    assert.ok(Math.abs(angularAtCrossing.arcminutes - targetArcmin) <= 0.05);
  });

  await t.test('5. Zero or negative height/distance returns invalid without throw or division by zero', () => {
    const resZeroH = calculateAngularSize(0, 60);
    const resZeroD = calculateAngularSize(2.0, 0);
    const resNeg = calculateAngularSize(-1.0, 50);

    assert.equal(resZeroH.isValid, false);
    assert.equal(resZeroD.isValid, false);
    assert.equal(resNeg.isValid, false);
  });
});
