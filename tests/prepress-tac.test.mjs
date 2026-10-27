import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTac,
  evaluateTacCoverage,
  COLOR_EVIDENCE_AUTHORITY,
  HOTSPOT_SEVERITY,
} from '../lib/prepress/tac-analysis.mjs';
import { getPressProfile } from '../lib/prepress/press-profiles.mjs';

test('1. Accurate CMYK TAC arithmetic: TAC = C + M + Y + K', () => {
  assert.equal(calculateTac(0, 0, 0, 0), 0);
  assert.equal(calculateTac(100, 100, 100, 100), 400);
  assert.equal(calculateTac(50, 50, 50, 50), 200);
  // Channel clamping
  assert.equal(calculateTac(120, -10, 50, 50), 200);
});

test('2. Controlled example: C=80%, M=70%, Y=70%, K=100% -> 320% TAC produces issue with +20% excess', () => {
  const sample = [{
    c: 80,
    m: 70,
    y: 70,
    k: 100,
    box: [0.1, 0.1, 0.3, 0.3],
    objectType: 'Vector Background Fill',
  }];

  const res = evaluateTacCoverage({
    samples: sample,
    pressProfileId: 'ISO-OFFSET-COATED-300', // 300% maximum TAC
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'TAC_LIMIT_EXCEEDED');
  assert.equal(res.peakTac, 320);
  assert.equal(res.tacLimit, 300);
  assert.equal(res.hotspots.length, 1);

  const h = res.hotspots[0];
  assert.equal(h.measuredTac, 320);
  assert.equal(h.limit, 300);
  assert.equal(h.excessPercentagePoints, 20);
  assert.equal(h.severity, HOTSPOT_SEVERITY.CRITICAL);
  assert.ok(res.explanation.includes('exceeds the approved'));
  assert.ok(res.explanation.includes('+20 percentage points'));
});

test('3. Rich black (C=60%, M=40%, Y=40%, K=100% -> 240% TAC) below limit passes cleanly', () => {
  const sample = [{
    c: 60,
    m: 40,
    y: 40,
    k: 100,
    box: [0.2, 0.2, 0.4, 0.4],
  }];

  const res = evaluateTacCoverage({
    samples: sample,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.status, 'match');
  assert.equal(res.verdict, 'TAC_WITHIN_LIMIT');
  assert.equal(res.peakTac, 240);
  assert.equal(res.coverageSummary.exceededRegions, 0);
  assert.ok(res.explanation.includes('complies with the approved'));
});

test('4. Press-profile-specific thresholds apply (No universal 300% limit)', () => {
  const sample = [{ c: 70, m: 70, y: 70, k: 80 }]; // TAC = 290%

  // Offset limit = 300% -> PASS
  const offsetRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'ISO-OFFSET-COATED-300' });
  assert.equal(offsetRes.status, 'match');
  assert.equal(offsetRes.tacLimit, 300);

  // Flexo film limit = 280% -> FAIL (exceeds by 10%)
  const flexoRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'FTA-FLEXO-POUCH-280' });
  assert.equal(flexoRes.status, 'issue');
  assert.equal(flexoRes.tacLimit, 280);
  assert.equal(flexoRes.peakTac - flexoRes.tacLimit, 10);

  // Digital limit = 320% -> PASS
  const digitalRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'DIGITAL-FOLDING-320' });
  assert.equal(digitalRes.status, 'match');
  assert.equal(digitalRes.tacLimit, 320);

  // Gravure can limit = 340% -> PASS
  const gravureRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'GRAVURE-BEVERAGE-CAN-340' });
  assert.equal(gravureRes.status, 'match');
  assert.equal(gravureRes.tacLimit, 340);
});

test('5. Unmanaged RGB artwork returns UNABLE without fabricating fake CMYK values', () => {
  const res = evaluateTacCoverage({
    samples: [{ c: 0, m: 0, y: 0, k: 0 }],
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: false,
  });

  assert.equal(res.checkVerdict, 'UNABLE');
  assert.equal(res.authority, COLOR_EVIDENCE_AUTHORITY.UNSUPPORTED_COLOR_SPACE);
  assert.equal(res.peakTac, null, 'Must not report fabricated CMYK TAC from unmanaged RGB');
  assert.equal(res.hotspots.length, 0);
});

test('6. Profile-converted RGB is honestly labeled SIMULATED / PROFILE_CONVERTED_ESTIMATE', () => {
  const sample = [{ c: 75, m: 65, y: 65, k: 90 }]; // TAC = 295%
  const res = evaluateTacCoverage({
    samples: sample,
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: true,
    pressProfileId: 'ISO-OFFSET-COATED-300',
  });

  assert.equal(res.authority, COLOR_EVIDENCE_AUTHORITY.PROFILE_CONVERTED_ESTIMATE);
  assert.ok(res.authorityNote.includes('converted via ICC profile'));
  assert.equal(res.status, 'review', 'ICC-converted estimates require human reviewer confirmation');
  assert.equal(res.peakTac, 295);
});

test('7. Spot colors are inventoried separately without fabricating CMYK process plate values', () => {
  const res = evaluateTacCoverage({
    samples: [{ c: 40, m: 30, y: 20, k: 10 }],
    spotColors: ['PANTONE 186 C', 'PANTONE Reflex Blue C'],
  });

  assert.deepEqual(res.spotColors, ['PANTONE 186 C', 'PANTONE Reflex Blue C']);
  assert.equal(res.peakTac, 100);
});

test('8. Overprint compositing uncertainty is flagged without naive double counting', () => {
  const overlappingSample = [{
    c: 50, m: 50, y: 50, k: 50,
    overprint: true,
    overlapping: true,
    effectiveSeparations: false,
  }];

  const res = evaluateTacCoverage({ samples: overlappingSample });
  assert.equal(res.coverageSummary.uncertainOverprintRegions, 1);
  assert.equal(res.status, 'review');
  assert.ok(res.explanation.includes('overprint/compositing analysis required'));
});
