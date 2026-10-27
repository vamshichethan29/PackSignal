import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocales, getLocale, getLocalizedRulePresentation, translateKey } from '../lib/i18n.mjs';

test('India Localization — Locale Loading and Rule Stability', async () => {
  const locales = await loadLocales();
  assert.ok(locales.en, 'English locale must load');
  assert.ok(locales.hi, 'Hindi locale must load');

  // Verify UI navigation keys
  assert.equal(locales.en.nav.spotMistakes, 'Spot the Mistakes');
  assert.ok(locales.hi.nav.spotMistakes.includes('त्रुटियां पहचानें'), 'Hindi navigation must include Devanagari');

  // Verify stable rule IDs across languages
  const fssaiVegRuleEn = await getLocalizedRulePresentation('fssai_veg_logo', 'en');
  const fssaiVegRuleHi = await getLocalizedRulePresentation('fssai_veg_logo', 'hi');

  assert.equal(fssaiVegRuleEn.ruleId, 'fssai_veg_logo', 'Rule ID must remain stable');
  assert.equal(fssaiVegRuleHi.ruleId, 'fssai_veg_logo', 'Rule ID must remain stable in Hindi');
  assert.equal(fssaiVegRuleEn.lang, 'en');
  assert.equal(fssaiVegRuleHi.lang, 'hi');
  assert.ok(fssaiVegRuleHi.title.includes('शाकाहारी'), 'Hindi title must be in Devanagari');

  // Verify non-existent rule fallback
  const fallbackRule = await getLocalizedRulePresentation('unknown_rule_xyz', 'hi');
  assert.equal(fallbackRule.ruleId, 'unknown_rule_xyz');
  assert.ok(fallbackRule.fallbackNotice, 'Missing translation must provide fallback notice');

  // Verify regulatory compliance note: no fabricated dual-language obligation
  assert.match(locales.en.notices.dualLanguageRegulatoryNote, /English or Hindi/, 'Must correctly cite FSSAI Rule 2.1.1 (English or Hindi)');
  assert.doesNotMatch(locales.en.notices.dualLanguageRegulatoryNote, /must display both English and Hindi on every panel/, 'Must not claim false bilingual obligation');
});
