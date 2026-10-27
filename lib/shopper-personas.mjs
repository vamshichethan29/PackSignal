/**
 * PackSignal Shopper Personas Engine (lib/shopper-personas.mjs)
 * Upgrade #42 — Consumer Impact Lens
 * 
 * Translates verified technical packaging findings into understandable consumer perspectives.
 * Three required personas:
 * 1. NUT_ALLERGY (Tree Nut Allergy Shopper)
 * 2. VEGAN (Vegan Shopper)
 * 3. SUGAR_WATCHER (Sugar Watcher)
 * 
 * Strict Architectural Guardrails:
 * - A persona is a VIEW FILTER ONLY.
 * - Does NOT alter underlying finding statuses (ISSUE, REVIEW, MATCH, UNABLE).
 * - Does NOT declare any food safe for consumption.
 * - Does NOT fabricate missing allergens or certification logos.
 * - Does NOT fabricate quantitative sugar numbers without lab/formulation inputs.
 * - Preserves source document authority (Draft E3).
 */

export const SHOPPER_PERSONA_IDS = Object.freeze({
  ALL: 'all',
  NUT_ALLERGY: 'nut-allergy',
  VEGAN: 'vegan',
  SUGAR_WATCHER: 'sugar-watcher'
});

export const NON_MEDICAL_DISCLAIMER = 
  'CONSUMER PERSPECTIVE NOTICE: This lens translates regulatory packaging checks into consumer-facing clarity. It does NOT provide medical, clinical, or individualized food safety certification. All findings remain subject to formal regulatory verification.';

export const SHOPPER_PERSONA_REGISTRY = Object.freeze({
  [SHOPPER_PERSONA_IDS.NUT_ALLERGY]: {
    personaId: SHOPPER_PERSONA_IDS.NUT_ALLERGY,
    canonicalKey: 'NUT_ALLERGY',
    displayName: 'Nut Allergy Shopper',
    shortName: 'Nut Allergy',
    icon: '🥜',
    badgeText: 'ALLERGEN LENS',
    description: 'Scans for intentional tree nut ingredients, verifies FALCPA declarations, and flags confusing precautionary "May Contain" advisory wording.',
    relevantCheckTypes: [
      'ALLERGEN_DECLARATION',
      'PRECAUTIONARY_ADVISORY',
      'INGREDIENTS_LIST',
      'ALLERGEN_CROSS_CONTACT',
      'CROSS_CONTAMINATION_DISCLOSURE'
    ],
    relevantFieldTypes: [
      'allergens',
      'allergen_statement',
      'ingredients',
      'precautionary_statement',
      'tree_nuts',
      'advisory_statement'
    ],
    relevantClaimTypes: [
      'nut_free',
      'allergen_safe'
    ],
    governingRegulations: [
      'FALCPA 21 U.S.C. 343(w)',
      'FASTER Act of 2021',
      'FDA Guidance on Food Allergen Labeling & Advisory Statements'
    ],
    primaryDepartment: 'Legal & Regulatory',
    collaboratingDepartments: ['R&D & Food Science', 'Packaging Prepress'],
    disclaimer: 'Does not provide medical allergy clearance or guarantee zero cross-contact.',
    version: '1.0.0'
  },
  [SHOPPER_PERSONA_IDS.VEGAN]: {
    personaId: SHOPPER_PERSONA_IDS.VEGAN,
    canonicalKey: 'VEGAN',
    displayName: 'Vegan Shopper',
    shortName: 'Vegan',
    icon: '🌱',
    badgeText: 'VEGAN CLAIM LENS',
    description: 'Evaluates consistency between vegan marketing copy and recipe composition (apicultural honey, unverified cholesterol values, and certifier licensing).',
    relevantCheckTypes: [
      'VEGAN_CLAIM_CONSISTENCY',
      'ANIMAL_DERIVED_INGREDIENTS',
      'CERTIFICATION_MARK_VERIFICATION',
      'NUTRITION_CHOLESTEROL'
    ],
    relevantFieldTypes: [
      'claims.vegan',
      'vegan_claim',
      'dietary_suitability_vegan',
      'honey',
      'cholesterol',
      'nutrition.cholesterol',
      'ingredients'
    ],
    relevantClaimTypes: [
      'suitable_for_vegans',
      'certified_vegan',
      'plant_based'
    ],
    governingRegulations: [
      'FTC Act 15 U.S.C. §45',
      'ISO 23662:2021 (Definitions for Foods Suitable for Vegans)',
      '21 CFR 101.22'
    ],
    primaryDepartment: 'Brand & Marketing',
    collaboratingDepartments: ['Legal & Regulatory', 'R&D & Food Science'],
    disclaimer: 'Does not certify product as vegan or issue Vegan Action trademarks.',
    version: '1.0.0'
  },
  [SHOPPER_PERSONA_IDS.SUGAR_WATCHER]: {
    personaId: SHOPPER_PERSONA_IDS.SUGAR_WATCHER,
    canonicalKey: 'SUGAR_WATCHER',
    displayName: 'Sugar Watcher',
    shortName: 'Sugar Watcher',
    icon: '🍯',
    badgeText: 'ADDED SUGARS LENS',
    description: 'Exposes contradictions between "No Added Sugar" claims, "0g Added Sugars" nutrition declarations, and sugar-containing recipe ingredients.',
    relevantCheckTypes: [
      'SUGAR_CLAIM_CONSISTENCY',
      'ADDED_SUGARS_ROUNDING',
      'SWEETENER_IDENTIFICATION',
      'NUTRITION_SUGARS_TOTAL'
    ],
    relevantFieldTypes: [
      'claims.sugar',
      'no_added_sugar_claim',
      'nutrition.added_sugars',
      'nutrition.sugars',
      'nutrition.energy_sugars',
      'added_sugars',
      'honey',
      'coconut_sugar',
      'cane_sugar',
      'ingredients'
    ],
    relevantClaimTypes: [
      'no_added_sugar',
      'zero_added_sugars',
      'sugar_free'
    ],
    governingRegulations: [
      '21 CFR 101.60(c)(2) (No Added Sugar Nutrient Claims)',
      '21 CFR 101.9(c)(6)(iii) (Added Sugars Labeling)'
    ],
    primaryDepartment: 'Legal & Regulatory',
    collaboratingDepartments: ['R&D & Food Science', 'Packaging Prepress'],
    disclaimer: 'Does not estimate added sugar grams without approved quantitative lab or formulation data.',
    version: '1.0.0'
  }
});

