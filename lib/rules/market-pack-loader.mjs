/**
 * PackSignal Date-Aware Market Pack Loader (lib/rules/market-pack-loader.mjs)
 * 
 * Loads market rule packs from `markets/<market>/` with schema validation,
 * date-aware applicability filtering, and reference data resolution.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMarketPack } from './rule-schema-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../../..');

/**
 * Discovers installed market packs dynamically from `markets/` directory.
 * Avoids hardcoding jurisdictions in the core interface.
 */
export function discoverInstalledMarkets() {
  const marketsDir = join(root, 'markets');
  if (!existsSync(marketsDir)) return [];
  const entries = readdirSync(marketsDir, { withFileTypes: true });
  const installed = [];
  for (const ent of entries) {
    if (ent.isDirectory() && ent.name !== 'schema') {
      const code = ent.name.toLowerCase();
      const manifestPath = join(marketsDir, code, 'manifest.json');
      const rulesPath = join(marketsDir, code, 'rules.json');
      if (existsSync(manifestPath) || existsSync(rulesPath)) {
        let name = code.toUpperCase();
        let regulators = [];
        let version = '2026.1';
        if (existsSync(manifestPath)) {
          try {
            const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
            name = m.name || m.market || name;
            regulators = m.regulators || (m.regulator ? [m.regulator] : []);
            version = m.version || version;
          } catch {}
        }
        installed.push({
          code,
          market: code.toUpperCase(),
          packId: code,
          name,
          version,
          regulators,
          flag: code === 'us' ? '🇺🇸' : code === 'in' || code === 'india' ? '🇮🇳' : code === 'eu' ? '🇪🇺' : '🌐'
        });
      }
    }
  }
  return installed;
}

/**
 * Evaluates the date status of a rule against a selected product launch date.
 * 
 * @param {string} launchDate - Selected commercial launch date (YYYY-MM-DD).
 * @param {string} effectiveFrom - Date the rule became binding (YYYY-MM-DD).
 * @param {string|null} effectiveUntil - Date the rule expired or was superseded (YYYY-MM-DD).
 * @returns {object} { status: 'ACTIVE' | 'FUTURE' | 'EXPIRED' | 'SUPERSEDED' | 'APPLICABILITY_UNKNOWN', reason: string }
 */
export function evaluateRuleDateStatus(launchDate, effectiveFrom, effectiveUntil = null) {
  if (!launchDate) {
    return {
      status: 'APPLICABILITY_UNKNOWN',
      reason: 'Launch date not specified; historical applicability not fully verified.'
    };
  }

  const lDate = new Date(launchDate);
  if (isNaN(lDate.getTime())) {
    return {
      status: 'APPLICABILITY_UNKNOWN',
      reason: `Invalid launch date format "${launchDate}".`
    };
  }

  if (!effectiveFrom) {
    return {
      status: 'APPLICABILITY_UNKNOWN',
      reason: 'Rule effectiveFrom date is unspecified; historical applicability not fully verified.'
    };
  }

  const fromDate = new Date(effectiveFrom);
  if (lDate < fromDate) {
    return {
      status: 'FUTURE',
      reason: `Rule becomes binding on ${effectiveFrom}; selected launch date (${launchDate}) is prior to effective date.`
    };
  }

  if (effectiveUntil) {
    const untilDate = new Date(effectiveUntil);
    if (lDate > untilDate) {
      return {
        status: 'EXPIRED',
        reason: `Rule expired or was superseded on ${effectiveUntil}; selected launch date (${launchDate}) is past expiration.`
      };
    }
  }

  return {
    status: 'ACTIVE',
    reason: `Rule is active for launch date ${launchDate} (effective interval: ${effectiveFrom} to ${effectiveUntil || 'indefinite'}).`
  };
}

/**
 * Loads a market pack from disk by market code.
 * 
 * @param {string} marketCode - Market code ('us', 'in', 'eu', etc.)
 * @param {object} options - { launchDate: string, productCategory: string, noCache: boolean }
 * @returns {object} Loaded pack with resolved rules and reference data
 */
