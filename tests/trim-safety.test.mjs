import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTrimSafety } from '../lib/print/trim-clearance.mjs';
import { DIELINE_SOURCE_AUTHORITY } from '../lib/print/dieline-geometry.mjs';

test('1. Critical text safely inside trim boundary passes cleanly', () => {
  // TrimBox: [0, 0, 100, 100] pt. Text: [20, 20, 80, 40] pt.
  // Distance to edge = 20 pt * (25.4/72) = 7.05 mm >= 3.0 mm
  const elements = [
    { text: 'Dancing Fish Wild Sardines', box: [20, 20, 80, 40], isCritical: true, role: 'critical_text' },
  ];
  const res = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'ISO-OFFSET-COATED-300', // 3.0 mm required
    dielineSource: DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
  });

  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'TRIM_SAFETY_INSET_CLEARED');
  assert.equal(res.violations.length, 0);
  assert.ok(res.minObservedClearanceMm >= 3.0);
});

test('2. Critical text entering configured safety zone produces issue with shortfall', () => {
  // TrimBox: [0, 0, 100, 100] pt. Text placed at x1 = 3.4 pt => 3.4 * (25.4/72) = 1.2 mm
  const elements = [
    { text: 'CONTAINS: FISH (SARDINES)', box: [3.4, 20, 60, 30], isCritical: true, role: 'critical_text' },
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
  assert.equal(v.shortfallMm, 1.8); // 3.0 - 1.2 = 1.8 mm shortfall
  assert.ok(res.explanation.includes('Critical text enters the trim safety zone'));
});

test('3. Brand logo entering safety zone triggers trim safety warning', () => {
  // Logo at y1 = 4.2 pt from bottom => 1.5 mm
  const elements = [
    { label: 'Primary Brand Crest', box: [30, 4.2, 70, 20], role: 'logo', isCritical: true },
  ];
  const res = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.violations[0].objectType, 'logo');
  assert.equal(res.violations[0].measuredDistanceMm, 1.5);
});

test('4. Background fills intended to bleed are NOT misclassified as trim safety violations', () => {
  // Background element extending across trim line into bleed zone
  const elements = [
    { role: 'background_fill', box: [-10, -10, 110, 110], isBackground: true, isCritical: false },
    { role: 'bleed_fill', box: [0, 0, 100, 100], isBackground: true, isCritical: false },
  ];
  const res = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'match');
  assert.equal(res.violations.length, 0, 'Backgrounds intended to bleed must never trigger trim violations');
});

test('5. Configured safety inset comes from profile (Flexo: 3.5 mm, Digital: 2.5 mm)', () => {
  // Element at 2.8 mm distance
  const elements = [
    { text: 'Net Wt 12 oz', box: [7.94, 20, 50, 30], isCritical: true }, // 7.94 pt = 2.8 mm
  ];

  // Flexo requires 3.5 mm -> FAIL (2.8 < 3.5)
  const flexoRes = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'FTA-FLEXO-POUCH-280',
  });
  assert.equal(flexoRes.status, 'issue');
  assert.equal(flexoRes.requiredSafetyInsetMm, 3.5);

  // Digital requires 2.5 mm -> PASS (2.8 >= 2.5)
  const digitalRes = evaluateTrimSafety({
    elements,
    trimBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
    pressProfileId: 'DIGITAL-FOLDING-320',
  });
  assert.equal(digitalRes.status, 'match');
  assert.equal(digitalRes.requiredSafetyInsetMm, 2.5);
});

test('6. Missing cut geometry returns status UNABLE', () => {
  const res = evaluateTrimSafety({
    elements: [{ text: 'Hello', box: [10, 10, 20, 20] }],
    trimCutPaths: [],
    trimBox: null,
  });
  assert.equal(res.status, 'unable');
  assert.equal(res.checkVerdict, 'UNABLE');
});
