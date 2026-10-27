/**
 * PackSignal Market Pack Loader (lib/market-loader.mjs)
 * Dynamically loads market definitions from `markets/<market>/` to keep engine code free of jurisdiction-specific constants.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');

const loadedMarketPacks = new Map();

/**
 * Loads a market pack by country/jurisdiction code (e.g. 'us', 'in', 'eu').
 * 
 * @param {string} marketCode - ISO country code or jurisdiction code.
 * @returns {Promise<object>} The loaded market pack.
 */
export async function loadMarketPack(marketCode = 'us') {
  const code = String(marketCode).toLowerCase().trim();
  if (loadedMarketPacks.has(code)) {
    return loadedMarketPacks.get(code);
  }

  const marketDir = join(root, 'markets', code);
  const entryPath = join(marketDir, 'index.mjs');

  if (!existsSync(entryPath)) {
    throw new Error(`Market pack not found for '${code}'. Directory does not exist: markets/${code}/`);
  }

  const moduleUrl = new URL(`../markets/${code}/index.mjs`, import.meta.url).href;
  const mod = await import(moduleUrl);
  const pack = mod.default || mod.US_MARKET_PACK || mod.IN_MARKET_PACK || mod.marketPack || mod;

  loadedMarketPacks.set(code, pack);
  return pack;
}

/**
 * Synchronous loader helper using pre-imported default for Node tests & CLI.
 */
import US_PACK_SYNC from '../markets/us/index.mjs';

export function loadMarketPackSync(marketCode = 'us') {
  const code = String(marketCode).toLowerCase().trim();
  if (loadedMarketPacks.has(code)) return loadedMarketPacks.get(code);
  if (code === 'us') return US_PACK_SYNC;

  // Generic fallback: dynamically read market directory synchronously
  const marketDir = join(root, 'markets', code);
  const entryPath = join(marketDir, 'index.mjs');
  if (!existsSync(entryPath)) {
    throw new Error(`Market pack not found for '${code}'. Directory does not exist: markets/${code}/`);
  }

  const rules = JSON.parse(readFileSync(join(marketDir, 'rules.json'), 'utf8'));
  const dailyValues = existsSync(join(marketDir, 'daily-values.json'))
    ? JSON.parse(readFileSync(join(marketDir, 'daily-values.json'), 'utf8'))
    : {};
  const allergens = existsSync(join(marketDir, 'allergens.json'))
    ? JSON.parse(readFileSync(join(marketDir, 'allergens.json'), 'utf8'))
    : [];
  const claims = existsSync(join(marketDir, 'claims.json'))
    ? JSON.parse(readFileSync(join(marketDir, 'claims.json'), 'utf8'))
    : {};
  const reqItems = existsSync(join(marketDir, 'required-pack-items.json'))
    ? JSON.parse(readFileSync(join(marketDir, 'required-pack-items.json'), 'utf8'))
    : {};
  const vegMark = existsSync(join(marketDir, 'veg-mark.json'))
    ? JSON.parse(readFileSync(join(marketDir, 'veg-mark.json'), 'utf8'))
    : null;

  const pack = {
    market: code.toUpperCase(),
    jurisdiction: rules.jurisdiction || code.toUpperCase(),
    regulatoryAuthority: rules.authority || 'Regulatory Authority',
    version: rules.version || '2026.1',
    rules: rules.rules || [],
    dailyValues: dailyValues.referenceDailyValues || dailyValues,
    atwaterFactors: dailyValues.atwaterFactors || { fat: 9, carbohydrate: 4, protein: 4 },
    allergens: allergens.allergens || allergens,
    claims: claims.nutrientContentClaims || claims,
    mandatoryElements: reqItems.mandatoryPackagingElements || [],
    vegMark,
    filterRules({ launchDate = new Date().toISOString(), category = 'granola', hasClaim = [], hasNutrition = true, hasBarcode = true }) {
      const targetDate = launchDate.slice(0, 10);
      return rules.rules.filter(rule => {
        if (rule.effectiveDate && rule.effectiveDate > targetDate) return false;
        if (rule.expirationDate && rule.expirationDate < targetDate) return false;
        const app = rule.appliesIf || {};
        if (app.category && !app.category.includes(category) && !app.category.includes('food')) return false;
        if (app.hasNutrition !== undefined && app.hasNutrition !== hasNutrition) return false;
        if (app.hasBarcode !== undefined && app.hasBarcode !== hasBarcode) return false;
        return true;
      });
    }
  };

  loadedMarketPacks.set(code, pack);
  return pack;
}
