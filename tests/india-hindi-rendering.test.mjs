import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHindiDevanagariContent } from '../lib/i18n.mjs';

test('India Hindi Rendering — Devanagari Unicode and Font Validation', () => {
  const sampleHindiText = 'अमृत मसाला चाय शुद्ध वजन: २५० ग्राम एफएसएसएआई लाइसेंस सं. 10020042000123';
  const validation = validateHindiDevanagariContent(sampleHindiText);

  assert.equal(validation.ok, true, 'Validation must succeed');
  assert.equal(validation.hasDevanagari, true, 'Must detect Devanagari script');
  assert.ok(validation.devanagariCharCount > 20, 'Must count Devanagari characters');
  assert.ok(validation.fontFamilyRecommended.includes('Noto Sans Devanagari'), 'Font stack must recommend compliant fonts');
  assert.equal(validation.requiresSpecialShaping, true, 'Devanagari requires complex text shaping');
  assert.ok(validation.estimatedExpansionFactor >= 1.10, 'Must account for text expansion');

  // Verify pure ASCII English does not trigger Devanagari shaping
  const sampleEnglishText = 'Dancing Fish Organic Berry Crunch Granola Net Wt 16 oz';
  const englishValidation = validateHindiDevanagariContent(sampleEnglishText);
  assert.equal(englishValidation.hasDevanagari, false, 'English text has no Devanagari');
  assert.equal(englishValidation.devanagariCharCount, 0);
});
