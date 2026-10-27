/**
 * PackSignal — Regulatory Placement Rule Registry
 * lib/regulatory/placement-rules.mjs
 *
 * Authoritative registry of packaging declaration placement rules derived from
 * statutory regulations (FDA 21 CFR Part 101, FSSAI Packaging & Labelling,
 * Health Canada Food & Drug Regulations) and authorized company specifications.
 *
 * Separates legal authority levels:
 * - VERIFIED_STATUTORY: Direct statutory requirement (e.g. 21 CFR §101.105)
 * - VERIFIED_COMPANY_SPECIFICATION: Authorized internal brand / retailer standard
 * - REVIEWER_CONFIRMED: Explicitly verified by regulatory reviewer
 * - ILLUSTRATIVE_SUGGESTION: Non-binding design guideline
 * - UNRESOLVED: Insufficient regulatory or package context
 */

export const PLACEMENT_AUTHORITIES = {
  VERIFIED_STATUTORY: 'VERIFIED_STATUTORY',
  VERIFIED_COMPANY_SPECIFICATION: 'VERIFIED_COMPANY_SPECIFICATION',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  ILLUSTRATIVE_SUGGESTION: 'ILLUSTRATIVE_SUGGESTION',
  UNRESOLVED: 'UNRESOLVED',
};

export const LEGAL_STATUSES = {
  ENFORCEABLE_CURRENT: 'ENFORCEABLE_CURRENT',
  PROPOSED_FUTURE: 'PROPOSED_FUTURE',
  VOLUNTARY_CERTIFICATION: 'VOLUNTARY_CERTIFICATION',
  REPEALED_SUPERSEDED: 'REPEALED_SUPERSEDED',
};

export const REGION_TYPES = {
  MANDATORY_REGION: 'MANDATORY_REGION',
  PERMITTED_REGION: 'PERMITTED_REGION',
  ALTERNATIVE_PERMITTED_REGION: 'ALTERNATIVE_PERMITTED_REGION',
  DESIGN_SUGGESTION: 'DESIGN_SUGGESTION',
  PLACEMENT_UNRESOLVED: 'PLACEMENT_UNRESOLVED',
};

export const MAPPING_STATUSES = {
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  ILLUSTRATIVE: 'ILLUSTRATIVE',
  UNMAPPED: 'UNMAPPED',
};

/**
 * Authoritative placement rules database.
 */
