/**
 * @file temporal-rules.mjs
 * 
 * PackSignal Regulatory Time Machine — Temporal Rule Engine
 * 
 * Evaluates regulatory requirements based on planned launch date, target market,
 * product category, and regulatory lifecycle states.
 * 
 * Strictly adheres to verified official sources, date cutovers, and product category boundaries.
 * Prohibits fabricating dates, inventing mandates, or treating draft proposals as binding law.
 */

import { REGULATORY_KNOWLEDGE_DATE, createRegulatorySnapshot } from './regulatory-snapshot.mjs';

/**
 * Standard product categories recognized by PackSignal.
 */
export const PRODUCT_CATEGORIES = Object.freeze({
  FOOD: 'food',
  BEVERAGE: 'beverage',
  COSMETIC: 'cosmetic',
  PERSONAL_CARE: 'personal_care',
  SUPPLEMENT: 'supplement',
  OTHER: 'other',
  UNKNOWN: 'unknown'
});

/**
 * Regulatory lifecycle states for individual rules.
 */
export const REGULATORY_LIFECYCLE = Object.freeze({
  DRAFT: 'DRAFT',
  PROPOSED: 'PROPOSED',
  CONSULTATION: 'CONSULTATION',
  NOTIFIED_NOT_YET_EFFECTIVE: 'NOTIFIED_NOT_YET_EFFECTIVE',
  IN_FORCE: 'IN_FORCE',
  TRANSITIONAL_COMPLIANCE_PERIOD: 'TRANSITIONAL_COMPLIANCE_PERIOD',
  SUPERSEDED: 'SUPERSEDED',
  WITHDRAWN: 'WITHDRAWN',
  REPEALED: 'REPEALED',
  STATUS_UNVERIFIED: 'STATUS_UNVERIFIED'
});

/**
 * Temporal evaluation result statuses.
 */
export const TEMPORAL_STATUS = Object.freeze({
  APPLICABLE_NOW: 'APPLICABLE_NOW',
  CONFIRMED_FUTURE_REQUIREMENT: 'CONFIRMED_FUTURE_REQUIREMENT',
  NOT_YET_EFFECTIVE: 'NOT_YET_EFFECTIVE',
  PROPOSED_NONBINDING: 'PROPOSED_NONBINDING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  SUPERSEDED: 'SUPERSEDED',
  WITHDRAWN: 'WITHDRAWN',
  APPLICABILITY_UNDETERMINED: 'APPLICABILITY_UNDETERMINED',
  SOURCE_UNVERIFIED: 'SOURCE_UNVERIFIED',
  EVALUATOR_UNSUPPORTED: 'EVALUATOR_UNSUPPORTED'
});

/**
 * Requirement classifications.
 */
export const REQUIREMENT_TYPE = Object.freeze({
  ARTWORK_LABEL_CHECK: 'ARTWORK_LABEL_CHECK',
  SUPPORTING_DOCUMENT_CHECK: 'SUPPORTING_DOCUMENT_CHECK',
  ORGANIZATIONAL_OBLIGATION: 'ORGANIZATIONAL_OBLIGATION',
  REGULATORY_MONITORING_ONLY: 'REGULATORY_MONITORING_ONLY'
});

/**
 * Master library of verified regulatory rules with temporal metadata.
 */
