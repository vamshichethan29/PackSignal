/**
 * PackSignal US Market Pack (markets/us/index.mjs)
 * Encapsulates all US FDA packaging rules, daily values, allergens, claims, and mandatory elements.
 * 
 * Strict Architecture Requirement:
 * All US-specific statutory values, thresholds, and rule records live here, decoupled from engine code.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readJson = file => JSON.parse(readFileSync(join(__dirname, file), 'utf8'));

export const usRules = readJson('rules.json');
export const usDailyValues = readJson('daily-values.json');
export const usAllergens = readJson('allergens.json');
export const usClaims = readJson('claims.json');
export const usRequiredPackItems = readJson('required-pack-items.json');

export const US_MARKET_PACK = {
  market: 'US',
  jurisdiction: 'United States of America',
  regulatoryAuthority: 'US Food and Drug Administration (FDA) & FTC',
  version: usRules.version,
  rules: usRules.rules,
  dailyValues: usDailyValues.referenceDailyValues,
  atwaterFactors: usDailyValues.atwaterFactors,
  allergens: usAllergens,
  claims: usClaims.nutrientContentClaims || usClaims.claims || usClaims,
  mandatoryElements: usRequiredPackItems.mandatoryPackagingElements,
  
  /**
   * Filters rules by launch date and applicability criteria.
   */
  filterRules({ launchDate = new Date().toISOString(), category = 'granola', hasClaim = [], hasNutrition = true, hasBarcode = true }) {
    const targetDate = launchDate.slice(0, 10);
    return usRules.rules.filter(rule => {
      // Date filter
      if (rule.effectiveDate && rule.effectiveDate > targetDate) return false;
      if (rule.expirationDate && rule.expirationDate < targetDate) return false;

      // AppliesIf logic
      const app = rule.appliesIf || {};
      if (app.category && !app.category.includes(category) && !app.category.includes('food')) {
        return false;
      }
      if (app.hasNutrition !== undefined && app.hasNutrition !== hasNutrition) {
        return false;
      }
      if (app.hasBarcode !== undefined && app.hasBarcode !== hasBarcode) {
        return false;
      }
      if (app.hasClaim) {
        const claimsList = Array.isArray(hasClaim) ? hasClaim : [hasClaim];
        const matchesClaim = app.hasClaim.some(c => claimsList.includes(c));
        if (!matchesClaim) return false;
      }
      return true;
    });
  }
};

export default US_MARKET_PACK;
