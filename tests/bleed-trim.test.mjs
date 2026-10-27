import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateBleedExtension,
  evaluateCriticalContentSafety,
  evaluateCreaseClearance,
  GEOMETRY_SOURCE_AUTHORITY,
} from '../lib/print/geometry-preflight.mjs';

test('1. Bleed extension: measured outward from TrimBox boundary', () => {
  // 1 pt = 0.352778 mm
  // TrimBox: (10, 10, 110, 110)
  // BleedBox: (0, 0, 120, 120) => margin = 10 pt = ~3.53 mm
  const sufficientBleed = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 10, y1: 10, x2: 110, y2: 110 },
      bleedBox: { x1: 0, y1: 0, x2: 120, y2: 120 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300', // Req: 3.0 mm
  });
  assert.equal(sufficientBleed.status, 'match');
  assert.equal(sufficientBleed.verdict, 'BLEED_EXTENSION_SUFFICIENT');
  assert.equal(sufficientBleed.measuredBleedMm, 3.5);

  // Deficient bleed: margin = 2 pt = ~0.7 mm < 3.0 mm
  const deficientBleed = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 2, y1: 2, x2: 102, y2: 102 },
      bleedBox: { x1: 0, y1: 0, x2: 104, y2: 104 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(deficientBleed.status, 'issue');
  assert.equal(deficientBleed.verdict, 'BLEED_EXTENSION_DEFICIENT');
  assert.equal(deficientBleed.measuredBleedMm, 0.7);
});

test('2. Critical content safety: measured inward from TrimBox cut line', () => {
  const trimBox = { x1: 0, y1: 0, x2: 200, y2: 200 };

  // Text element placed at x=2 pt (~0.7 mm from left trim cut line) => VIOLATION (< 3.0 mm inset)
  const unsafeText = evaluateCriticalContentSafety({
    textElements: [
      { text: 'WARNING: Contains Peanuts', box: [2, 50, 60, 60], page: 1 },
    ],
    trimBox,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(unsafeText.status, 'issue');
  assert.equal(unsafeText.verdict, 'CRITICAL_TEXT_TOO_CLOSE_TO_TRIM');
  assert.equal(unsafeText.violations.length, 1);
  assert.equal(unsafeText.violations[0].measuredDistanceMm, 0.7);

  // Safe text placed at x=20 pt (~7.0 mm from trim) => PASS
  const safeText = evaluateCriticalContentSafety({
    textElements: [
      { text: 'WARNING: Contains Peanuts', box: [20, 50, 80, 60], page: 1 },
    ],
    trimBox,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(safeText.status, 'match');
  assert.equal(safeText.verdict, 'TRIM_SAFETY_INSET_CLEARED');
  assert.equal(safeText.violations.length, 0);
});

test('3. Crease clearance: evaluated separately from outer trim cut lines', () => {
  const creaseLines = [
    { x1: 100, y1: 0, x2: 100, y2: 200, panelName: 'Front / Side Crease Score' },
  ];

  // Text element overlapping the score line (x1=98, x2=130) => distance = 0 mm
  const overlapping = evaluateCreaseClearance({
    creaseLines,
    textElements: [
      { text: 'Ingredients List', box: [98, 40, 150, 55], page: 1 },
    ],
    pressProfileId: 'ISO-OFFSET-COATED-300', // Req: 1.5 mm
  });
  assert.equal(overlapping.status, 'issue');
  assert.equal(overlapping.verdict, 'TEXT_OVERLAPS_CREASE_LINE');

  // Text element well clear of the score line (x1=120, distance = 20 pt = ~7 mm)
  const clear = evaluateCreaseClearance({
    creaseLines,
    textElements: [
      { text: 'Ingredients List', box: [120, 40, 180, 55], page: 1 },
    ],
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(clear.status, 'match');
  assert.equal(clear.verdict, 'CREASE_CLEARANCE_SUFFICIENT');
});

test('4. Unknown dieline geometry returns review status safely', () => {
  const missingBoxes = evaluateBleedExtension({
    artworkBoxes: {},
  });
  assert.equal(missingBoxes.status, 'unable');
  assert.equal(missingBoxes.checkVerdict, 'BLEED_GEOMETRY_UNSPECIFIED');

  const missingCreases = evaluateCreaseClearance({
    creaseLines: [],
    textElements: [{ text: 'Brand Name', box: [10, 10, 50, 20] }],
  });
  assert.equal(missingCreases.status, 'review');
  assert.equal(missingCreases.verdict, 'NO_CREASE_LINES_DEFINED');
});
