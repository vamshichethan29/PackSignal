/**
 * @file text-measurement.test.mjs
 * 
 * Unit tests for typographic shaping, line wrapping, and FDA regulatory font minimums.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  measureTextBlock,
  measureNutritionFactsBlock,
  validateRegulatoryFontMinimum
} from '../lib/pack-canvas/text-measurement.mjs';

test('Text Measurement: Real text wraps dynamically based on available width and font metrics', () => {
  const sampleIngredients = 'Whole grain rolled oats, honey (9%), sunflower oil, dried berries (blueberries, cranberries), almonds, sea salt.';

  // Standard width (125mm) at 8pt
  const measurement125 = measureTextBlock(sampleIngredients, 125.0, 8.0);
  assert.equal(measurement125.widthMm, 125.0);
  assert.ok(measurement125.lineCount >= 2);
  assert.ok(measurement125.heightMm >= 12.0);

  // Narrow width (65mm) should wrap into more lines and increase height
  const measurement65 = measureTextBlock(sampleIngredients, 65.0, 8.0);
  assert.ok(measurement65.lineCount > measurement125.lineCount);
  assert.ok(measurement65.heightMm > measurement125.heightMm);
});

test('Text Measurement: Structured Nutrition Facts table footprint calculation', () => {
  // Standard vertical Nutrition Facts panel
  const standardNF = measureNutritionFactsBlock('standard_vertical');
  assert.equal(standardNF.format, 'STANDARD_VERTICAL');
  assert.equal(standardNF.widthMm, 70.0);
  assert.equal(standardNF.heightMm, 124.0);
  assert.equal(standardNF.citation, '21 CFR 101.9(d)');

  // Condensed vertical Nutrition Facts panel
  const condensedNF = measureNutritionFactsBlock('condensed_vertical');
  assert.equal(condensedNF.format, 'CONDENSED_VERTICAL');
  assert.equal(condensedNF.heightMm, 95.0);
  assert.ok(condensedNF.heightMm < standardNF.heightMm);
});

test('Text Measurement: Regulatory font minimum validation (FDA 21 CFR)', () => {
  // 1. Ingredients: requires min 6.0pt (1/16" x-height)
  const validIngFont = validateRegulatoryFontMinimum('INGREDIENTS', 8.0);
  assert.equal(validIngFont.compliant, true);

  const minIngFont = validateRegulatoryFontMinimum('INGREDIENTS', 6.0);
  assert.equal(minIngFont.compliant, true);

  const invalidIngFont = validateRegulatoryFontMinimum('INGREDIENTS', 4.5);
  assert.equal(invalidIngFont.compliant, false);
  assert.equal(invalidIngFont.requiredMinPt, 6.0);
  assert.ok(invalidIngFont.citation.includes('101.4'));

  // 2. Net Quantity: requires min 13.5pt for 25-100 sq inch PDP
  const validNetQtyFont = validateRegulatoryFontMinimum('NET_QUANTITY', 14.0);
  assert.equal(validNetQtyFont.compliant, true);

  const invalidNetQtyFont = validateRegulatoryFontMinimum('NET_QUANTITY', 10.0);
  assert.equal(invalidNetQtyFont.compliant, false);
  assert.equal(invalidNetQtyFont.requiredMinPt, 13.5);
  assert.ok(invalidNetQtyFont.citation.includes('101.7'));
});