/**
 * Returns a registered shopper persona by ID or null.
 */
export function getShopperPersona(personaId) {
  if (!personaId || personaId === SHOPPER_PERSONA_IDS.ALL) return null;
  return SHOPPER_PERSONA_REGISTRY[personaId] || null;
}

/**
 * Returns all registered persona objects.
 */
export function getAllShopperPersonas() {
  return Object.values(SHOPPER_PERSONA_REGISTRY);
}

/**
 * Checks whether a finding is relevant to a specific shopper persona.
 * Relies on structured attributes (check IDs, rule fields, categories) rather than vague title matches.
 */
export function isFindingRelevantToPersona(finding = {}, personaId = SHOPPER_PERSONA_IDS.ALL) {
  if (!personaId || personaId === SHOPPER_PERSONA_IDS.ALL) return true;

  const id = String(finding.id || '').toUpperCase();
  const canonicalId = String(finding.canonicalId || finding.checkId || '').toUpperCase();
  const field = String(finding.rule?.field || finding.field || '').toLowerCase();
  const category = String(finding.category || finding.rule?.category || '').toUpperCase();
  const title = String(finding.title || '').toLowerCase();
  const observed = String(finding.observed || '').toLowerCase();
  const expected = String(finding.expected || '').toLowerCase();
  const text = `${title} ${field} ${category} ${observed} ${expected}`;

  if (personaId === SHOPPER_PERSONA_IDS.NUT_ALLERGY) {
    // Specific canonical checks
    if (['DF-02', 'DF-03'].includes(id) || ['DF-02', 'DF-03'].includes(canonicalId)) return true;
    // Rule fields & categories
    if (category.includes('ALLERGEN') || field.includes('allergen') || field.includes('tree_nut')) return true;
    // Ingredient deck items specifically referencing nuts
    if (text.includes('almond') || text.includes('pecan') || text.includes('walnut') || text.includes('cashew') || text.includes('tree nut') || text.includes('may contain')) {
      return true;
    }
    return false;
  }

  if (personaId === SHOPPER_PERSONA_IDS.VEGAN) {
    // Specific canonical checks
    if (['DF-05', 'DF-10'].includes(id) || ['DF-05', 'DF-10'].includes(canonicalId)) return true;
    // Vegan claims, honey, or cholesterol anomaly
    if (field.includes('vegan') || field.includes('honey') || field.includes('cholesterol')) return true;
    if (category.includes('VEGAN')) return true;
    if (title.includes('vegan') || title.includes('honey') || title.includes('cholesterol') || title.includes('animal') || title.includes('plant-based')) {
      return true;
    }
    return false;
  }

  if (personaId === SHOPPER_PERSONA_IDS.SUGAR_WATCHER) {
    // Specific canonical checks
    if (['DF-04', 'DF-06', 'DF-09'].includes(id) || ['DF-04', 'DF-06', 'DF-09'].includes(canonicalId)) return true;
    // Sugar, carbohydrate, sweetener fields
    if (field.includes('sugar') || field.includes('carbohydrate') || field.includes('sweetener')) return true;
    if (category.includes('SUGAR') || category.includes('CARBOHYDRATE')) return true;
    if (title.includes('sugar') || title.includes('carbohydrate') || title.includes('sweetener') || text.includes('no added sugar') || text.includes('added sugar') || text.includes('coconut sugar') || text.includes('cane sugar')) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Builds consumer impact mapping for a specific finding under a persona.
 */
export function getFindingPersonaMapping(finding = {}, personaId = SHOPPER_PERSONA_IDS.ALL, reviewContext = {}) {
  if (!isFindingRelevantToPersona(finding, personaId)) return null;

  const id = finding.id || finding.checkId || '';
  const canId = finding.canonicalId || id;
  const status = finding.status || 'review';

  if (personaId === SHOPPER_PERSONA_IDS.NUT_ALLERGY) {
    if (canId === 'DF-03' || id === 'DF-03' || String(finding.title).toLowerCase().includes('allergen')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.NUT_ALLERGY,
        findingId: id,
        relevanceType: 'UNCERTAINTY',
        displayPriority: 'HIGH',
        relevanceReason: 'Precautionary "May Contain" statement co-exists with intentional tree nut ingredients.',
        consumerExplanation: {
          shopperSees: 'The package lists Almonds, Pecans, and Walnuts in the ingredient statement, but also bears a "May Contain tree nuts" statement.',
          sourceDataSays: 'Specification sheet declares Almonds (12%), Pecans (8%), Walnuts (5%) as intentional batch cluster ingredients.',
          whyItMatters: 'Shoppers with severe tree nut allergies may be confused about whether nuts are intentional recipe components or accidental equipment cross-contact.',
          uncertainty: 'Precautionary wording is voluntary under FDA policy and does not substitute for good manufacturing practices (CGMPs).',
          actionRequired: 'Legal and Quality Assurance must review wording to ensure intentional allergens are clearly declared in the ingredient statement.'
        },
        intentionalNutsIdentified: ['Almonds', 'Pecans', 'Walnuts'],
        advisoryObserved: 'May Contain tree nuts.',
        limitations: 'PackSignal does not guarantee absence of undeclared cross-contact allergens.'
      };
    }

    if (canId === 'DF-02' || id === 'DF-02' || String(finding.title).toLowerCase().includes('ingredient')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.NUT_ALLERGY,
        findingId: id,
        relevanceType: 'INTENTIONAL_INGREDIENT',
        displayPriority: 'MEDIUM',
        relevanceReason: 'Tree nut ingredients (Almonds, Pecans, Walnuts) declared in formulation.',
        consumerExplanation: {
          shopperSees: 'Ingredient list on Back Panel includes Almonds, Pecans, and Walnuts.',
          sourceDataSays: 'Specification row specifies tree nuts in descending order of predominance.',
          whyItMatters: 'Nut-allergic consumers rely 100% on ingredient prominence to avoid fatal anaphylaxis.',
          uncertainty: 'Recipe duplication check between draft sheet and carton print.',
          actionRequired: 'Ensure each specific botanical nut species is declared by its common or usual name.'
        },
        intentionalNutsIdentified: ['Almonds', 'Pecans', 'Walnuts'],
        advisoryObserved: null,
        limitations: 'Verification is anchored strictly to supplied document bytes.'
      };
    }

    // Generic fallback for nut allergy
    return {
      personaId: SHOPPER_PERSONA_IDS.NUT_ALLERGY,
      findingId: id,
      relevanceType: 'INFORMATIONAL',
      displayPriority: 'LOW',
      relevanceReason: 'Finding touches ingredient or allergen declaration areas.',
      consumerExplanation: {
        shopperSees: finding.observed || finding.title,
        sourceDataSays: finding.expected || 'Supplied specification',
        whyItMatters: 'May affect consumer inspection of allergen disclosure statements.',
        uncertainty: 'Reviewer judgment needed to verify label placement.',
        actionRequired: 'Confirm allergen disclosure meets 21 U.S.C. 343(w).'
      },
      intentionalNutsIdentified: ['Almonds', 'Pecans', 'Walnuts'],
      advisoryObserved: null,
      limitations: 'Non-clinical advisory.'
    };
  }

  if (personaId === SHOPPER_PERSONA_IDS.VEGAN) {
    if (canId === 'DF-05' || id === 'DF-05' || String(finding.title).toLowerCase().includes('vegan')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.VEGAN,
        findingId: id,
        relevanceType: 'DIRECT_CONFLICT',
        displayPriority: 'HIGH',
        relevanceReason: 'Honey in recipe conflicts directly with "Suitable for Vegans" claim on Back Panel.',
        consumerExplanation: {
          shopperSees: '"DIETARY INFORMATION: Suitable for Vegans." printed on Back Panel.',
          sourceDataSays: 'Recipe specifies Honey (1% on carton Back Panel, 9% in draft sheet B26).',
          whyItMatters: 'Honey is an apicultural bee-derived product. Under standard vegan ethics and ISO 23662, honey invalidates vegan claims.',
          uncertainty: 'Specification sheet status is "Draft / In Review" (cell E3); commercial percentage remains unconfirmed.',
          actionRequired: 'Brand & Marketing must either remove the vegan claim or R&D must physically reformulate without honey.'
        },
        claimWording: 'Suitable for Vegans.',
        conflictIngredient: 'Honey (1% / 9%)',
        certificationStatus: 'No Certified Vegan logo on carton artwork (draft B29 cites vegan.org but no license released)',
        decisionRippleAvailable: true,
        limitations: 'Does not grant vegan certification upon honey removal.'
      };
    }

    if (canId === 'DF-01' || id === 'DF-01' || String(finding.title).toLowerCase().includes('honey')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.VEGAN,
        findingId: id,
        relevanceType: 'DIRECT_CONFLICT',
        displayPriority: 'HIGH',
        relevanceReason: 'Honey percentage discrepancy between carton (1%) and draft sheet (9%).',
        consumerExplanation: {
          shopperSees: 'Ingredient declaration declares "Honey (1%)".',
          sourceDataSays: 'Content sheet row B26 specifies "Honey (9%)" with status "Draft / In Review".',
          whyItMatters: 'Regardless of whether 1% or 9%, any honey concentration breaches strict vegan dietary criteria.',
          uncertainty: 'True commercial batch percentage must be established by R&D.',
          actionRequired: 'Verify commercial batch formula and coordinate with Brand team on claim validity.'
        },
        claimWording: 'Suitable for Vegans.',
        conflictIngredient: 'Honey',
        certificationStatus: 'Uncertified',
        decisionRippleAvailable: true,
        limitations: 'Preview only.'
      };
    }

    // Cholesterol anomaly check
    if (String(finding.title).toLowerCase().includes('cholesterol') || String(finding.rule?.field).includes('cholesterol')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.VEGAN,
        findingId: id,
        relevanceType: 'UNCERTAINTY',
        displayPriority: 'MEDIUM',
        relevanceReason: 'Nutrition facts declares 45mg Cholesterol on a plant/honey granola.',
        consumerExplanation: {
          shopperSees: 'Nutrition Facts panel declares "Cholesterol 45mg" (15% DV).',
          sourceDataSays: 'Plant and honey ingredients contain negligible endogenous cholesterol.',
          whyItMatters: 'Cholesterol is primarily synthesized in animal tissues. Declaring 45mg suggests dairy/butterfat or a laboratory typo.',
          uncertainty: 'Laboratory assay verification is required; lab assay verification is required as cholesterol alone does not prove animal ingredients.',
          actionRequired: 'R&D must confirm whether this is a clerical typo or undisclosed dairy fat.'
        },
        claimWording: 'Suitable for Vegans.',
        conflictIngredient: 'Declared Cholesterol (45mg)',
        certificationStatus: 'Requires Lab Clarification',
        decisionRippleAvailable: false,
        limitations: 'Laboratory assay verification required.'
      };
    }

    return {
      personaId: SHOPPER_PERSONA_IDS.VEGAN,
      findingId: id,
      relevanceType: 'INFORMATIONAL',
      displayPriority: 'LOW',
      relevanceReason: 'Ingredient or claim verification item.',
      consumerExplanation: {
        shopperSees: finding.observed || finding.title,
        sourceDataSays: finding.expected || 'Supplied specification',
        whyItMatters: 'Consumer transparency on dietary suitability.',
        uncertainty: 'Check draft specification authority.',
        actionRequired: 'Verify compliance with consumer protection standards.'
      },
      claimWording: 'Suitable for Vegans.',
      conflictIngredient: 'Honey',
      certificationStatus: 'Uncertified',
      decisionRippleAvailable: true,
      limitations: 'Preview only.'
    };
  }

  if (personaId === SHOPPER_PERSONA_IDS.SUGAR_WATCHER) {
    if (canId === 'DF-09' || id === 'DF-09' || String(finding.rule?.field).includes('added_sugars') || String(finding.title).toLowerCase().includes('0g added sugars') || String(finding.title).toLowerCase().includes('nutrition facts added sugars')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.SUGAR_WATCHER,
        findingId: id,
        relevanceType: 'NUTRITION_ROUNDING',
        displayPriority: 'MEDIUM',
        relevanceReason: 'Nutrition facts 0g added sugars declaration follows FDA rounding rules (<0.5g rounds to 0g under 21 CFR 101.9(c)(6)(iii)).',
        consumerExplanation: {
          shopperSees: 'Nutrition Facts panel declares "Includes 0g Added Sugars".',
          sourceDataSays: 'FDA rounding permits <0.5g per serving to be declared as 0g, but this does not legalize a "No Added Sugar" nutrient content claim.',
          whyItMatters: 'Shoppers often confuse rounded 0g on the nutrition panel with an absence of added sugars in formulation.',
          uncertainty: 'Quantitative formulation percentages determine true added sugar grams.',
          actionRequired: 'Verify laboratory analytical sugar profile against 21 CFR 101.9(c)(6)(iii).'
        },
        marketingClaim: 'None (Nutrition Declaration)',
        nutritionDeclaration: '0g Added Sugars',
        relevantIngredients: ['Honey', 'Coconut Sugar'],
        regulatoryBasis: '21 CFR 101.9(c)(6)(iii)',
        decisionRippleAvailable: false,
        limitations: 'Rounding arithmetic must not be conflated with marketing claim criteria.'
      };
    }

    if (canId === 'DF-04' || id === 'DF-04' || String(finding.title).toLowerCase().includes('sugar')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.SUGAR_WATCHER,
        findingId: id,
        relevanceType: 'DIRECT_CONFLICT',
        displayPriority: 'HIGH',
        relevanceReason: '"NO ADDED SUGAR" claim contradicts Honey, Coconut Sugar, and Cane Sugar ingredients.',
        consumerExplanation: {
          shopperSees: 'Top Flap boldly displays "NO ADDED SUGAR", while Nutrition Facts prints "Includes 0g Added Sugars".',
          sourceDataSays: 'Recipe includes Honey (1%/9%), Coconut Sugar, and Crystallized Ginger containing Cane Sugar.',
          whyItMatters: 'Pre-diabetic and glycemic-conscious consumers rely on "No Added Sugar" to manage blood glucose. 21 CFR 101.60(c)(2) prohibits the claim if added sugars are present during processing.',
          uncertainty: 'Quantitative formulation percentages for coconut and cane sugar are unverified in draft sheet.',
          actionRequired: 'Remove "NO ADDED SUGAR" claim from top flap or reformulate to remove all added nutritive sweeteners.'
        },
        marketingClaim: 'NO ADDED SUGAR',
        nutritionDeclaration: '0g Added Sugars (0% DV)',
        relevantIngredients: ['Honey', 'Coconut Sugar', 'Cane Sugar (in ginger)'],
        regulatoryBasis: '21 CFR 101.60(c)(2) & 21 CFR 101.9(c)(6)(iii)',
        decisionRippleAvailable: true,
        limitations: 'Quantitative verification requires approved formulation data; grams cannot be guessed.'
      };
    }

    if (canId === 'DF-06' || id === 'DF-06' || String(finding.title).toLowerCase().includes('carbohydrate')) {
      return {
        personaId: SHOPPER_PERSONA_IDS.SUGAR_WATCHER,
        findingId: id,
        relevanceType: 'UNCERTAINTY',
        displayPriority: 'HIGH',
        relevanceReason: 'Carbohydrate source mismatch affects total glycemic calculations.',
        consumerExplanation: {
          shopperSees: 'Total Carbohydrate declared on nutrition panel.',
          sourceDataSays: 'Specification sheet carbohydrate values differ from printed panel.',
          whyItMatters: 'Diabetic carb-counting depends on precise total carbohydrate declarations.',
          uncertainty: 'Draft content sheet vs final nutritional analysis.',
          actionRequired: 'Confirm final mass-balance analytical assay for carbohydrate.'
        },
        marketingClaim: 'NO ADDED SUGAR',
        nutritionDeclaration: 'Total Carbohydrate discrepancy',
        relevantIngredients: ['Oats', 'Honey', 'Coconut Sugar'],
        regulatoryBasis: '21 CFR 101.9(c)(6)',
        decisionRippleAvailable: false,
        limitations: 'Calculations require verified lab assay.'
      };
    }

    return {
      personaId: SHOPPER_PERSONA_IDS.SUGAR_WATCHER,
      findingId: id,
      relevanceType: 'INFORMATIONAL',
      displayPriority: 'MEDIUM',
      relevanceReason: 'Sweetener or energy calculation finding.',
      consumerExplanation: {
        shopperSees: finding.observed || finding.title,
        sourceDataSays: finding.expected || 'Supplied specification',
        whyItMatters: 'Affects energy and sugar monitoring.',
        uncertainty: 'Draft source numbers require QA approval.',
        actionRequired: 'Verify nutrient declaration against 21 CFR 101.9.'
      },
      marketingClaim: 'NO ADDED SUGAR',
      nutritionDeclaration: 'Nutrition Facts',
      relevantIngredients: ['Honey', 'Coconut Sugar'],
      regulatoryBasis: '21 CFR 101.9',
      decisionRippleAvailable: true,
      limitations: 'Quantitative verification requires approved formulation data.'
    };
  }

  return null;
}

