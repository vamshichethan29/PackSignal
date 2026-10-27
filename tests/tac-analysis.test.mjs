import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTac,
  evaluateTacCoverage,
  COLOR_EVIDENCE_AUTHORITY,
  HOTSPOT_SEVERITY,
} from '../lib/print/tac-analysis.mjs';

test('1. TAC arithmetic calculates C + M + Y + K correctly', () => {
  // C: 80%, M: 70%, Y: 60%, K: 100% => 310%
  const tac = calculateTac(80, 70, 60, 100);
  assert.equal(tac, 310);

  // Clamping to 0..100 per channel
  assert.equal(calculateTac(-10, 120, 50, 50), 200); // 0 + 100 + 50 + 50
});

test('2. Approved press threshold applied (no universal 300% rule)', () => {
  // Sample with TAC = 260% (C:65, M:65, Y:65, K:65)
  const cleanSample = [{ c: 65, m: 65, y: 65, k: 65, box: [0.1, 0.1, 0.2, 0.2] }];

  // Evaluated against Offset (300% limit) => PASS (MATCH: 260% <= 300%)
  const offsetResult = evaluateTacCoverage({
    samples: cleanSample,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });
  assert.equal(offsetResult.status, 'match');
  assert.equal(offsetResult.peakTac, 260);
  assert.equal(offsetResult.verdict, 'TAC_WITHIN_LIMIT');

  // Sample with TAC = 285% (C:75, M:70, Y:70, K:70)
  const highSample = [{ c: 75, m: 70, y: 70, k: 70, box: [0.1, 0.1, 0.2, 0.2] }];

  // Evaluated against Flexo (280% limit) => FAIL (ISSUE: 285% > 280%)
  const flexoResult = evaluateTacCoverage({
    samples: highSample,
    pressProfileId: 'FTA-FLEXO-POUCH-280',
  });
  assert.equal(flexoResult.status, 'issue');
  assert.equal(flexoResult.verdict, 'TAC_LIMIT_EXCEEDED');
  assert.equal(flexoResult.hotspots.length, 1);
  assert.equal(flexoResult.hotspots[0].difference, 5); // 285 - 280 = +5%
});

test('3. Source CMYK distinguished from ICC-converted RGB estimate', () => {
  const samples = [{ c: 60, m: 50, y: 40, k: 30 }];

  // Native CMYK source
  const nativeResult = evaluateTacCoverage({
    samples,
    sourceColorSpace: 'DeviceCMYK',
  });
  assert.equal(nativeResult.authority, COLOR_EVIDENCE_AUTHORITY.MEASURED_FROM_SOURCE);

  // Profile-converted RGB source
  const convertedResult = evaluateTacCoverage({
    samples,
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: true,
  });
  assert.equal(convertedResult.authority, COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE);
  assert.ok(convertedResult.authorityNote.includes('conversion-dependent estimate'));
});

test('4. Unmanaged RGB-only artwork returns UNSUPPORTED_COLOR_SPACE without fake TAC values', () => {
  const rgbResult = evaluateTacCoverage({
    samples: [{ c: 0, m: 0, y: 0, k: 0 }],
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: false,
  });
  assert.equal(rgbResult.status, 'review');
  assert.equal(rgbResult.verdict, 'TAC_EVALUATION_BLOCKED_RGB');
  assert.equal(rgbResult.authority, COLOR_EVIDENCE_AUTHORITY.UNSUPPORTED_COLOR_SPACE);
  assert.equal(rgbResult.peakTac, null, 'Must not fabricate TAC from unmanaged RGB');
});

test('5. Spot colors do not produce fabricated process CMYK coverage', () => {
  const spotResult = evaluateTacCoverage({
    samples: [{ c: 40, m: 30, y: 20, k: 10 }],
    spotColors: ['PANTONE 186 C', 'Spot Opaque White'],
  });
  assert.deepEqual(spotResult.spotColors, ['PANTONE 186 C', 'Spot Opaque White']);
  assert.equal(spotResult.peakTac, 100); // 40+30+20+10, spot inks kept separate
});