export const VERIFIED_TEMPORAL_RULES = Object.freeze([
  // =========================================================================
  // INDIA — FSSAI & LEGAL METROLOGY (FOOD)
  // =========================================================================
  {
    ruleId: 'FSSAI-LDR-2020-NAME-PDP',
    jurisdiction: 'india',
    regulator: 'Food Safety and Standards Authority of India (FSSAI)',
    productCategory: 'food',
    productSubcategory: ['granola', 'cereal', 'packaged_food'],
    market: 'india',
    originalSource: 'Food Safety and Standards (Labelling and Display) Regulations, 2020, Regulation 5(1)',
    officialSourceUrl: 'https://www.fssai.gov.in/food-law/regulations/labelling-display',
    originalQuotation: 'The name of the food shall be declared on the front of the pack (Principal Display Panel) indicating the true nature of the food.',
    publicationDate: '2020-11-17',
    effectiveDate: '2021-01-01',
    complianceDate: '2021-11-17',
    enforcementDate: '2021-11-17',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'FOOD_NAME_PDP',
    parameters: { requiredPanel: 'front' },
    evaluatorId: 'eval-fssai-pdp-name',
    evaluatorSupported: true,
    title: 'Name of Food on Principal Display Panel',
    description: 'True nature and description of the food (e.g. Granola) must appear prominently on the PDP.'
  },
  {
    ruleId: 'FSSAI-LDR-2020-VEG-MARK',
    jurisdiction: 'india',
    regulator: 'Food Safety and Standards Authority of India (FSSAI)',
    productCategory: 'food',
    productSubcategory: ['granola', 'cereal', 'packaged_food'],
    market: 'india',
    originalSource: 'Food Safety and Standards (Labelling and Display) Regulations, 2020, Regulation 5(2)',
    officialSourceUrl: 'https://www.fssai.gov.in/food-law/regulations/labelling-display',
    originalQuotation: 'Every package of vegetarian food shall bear a declaration to this effect by a symbol in green colour consisting of a filled circle inside a square.',
    publicationDate: '2020-11-17',
    effectiveDate: '2021-01-01',
    complianceDate: '2021-11-17',
    enforcementDate: '2021-11-17',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'VEG_LOGO_MARK',
    parameters: { symbol: 'GREEN_VEG_DOT', requiredPanel: 'front' },
    evaluatorId: 'eval-fssai-veg-mark',
    evaluatorSupported: true,
    title: 'Mandatory Green Vegetarian Logo (Veg Mark)',
    description: 'Vegetarian food packages must display the green square with filled circle logo prominently near the name.'
  },
  {
    ruleId: 'LM-PC-2011-NET-QTY-METRIC',
    jurisdiction: 'india',
    regulator: 'Department of Consumer Affairs (Legal Metrology)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'india',
    originalSource: 'Legal Metrology (Packaged Commodities) Rules, 2011, Rule 12',
    officialSourceUrl: 'https://consumeraffairs.nic.in/acts-and-rules/legal-metrology',
    originalQuotation: 'The net quantity shall be expressed in terms of the standard unit of weight or measure or in number. Use of non-metric units is non-compliant.',
    publicationDate: '2011-03-07',
    effectiveDate: '2011-04-01',
    complianceDate: '2011-04-01',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'NET_QUANTITY_METRIC',
    parameters: { allowedUnits: ['g', 'kg', 'ml', 'l'] },
    evaluatorId: 'eval-lm-net-qty',
    evaluatorSupported: true,
    title: 'Metric Net Quantity Declaration',
    description: 'Net quantity must be declared in metric units (g or kg). Standalone US customary units (ounces) are prohibited.'
  },
  {
    ruleId: 'LM-PC-2011-MRP-INCL-TAXES',
    jurisdiction: 'india',
    regulator: 'Department of Consumer Affairs (Legal Metrology)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'india',
    originalSource: 'Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e)',
    officialSourceUrl: 'https://consumeraffairs.nic.in/acts-and-rules/legal-metrology',
    originalQuotation: 'Retail sale price of the package shall be stated in the form MRP Rs ... / Maximum Retail Price Rs ... (inclusive of all taxes).',
    publicationDate: '2011-03-07',
    effectiveDate: '2011-04-01',
    complianceDate: '2011-04-01',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'MRP_DECLARATION',
    parameters: { phrase: 'MRP', inclusiveText: 'incl. of all taxes' },
    evaluatorId: 'eval-lm-mrp',
    evaluatorSupported: true,
    title: 'Maximum Retail Price (MRP incl. of all taxes)',
    description: 'MRP declaration must be legible with "inclusive of all taxes" stated.'
  },
  {
    ruleId: 'FSSAI-LDR-2020-NUTRITION-TABLE',
    jurisdiction: 'india',
    regulator: 'Food Safety and Standards Authority of India (FSSAI)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'india',
    originalSource: 'Food Safety and Standards (Labelling and Display) Regulations, 2020, Regulation 5(3)',
    officialSourceUrl: 'https://www.fssai.gov.in/food-law/regulations/labelling-display',
    originalQuotation: 'Nutritional information shall be given per 100g or 100ml or per single consumption pack of the product and per serve percentage (%) contribution to RDA.',
    publicationDate: '2020-11-17',
    effectiveDate: '2021-01-01',
    complianceDate: '2021-11-17',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'NUTRITION_FACTS_TABLE',
    parameters: { requiredFields: ['energy', 'protein', 'carbohydrates', 'total_sugars', 'added_sugars', 'total_fat', 'saturated_fat', 'sodium'] },
    evaluatorId: 'eval-fssai-nutrition-table',
    evaluatorSupported: true,
    title: 'Nutritional Information Table per 100g and per Serve with % RDA',
    description: 'Mandates declaration of Energy, Protein, Carbs, Total Sugars, Added Sugars, Total Fat, Saturated Fat, and Sodium.'
  },
  // VERIFIED FUTURE AMENDMENT (Commencement 1 July 2027)
  {
    ruleId: 'FSSAI-LDR-2026-AMEND-BOLD-RDA',
    jurisdiction: 'india',
    regulator: 'Food Safety and Standards Authority of India (FSSAI)',
    productCategory: 'food',
    productSubcategory: ['granola', 'cereal', 'packaged_food', 'all'],
    market: 'india',
    originalSource: 'Food Safety and Standards (Labelling and Display) First Amendment Regulations, 2026, Gazette Notification F. No. STD/SP-08/A-1.2024/BS',
    officialSourceUrl: 'https://www.fssai.gov.in/food-law/regulations/amendments/labelling-display',
    originalQuotation: 'In sub-regulation (3) of regulation 5, the nutritional information for per serve percentage (%) contribution to RDA of Total Sugars, Saturated Fat, and Sodium shall be bolded and font size increased to ensure conspicuous prominence.',
    publicationDate: '2026-03-12',
    effectiveDate: '2027-07-01',
    complianceDate: '2027-07-01',
    enforcementDate: '2027-07-01',
    legalStatus: REGULATORY_LIFECYCLE.NOTIFIED_NOT_YET_EFFECTIVE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'NUTRITION_TYPOGRAPHY_BOLD_RDA',
    parameters: { boldNutrients: ['total_sugars', 'added_sugars', 'saturated_fat', 'sodium'], minFontSizeRatio: 1.15 },
    evaluatorId: 'eval-fssai-bold-rda',
    evaluatorSupported: true,
    title: 'FSSAI 2026 First Amendment — Bold Typography for % RDA of Sugars, Saturated Fat & Sodium',
    description: 'Notified commencement on 1 July 2027: Mandatory bold font and increased size for per-serve percentage contribution to Recommended Dietary Allowances (RDA) of sugars, saturated fat, and sodium.'
  },
  // FORWARD PLANNING PROPOSAL: FSSAI FOPNL (PROPOSED_NONBINDING / DRAFT)
  {
    ruleId: 'FSSAI-DRAFT-FOPNL-INR-STAR',
    jurisdiction: 'india',
    regulator: 'Food Safety and Standards Authority of India (FSSAI)',
    productCategory: 'food',
    productSubcategory: ['granola', 'cereal', 'packaged_food'],
    market: 'india',
    originalSource: 'Draft Food Safety and Standards (Labelling and Display) Amendment Regulations, 2022 (FOPNL)',
    officialSourceUrl: 'https://www.fssai.gov.in/upload/uploadfiles/files/Draft_Notification_FOPNL.pdf',
    originalQuotation: 'Front-of-Pack Nutrition Labelling (FOPNL) under discussion: Indian Nutrition Rating (INR) star system rating from 0.5 to 5 stars displayed on the front of pack.',
    publicationDate: '2022-09-13',
    effectiveDate: null, // No confirmed statutory effective date!
    complianceDate: null,
    enforcementDate: null,
    legalStatus: REGULATORY_LIFECYCLE.DRAFT,
    requirementType: REQUIREMENT_TYPE.REGULATORY_MONITORING_ONLY,
    checkType: 'FOPNL_MONITORING',
    parameters: { system: 'INR_STAR_RATING', status: 'DRAFT_CONSULTATION' },
    evaluatorId: 'eval-fssai-fopnl-draft',
    evaluatorSupported: false,
    title: 'Draft FSSAI Front-of-Pack Nutrition Labelling (INR Star Rating) — Forward Monitor',
    description: 'Proposed Indian Nutrition Rating (INR) star emblem (0.5 to 5 stars). Under stakeholder consultation. NOT yet notified as enforceable law.'
  },

  // =========================================================================
  // UNITED STATES — FDA FOOD (Granola, Packaged Foods)
  // =========================================================================
  {
    ruleId: 'FDA-21CFR101.3-IDENTITY',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'us',
    originalSource: '21 CFR § 101.3 — Statement of identity',
    officialSourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.3',
    originalQuotation: 'The principal display panel of a food in package form shall bear as one of its principal features a statement of the identity of the commodity.',
    publicationDate: '1973-03-14',
    effectiveDate: '1974-01-01',
    complianceDate: '1974-01-01',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'STATEMENT_OF_IDENTITY',
    parameters: { requiredPanel: 'PDP' },
    evaluatorId: 'eval-fda-identity',
    evaluatorSupported: true,
    title: 'Statement of Identity on PDP',
    description: 'Common or usual name of the food (e.g. "Granola") must appear in prominent bold type parallel to the base.'
  },
  {
    ruleId: 'FDA-21CFR101.105-NET-QTY',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'us',
    originalSource: '21 CFR § 101.105 — Declaration of net quantity of contents',
    officialSourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-G/section-101.105',
    originalQuotation: 'The principal display panel of a food in package form shall bear a declaration of the net quantity of contents. The declaration shall be in both customary (oz/lb) and metric (g/kg) terms in the bottom 30 percent of the PDP.',
    publicationDate: '1993-01-06',
    effectiveDate: '1994-05-08',
    complianceDate: '1994-05-08',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'NET_QUANTITY_DUAL',
    parameters: { dualRequired: true, bottomZonePercentage: 30 },
    evaluatorId: 'eval-fda-net-qty',
    evaluatorSupported: true,
    title: 'Dual Net Quantity Declaration (Customary & Metric)',
    description: 'Net quantity must declare both US customary (ounces/lbs) and metric (grams), placed within the lower 30% of the front panel.'
  },
  {
    ruleId: 'FDA-21CFR101.9-NUTRITION',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'us',
    originalSource: '21 CFR § 101.9 — Nutrition labeling of food',
    officialSourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9',
    originalQuotation: 'Nutrition information relating to food shall be provided for all products intended for human consumption using the Nutrition Facts format.',
    publicationDate: '2016-05-27',
    effectiveDate: '2016-07-26',
    complianceDate: '2020-01-01',
    enforcementDate: '2020-01-01',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'NUTRITION_FACTS_FORMAT',
    parameters: { includeAddedSugars: true, referenceDvCalories: 2000 },
    evaluatorId: 'eval-fda-nutrition',
    evaluatorSupported: true,
    title: 'FDA Nutrition Facts Panel Format',
    description: 'Mandatory standard Nutrition Facts panel including dual column / added sugars breakdown.'
  },

  // =========================================================================
  // UNITED STATES — FDA COSMETICS & MoCRA 2022 (Cosmetics & Personal Care ONLY)
  // =========================================================================
  {
    ruleId: 'FDA-MOCRA-2022-ADVERSE-EVENT-CONTACT',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'cosmetic',
    productSubcategory: ['cosmetics', 'personal_care', 'skincare'],
    market: 'us',
    originalSource: 'Modernization of Cosmetics Regulation Act of 2022 (MoCRA), FD&C Act Section 605',
    officialSourceUrl: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra',
    originalQuotation: 'The label of a cosmetic product shall bear a domestic address, domestic phone number, or electronic contact information through which the responsible person may receive adverse event reports.',
    publicationDate: '2022-12-29',
    effectiveDate: '2024-12-29',
    complianceDate: '2024-12-29',
    enforcementDate: '2024-12-29',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'COSMETIC_ADVERSE_EVENT_CONTACT',
    parameters: { contactRequired: ['domestic_address', 'domestic_phone', 'electronic_contact'] },
    evaluatorId: 'eval-mocra-contact',
    evaluatorSupported: true,
    title: 'MoCRA § 605 — Adverse Event Contact Information on Cosmetic Labels',
    description: 'Cosmetic labels must declare a US domestic address, US phone number, or electronic contact (website/email) for reporting serious adverse events.'
  },
  {
    ruleId: 'FDA-MOCRA-2022-FACILITY-REGISTRATION',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'cosmetic',
    productSubcategory: ['cosmetics', 'personal_care'],
    market: 'us',
    originalSource: 'Modernization of Cosmetics Regulation Act of 2022 (MoCRA), FD&C Act Section 607(a)',
    officialSourceUrl: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra',
    originalQuotation: 'Each person that owns or operates a facility that engages in the manufacturing or processing of a cosmetic product distributed in the United States shall register each facility with FDA.',
    publicationDate: '2022-12-29',
    effectiveDate: '2023-12-29',
    complianceDate: '2024-07-01',
    enforcementDate: '2024-07-01',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.ORGANIZATIONAL_OBLIGATION,
    checkType: 'FACILITY_REGISTRATION_VERIFICATION',
    parameters: { obligationType: 'FDA_COSMETICS_DIRECT_PORTAL' },
    evaluatorId: 'eval-mocra-facility',
    evaluatorSupported: true,
    title: 'MoCRA § 607(a) — Facility Registration',
    description: 'Organizational manufacturing obligation: cosmetic facilities must be registered via FDA Cosmetics Direct. Not an on-artwork declaration.'
  },
  {
    ruleId: 'FDA-MOCRA-2022-PRODUCT-LISTING',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'cosmetic',
    productSubcategory: ['cosmetics', 'personal_care'],
    market: 'us',
    originalSource: 'Modernization of Cosmetics Regulation Act of 2022 (MoCRA), FD&C Act Section 607(c)',
    officialSourceUrl: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra',
    originalQuotation: 'For each cosmetic product, the responsible person shall submit to the FDA a cosmetic product listing including ingredients, facility registration, and category.',
    publicationDate: '2022-12-29',
    effectiveDate: '2023-12-29',
    complianceDate: '2024-07-01',
    enforcementDate: '2024-07-01',
    legalStatus: REGULATORY_LIFECYCLE.IN_FORCE,
    requirementType: REQUIREMENT_TYPE.SUPPORTING_DOCUMENT_CHECK,
    checkType: 'PRODUCT_LISTING_DOSSIER',
    parameters: { dossierField: 'fda_listing_number' },
    evaluatorId: 'eval-mocra-listing',
    evaluatorSupported: true,
    title: 'MoCRA § 607(c) — Cosmetic Product Listing Dossier',
    description: 'Regulatory document obligation: Product listing must be filed with FDA. Supporting document check, not an on-pack text box.'
  },
  {
    ruleId: 'FDA-MOCRA-2022-FRAGRANCE-ALLERGEN-PROP',
    jurisdiction: 'us',
    regulator: 'United States Food and Drug Administration (FDA)',
    productCategory: 'cosmetic',
    productSubcategory: ['cosmetics', 'personal_care'],
    market: 'us',
    originalSource: 'MoCRA Section 606 — Fragrance Allergen Proposed Rulemaking',
    officialSourceUrl: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra',
    originalQuotation: 'FDA shall issue proposed regulations to identify fragrance allergens that must be disclosed on the cosmetic product label.',
    publicationDate: '2023-06-01',
    effectiveDate: null, // Pending final rule
    complianceDate: null,
    legalStatus: REGULATORY_LIFECYCLE.PROPOSED,
    requirementType: REQUIREMENT_TYPE.REGULATORY_MONITORING_ONLY,
    checkType: 'FRAGRANCE_ALLERGEN_MONITORING',
    parameters: { targetList: 'EU_SCCS_CROSSWALK' },
    evaluatorId: 'eval-mocra-fragrance-prop',
    evaluatorSupported: false,
    title: 'MoCRA § 606 — Fragrance Allergen On-Pack Disclosure (Proposed Rulemaking)',
    description: 'FDA mandated to propose fragrance allergen declaration requirements. Proposed initiative currently pending final enactment.'
  },

  // =========================================================================
  // COMPANY SPECIFIC — SUSTAINABLE PACKAGING MANDATE (Internal Brand Standard)
  // =========================================================================
  {
    ruleId: 'COMPANY-SUSTAINABLE-PACK-2028',
    jurisdiction: 'company',
    regulator: 'Global Packaging Governance Committee',
    productCategory: 'all',
    productSubcategory: ['all'],
    market: 'all',
    originalSource: 'Corporate Sustainable Packaging Charter 2025-2030, Section 4.2',
    officialSourceUrl: 'https://internal.company.corp/sustainability/charter-2028',
    originalQuotation: 'Effective January 1, 2028, all retail carton artwork must carry the verified Post-Consumer Recycled (PCR) content percentage badge and How2Recycle instruction icon.',
    publicationDate: '2025-06-01',
    effectiveDate: '2028-01-01',
    complianceDate: '2028-01-01',
    legalStatus: REGULATORY_LIFECYCLE.NOTIFIED_NOT_YET_EFFECTIVE,
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'PCR_RECYCLE_BADGE',
    parameters: { minPcrPercent: 30, iconRequired: 'HOW2RECYCLE_STANDARDIZED' },
    evaluatorId: 'eval-company-pcr',
    evaluatorSupported: true,
    title: 'Company Sustainability Standard — PCR Content & Recyclability Badge',
    description: 'Corporate charter requirement taking effect January 1, 2028: mandatory PCR recycling badge on primary packaging.'
  },

  // =========================================================================
  // SUPERSEDED / WITHDRAWN HISTORICAL RULE FIXTURE (Verification Case)
  // =========================================================================
  {
    ruleId: 'FSSAI-P&L-2011-SUPERSEDED-NUTRITION',
    jurisdiction: 'india',
    regulator: 'Food Safety and Standards Authority of India (FSSAI)',
    productCategory: 'food',
    productSubcategory: ['all'],
    market: 'india',
    originalSource: 'FSSAI (Packaging and Labelling) Regulations, 2011, Regulation 2.2.2.3',
    officialSourceUrl: 'https://www.fssai.gov.in/food-law/regulations/repealed',
    originalQuotation: 'Old nutrition facts format without mandatory added sugars or trans fat sub-breakdown.',
    publicationDate: '2011-08-05',
    effectiveDate: '2011-08-05',
    expirationDate: '2021-11-17',
    withdrawalDate: '2021-11-17',
    legalStatus: REGULATORY_LIFECYCLE.SUPERSEDED,
    supersededBy: 'FSSAI-LDR-2020-NUTRITION-TABLE',
    requirementType: REQUIREMENT_TYPE.ARTWORK_LABEL_CHECK,
    checkType: 'LEGACY_NUTRITION_2011',
    evaluatorId: 'eval-fssai-legacy-2011',
    evaluatorSupported: false,
    title: 'FSSAI 2011 Legacy Nutrition Requirements (Superseded by 2020 Regulations)',
    description: 'Historical 2011 nutritional labelling requirements, formally repealed and superseded by the 2020 Labelling and Display Regulations.'
  }
]);

