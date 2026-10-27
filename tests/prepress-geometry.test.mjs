import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDielineGeometry,
  DIELINE_SOURCE_AUTHORITY,
  PATH_CLASSIFICATIONS,
  pointsToMm,
  mmToPoints,
  MM_PER_PT,
} from '../lib/prepress/dieline-geometry.mjs';
import {
  evaluateBleedExtension,
  evaluateTrimSafety,
  evaluateCreaseClearance,
  pointToSegmentDistance,
  boxToSegmentDistance,
} from '../lib/prepress/trim-clearance.mjs';

test('1. Unit conversions between PDF points and millimeters are mathematically exact', () => {
  // 72 points = 25.4 mm (1 inch)
  assert.equal(pointsToMm(72), 25.4);
  assert.equal(mmToPoints(25.4), 72);
  assert.equal(pointsToMm(0), 0);
  assert.equal(mmToPoints(0), 0);
});

test('2. Structural dieline extraction distinguishes CUT, CREASE, and GLUE paths', () => {
  const dxfMock = {
    cutPaths: [{ x1: 0, y1: 0, x2: 200, y2: 0 }],
    creases: [{ x1: 50, y1: 0, x2: 50, y2: 150 }],
    glueAreas: [{ box: [0, 0, 20, 150] }],
    dimensionsMm: { width: 100, height: 150 },
  };

  const res = resolveDielineGeometry({ dxfDieline: dxfMock });
  assert.equal(res.authority, DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED);
  assert.equal(res.sourceType, 'EXPLICIT_DXF_CAD');
  assert.equal(res.isVerified, true);
  assert.equal(res.cutPaths[0].type, PATH_CLASSIFICATIONS.CUT);
  assert.equal(res.cutPaths[0].strokeColor, '#ef4444');
  assert.equal(res.creasePaths[0].type, PATH_CLASSIFICATIONS.CREASE);
  assert.equal(res.creasePaths[0].strokeColor, '#3b82f6');
  assert.equal(res.glueAreas[0].type, PATH_CLASSIFICATIONS.GLUE);
});

test('3. Bleed Extension controlled example: 3.0 mm required, 1.0 mm measured -> 2.0 mm deficit (ISSUE)', () => {
  // Margin = 2.83 pt * (25.4/72) = 1.0 mm
  const res = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
      bleedBox: { x1: 7.17, y1: 7.17, x2: 102.83, y2: 102.83 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300', // Requires 3.0 mm
    dielineSource: DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'BLEED_EXTENSION_DEFICIENT');
  assert.equal(res.requiredBleedMm, 3.0);
  assert.equal(res.measuredBleedMm, 1.0);
  assert.equal(res.deficitMm, 2.0);
  assert.ok(res.explanation.includes('Insufficient bleed extension at cut boundary'));
});

test('4. Bleed Extension: 3.0 mm measured meeting 3.0 mm requirement passes cleanly (MATCH)', () => {
  // Margin = 8.5 pt * (25.4/72) = 3.0 mm
  const res = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
      bleedBox: { x1: 1.5, y1: 1.5, x2: 108.5, y2: 108.5 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BLEED_EXTENSION_SUFFICIENT');
  assert.equal(res.requiredBleedMm, 3.0);
  assert.equal(res.measuredBleedMm, 3.0);
  assert.equal(res.deficitMm, 0);
});

test('5. Trim Safety controlled example: 3.0 mm required, 1.2 mm measured -> 1.8 mm shortfall (ISSUE)', () => {
  // TrimBox: [0, 0, 100, 100] pt. Text element at x1 = 3.4 pt => 3.4 * (25.4/72) = 1.2 mm
  const elements = [
    { text: 'Dancing Fish Wild Sardines', box: [3.4, 20, 60, 30], isCritical: true, role: 'critical_text' },
  ];
  const res = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'ISO-OFFSET-COATED-300', // 3.0 mm required
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'CRITICAL_TEXT_TOO_CLOSE_TO_TRIM');
  assert.equal(res.violations.length, 1);
  const v = res.violations[0];
  assert.equal(v.measuredDistanceMm, 1.2);
  assert.equal(v.requiredSafetyInsetMm, 3.0);
  assert.equal(v.shortfallMm, 1.8);
});

test('6. Background bleed fills are excluded and not flagged as trim safety violations', () => {
  const elements = [
    { text: null, box: [-10, -10, 110, 110], isBackground: true, role: 'background_fill' },
    { text: 'FDA Statutory Copy', box: [20, 20, 80, 40], isCritical: true, role: 'critical_text' },
  ];
  const res = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'match');
  assert.equal(res.violations.length, 0);
});

test('7. Crease Clearance evaluated separately from cut boundaries', () => {
  // Score line at x = 50 pt. Text element at [48, 10, 70, 30] pt (overlaps score line)
  const creaseLines = [{ x1: 50, y1: 0, x2: 50, y2: 100 }];
  const elements = [
    { text: 'CAUTION: CONTAINS NUTS', box: [48, 10, 70, 30], isCritical: true },
  ];

  const res = evaluateCreaseClearance({
    elements,
    creaseLines,
    pressProfileId: 'ISO-OFFSET-COATED-300', // 1.5 mm required
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'TEXT_OVERLAPS_CREASE_LINE');
  assert.equal(res.violations[0].measuredDistanceMm, 0.0);
  assert.equal(res.violations[0].requiredClearanceMm, 1.5);
});

test('8. Seamless cylindrical can profile returns NOT_APPLICABLE for crease clearance', () => {
  const res = evaluateCreaseClearance({
    elements: [{ text: 'Can Brand Logo', box: [10, 10, 30, 30] }],
    creaseLines: [],
    pressProfileId: 'GRAVURE-BEVERAGE-CAN-340',
  });

  assert.equal(res.status, 'not_applicable');
  assert.equal(res.checkVerdict, 'NOT_APPLICABLE');
});