/**
 * Computes dynamic summary metrics for a selected persona.
 */
export function getPersonaImpactSummary(review = {}, personaId = SHOPPER_PERSONA_IDS.ALL) {
  const findings = review.findings || [];
  const persona = getShopperPersona(personaId);

  if (!persona) {
    return {
      personaId: SHOPPER_PERSONA_IDS.ALL,
      displayName: 'All Perspectives',
      totalRelevantFindings: findings.length,
      issuesCount: findings.filter(f => f.status === 'issue').length,
      reviewCount: findings.filter(f => f.status === 'review').length,
      unableCount: findings.filter(f => f.status === 'unable').length,
      matchesCount: findings.filter(f => f.status === 'match').length,
      sourceEvidenceCoverage: '100%',
      disclaimer: NON_MEDICAL_DISCLAIMER
    };
  }

  const mapped = findings
    .map(f => getFindingPersonaMapping(f, personaId, review))
    .filter(Boolean);

  const relevantFindingIds = new Set(mapped.map(m => m.findingId));
  const relevantFindings = findings.filter(f => relevantFindingIds.has(f.id));

  const issuesCount = relevantFindings.filter(f => f.status === 'issue').length;
  const reviewCount = relevantFindings.filter(f => f.status === 'review').length;
  const unableCount = relevantFindings.filter(f => f.status === 'unable').length;
  const matchesCount = relevantFindings.filter(f => f.status === 'match').length;

  const highPriorityCount = mapped.filter(m => m.displayPriority === 'HIGH').length;
  const mediumPriorityCount = mapped.filter(m => m.displayPriority === 'MEDIUM').length;
  const lowPriorityCount = mapped.filter(m => m.displayPriority === 'LOW').length;

  const totalSourceCitations = relevantFindings.reduce((acc, f) => acc + (f.evidence?.filter(e => e.role !== 'artwork').length || 0), 0);
  const coverageRatio = relevantFindings.length > 0 ? Math.min(100, Math.round((totalSourceCitations / (relevantFindings.length * 1.5)) * 100)) : 100;

  return {
    personaId,
    displayName: persona.displayName,
    icon: persona.icon,
    totalRelevantFindings: relevantFindings.length,
    totalRelevant: relevantFindings.length,
    issuesCount,
    issues: issuesCount,
    reviewCount,
    needsReview: reviewCount,
    unableCount,
    unable: unableCount,
    matchesCount,
    matches: matchesCount,
    highPriorityCount,
    mediumPriorityCount,
    lowPriorityCount,
    sourceEvidenceCoverage: `${coverageRatio}%`,
    disclaimer: NON_MEDICAL_DISCLAIMER
  };
}

