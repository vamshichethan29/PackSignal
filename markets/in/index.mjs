/**
 * PackSignal India Market Pack (markets/in/index.mjs)
 * Encapsulates all Indian FSSAI and Legal Metrology packaging rules, daily values, allergens, claims, and mandatory elements.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readJson = file => JSON.parse(readFileSync(join(__dirname, file), 'utf8'));

export const inRules = readJson('rules.json');
export const inDailyValues = readJson('daily-values.json');
export const inAllergens = readJson('allergens.json');
export const inClaims = readJson('claims.json');
export const inRequiredPackItems = readJson('required-pack-items.json');
export const inVegMark = readJson('veg-mark.json');

export const IN_MARKET_PACK = {
  market: 'IN',
  jurisdiction: 'Republic of India',
  regulatoryAuthority: inRules.authority,
  version: inRules.version,
  rules: inRules.rules,
  dailyValues: inDailyValues.referenceDailyValues,
  atwaterFactors: inDailyValues.atwaterFactors,
  allergens: inAllergens.allergens,
  claims: inClaims.nutrientContentClaims,
  mandatoryElements: inRequiredPackItems.mandatoryPackagingElements,
  vegMark: inVegMark,

  /**
   * Filters rules by launch date and applicability criteria.
   * If launchDate is >= '2027-07-01', includes FSSAI 2027 FOPNL Indian Nutrition Rating amendment rules!
   */
  filterRules({ launchDate = new Date().toISOString(), category = 'granola', hasClaim = [], hasNutrition = true, hasBarcode = true }) {
    const targetDate = launchDate.slice(0, 10);
    return inRules.rules.filter(rule => {
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

export default IN_MARKET_PACK;
