import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePdpArea, PACKAGE_TYPES, PDP_SOURCE_AUTHORITY } from '../lib/print/pdp-area.mjs';
import { getNetQuantityMinimumHeight } from '../lib/font-preflight.mjs';

describe('PDP Geometry & Type-Height Scaling Tests (21 CFR 101.1 & 101.105)', () => {
  it('1. Rectangular folding carton: PDP Area = width × height in square inches', () => {
    // 4 in width × 6 in height = 24.0 sq in -> Bracket: 5 < PDP ≤ 25 sq in -> 1/8" (3.175 mm)
    const pdp = calculatePdpArea({
      dimensions: { widthInches: 4.0, heightInches: 6.0 },
      packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
      sourceAuthority: PDP_SOURCE_AUTHORITY.REVIEWER_CONFIRMED,
    });

    assert.equal(pdp.status, 'PDP_AREA_VERIFIED');
    assert.equal(pdp.pdpAreaSqIn, 24.0);

    const netQty = getNetQuantityMinimumHeight(pdp.pdpAreaSqIn);
    assert.equal(netQty.minimumMm, 3.175);
    assert.equal(netQty.fractionText, '1/8 inch');
  });

  it('2. Cylindrical soda can: PDP Area = 40% of circumference × height (21 CFR 101.1(b))', () => {
    // 2.6 in diameter × 4.8 in height: Circumference = pi * 2.6 = 8.168 in. PDP = 0.40 * 8.168 * 4.8 ≈ 15.68 sq in
    const pdp = calculatePdpArea({
      dimensions: { diameterInches: 2.6, heightInches: 4.8 },
      packageType: PACKAGE_TYPES.CYLINDRICAL_CAN,
      sourceAuthority: PDP_SOURCE_AUTHORITY.REVIEWER_CONFIRMED,
    });

    assert.equal(pdp.status, 'PDP_AREA_VERIFIED');
    assert.ok(Math.abs(pdp.pdpAreaSqIn - 15.68) < 0.2);

    const netQty = getNetQuantityMinimumHeight(pdp.pdpAreaSqIn);
    assert.equal(netQty.minimumMm, 3.175);
    assert.equal(netQty.fractionText, '1/8 inch');
  });

  it('3. Stand-up pouch: PDP Area = front panel face area', () => {
    // 6.0 in width × 8.5 in height = 51.0 sq in -> Bracket: 25 < PDP ≤ 100 sq in -> 3/16" (4.7625 mm)
    const pdp = calculatePdpArea({
      dimensions: { widthInches: 6.0, heightInches: 8.5 },
      packageType: PACKAGE_TYPES.STANDUP_POUCH,
      sourceAuthority: PDP_SOURCE_AUTHORITY.DIELINE_GEOMETRY,
    });

    assert.equal(pdp.status, 'PDP_AREA_VERIFIED');
    assert.equal(pdp.pdpAreaSqIn, 51.0);

    const netQty = getNetQuantityMinimumHeight(pdp.pdpAreaSqIn);
    assert.equal(netQty.minimumMm, 4.7625);
    assert.equal(netQty.fractionText, '3/16 inch');
  });

  it('4. Large shipping case (> 400 sq in) triggers the 1/2 inch (12.7 mm) tier', () => {
    // 22 in width × 20 in height = 440.0 sq in -> Bracket: PDP > 400 sq in -> 1/2" (12.7 mm)
    const pdp = calculatePdpArea({
      dimensions: { widthInches: 22.0, heightInches: 20.0 },
      packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
      sourceAuthority: PDP_SOURCE_AUTHORITY.SPECIFICATION_DOC,
    });

    assert.equal(pdp.pdpAreaSqIn, 440.0);
    const netQty = getNetQuantityMinimumHeight(pdp.pdpAreaSqIn);
    assert.equal(netQty.minimumMm, 12.7);
    assert.equal(netQty.fractionText, '1/2 inch');
  });

  it('5. Missing or invalid package dimensions safely returns PDP_AREA_UNVERIFIED', () => {
    const pdp = calculatePdpArea({
      dimensions: {},
      packageType: PACKAGE_TYPES.RECTANGULAR_CARTON,
    });

    assert.equal(pdp.status, 'PDP_AREA_UNVERIFIED');
    assert.equal(pdp.pdpAreaSqIn, null);

    const netQty = getNetQuantityMinimumHeight(pdp.pdpAreaSqIn);
    assert.equal(netQty.status, 'UNVERIFIED');
    assert.equal(netQty.minimumMm, null);
  });
});