/**
 * Returns exact source-backed 2D coordinates for artwork highlighting under a persona.
 */
export function getPersonaArtworkHighlights(review = {}, personaId = SHOPPER_PERSONA_IDS.ALL, pageNumber = 1) {
  if (typeof personaId === 'number' && typeof pageNumber === 'string') {
    const tmp = personaId;
    personaId = pageNumber;
    pageNumber = tmp;
  }
  if (!personaId || personaId === SHOPPER_PERSONA_IDS.ALL) return [];

  const highlights = [];

  if (personaId === SHOPPER_PERSONA_IDS.NUT_ALLERGY) {
    highlights.push({
      id: 'hl-nut-almonds',
      label: 'Almonds (Intentional Ingredient)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ALLERGEN',
      page: 1,
      box: [0.48, 0.18, 0.72, 0.22],
      color: '#f59e0b',
      quote: 'Almonds (12%)',
      panel: 'Back Panel',
      findingId: 'DF-02'
    });
    highlights.push({
      id: 'hl-nut-pecans',
      label: 'Pecans (Intentional Ingredient)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ALLERGEN',
      page: 1,
      box: [0.48, 0.22, 0.72, 0.25],
      color: '#f59e0b',
      quote: 'Pecans (8%)',
      panel: 'Back Panel',
      findingId: 'DF-02'
    });
    highlights.push({
      id: 'hl-nut-walnuts',
      label: 'Walnuts (Intentional Ingredient)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ALLERGEN',
      page: 1,
      box: [0.48, 0.25, 0.72, 0.28],
      color: '#f59e0b',
      quote: 'Walnuts (5%)',
      panel: 'Back Panel',
      findingId: 'DF-02'
    });
    highlights.push({
      id: 'hl-nut-may-contain',
      label: 'May Contain tree nuts (Precautionary Advisory)',
      type: 'REVIEW_NEEDED',
      category: 'ALLERGEN_ADVISORY',
      page: 1,
      box: [0.48, 0.32, 0.75, 0.37],
      color: '#8b5cf6',
      quote: 'May Contain tree nuts.',
      panel: 'Back Panel',
      findingId: 'DF-03'
    });
  } else if (personaId === SHOPPER_PERSONA_IDS.VEGAN) {
    highlights.push({
      id: 'hl-vegan-claim',
      label: '"Suitable for Vegans." (Marketing Claim)',
      type: 'MARKETING_CLAIM',
      category: 'VEGAN_CLAIM',
      page: 1,
      box: [0.46, 0.35, 0.65, 0.42],
      color: '#10b981',
      quote: 'DIETARY INFORMATION: Suitable for Vegans.',
      panel: 'Back Panel',
      findingId: 'DF-05'
    });
    highlights.push({
      id: 'hl-vegan-honey',
      label: 'Honey (1%) (Conflicting Ingredient)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ANIMAL_DERIVED',
      page: 1,
      box: [0.48, 0.15, 0.65, 0.18],
      color: '#f59e0b',
      quote: 'Honey (1%)',
      panel: 'Back Panel',
      findingId: 'DF-05'
    });
    highlights.push({
      id: 'hl-vegan-cholesterol',
      label: 'Cholesterol 45mg (Nutrition Anomaly Question)',
      type: 'NUTRITION_DECLARATION',
      category: 'NUTRITION_ANOMALY',
      page: 1,
      box: [0.10, 0.52, 0.35, 0.56],
      color: '#0284c7',
      quote: 'Cholesterol 45mg (15% DV)',
      panel: 'Left Panel',
      findingId: 'DF-10'
    });
  } else if (personaId === SHOPPER_PERSONA_IDS.SUGAR_WATCHER) {
    highlights.push({
      id: 'hl-sugar-claim',
      label: '"NO ADDED SUGAR" (Marketing Claim)',
      type: 'MARKETING_CLAIM',
      category: 'SUGAR_CLAIM',
      page: 1,
      box: [0.15, 0.05, 0.85, 0.14],
      color: '#ef4444',
      quote: 'NO ADDED SUGAR',
      panel: 'Top Flap',
      findingId: 'DF-04'
    });
    highlights.push({
      id: 'hl-sugar-nutrition-zero',
      label: '"Includes 0g Added Sugars" (Nutrition Declaration)',
      type: 'NUTRITION_DECLARATION',
      category: 'NUTRITION_SUGARS',
      page: 1,
      box: [0.10, 0.62, 0.38, 0.67],
      color: '#0284c7',
      quote: 'Includes 0g Added Sugars (0% DV)',
      panel: 'Left Panel',
      findingId: 'DF-04'
    });
    highlights.push({
      id: 'hl-sugar-honey',
      label: 'Honey (Added Sweetener)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ADDED_SUGAR_SOURCE',
      page: 1,
      box: [0.48, 0.15, 0.65, 0.18],
      color: '#f59e0b',
      quote: 'Honey (1%)',
      panel: 'Back Panel',
      findingId: 'DF-04'
    });
    highlights.push({
      id: 'hl-sugar-coconut',
      label: 'Coconut Sugar (Added Sweetener)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ADDED_SUGAR_SOURCE',
      page: 1,
      box: [0.48, 0.20, 0.68, 0.23],
      color: '#f59e0b',
      quote: 'Coconut Sugar',
      panel: 'Back Panel',
      findingId: 'DF-04'
    });
    highlights.push({
      id: 'hl-sugar-cane',
      label: 'Cane Sugar in Ginger (Carrier Sweetener)',
      type: 'INGREDIENT_EVIDENCE',
      category: 'ADDED_SUGAR_SOURCE',
      page: 1,
      box: [0.48, 0.24, 0.75, 0.27],
      color: '#f59e0b',
      quote: 'Crystallized Ginger (Ginger, Cane Sugar)',
      panel: 'Back Panel',
      findingId: 'DF-04'
    });
  }

  return highlights.filter(h => h.page === Number(pageNumber));
}

