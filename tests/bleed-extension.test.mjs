import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBleedExtension } from '../lib/print/trim-clearance.mjs';
import { DIELINE_SOURCE_AUTHORITY } from '../lib/print/dieline-geometry.mjs';

test('1. Correct 3.0 mm bleed on fixture configured for 3.0 mm passes cleanly', () => {
  // TrimBox: [10, 10, 100, 100] pt, BleedBox: [1.5, 1.5, 108.5, 108.5] pt
  // Margin = 8.5 pt * (25.4/72) = 3.0 mm
  const res = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
      bleedBox: { x1: 1.5, y1: 1.5, x2: 108.5, y2: 108.5 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300', // Requires 3.0 mm
    dielineSource: DIELINE_SOURCE_AUTHORITY.SOURCE_VERIFIED,
  });

  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'BLEED_EXTENSION_SUFFICIENT');
  assert.equal(res.requiredBleedMm, 3.0);
  assert.equal(res.measuredBleedMm, 3.0);
  assert.equal(res.deficitMm, 0);
  assert.ok(res.explanation.includes('meets approved'));
});

test('2. Insufficient bleed extension (1.0 mm vs 3.0 mm required) flags defect with exact deficiency', () => {
  // Margin = 2.83 pt * (25.4/72) = 1.0 mm
  const res = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
      bleedBox: { x1: 7.17, y1: 7.17, x2: 102.83, y2: 102.83 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300', // Requires 3.0 mm
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'BLEED_EXTENSION_DEFICIENT');
  assert.equal(res.requiredBleedMm, 3.0);
  assert.equal(res.measuredBleedMm, 1.0);
  assert.equal(res.deficitMm, 2.0); // 3.0 - 1.0 = 2.0 mm deficit
  assert.ok(res.explanation.includes('Insufficient bleed extension at cut boundary'));
});

test('3. Bleed requirement comes from active press profile (no universal 3.0 mm assumption)', () => {
  // Margin = 4.25 pt * (25.4/72) = 1.5 mm
  const boxes = {
    trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
    bleedBox: { x1: 5.75, y1: 5.75, x2: 104.25, y2: 104.25 },
  };

  // Digital press requires only 1.5 mm -> PASS
  const digitalRes = evaluateBleedExtension({
    artworkBoxes: boxes,
    pressProfileId: 'DIGITAL-FOLDING-320',
  });
  assert.equal(digitalRes.status, 'match');
  assert.equal(digitalRes.requiredBleedMm, 1.5);

  // Offset press requires 3.0 mm -> FAIL
  const offsetRes = evaluateBleedExtension({
    artworkBoxes: boxes,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(offsetRes.status, 'issue');
  assert.equal(offsetRes.requiredBleedMm, 3.0);
});

test('4. Missing TrimBox or boundary headers returns status UNABLE', () => {
  const res = evaluateBleedExtension({
    artworkBoxes: {},
  });
  assert.equal(res.status, 'unable');
  assert.equal(res.checkVerdict, 'UNABLE');
  assert.equal(res.measuredBleedMm, null);
});

test('5. Bleed measured outward from trim line across all 4 edges', () => {
  const res = evaluateBleedExtension({
    artworkBoxes: {
      trimBox: { x1: 10, y1: 10, x2: 100, y2: 100 },
      bleedBox: { x1: 1.5, y1: 1.5, x2: 110, y2: 110 },
    },
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.ok(res.marginsMm.left >= 3.0);
  assert.ok(res.marginsMm.bottom >= 3.0);
  assert.ok(res.marginsMm.right >= 3.0);
  assert.ok(res.marginsMm.top >= 3.0);
});
