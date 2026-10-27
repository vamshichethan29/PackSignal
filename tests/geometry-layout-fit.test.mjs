import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessLayoutFit,
  estimateTextBlockDimensions,
  computeUsableConnectedRegions,
  screenLayoutFit
} from '../lib/geometry/layout-fit.mjs';
import { FIT_OUTCOMES } from '../lib/geometry/model.mjs';

test('40. Copy fits comfortably inside available panel region at required font size', () => {
  const panelRegion = {
    panelId: 'front',
    face: 'front',
    safeCopyBox: [0.1, 0.1, 0.9, 0.9] // large 80% box
  };
  const pageDim = { width: 300, height: 200 }; // 300mm x 200mm = large canvas

  const res = assessLayoutFit({
    panelPrintableRegion: panelRegion,
    requiredCopy: 'Certified Organic Oats',
    minimumFontSizePt: 8.0,
    pageDimensionsMm: pageDim
  });

  assert.equal(res.outcome, FIT_OUTCOMES.FIT_LIKELY);
  assert.equal(res.estimatedLineCount, 1);
  assert.ok(res.estimatedWidthPt < res.availableWidthPt);
  assert.ok(res.estimatedHeightPt < res.availableHeightPt);
});

test('41. Long mandatory copy overflows small available panel space producing OVERFLOW_RISK', () => {
  const panelRegion = {
    panelId: 'side',
    face: 'left',
    safeCopyBox: [0.05, 0.05, 0.15, 0.15] // tiny 10% x 10% region
  };
  const pageDim = { width: 100, height: 100 }; // small carton

  const longCopy = 'Storage Instructions: Store in a cool, dry place away from direct sunlight. Once opened, keep refrigerated in an airtight container and consume within 7 days. Do not freeze.';

  const res = assessLayoutFit({
    panelPrintableRegion: panelRegion,
    requiredCopy: longCopy,
    minimumFontSizePt: 10.0, // High minimum font size requirement!
    pageDimensionsMm: pageDim
  });

  assert.equal(res.outcome, FIT_OUTCOMES.OVERFLOW_RISK);
  assert.ok(res.reasons.some(r => r.includes('OVERFLOW_RISK') || r.includes('requires')));
  assert.ok(res.recommendations.length > 0);
  assert.ok(res.recommendations[0].includes('available width') || res.recommendations[0].includes('wrapping'));
});

test('42. Word wrapping calculation estimates lines and dimensions correctly', () => {
  const text = 'One Two Three Four Five Six Seven Eight Nine Ten';
  const measurement = estimateTextBlockDimensions({
    copyText: text,
    availableWidthPt: 60, // Narrow width forces wrapping
    fontSizePt: 10.0
  });

  assert.ok(measurement.lineCount >= 3, `Expected at least 3 wrapped lines, got ${measurement.lineCount}`);
  assert.ok(measurement.heightPt >= measurement.lineCount * 10.0);
});

test('44 & 45. Fragmented region and multiple locked obstacles reduce usable space', () => {
  const safeBox = [0.1, 0.1, 0.9, 0.9];
  // An obstacle right in the center (0.4 to 0.6)
  const obstacle = {
    box: [0.3, 0.4, 0.7, 0.6],
    type: 'barcode'
  };

  const usable = computeUsableConnectedRegions(safeBox, [obstacle]);
  assert.ok(usable.length >= 2, 'Usable space must be partitioned around the obstacle');
  // Top and bottom sub-rectangles must be created
  assert.ok(usable.some(r => r.box[3] <= 0.4)); // Top region
  assert.ok(usable.some(r => r.box[1] >= 0.6)); // Bottom region
});

test('46. Unsupported complex text shaping (Arabic / Indic) returns NEEDS_REVIEW', () => {
  const panelRegion = {
    panelId: 'front',
    face: 'front',
    safeCopyBox: [0.1, 0.1, 0.9, 0.9]
  };

  const arabicCopy = 'المكونات: الشوفان العضوي، التوت البري';

  const res = assessLayoutFit({
    panelPrintableRegion: panelRegion,
    requiredCopy: arabicCopy,
    minimumFontSizePt: 8.0,
    pageDimensionsMm: { width: 200, height: 100 }
  });

  assert.equal(res.outcome, FIT_OUTCOMES.NEEDS_REVIEW);
  assert.ok(res.reasons.some(r => r.includes('complex non-Latin scripts')));
});

test('38. ScreenLayoutFit identifies text closer than 1.5mm to cut line as INSUFFICIENT_CLEARANCE', () => {
  const textSpans = [
    { text: 'Border Warning Text', boxPt: [98, 40, 102, 50] }
  ];
  const cutSegments = [
    { points: [[100, 0], [100, 100]], kind: 'cut' }
  ];

  const res = screenLayoutFit({
    textSpans,
    boundarySegments: cutSegments,
    minClearanceMm: 1.5
  });

  assert.equal(res.hasRisks, true);
  assert.equal(res.warnings[0].type, 'INSUFFICIENT_CLEARANCE');
  assert.equal(res.warnings[0].text, 'Border Warning Text');
});