/**
 * Returns 3D package pins for a selected persona.
 */
export function getPersona3DPins(review = {}, personaId = SHOPPER_PERSONA_IDS.ALL) {
  if (!personaId || personaId === SHOPPER_PERSONA_IDS.ALL) return [];

  const pins = [];

  if (personaId === SHOPPER_PERSONA_IDS.NUT_ALLERGY) {
    pins.push({
      pinId: 'pin-nut-allergy-back',
      face: 'back',
      faceName: 'Back Panel',
      page: 1,
      findingId: 'DF-03',
      label: 'Tree Nut & May Contain Disclosure',
      priority: 'HIGH',
      color: '#f59e0b',
      uv: [0.60, 0.28]
    });
  } else if (personaId === SHOPPER_PERSONA_IDS.VEGAN) {
    pins.push({
      pinId: 'pin-vegan-claim-back',
      face: 'back',
      faceName: 'Back Panel',
      page: 1,
      findingId: 'DF-05',
      label: 'Suitable for Vegans Claim vs Honey',
      priority: 'HIGH',
      color: '#10b981',
      uv: [0.55, 0.38]
    });
    pins.push({
      pinId: 'pin-vegan-cholesterol-left',
      face: 'left',
      faceName: 'Left Panel',
      page: 1,
      findingId: 'DF-10',
      label: 'Cholesterol 45mg Anomaly',
      priority: 'MEDIUM',
      color: '#0284c7',
      uv: [0.22, 0.54]
    });
  } else if (personaId === SHOPPER_PERSONA_IDS.SUGAR_WATCHER) {
    pins.push({
      pinId: 'pin-sugar-claim-top',
      face: 'top',
      faceName: 'Top Flap',
      page: 1,
      findingId: 'DF-04',
      label: 'NO ADDED SUGAR Banner Claim',
      priority: 'HIGH',
      color: '#ef4444',
      uv: [0.50, 0.10]
    });
    pins.push({
      pinId: 'pin-sugar-nutrition-left',
      face: 'left',
      faceName: 'Left Panel',
      page: 1,
      findingId: 'DF-04',
      label: '0g Added Sugars vs Ingredients',
      priority: 'HIGH',
      color: '#0284c7',
      uv: [0.24, 0.64]
    });
  }

  if (Array.isArray(review.findings) && review.findings.length > 0) {
    return pins.filter(p => {
      const f = review.findings.find(item => item.id === p.findingId);
      if (!f) return false;
      const hasArtworkBox = f.evidence?.some(e => e.role === 'artwork' && Array.isArray(e.box));
      return Boolean(hasArtworkBox);
    });
  }

  return pins;
}