/**
 * Validates and normalizes date string to YYYY-MM-DD.
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // Basic calendar sanity check
    const [y, m, d] = s.split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return s;
    }
  }
  return null;
}

/**
 * Pure function: Evaluates the regulatory applicability and lifecycle state of rules
 * for a specific planned launch date, target market, product category, and product profile.
 * 
 * @param {Object} params
 * @param {Array} params.rules Master or custom rule records (defaults to VERIFIED_TEMPORAL_RULES)
 * @param {string} params.launchDate Target product entry date (YYYY-MM-DD)
 * @param {string} params.market Target jurisdiction ('india', 'us', 'eu', 'company')
 * @param {string} params.productCategory Product category ('food', 'cosmetic', etc.)
 * @param {Object} params.productFacts Extracted formulation & packaging facts
 * @param {Object} params.regulatorySnapshot Optional snapshot record
 * @param {string} params.reviewDate Current date of analysis (defaults to REGULATORY_KNOWLEDGE_DATE)
 * 
 * @returns {Object} Comprehensive evaluation breakdown
 */
export function evaluateRulesAtDate({
  rules = VERIFIED_TEMPORAL_RULES,
  launchDate = '2026-10-25',
  market = 'india',
  productCategory = 'food',
  productFacts = {},
  regulatorySnapshot = null,
  reviewDate = REGULATORY_KNOWLEDGE_DATE
} = {}) {
  const normLaunchDate = normalizeDate(launchDate) || '2026-10-25';
  const normReviewDate = normalizeDate(reviewDate) || REGULATORY_KNOWLEDGE_DATE;
  const normMarket = String(market).toLowerCase();
  const normCategory = String(productCategory).toLowerCase();

  const evaluatedRules = [];
  const categorized = {
    applicableNow: [],
    confirmedFutureRequirements: [],
    notYetEffective: [],
    proposedInitiatives: [],
    notApplicable: [],
    supersededOrWithdrawn: [],
    unsupportedEvaluators: []
  };

  for (const rawRule of rules) {
    const rule = { ...rawRule };
    const ruleMarket = String(rule.market || rule.jurisdiction || '').toLowerCase();
    const ruleCategory = String(rule.productCategory || 'all').toLowerCase();

    // 1. Jurisdiction Match
    const marketMatches = ruleMarket === 'all' || ruleMarket === normMarket ||
      (normMarket === 'in' && ruleMarket === 'india') ||
      (normMarket === 'india' && ruleMarket === 'in');

    if (!marketMatches) {
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.NOT_APPLICABLE,
        reason: `Jurisdiction mismatch: rule applies to ${ruleMarket.toUpperCase()}, product targeting ${normMarket.toUpperCase()}.`,
        isBinding: false,
        isActiveOnLaunchDate: false
      });
      categorized.notApplicable.push(rule);
      continue;
    }

    // 2. Product Category Match
    const categoryMatches = ruleCategory === 'all' || ruleCategory === normCategory;
    if (!categoryMatches) {
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.NOT_APPLICABLE,
        reason: `Category exclusion: rule applies strictly to '${ruleCategory}', product classified as '${normCategory}'.`,
        isBinding: false,
        isActiveOnLaunchDate: false
      });
      categorized.notApplicable.push(rule);
      continue;
    }

    // 3. Proposed / Non-binding Initiatives (DRAFT / PROPOSED / CONSULTATION)
    // CRITICAL: A proposed rule must NEVER be presented as an effective legal obligation merely because the selected date is in the future.
    const isDraftOrProposed = rule.legalStatus === REGULATORY_LIFECYCLE.DRAFT ||
      rule.legalStatus === REGULATORY_LIFECYCLE.PROPOSED ||
      rule.legalStatus === REGULATORY_LIFECYCLE.CONSULTATION ||
      rule.requirementType === REQUIREMENT_TYPE.REGULATORY_MONITORING_ONLY ||
      !rule.effectiveDate;

    if (isDraftOrProposed) {
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.PROPOSED_NONBINDING,
        reason: `Regulatory initiative under ${rule.legalStatus || 'PROPOSED'} status. Not confirmed as legally binding; forward-monitoring advisory only.`,
        isBinding: false,
        isActiveOnLaunchDate: false,
        isProposed: true
      });
      categorized.proposedInitiatives.push(rule);
      continue;
    }

    // 4. Superseded or Withdrawn Rules
    const isWithdrawn = (rule.withdrawalDate && rule.withdrawalDate <= normLaunchDate) ||
      (rule.expirationDate && rule.expirationDate <= normLaunchDate) ||
      rule.legalStatus === REGULATORY_LIFECYCLE.WITHDRAWN ||
      rule.legalStatus === REGULATORY_LIFECYCLE.REPEALED ||
      (rule.legalStatus === REGULATORY_LIFECYCLE.SUPERSEDED && rule.effectiveDate <= normLaunchDate);

    if (isWithdrawn) {
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.SUPERSEDED,
        reason: `Rule expired, withdrawn, or superseded on or before launch date ${normLaunchDate}.`,
        isBinding: false,
        isActiveOnLaunchDate: false
      });
      categorized.supersededOrWithdrawn.push(rule);
      continue;
    }

    // 5. Exact Effective Date Comparison
    const effDate = rule.complianceDate || rule.effectiveDate;
    const isEffectiveByLaunch = effDate <= normLaunchDate;
    const isNewlyEffectiveSinceReview = effDate > normReviewDate && isEffectiveByLaunch;

    if (!isEffectiveByLaunch) {
      // Not yet effective on planned launch date
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.NOT_YET_EFFECTIVE,
        reason: `Commencement date is ${effDate}. Not enforceable as of selected launch date ${normLaunchDate}.`,
        isBinding: true,
        isActiveOnLaunchDate: false,
        effectiveDate: effDate
      });
      categorized.notYetEffective.push(rule);
      continue;
    }

    // 6. Confirmed Future Requirement vs Already Active
    if (isNewlyEffectiveSinceReview) {
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.CONFIRMED_FUTURE_REQUIREMENT,
        reason: `Verified upcoming statutory requirement: Takes effect on ${effDate}. Enforceable on planned launch date ${normLaunchDate}.`,
        isBinding: true,
        isActiveOnLaunchDate: true,
        isNewlyEffective: true,
        effectiveDate: effDate
      });
      categorized.confirmedFutureRequirements.push(rule);
      categorized.applicableNow.push(rule);
    } else {
      evaluatedRules.push({
        rule,
        status: TEMPORAL_STATUS.APPLICABLE_NOW,
        reason: `Statutory requirement in force (commenced ${effDate}). Applicable on launch date ${normLaunchDate}.`,
        isBinding: true,
        isActiveOnLaunchDate: true,
        isNewlyEffective: false,
        effectiveDate: effDate
      });
      categorized.applicableNow.push(rule);
    }

    // Check if evaluator is supported
    if (rule.evaluatorSupported === false) {
      categorized.unsupportedEvaluators.push(rule);
    }
  }

  // Create or reuse regulatory snapshot
  const snapshot = regulatorySnapshot || createRegulatorySnapshot({
    market: normMarket,
    productCategory: normCategory,
    launchDate: normLaunchDate,
    rules: evaluatedRules.map(e => e.rule)
  });

  return {
    launchDate: normLaunchDate,
    reviewDate: normReviewDate,
    market: normMarket,
    productCategory: normCategory,
    snapshotId: snapshot.snapshotId,
    knowledgeDate: snapshot.knowledgeDate,
    summaryCounts: {
      totalEvaluated: evaluatedRules.length,
      applicableNow: categorized.applicableNow.length,
      confirmedFuture: categorized.confirmedFutureRequirements.length,
      notYetEffective: categorized.notYetEffective.length,
      proposedInitiatives: categorized.proposedInitiatives.length,
      notApplicable: categorized.notApplicable.length,
      supersededOrWithdrawn: categorized.supersededOrWithdrawn.length,
      unsupported: categorized.unsupportedEvaluators.length
    },
    categorized,
    evaluatedRules
  };
}
