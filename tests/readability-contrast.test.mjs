import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateRelativeLuminance,
  calculateContrastRatio,
  cmykToApproximateRgb,
  estimateTextRunContrast,
  CONTRAST_THRESHOLDS
} from '../lib/readability/text-contrast.mjs';

test('1. Relative luminance: pure white is 1.0 and pure black is 0.0', () => {
  const white = calculateRelativeLuminance({ r: 255, g: 255, b: 255 });
  const black = calculateRelativeLuminance({ r: 0, g: 0, b: 0 });

  assert.equal(white, 1.0);
  assert.equal(black, 0.0);
});

test('2. Contrast ratio: black on white achieves 21.0:1 maximum contrast', () => {
  const res = calculateContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.equal(res.status, 'VERIFIED');
  assert.equal(res.contrastRatio, 21.0);
  assert.equal(res.screeningClassification, 'ROBUST_CONTRAST');
  assert.equal(res.wcagAANormalTextPass, true);
});

test('3. Low contrast text is classified with LOW_CONTRAST_RISK', () => {
  // Light gray text on white background: e.g. #bbbbbb (lum ~ 0.5) on #ffffff (lum = 1.0)
  const res = calculateContrastRatio({ r: 187, g: 187, b: 187 }, { r: 255, g: 255, b: 255 });
  assert.ok(res.contrastRatio < 3.0);
  assert.equal(res.screeningClassification, 'LOW_CONTRAST_RISK');
  assert.equal(res.wcagAANormalTextPass, false);
});

test('4. WCAG screen contrast is explicitly marked as non-binding for printed packaging', () => {
  const res = calculateContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.ok(res.regulatoryNotice);
  assert.ok(res.regulatoryNotice.toLowerCase().includes('screening reference'));
  assert.ok(!res.regulatoryNotice.toLowerCase().includes('fda violation'));
});

test('5. Unresolvable substrate or foreground colors return UNCERTAIN without guessing', () => {
  const tr = {
    textRunId: 'tr-01',
    originalText: 'Berry Crunch',
    category: 'identity'
    // No explicit fill or background colors
  };

  const res = estimateTextRunContrast(tr, { assumeWhiteSubstrate: false });
  assert.equal(res.status, 'UNCERTAIN');
  assert.equal(res.contrastRatio, null);
  assert.equal(res.method, 'ESTIMATED_UNKNOWN');
  assert.ok(res.explanation.includes('cannot be deterministically isolated'));
  assert.ok(res.regulatoryNotice.includes('NOT a binding physical packaging print law'));
});

test('6. CMYK ink density converts to approximate RGB for preview screening', () => {
  // 100% Black (K=1.0, C=0, M=0, Y=0) -> R=0, G=0, B=0
  const black = cmykToApproximateRgb(0, 0, 0, 1.0);
  assert.deepEqual(black, { r: 0, g: 0, b: 0 });

  // 0% Inks -> R=255, G=255, B=255
  const white = cmykToApproximateRgb(0, 0, 0, 0);
  assert.deepEqual(white, { r: 255, g: 255, b: 255 });

  // 100% Cyan (C=1.0) -> R=0, G=255, B=255
  const cyan = cmykToApproximateRgb(1.0, 0, 0, 0);
  assert.deepEqual(cyan, { r: 0, g: 255, b: 255 });
});
