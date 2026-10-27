import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTac,
  evaluateTacCoverage,
  COLOR_EVIDENCE_AUTHORITY,
  HOTSPOT_SEVERITY,
} from '../lib/print/tac-analysis.mjs';

test('1. CMYK arithmetic: TAC = C + M + Y + K', () => {
  // C: 80%, M: 70%, Y: 70%, K: 100% => 320%
  const tac = calculateTac(80, 70, 70, 100);
  assert.equal(tac, 320);

  // Clamping test
  assert.equal(calculateTac(-20, 110, 50, 40), 190); // 0 + 100 + 50 + 40
});

test('2. TAC of 320% against configured 300% limit produces issue finding with +20% excess', () => {
  const sample = [{ c: 80, m: 70, y: 70, k: 100, page: 1, box: [0.2, 0.2, 0.5, 0.5] }];
  const res = evaluateTacCoverage({
    samples: sample,
    pressProfileId: 'ISO-OFFSET-COATED-300', // 300% limit
  });

  assert.equal(res.status, 'issue');
  assert.equal(res.verdict, 'TAC_LIMIT_EXCEEDED');
  assert.equal(res.peakTac, 320);
  assert.equal(res.tacLimit, 300);
  assert.equal(res.hotspots.length, 1);
  assert.equal(res.hotspots[0].excessPercentagePoints, 20);
  assert.equal(res.hotspots[0].difference, 20);
  assert.equal(res.hotspots[0].severity, HOTSPOT_SEVERITY.CRITICAL);
  assert.ok(res.explanation.includes('+20 percentage points'));
});

test('3. Rich black of 290% against 300% limit does not fail TAC alone', () => {
  // C: 70, M: 60, Y: 60, K: 100 => 290% TAC
  const richBlackSample = [{ c: 70, m: 60, y: 60, k: 100, page: 1, box: [0.1, 0.1, 0.4, 0.4] }];
  const res = evaluateTacCoverage({
    samples: richBlackSample,
    pressProfileId: 'ISO-OFFSET-COATED-300', // 300% limit
  });

  // 290% <= 300% => MUST NOT fail TAC alone
  assert.notEqual(res.status, 'issue', 'Rich black below 300% must not be flagged as TAC excess');
  assert.equal(res.peakTac, 290);
  assert.equal(res.hotspots[0].isRichBlack, true);
  // May be warning if >= 92% of limit (276%), but verdict is within limit / near limit
  assert.ok(res.verdict === 'TAC_NEAR_LIMIT_OR_ESTIMATE' || res.verdict === 'TAC_WITHIN_LIMIT');
});

test('4. Different press profile limits produce process-specific results', () => {
  // Sample with 285% TAC
  const sample = [{ c: 75, m: 70, y: 70, k: 70 }];

  // Offset (300% limit) -> PASS
  const offsetRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'ISO-OFFSET-COATED-300' });
  assert.equal(offsetRes.status, 'match');

  // Flexo (280% limit) -> FAIL
  const flexoRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'FTA-FLEXO-POUCH-280' });
  assert.equal(flexoRes.status, 'issue');
  assert.equal(flexoRes.tacLimit, 280);

  // Digital (320% limit) -> PASS
  const digitalRes = evaluateTacCoverage({ samples: sample, pressProfileId: 'DIGITAL-FOLDING-320' });
  assert.equal(digitalRes.status, 'match');
});

test('5. Missing profile handled gracefully with unverified generic reference', () => {
  const sample = [{ c: 50, m: 40, y: 30, k: 10 }];
  const res = evaluateTacCoverage({ samples: sample, pressProfileId: null });
  assert.equal(res.tacLimit, 300);
  assert.ok(res.pressProfileName.includes('Unverified'));
});

test('6. Unmanaged RGB artwork returns UNABLE without fabricating fake CMYK values', () => {
  const res = evaluateTacCoverage({
    samples: [{ c: 0, m: 0, y: 0, k: 0 }],
    sourceColorSpace: 'DeviceRGB',
    isIccConverted: false,
  });

  assert.equal(res.checkVerdict, 'UNABLE');
  assert.equal(res.authority, COLOR_EVIDENCE_AUTHORITY.UNSUPPORTED_COLOR_SPACE);
  assert.equal(res.peakTac, null, 'Must not infer fake CMYK from RGB brightness');
  assert.equal(res.explanation, 'CMYK separation data could not be reliably evaluated for this artwork.');
});

test('7. Spot colors are inventoried separately without fabricating process CMYK plates', () => {
  const res = evaluateTacCoverage({
    samples: [{ c: 30, m: 20, y: 10, k: 0 }],
    spotColors: [{ name: 'PANTONE 186 C' }, { name: 'CutContour' }],
  });

  assert.deepEqual(res.spotColors, ['PANTONE 186 C', 'CutContour']);
  assert.equal(res.peakTac, 60);
});

test('8. Overprint compositing uncertainty flagged without naive double counting', () => {
  const overlappingSample = [
    { c: 50, m: 40, y: 0, k: 0, overprint: true, overlapping: true, overprintUncertain: true }
  ];
  const res = evaluateTacCoverage({ samples: overlappingSample });
  assert.ok(res.explanation.includes('overprint/compositing analysis required') || res.coverageSummary.uncertainOverprintRegions > 0);
  assert.equal(res.hotspots[0].confidenceLimitations, 'Combined ink coverage uncertain — overprint/compositing analysis required.');
});

test('9. Canonical region coordinates preserved in hotspot records', () => {
  const sample = [{
    c: 90, m: 80, y: 80, k: 80,
    page: 2,
    box: [0.12, 0.34, 0.56, 0.78],
    documentId: 'art-doc-123',
    artworkVersion: 'v2',
  }];
  const res = evaluateTacCoverage({ samples: sample });
  assert.equal(res.hotspots[0].page, 2);
  assert.deepEqual(res.hotspots[0].box, [0.12, 0.34, 0.56, 0.78]);
  assert.equal(res.hotspots[0].documentId, 'art-doc-123');
  assert.equal(res.hotspots[0].artworkVersion, 'v2');
});
