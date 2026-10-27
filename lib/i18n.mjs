/**
 * PackSignal — Bilingual India Localization Engine (lib/i18n.mjs)
 * Phase 8–11: English + Hindi Devanagari presentation support.
 * Preserves stable requirement IDs, document hashes, and canonical facts.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT_DIR = process.cwd();

let enLocale = null;
let hiLocale = null;

export async function loadLocales() {
  if (!enLocale) {
    const rawEn = await readFile(join(ROOT_DIR, 'locales', 'en.json'), 'utf8');
    enLocale = JSON.parse(rawEn.normalize('NFC'));
  }
  if (!hiLocale) {
    const rawHi = await readFile(join(ROOT_DIR, 'locales', 'hi.json'), 'utf8');
    hiLocale = JSON.parse(rawHi.normalize('NFC'));
  }
  return { en: enLocale, hi: hiLocale };
}

export async function getLocale(lang = 'en') {
  const locales = await loadLocales();
  const normalized = String(lang).toLowerCase().trim();
  if (normalized === 'hi' || normalized === 'hindi') {
    return locales.hi;
  }
  return locales.en;
}

export function translateKey(localeObj, keyPath, fallback = '') {
  if (!localeObj || !keyPath) return fallback;
  const parts = String(keyPath).split('.');
  let current = localeObj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return fallback;
    }
  }
  return typeof current === 'string' ? current : fallback;
}

/**
 * Returns localized presentation data for an India FSSAI / Legal Metrology rule,
 * without altering or mutating the underlying statutory rule ID.
 */
export async function getLocalizedRulePresentation(ruleId, lang = 'en') {
  const locale = await getLocale(lang);
  const ruleData = locale.requirements?.[ruleId];
  if (ruleData) {
    return {
      ruleId,
      lang: locale.locale,
      title: ruleData.title,
      authority: ruleData.authority,
      explanation: ruleData.explanation,
      question: ruleData.question,
    };
  }

  // Fallback to English if not found in requested locale
  const en = await getLocale('en');
  const enData = en.requirements?.[ruleId] || {};
  return {
    ruleId,
    lang: 'en',
    title: enData.title || ruleId,
    authority: enData.authority || 'Statutory Requirement',
    explanation: enData.explanation || '',
    question: enData.question || '',
    fallbackNotice: lang !== 'en' ? 'Localized presentation not yet available for this requirement.' : undefined,
  };
}

/**
 * Validates Devanagari Unicode characteristics, font stack recommendations,
 * and text expansion factors for packaging layout.
 */
export function validateHindiDevanagariContent(text) {
  if (typeof text !== 'string') return { ok: false, error: 'Input must be a string' };
  const normalized = text.normalize('NFC');
  
  // Devanagari Unicode block: U+0900 to U+097F
  const hasDevanagari = /[\u0900-\u097F]/.test(normalized);
  const devanagariCount = (normalized.match(/[\u0900-\u097F]/g) || []).length;
  
  return {
    ok: true,
    normalized,
    hasDevanagari,
    devanagariCharCount: devanagariCount,
    fontFamilyRecommended: "'Noto Sans Devanagari', 'Lohit Devanagari', 'Kohinoor Devanagari', -apple-system, sans-serif",
    requiresSpecialShaping: hasDevanagari,
    estimatedExpansionFactor: 1.15, // Hindi typically expands by 10-20% relative to concise English
  };
}