export const STATUTORY_PLACEMENT_REGISTRY = [
  // 1. US Net Quantity of Contents (21 CFR §101.7 & §101.105)
  {
    ruleId: 'US-FDA-NET-QTY-01',
    declarationType: 'NET_QUANTITY',
    jurisdiction: 'US',
    productCategory: 'FOOD_AND_BEVERAGE',
    regulatorySource: 'FDA 21 CFR §101.7 & 21 CFR §101.105',
    sourceQuotation: 'The principal display panel shall bear a declaration of the net quantity of contents... within the bottom 30 percent of the area of the label panel in lines generally parallel to the base on which the package rests as it is designed to be displayed.',
    sourceURL: 'https://www.ecfr.gov/current/title-21/section-101.105',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '1973-03-14',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['principal_display_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    placementConstraints: {
      regionConstraint: 'bottom_30_percent',
      parallelToBase: true,
      conspicuousness: 'prominent_and_clear',
    },
    exceptions: [
      {
        id: 'SMALL_PDP_EXCEPTION',
        citation: '21 CFR §101.7(f)',
        description: 'Where the principal display panel is 5 square inches or less, the declaration may appear anywhere on the PDP rather than bottom 30%.',
        condition: (panelGeometry) => (panelGeometry?.areaSqInches || 999) <= 5.0,
        alternateConstraint: 'anywhere_on_panel',
      },
      {
        id: 'RANDOM_WEIGHT_EXCEPTION',
        citation: '21 CFR §101.105(j)(1)',
        description: 'Random weight packages sold at retail may omit customary units if net weight is declared at time of sale.',
        condition: (product) => product?.isRandomWeight === true,
      },
    ],
    minimumTypeRequirements: [
      { maxAreaSqIn: 5, minHeightPt: 4.5, minHeightMm: 1.588, label: '1/16 in (4.5 pt)' },
      { maxAreaSqIn: 25, minHeightPt: 9.0, minHeightMm: 3.175, label: '1/8 in (9 pt)' },
      { maxAreaSqIn: 100, minHeightPt: 13.5, minHeightMm: 4.763, label: '3/16 in (13.5 pt)' },
      { maxAreaSqIn: 400, minHeightPt: 18.0, minHeightMm: 6.350, label: '1/4 in (18 pt)' },
      { maxAreaSqIn: Infinity, minHeightPt: 36.0, minHeightMm: 12.70, label: '1/2 in (36 pt)' },
    ],
    embossedAdditivePt: 4.5, // 21 CFR §101.105(h)(5) +1/16 in if blown, formed, or molded
    unitsRequired: ['us_customary', 'metric'],
    limitations: [
      'Applies strictly to Principal Display Panel; does not mandate bottom 30% on packages ≤ 5 sq inches.',
      'Requires dual US customary and metric units under the Fair Packaging and Labeling Act (FPLA).',
      'Distinguishes liquid volume (fl oz) from solid weight (oz net wt).',
    ],
  },

  // 2. US Name and Place of Business (21 CFR §101.2 & §101.5)
  {
    ruleId: 'US-FDA-MFR-ADDR-01',
    declarationType: 'MANUFACTURER_ADDRESS',
    jurisdiction: 'US',
    productCategory: 'ALL_FOODS',
    regulatorySource: 'FDA 21 CFR §101.2(b) & 21 CFR §101.5',
    sourceQuotation: 'The label of a food in packaged form shall specify conspicuously the name and place of business of the manufacturer, packer, or distributor... All information required to appear on the label... shall appear on the information panel or principal display panel.',
    sourceURL: 'https://www.ecfr.gov/current/title-21/section-101.5',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '1973-03-14',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['principal_display_panel', 'information_panel'],
    requiredPanelRoles: ['information_panel'], // preferred default if IP exists
    preferredPanelRole: 'information_panel',
    placementConstraints: {
      regionConstraint: 'panel_lower_region',
      allowsAlternativePanels: true,
      permittedAlternatives: ['principal_display_panel', 'information_panel'],
    },
    exceptions: [
      {
        id: 'STREET_ADDRESS_DIRECTORY_EXCEPTION',
        citation: '21 CFR §101.5(d)',
        description: 'The street address may be omitted if it is shown in a current city directory or telephone directory; city, state, and ZIP code are still mandatory.',
      },
      {
        id: 'DISTRIBUTOR_QUALIFIER_MANDATE',
        citation: '21 CFR §101.5(c)',
        description: 'Where food is not manufactured by the person whose name appears on the label, the name shall be qualified by a phrase stating the relation (e.g. "Manufactured for...", "Distributed by...").',
      },
    ],
    minimumTypeRequirements: [
      { minHeightPt: 4.5, minHeightMm: 1.588, label: '1/16 in (4.5 pt) prominent and conspicuous type' },
    ],
    limitations: [
      'Does NOT universally mandate the front panel; Information Panel or PDP are both legally permissible under 21 CFR §101.2.',
      'Does not mandate both manufacturer and distributor addresses simultaneously.',
    ],
  },

  // 3. US Nutrition Facts Panel (21 CFR §101.9)
  {
    ruleId: 'US-FDA-NUTR-PANEL-01',
    declarationType: 'NUTRITION_FACTS',
    jurisdiction: 'US',
    productCategory: 'ALL_FOODS',
    regulatorySource: 'FDA 21 CFR §101.9',
    sourceQuotation: 'Nutrition information relating to food shall be provided for all products intended for human consumption... on the information panel or principal display panel.',
    sourceURL: 'https://www.ecfr.gov/current/title-21/section-101.9',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '2016-05-27',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['information_panel', 'principal_display_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    placementConstraints: {
      regionConstraint: 'contiguous_vertical_block',
      allInformationTogether: true,
    },
    exceptions: [
      {
        id: 'LINEAR_DISPLAY_EXCEPTION',
        citation: '21 CFR §101.9(j)(13)(ii)(A)',
        description: 'Packages with 40 or fewer square inches of available label space may use tabular or linear display format.',
        condition: (panelGeometry) => (panelGeometry?.totalAvailableSqIn || 999) <= 40.0,
      },
    ],
    minimumTypeRequirements: [
      { label: 'Standard FDA Nutrition Facts typography (6 pt body, 8 pt nutrients, 10 pt bold calories/servings, 16 pt title)' },
    ],
    limitations: [
      'Must appear as a contiguous block unbroken by non-nutrition graphics or text.',
    ],
  },

  // 4. US Mandatory Major Food Allergen Statement (FALCPA & FASTER Act, 21 U.S.C. 343(w))
  {
    ruleId: 'US-FDA-ALLERGEN-01',
    declarationType: 'ALLERGEN_STATEMENT',
    jurisdiction: 'US',
    productCategory: 'ALL_FOODS',
    regulatorySource: 'Food Allergen Labeling and Consumer Protection Act (FALCPA) & FASTER Act of 2021 (21 U.S.C. 343(w))',
    sourceQuotation: 'The word "Contains", followed by the name of the food source from which the major food allergen is derived, is printed immediately after or is adjacent to the list of ingredients.',
    sourceURL: 'https://www.fda.gov/food/food-allergensgluten-free-guidance-documents-regulatory-information/food-allergen-labeling-and-consumer-protection-act-2004-falcpa',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '2006-01-01',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['information_panel', 'principal_display_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    placementConstraints: {
      regionConstraint: 'adjacent_to_ingredients',
      contiguousWithIngredients: true,
    },
    exceptions: [
      {
        id: 'INGREDIENT_COMMON_NAME_EXCEPTION',
        citation: '21 U.S.C. 343(w)(1)(A)',
        description: 'Separate "Contains" statement not required if all major allergens are declared by their common name directly in the ingredient list.',
      },
    ],
    minimumTypeRequirements: [
      { label: 'No smaller than the type size used for the ingredient list (min 1/16 in / 4.5 pt)' },
    ],
    limitations: [
      'Must appear contiguous to the ingredient list on the information panel or PDP.',
    ],
  },

  // 5. India FSSAI Vegetarian / Non-Vegetarian Logo Mark (FSS Regulations 2020)
  {
    ruleId: 'IN-FSSAI-VEG-01',
    declarationType: 'VEG_MARK',
    jurisdiction: 'IN',
    productCategory: 'PACKAGED_FOOD',
    regulatorySource: 'FSSAI Food Safety and Standards (Labelling and Display) Regulations, 2020 §2.2.2',
    sourceQuotation: 'Every package of "Vegetarian" food shall bear a declaration to this effect by a symbol in green colour consisting of a filled circle inside a square... on the Principal Display Panel in close proximity to the name or brand name of food.',
    sourceURL: 'https://www.fssai.gov.in/upload/uploadfiles/files/Compendium_Labelling_Display_23_09_2021.pdf',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '2020-11-17',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['principal_display_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    placementConstraints: {
      regionConstraint: 'top_corner_region',
      preferredCorner: 'top_left',
      closeProximityToBrand: true,
    },
    exceptions: [
      {
        id: 'MINERAL_WATER_EXEMPTION',
        citation: 'FSSAI Reg §2.2.2(4) Prov.',
        description: 'Exempts packaged drinking water and carbonated water with no other ingredients.',
      },
    ],
    minimumTypeRequirements: [
      { maxAreaSqIn: 15.5, label: '3 mm square box with 1.5 mm circle' },
      { maxAreaSqIn: 77.5, label: '4 mm square box with 2 mm circle' },
      { maxAreaSqIn: Infinity, label: '6 mm square box with 3 mm circle' },
    ],
    limitations: [
      'Mandatory on the Principal Display Panel for all prepackaged foods in India.',
    ],
  },

  // 6. India FSSAI MRP & FSSAI 14-Digit Licence Number
  {
    ruleId: 'IN-FSSAI-MRP-01',
    declarationType: 'MRP_AND_LICENSE',
    jurisdiction: 'IN',
    productCategory: 'PACKAGED_FOOD',
    regulatorySource: 'FSS (Labelling and Display) Regulations 2020 & Legal Metrology (Packaged Commodities) Rules',
    sourceQuotation: 'The FSSAI logo and licence number of the manufacturer shall be displayed on the label in contrast colour... Maximum Retail Price inclusive of all taxes must be declared.',
    sourceURL: 'https://www.fssai.gov.in',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '2020-11-17',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['information_panel', 'back_panel', 'side_panel', 'principal_display_panel'],
    requiredPanelRoles: ['information_panel'],
    preferredPanelRole: 'information_panel',
    placementConstraints: {
      regionConstraint: 'panel_lower_region',
    },
    exceptions: [],
    minimumTypeRequirements: [
      { minHeightPt: 5.0, minHeightMm: 1.8, label: 'Minimum 1.8 mm character height' },
    ],
    limitations: [
      'MRP must clearly state "incl. of all taxes" without ambiguity.',
    ],
  },

  // 7. Canada Mandatory Bilingual Declaration (Food & Drug Regulations B.01.012)
  {
    ruleId: 'CA-FDR-BILINGUAL-01',
    declarationType: 'MULTILINGUAL_REQUIREMENT',
    jurisdiction: 'CA',
    productCategory: 'PREPACKAGED_FOOD',
    regulatorySource: 'Health Canada Food and Drug Regulations (F.D.R.) §B.01.012 & Consumer Packaging and Labelling Act §6',
    sourceQuotation: 'All mandatory packaging information must be displayed in both official languages (English and French), either in parallel columns or on separate identical display panels.',
    sourceURL: 'https://laws-lois.justice.gc.ca/eng/regulations/c.r.c.,_c._870/section-B.01.012.html',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '1975-03-01',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['principal_display_panel', 'information_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    preferredPanelRole: 'principal_display_panel',
    placementConstraints: {
      regionConstraint: 'anywhere_on_panel',
      parallelOrIdentical: true,
    },
    exceptions: [
      {
        id: 'LOCAL_FEED_GRAIN_EXEMPTION',
        citation: 'FDR §B.01.012(3)',
        description: 'Exempts specialty or local products sold in unilingual municipalities under specific conditions.',
      },
    ],
    minimumTypeRequirements: [
      { minHeightPt: 4.5, minHeightMm: 1.6, label: 'Equal prominence and identical font height in French and English' },
    ],
    limitations: [
      'Requires English and French to have equal prominence; neither language may be rendered in smaller type.',
    ],
  },

  // 8. Storage Instructions Mandate (Conditional / Perishable Foods)
  {
    ruleId: 'STAT-STORAGE-INSTR-01',
    declarationType: 'STORAGE_INSTRUCTIONS',
    jurisdiction: 'US',
    productCategory: 'PERISHABLE_FOOD',
    regulatorySource: 'FDA 21 CFR §101 / Approved Quality Spec (e.g. 21 CFR §102.19 for perishable foods)',
    sourceQuotation: 'Keep Refrigerated or Keep Frozen declaration required for foods requiring refrigeration to assure safety or preservation.',
    sourceURL: 'https://www.fda.gov',
    sourceVerified: true,
    legalStatus: LEGAL_STATUSES.ENFORCEABLE_CURRENT,
    effectiveDate: '1990-01-01',
    placementAuthority: PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY,
    permittedPanelRoles: ['principal_display_panel', 'information_panel', 'back_panel'],
    requiredPanelRoles: ['principal_display_panel'],
    preferredPanelRole: 'principal_display_panel',
    placementConstraints: {
      regionConstraint: 'panel_lower_region',
      prominentOnFace: true,
    },
    exceptions: [
      {
        id: 'SHELF_STABLE_EXCEPTION',
        citation: 'FDA Quality Spec',
        description: 'Shelf-stable ambient goods are exempt from mandatory temperature storage instructions unless specified by formulation.',
        condition: (product) => product?.isShelfStable === true,
      },
    ],
    minimumTypeRequirements: [
      { minHeightPt: 6.0, label: 'Prominent conspicuous type' },
    ],
    limitations: [
      'Mandatory only for perishable, refrigerated, or frozen products; voluntary for ambient shelf-stable items.',
    ],
  },
];

/**
 * Resolves placement rule considering launch date, market, product category, and authority.
 *
 * @param {Object} query
 * @param {string} query.declarationType
 * @param {string} [query.jurisdiction='US']
 * @param {string} [query.productCategory]
 * @param {string|Date} [query.launchDate]
 */
export function lookupPlacementRule({
  declarationType,
  jurisdiction = 'US',
  productCategory = 'FOOD_AND_BEVERAGE',
  launchDate = null,
} = {}) {
  const normJur = String(jurisdiction || 'US').toUpperCase();
  const jurKey = normJur === 'IN' || normJur === 'INDIA' ? 'IN' : normJur === 'CA' || normJur === 'CANADA' ? 'CA' : 'US';
  const normType = String(declarationType || '').toUpperCase().trim();

  // Find exact match
  let match = STATUTORY_PLACEMENT_REGISTRY.find(r =>
    r.declarationType === normType && r.jurisdiction === jurKey
  );

  // Fallback to US if jurisdiction specific not found
  if (!match) {
    match = STATUTORY_PLACEMENT_REGISTRY.find(r =>
      r.declarationType === normType && r.jurisdiction === 'US'
    );
  }

  if (!match) return null;

  // Regulatory Time Machine check: evaluate effective date against launch date
  let evaluatedStatus = match.legalStatus;
  let isProposed = false;
  if (launchDate && match.effectiveDate) {
    const launchTime = new Date(launchDate).getTime();
    const effectiveTime = new Date(match.effectiveDate).getTime();
    if (!isNaN(launchTime) && !isNaN(effectiveTime) && launchTime < effectiveTime) {
      evaluatedStatus = LEGAL_STATUSES.PROPOSED_FUTURE;
      isProposed = true;
    }
  }

  return {
    ...match,
    activeLegalStatus: evaluatedStatus,
    isProposedFutureRule: isProposed,
  };
}

/**
 * Returns all rules supported by the registry.
 */
export function getAllPlacementRules() {
  return [...STATUTORY_PLACEMENT_REGISTRY];
}
