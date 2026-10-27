/**
 * PackSignal Multi-Jurisdiction Regulatory Registry (lib/regulatory/registry.mjs)
 * Master catalog of supported jurisdictions, official authorities, regulatory acts,
 * published rule pack versions, and effective date baselines.
 */

export const JURISDICTIONS = {
  US: 'us',
  EU: 'eu',
  INDIA: 'india',
};

export const JURISDICTION_REGISTRY = {
  us: {
    id: 'us',
    flag: '🇺🇸',
    name: 'USA — FDA',
    fullName: 'United States of America',
    authority: 'US Food and Drug Administration (FDA)',
    governingAct: 'Federal Food, Drug, and Cosmetic Act (FD&C Act) & 21 CFR Part 101',
    primaryReference: '21 CFR 101.9, 101.4, 101.5, 101.105, 21 U.S.C. 343(w) (FALCPA/FASTER Act)',
    officialUrl: 'https://www.fda.gov/food/food-labeling-nutrition',
    rulePackVersion: '2026.1-FDA',
    defaultEffectiveDate: '2026-10-01',
    nutritionBasisDefault: 'per_serving',
    energyUnitsDefault: ['calories'],
    saltOrSodium: 'sodium',
    symbolsRequired: [],
  },
  eu: {
    id: 'eu',
    flag: '🇪🇺',
    name: 'European Union — Regulation 1169/2011',
    fullName: 'European Union',
    authority: 'European Parliament & Council of the European Union',
    governingAct: 'Regulation (EU) No 1169/2011 on Food Information to Consumers (FIC)',
    primaryReference: 'Articles 9, 13, 21, 30, 32, 34; Annexes II, XIII, XIV, XV',
    officialUrl: 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj',
    rulePackVersion: '2026.1-EU1169',
    defaultEffectiveDate: '2026-10-01',
    nutritionBasisDefault: 'per_100',
    energyUnitsDefault: ['kJ', 'kcal'],
    saltOrSodium: 'salt',
    symbolsRequired: [],
  },
  india: {
    id: 'india',
    flag: '🇮🇳',
    name: 'India — FSSAI',
    fullName: 'Republic of India',
    authority: 'Food Safety and Standards Authority of India (FSSAI)',
    governingAct: 'Food Safety and Standards Act, 2006 & Labelling and Display Regulations, 2020 (as amended)',
    primaryReference: 'FSSAI (Labelling and Display) Regulations, 2020, Reg 5(1), 5(2), 5(3), 5(4), 5(7), 5(10)',
    officialUrl: 'https://www.fssai.gov.in',
    rulePackVersion: '2026.1-FSSAI',
    defaultEffectiveDate: '2026-10-01',
    nutritionBasisDefault: 'per_100_and_serve',
    energyUnitsDefault: ['kcal'],
    saltOrSodium: 'sodium',
    symbolsRequired: ['fssai_veg', 'fssai_nonveg', 'fssai_logo'],
  },
};

export function getJurisdictionMeta(marketId) {
  const norm = String(marketId || '').toLowerCase().trim();
  if (norm === 'us' || norm === 'usa' || norm === 'fda') return JURISDICTION_REGISTRY.us;
  if (norm === 'eu' || norm === 'europe' || norm === 'fic') return JURISDICTION_REGISTRY.eu;
  if (norm === 'india' || norm === 'in' || norm === 'fssai') return JURISDICTION_REGISTRY.india;
  return null;
}
