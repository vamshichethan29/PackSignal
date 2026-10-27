/**
 * PackSignal — Phase 6A: Contrast Analysis & WCAG Heuristic Unit Tests
 * Asserts luminance formula accuracy, separation of digital WCAG from FDA packaging statutes,
 * conservative gradient handling, and graceful fallback for unmeasurable textures.
 *
 * (tests/contrast-analysis.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateRelativeLuminance,
  calculateContrastRatio,
  evaluateTextContrast,
  parseHexColor
} from '../lib/shopper/contrast-analysis.mjs';

test('Contrast Analysis & Digital WCAG Reference Heuristics', async (t) => {
  await t.test('1. calculateRelativeLuminance computes pure white (1.0) and pure black (0.0)', () => {
    const lumWhite = calculateRelativeLuminance(255, 255, 255);
    const lumBlack = calculateRelativeLuminance(0, 0, 0);

    assert.ok(Math.abs(lumWhite - 1.0) <= 0.001);
    assert.equal(lumBlack, 0.0);
  });

  await t.test('2. calculateContrastRatio computes exact 21:1 for pure black on pure white', () => {
    const res = calculateContrastRatio('#000000', '#FFFFFF');
    assert.equal(res.isValid, true);
    assert.equal(res.ratio, 21.0);
  });

  await t.test('3. Evaluates normal digital text against 4.5:1 WCAG benchmark', () => {
    // Charcoal (#333333) on Light Cream (#FAF7F2) -> High contrast
    const passRes = evaluateTextContrast({
      foregroundColor: '#333333',
      backgroundColor: '#FAF7F2',
      isLargeText: false
    });
    assert.equal(passRes.status, 'PASSES_DIGITAL_HEURISTIC');
    assert.equal(passRes.passesWcagDigitalHeuristic, true);

    // Light Tan (#C0A080) on White (#FFFFFF) -> Low contrast
    const failRes = evaluateTextContrast({
      foregroundColor: '#C0A080',
      backgroundColor: '#FFFFFF',
      isLargeText: false
    });
    assert.equal(failRes.status, 'POTENTIAL_LOW_CONTRAST');
    assert.equal(failRes.passesWcagDigitalHeuristic, false);
    assert.ok(failRes.suggestedFix !== null);
  });

  await t.test('4. Explicitly distinguishes digital WCAG heuristics from FDA packaging law', () => {
    const res = evaluateTextContrast({
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF'
    });
    assert.ok(res.legalDistinction.ruleText.includes('does NOT codify WCAG 2.2 digital ratios'));
    assert.equal(res.heuristicCategory, 'PACKAGING_CONTRAST_HEURISTIC');
  });

  await t.test('5. Reports CANNOT_DETERMINE_RELIABLY for photographic or complex backgrounds', () => {
    const photoRes = evaluateTextContrast({
      declarationName: 'Serving Size Footnote',
      backgroundType: 'PHOTOGRAPHIC'
    });
    assert.equal(photoRes.status, 'CANNOT_DETERMINE_RELIABLY');
    assert.equal(photoRes.contrastRatio, null);
    assert.match(photoRes.reason, /photographic or variable background/i);
    assert.ok(photoRes.remediationSuggestion.includes('bounding pill'));
  });

  await t.test('6. Notes conservative sampled ratio when evaluating gradient backgrounds', () => {
    const gradRes = evaluateTextContrast({
      foregroundColor: '#1A1A1A',
      backgroundColor: '#E2E8F0',
      backgroundType: 'GRADIENT'
    });
    assert.ok(gradRes.gradientNote.includes('gradient'));
  });
});
