import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCreaseClearance } from '../lib/print/trim-clearance.mjs';
import { DIELINE_SOURCE_AUTHORITY } from '../lib/print/dieline-geometry.mjs';

test('1. Artwork elements maintaining approved clearance from score lines pass cleanly', () => {
  // Score line at x = 50. Text element at [10, 10, 40, 30] pt.
  // Distance = (50 - 40) pt = 10 pt = 3.53 mm >= 1.5 mm
  const creaseLines = [{ x1: 50, y1: 0, x2: 50, y2: 100, panelName: 'PDP to Right Flap Fold' }];
  const elements = [
    { text: 'Nutrition Facts', box: [10, 10, 40, 30], isCritical: true },
  ];

  const res = evaluateCreaseClearance({
    elements,
    creaseLines,
    pressProfileId: 'ISO-OFFSET-COATED-300', // 1.5 mm required
    dielineSource: DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
  });

  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'CREASE_CLEARANCE_SUFFICIENT');
  assert.equal(res.violations.length, 0);
  assert.ok(res.minObservedMm >= 1.5);
});

test('2. Text too close to or overlapping a score line produces a crease defect', () => {
  // Score line at x = 50. Text element at [48, 10, 70, 30] pt (crosses the crease line)
  const creaseLines = [{ x1: 50, y1: 0, x2: 50, y2: 100, panelName: 'Main Crease Rule' }];
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
  assert.equal(res.violations.length, 1);
  assert.equal(res.violations[0].measuredDistanceMm, 0.0);
  assert.equal(res.violations[0].requiredClearanceMm, 1.5);
  assert.ok(res.explanation.includes('Fold crease hazard'));
});

test('3. No universal 3 mm crease rule: process-specific thresholds apply', () => {
  // Score line at x = 50. Text element at [45, 10, 47, 30] pt => distance = 3 pt = 1.06 mm
  const creaseLines = [{ x1: 50, y1: 0, x2: 50, y2: 100 }];
  const elements = [{ text: 'Body Text', box: [45, 10, 47, 30] }];

  // Digital press requires only 1.0 mm -> PASS (1.06 mm >= 1.0 mm)
  const digitalRes = evaluateCreaseClearance({
    elements,
    creaseLines,
    pressProfileId: 'DIGITAL-FOLDING-320',
  });
  assert.equal(digitalRes.status, 'match');
  assert.equal(digitalRes.requiredClearanceMm, 1.0);

  // Offset press requires 1.5 mm -> FAIL (1.06 mm < 1.5 mm)
  const offsetRes = evaluateCreaseClearance({
    elements,
    creaseLines,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(offsetRes.status, 'issue');
  assert.equal(offsetRes.requiredClearanceMm, 1.5);

  // Flexo press requires 2.0 mm -> FAIL
  const flexoRes = evaluateCreaseClearance({
    elements,
    creaseLines,
    pressProfileId: 'FTA-FLEXO-POUCH-280',
  });
  assert.equal(flexoRes.status, 'issue');
  assert.equal(flexoRes.requiredClearanceMm, 2.0);
});

test('4. Beverage can profile returns NOT_APPLICABLE because cans do not fold', () => {
  const res = evaluateCreaseClearance({
    elements: [{ text: 'Soda Brand', box: [10, 10, 20, 20] }],
    creaseLines: [],
    pressProfileId: 'GRAVURE-BEVERAGE-CAN-340',
  });

  assert.equal(res.status, 'not_applicable');
  assert.equal(res.checkVerdict, 'NOT_APPLICABLE');
  assert.ok(res.explanation.includes('cylindrical or non-folding decoration'));
});

test('5. Missing structural crease lines return REVIEW without guessing dieline geometry', () => {
  const res = evaluateCreaseClearance({
    elements: [{ text: 'Brand Copy', box: [10, 10, 50, 50] }],
    creaseLines: [],
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'review');
  assert.equal(res.verdict, 'NO_CREASE_LINES_DEFINED');
  assert.ok(res.explanation.includes('No structural crease lines defined in dieline layers'));
});

test('6. Intentional multi-panel spanning graphics are not flagged as crease defects', () => {
  const creaseLines = [{ x1: 50, y1: 0, x2: 50, y2: 100 }];
  const elements = [
    { role: 'background_fill', box: [0, 0, 100, 100], isBackground: true },
    { label: 'Continuous Panoramic Landscape', box: [20, 10, 80, 50], spansPanelsIntentional: true },
  ];

  const res = evaluateCreaseClearance({
    elements,
    creaseLines,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'match');
  assert.equal(res.violations.length, 0);
});
