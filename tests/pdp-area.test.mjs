import test from 'node:test';
import assert from 'node:assert/strict';

import { calculatePdpArea, PACKAGE_TYPES, PDP_SOURCE_AUTHORITY } from '../lib/print/pdp-area.mjs';

test('1. Rectangular carton PDP area: Height × Width (21 CFR 101.1)', () => {
  // Carton: 8.0 in height × 4.0 in width = 32.0 sq in
  const res = calculatePdpArea({
    packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
    dimensions: { heightInches: 8.0, widthInches: 4.0 },
    sourceAuthority: PDP_SOURCE_AUTHORITY.APPROVED_DIELINE,
  });

  assert.equal(res.status, 'PDP_AREA_VERIFIED');
  assert.equal(res.isVerified, true);
  assert.equal(res.pdpAreaSqIn, 32.0);
  assert.equal(res.calculationMethod, 'RECTANGULAR_H_X_W');
  assert.ok(res.calculationProof.includes('32.00 sq in'));
});

test('2. Cylindrical beverage can PDP area: 40% of Height × Circumference (21 CFR 101.1)', () => {
  // Can: 4.8 in height × 2.6 in diameter
  // Circumference = pi * 2.6 = 8.1681 in
  // Area = 0.40 * 4.8 * 8.1681 = 15.68 sq in
  const res = calculatePdpArea({
    packageType: PACKAGE_TYPES.CYLINDRICAL_CAN,
    dimensions: { heightInches: 4.8, diameterInches: 2.6 },
    sourceAuthority: PDP_SOURCE_AUTHORITY.VERIFIED_SPEC,
  });

  assert.equal(res.status, 'PDP_AREA_VERIFIED');
  assert.equal(res.isVerified, true);
  assert.ok(Math.abs(res.pdpAreaSqIn - 15.68) < 0.1, `Expected ~15.68, got ${res.pdpAreaSqIn}`);
  assert.equal(res.calculationMethod, 'CYLINDRICAL_40_PERCENT_H_X_CIRCUMFERENCE');
  assert.ok(res.calculationProof.includes('40% × Height'));
});

test('3. Metric dimensions in millimeters convert cleanly to inches and square inches', () => {
  // Height = 203.2 mm (8.0 in), Width = 101.6 mm (4.0 in)
  const res = calculatePdpArea({
    packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
    dimensions: { heightMm: 203.2, widthMm: 101.6 },
    sourceAuthority: PDP_SOURCE_AUTHORITY.REVIEWER_CONFIRMED,
  });

  assert.equal(res.status, 'PDP_AREA_VERIFIED');
  assert.equal(res.dimensions.heightInches, 8.0);
  assert.equal(res.dimensions.widthInches, 4.0);
  assert.equal(res.pdpAreaSqIn, 32.0);
});

test('4. Missing dimensions return PDP_AREA_UNVERIFIED without fabricating numbers', () => {
  const res = calculatePdpArea({
    packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
    dimensions: {},
    sourceAuthority: PDP_SOURCE_AUTHORITY.UNAVAILABLE,
  });

  assert.equal(res.status, 'PDP_AREA_UNVERIFIED');
  assert.equal(res.isVerified, false);
  assert.equal(res.pdpAreaSqIn, null);
  assert.ok(res.explanation.includes('requires confirmed physical height'));
});

test('5. Illustrative 3D geometry is marked as uncertified for legal compliance determinations', () => {
  const res = calculatePdpArea({
    packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
    dimensions: { heightInches: 6.0, widthInches: 3.0 },
    sourceAuthority: PDP_SOURCE_AUTHORITY.ILLUSTRATIVE,
  });

  assert.equal(res.status, 'PDP_AREA_VERIFIED');
  assert.equal(res.isVerified, false, 'Illustrative geometry must not be certified as verified authority');
  assert.ok(res.limitations.includes('illustrative 3D geometry'));
});
