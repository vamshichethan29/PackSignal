import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTac,
  evaluateTacCoverage,
  COLOR_EVIDENCE_AUTHORITY,
  HOTSPOT_SEVERITY,
} from '../lib/print/tac-analysis.mjs';
import { getPressProfile, APPROVED_PRESS_PROFILES } from '../lib/print/press-profiles.mjs';

test('TAC Coverage: CMYK TAC arithmetic verifies C + M + Y + K', () => {
  // C: 80%, M: 70%, Y: 70%, K: 100% -> 320%
  const tac = calculateTac(80, 70, 70, 100);
  assert.equal(tac, 320);

  // Standard Rich Black: C: 60%, M: 40%, Y: 40%, K: 100% -> 240%
  assert.equal(calculateTac(60, 40, 40, 100), 240);

  // Pure Black: C: 0%, M: 0%, Y: 0%, K: 100% -> 100%
  assert.equal(calculateTac(0, 0, 0, 100), 100);

  // Clamping: channel cannot exceed 100% or drop below 0%
  assert.equal(calculateTac(150, -20, 50, 50), 200);
});

test('TAC Coverage: 300% is not treated as a universal limit; process-specific profiles apply', () => {
  const flexo = getPressProfile('FTA-FLEXO-POUCH-280');
  assert.equal(flexo.tacLimit, 280);

  const gravure = getPressProfile('GRAVURE-BEVERAGE-CAN-340');
  assert.equal(gravure.tacLimit, 340);

  const offset = getPressProfile('ISO-OFFSET-COATED-300');
  assert.equal(offset.tacLimit, 300);

  // A measurement of 290% is COMPLIANT for offset (≤300%) but an ISSUE for flexo (>280%)
  const offsetEval = evaluateTacCoverage({
    samples: [{ box: [0, 0, 1, 1], page: 1, c: 70, m: 70, y: 70, k: 80 }], // 290%
    pressProfileId: 'ISO-OFFSET-COATED-300',
    sourceColorSpace: 'DeviceCMYK',
  });
  assert.equal(offsetEval.status, 'match');
  assert.equal(offsetEval.coverageSummary.exceededRegions, 0);

  const flexoEval = evaluateTacCoverage({
    samples: [{ box: [0, 0, 1, 1], page: 1, c: 70, m: 70, y: 70, k: 80 }], // 290%
    pressProfileId: 'FTA-FLEXO-POUCH-280',
    sourceColorSpace: 'DeviceCMYK',
  });
  assert.equal(flexoEval.status, 'issue');
  assert.equal(flexoEval.coverageSummary.exceededRegions, 1);
});

test('TAC Coverage: DeviceCMYK native data distinguishes from ICC-converted RGB estimate', () => {
  const nativeCmyk = evaluateTacCoverage({
    samples: [{ box: [0, 0, 1, 1], page: 1, c: 80, m: 75, y: 75, k: 90 }],
    pressProfileId: 'ISO-OFFSET-COATED-300',
    sourceColorSpace: 'DeviceCMYK',
  });
  assert.equal(nativeCmyk.authority, COLOR_EVIDENCE_AUTHORITY.MEASURED_FROM_SOURCE);

  const iccConverted = evaluateTacCoverage({
    samples: [{ box: [0, 0, 1, 1], page: 1, c: 80, m: 75, y: 75, k: 90 }],
    pressProfileId: 'ISO-OFFSET-COATED-300',
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: true,
  });
  assert.equal(iccConverted.authority, COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE);
});

test('TAC Coverage: Unmanaged RGB artwork returns UNABLE without fabricating CMYK values', () => {
  const rgbEval = evaluateTacCoverage({
    samples: [{ box: [0, 0, 1, 1], page: 1, r: 12, g: 15, b: 18 }],
    pressProfileId: 'ISO-OFFSET-COATED-300',
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: false, // No output profile
  });

  assert.equal(rgbEval.status, 'review');
  assert.equal(rgbEval.checkVerdict, 'UNABLE');
  assert.equal(rgbEval.peakTac, null);
  assert.equal(rgbEval.authority, COLOR_EVIDENCE_AUTHORITY.UNSUPPORTED_COLOR_SPACE);
  assert.ok(rgbEval.explanation.includes('CMYK separation data could not be reliably evaluated'));
});

test('TAC Coverage: Spot colors are recorded separately without inventing process CMYK plate values', () => {
  const spotEval = evaluateTacCoverage({
    samples: [{ box: [0, 0, 1, 1], page: 1, c: 40, m: 30, y: 30, k: 50 }],
    pressProfileId: 'ISO-OFFSET-COATED-300',
    sourceColorSpace: 'DeviceCMYK',
    spotColors: [{ name: 'PANTONE 185 C' }, { name: 'Dieline' }],
  });

  assert.ok(spotEval.spotColors.includes('PANTONE 185 C'));
  assert.ok(spotEval.spotColors.includes('Dieline'));
  assert.equal(spotEval.peakTac, 150); // C40 + M30 + Y30 + K50 = 150%, spot plate is separate
});