export function loadMarketPack(marketCode = 'us', options = {}) {
  const code = String(marketCode).toLowerCase().trim();
  const marketDir = join(root, 'markets', code);

  if (!existsSync(marketDir)) {
    throw new Error(`Market pack directory not found for market: "${marketCode}" at ${marketDir}`);
  }

  const manifestPath = join(marketDir, 'manifest.json');
  let manifest = {};
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse market manifest at ${manifestPath}: ${err.message}`);
    }
  }

  // Load component files
  const readJson = (filename) => {
    const p = join(marketDir, filename);
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        return null;
      }
    }
    return null;
  };

  const foodLabelling = readJson('food-labelling.json');
  const legalMetrology = readJson('legal-metrology.json');
  const fallbackRules = readJson('rules.json') || { rules: [] };
  const dailyValues = readJson('nutrition-daily-values.json') || readJson('nutrition-references.json') || readJson('daily-values.json') || {};
  const allergens = readJson('allergens.json') || {};
  const claims = readJson('claims.json') || {};
  const calorieMethods = readJson('calorie-methods.json') || {};
  const applicability = readJson('applicability.json') || {};
  const questionTemplates = readJson('question-templates.json') || {};
  const symbols = readJson('symbols.json') || readJson('veg-mark.json') || {};

  let rawRules = [];
  if (code === 'in' && fallbackRules && Array.isArray(fallbackRules.rules) && fallbackRules.rules.length >= 20) {
    rawRules = [...fallbackRules.rules];
  } else if (foodLabelling && Array.isArray(foodLabelling.rules)) {
    rawRules = [...foodLabelling.rules];
    if (legalMetrology && Array.isArray(legalMetrology.rules)) {
      rawRules.push(...legalMetrology.rules);
    }
  } else {
    rawRules = fallbackRules.rules || [];
  }

  const packRecord = {
    packId: manifest.packId || `MARKET-PACK-${code.toUpperCase()}-2026.1`,
    market: code.toUpperCase(),
    regulator: manifest.regulator || (code === 'us' ? 'US Food and Drug Administration (FDA)' : 'Market Regulator'),
    version: manifest.version || '2026.1',
    publishedAt: manifest.publishedAt || '2020-01-01',
    effectiveFrom: manifest.effectiveFrom || '2020-01-01',
    effectiveUntil: manifest.effectiveUntil || null,
    productScope: manifest.productScope || ['conventional_food'],
    sources: manifest.sources || [],
    rules: rawRules,
    nutrientReferences: dailyValues.dailyValues || {},
    allergens: allergens,
    claims: claims,
    calorieMethods: calorieMethods,
    applicability: applicability,
    questionTemplates: questionTemplates.templates || [],
    symbols: symbols.symbols || symbols
  };

  const validation = validateMarketPack(packRecord);
  if (!validation.valid) {
    throw new Error(`Market pack validation failed for "${marketCode}": ${validation.errors.join('; ')}`);
  }

  // Date-filter rules if launchDate is supplied
  const launchDate = options.launchDate || '2026-10-16';
  const effectiveRules = [];
  const inactiveRules = [];

  for (const rule of packRecord.rules) {
    const dateEval = evaluateRuleDateStatus(launchDate, rule.effectiveFrom, rule.effectiveUntil);
    const enrichedRule = {
      ...rule,
      dateStatus: dateEval.status,
      dateExplanation: dateEval.reason
    };

    if (dateEval.status === 'ACTIVE') {
      effectiveRules.push(enrichedRule);
    } else {
      inactiveRules.push(enrichedRule);
    }
  }

  return {
    pack: packRecord,
    market: code.toUpperCase(),
    launchDate,
    allRules: packRecord.rules,
    effectiveRules,
    inactiveRules,
    referenceData: {
      dailyValues,
      allergens,
      claims,
      calorieMethods,
      applicability,
      questionTemplates: questionTemplates.templates || [],
      symbols: symbols.symbols || symbols
    },
    summary: {
      totalRules: packRecord.rules.length,
      activeRules: effectiveRules.length,
      inactiveRules: inactiveRules.length
    }
  };
}
