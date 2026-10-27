import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateVisualAngle,
  calculateRequiredHeightMmForArcMin,
  nominalPtToEstimatedMm,
  DISTANCE_BOUNDS_CM,
  DISTANCE_PRESETS_CM
} from '../lib/readability/visual-angle.mjs';

test('1. Slider distance boundary constants: min 30 cm, max 200 cm, default 100 cm', () => {
  assert.equal(DISTANCE_BOUNDS_CM.MIN, 30.0);
  assert.equal(DISTANCE_BOUNDS_CM.MAX, 200.0);
  assert.equal(DISTANCE_BOUNDS_CM.DEFAULT, 100.0);
  assert.equal(DISTANCE_BOUNDS_CM.STEP, 10.0);
  assert.equal(DISTANCE_BOUNDS_CM.FINE_STEP, 1.0);
});

test('2. Presets include standard retail viewing positions from 30 cm to 2 m', () => {
  assert.ok(DISTANCE_PRESETS_CM.length >= 8);
  assert.equal(DISTANCE_PRESETS_CM[0].cm, 30);
  assert.equal(DISTANCE_PRESETS_CM[DISTANCE_PRESETS_CM.length - 1].cm, 200);
});

test('3. Angular size decreases monotonically with viewing distance', () => {
  const hMm = 2.1; // 2.1 mm lowercase letter
  const res30cm = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 30 });
  const res50cm = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 50 });
  const res100cm = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 100 });
  const res200cm = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 200 });

  assert.ok(res30cm.angularHeightArcMin > res50cm.angularHeightArcMin);
  assert.ok(res50cm.angularHeightArcMin > res100cm.angularHeightArcMin);
  assert.ok(res100cm.angularHeightArcMin > res200cm.angularHeightArcMin);
});

test('4. Same glyph at twice the distance has approximately half the small-angle size', () => {
  const hMm = 3.0;
  const res100 = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 100 }); // 1000 mm
  const res200 = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 200 }); // 2000 mm

  // At 1000 mm: angle ≈ 3 / 1000 rad ≈ 10.313 arcmin
  // At 2000 mm: angle ≈ 3 / 2000 rad ≈ 5.156 arcmin
  const ratio = res100.angularHeightArcMin / res200.angularHeightArcMin;
  assert.ok(Math.abs(ratio - 2.0) < 0.01, `Expected ratio ~2.0, got ${ratio}`);
});

test('5. Physical glyph height remains completely unchanged when distance changes', () => {
  const hMm = 4.7625; // 3/16 inch
  const at30 = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 30 });
  const at100 = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 100 });
  const at200 = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 200 });

  assert.equal(at30.physicalHeightMm, at100.physicalHeightMm);
  assert.equal(at100.physicalHeightMm, at200.physicalHeightMm);
  assert.equal(at30.physicalHeightMm, 4.763);
});

test('6. Correct unit conversions across millimeters, centimeters, meters, and arcminutes', () => {
  const res = calculateVisualAngle({ physicalHeightMm: 5.0, distanceCm: 100 });
  assert.equal(res.distanceMm, 1000);
  assert.equal(res.distanceCm, 100);
  assert.equal(res.distanceMeters, 1.0);
  assert.ok(res.angularHeightArcMin > 0);
  assert.ok(res.angularHeightDeg > 0);
  assert.equal(Math.round(res.angularHeightArcMin), Math.round(res.angularHeightDeg * 60));
});

test('7. Nominal font point size is distinguished from actual printed glyph height', () => {
  // Nominal 10 pt font: em-box is 3.528 mm, but lowercase "o" is ~1.76 mm, cap is ~2.47 mm
  const emMm = nominalPtToEstimatedMm(10, 'em_box');
  const capMm = nominalPtToEstimatedMm(10, 'capital');
  const xHeightMm = nominalPtToEstimatedMm(10, 'lowercase_o');

  assert.ok(emMm > capMm);
  assert.ok(capMm > xHeightMm);
  assert.equal(Math.round(emMm * 10) / 10, 3.5);
  assert.equal(Math.round(capMm * 10) / 10, 2.5);
  assert.equal(Math.round(xHeightMm * 10) / 10, 1.8);
});

test('8. Oblique surface normal angle reduces effective projected letter height by cos(phi)', () => {
  const hMm = 4.0;
  const perp = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 100, viewingAngleDeg: 0 });
  const slant60 = calculateVisualAngle({ physicalHeightMm: hMm, distanceCm: 100, viewingAngleDeg: 60 });

  // cos(60°) = 0.5, effective height should be half
  assert.equal(slant60.effectiveHeightMm, 2.0);
  assert.ok(Math.abs((perp.angularHeightArcMin / slant60.angularHeightArcMin) - 2.0) < 0.05);
});

test('9. Invalid or zero height returns INSUFFICIENT_DATA without crashing or dividing by zero', () => {
  const resZero = calculateVisualAngle({ physicalHeightMm: 0, distanceCm: 100 });
  const resNull = calculateVisualAngle({ physicalHeightMm: null, distanceCm: 100 });
  assert.equal(resZero.status, 'INSUFFICIENT_DATA');
  assert.equal(resNull.status, 'INSUFFICIENT_DATA');
});

test('10. Reverse solver calculates required physical mm for target shelf arcminutes', () => {
  // At 1 meter (100 cm), for a target of 10.0 arcminutes:
  // h = 2 * 1000 * tan((10/60 * PI / 180) / 2) ≈ 2.909 mm
  const reqMm = calculateRequiredHeightMmForArcMin(10.0, 100);
  assert.ok(reqMm > 2.85 && reqMm < 2.95);

  // Verifying forward calculation matches reverse calculation
  const verify = calculateVisualAngle({ physicalHeightMm: reqMm, distanceCm: 100 });
  assert.equal(Math.round(verify.angularHeightArcMin * 10) / 10, 10.0);
});
