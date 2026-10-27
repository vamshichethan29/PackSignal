import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calibratePhysicalScale,
  checkFinancialCardPrivacyRisk,
  ID1_CARD_NOMINAL_MM,
} from '../lib/scan/scale-calibration.mjs';

test('1. Valid ID-1 reference target computes accurate px/mm scale', () => {
  // Card dimensions: 856 px x 540 px (aspect ratio 1.585)
  const cardBox = { x: 100, y: 100, width: 856, height: 540 };
  const scale = calibratePhysicalScale(cardBox, { frameWidth: 2400, frameHeight: 3200 });

  assert.equal(scale.valid, true);
  assert.equal(scale.authority, 'REFERENCE_SCALED_APPROXIMATE_TWIN');
  assert.equal(scale.targetType, 'ID_1_CALIBRATION_CARD');
  assert.equal(scale.detectedBox.observedAspectRatio, 1.585);
  assert.ok(Math.abs(scale.pxPerMm - 10.0) < 0.05);
  assert.equal(scale.mmPerPx, 0.1);
  assert.equal(scale.coplanarVerified, true);
});

test('2. Rejects calibration when card is held too close to lens (non-coplanar depth violation)', () => {
  // Card covering 60% of image frame
  const cardBox = { x: 50, y: 50, width: 1200, height: 800 };
  const scale = calibratePhysicalScale(cardBox, { frameWidth: 1280, frameHeight: 960 });

  assert.equal(scale.valid, false);
  assert.equal(scale.authority, 'UNKNOWN_GEOMETRY');
  assert.match(scale.error, /too close to the lens and is not coplanar/i);
});

test('3. Rejects calibration when card aspect ratio deviates excessively from ID-1 standard', () => {
  // Steep perspective tilt: width 400, height 500 (aspect ratio 0.8)
  const cardBox = { x: 50, y: 50, width: 400, height: 500 };
  const scale = calibratePhysicalScale(cardBox, { frameWidth: 2000, frameHeight: 2000 });

  assert.equal(scale.valid, false);
  assert.equal(scale.authority, 'UNKNOWN_GEOMETRY');
  assert.match(scale.error, /deviates excessively/i);
});

test('4. Financial privacy scanner warns against real payment cards (PAN / CVV)', () => {
  const unsafeText = '4532 0123 4567 8910 CVV 892 EXP 12/28 CARDHOLDER NAME';
  const risk = checkFinancialCardPrivacyRisk(unsafeText);
  assert.equal(risk.privacyRisk, true);
  assert.equal(risk.severity, 'WARNING');
  assert.match(risk.message, /Privacy Warning: Financial payment card detected/i);

  const cleanText = 'PACKSIGNAL CALIBRATION TARGET 85.6 X 54 MM';
  const clean = checkFinancialCardPrivacyRisk(cleanText);
  assert.equal(clean.privacyRisk, false);
  assert.equal(clean.severity, 'CLEAN');
});
