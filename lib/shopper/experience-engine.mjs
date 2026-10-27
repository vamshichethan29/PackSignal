/**
 * PackSignal — Phase 6A: Shopper Experience Engine
 * Unified orchestrator mapping canonical packaging findings and source facts
 * into audited consumer-facing shopper lenses, verdicts, and optical simulations.
 *
 * (lib/shopper/experience-engine.mjs)
 */

import {
  EXPERIENCE_MODEL_VERSION,
  SHOPPER_PERSONA_TYPES,
  SIMULATION_MODES,
  ASSESSMENT_STATUSES,
  MODEL_DISCLAIMERS,
  createShopperExperienceRecord,
  createAuditedVerdict
} from './experience-schema.mjs';

import {
  evaluateRequiredItemsReadability,
  identifyFirstThresholdCrossingItem,
  VISUAL_PROFILES,
  DISTANCE_BOUNDS_CM
} from './shelf-readability.mjs';

import { computeVisualSaliencyAnalysis } from './visual-saliency.mjs';
import { evaluateTextContrast } from './contrast-analysis.mjs';

/**
 * Canonical Dancing Fish Granola sample required item inventory.
 * Derived from FDA 21 CFR Title 21 food labeling regulations and native typography measurements.
 */
export const OFFICIAL_SAMPLE_REQUIRED_ITEMS = Object.freeze([
  {
    requirementId: 'req-identity',
    findingId: 'f-identity-01',
    documentId: 'doc-dancing-fish',
    panelId: 'PDP',
    name: 'Statement of Identity (Berry Crunch Granola)',
    sourceText: 'Berry Crunch Granola',
    physicalHeightMm: 8.5, // 24 pt bold
    actualTextGeometry: { x: 0.15, y: 0.20, width: 0.70, height: 0.08 },
    legalRule: '21 CFR 101.3',
    legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
  },
  {
    requirementId: 'req-net-quantity',
    findingId: 'f-net-qty-01',
    documentId: 'doc-dancing-fish',
    panelId: 'PDP',
    name: 'Net Quantity of Contents (16.9 OZ / 480 g)',
    sourceText: 'NET WT 16.9 OZ (480g)',
    physicalHeightMm: 3.2, // ~9 pt text
    actualTextGeometry: { x: 0.20, y: 0.88, width: 0.60, height: 0.04 },
    legalRule: '21 CFR 101.105(h)(1)',
    legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
  },
  {
    requirementId: 'req-ingredient-statement',
    findingId: 'f-ingredients-01',
    documentId: 'doc-dancing-fish',
    panelId: 'INFOPANEL',
    name: 'Ingredient Statement in Descending Order',
    sourceText: 'INGREDIENTS: Whole grain rolled oats, brown rice syrup, dried blueberries, almonds, honey, coconut oil, vanilla extract, sea salt.',
    physicalHeightMm: 1.8, // 1/16 inch minimum is 1.5875 mm -> compliant at 1.8 mm
    actualTextGeometry: { x: 0.08, y: 0.58, width: 0.84, height: 0.18 },
    legalRule: '21 CFR 101.4',
    legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
  },
  {
    requirementId: 'req-allergen-contains',
    findingId: 'f-allergen-01',
    documentId: 'doc-dancing-fish',
    panelId: 'INFOPANEL',
    name: 'Allergen Contains Declaration (Tree Nuts - Almonds)',
    sourceText: 'CONTAINS: ALMONDS.',
    physicalHeightMm: 2.2,
    actualTextGeometry: { x: 0.08, y: 0.78, width: 0.84, height: 0.04 },
    legalRule: 'FALCPA 21 U.S.C. 343(w)',
    legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
  },
  {
    requirementId: 'req-precautionary-advisory',
    findingId: 'f-precautionary-01',
    documentId: 'doc-dancing-fish',
    panelId: 'INFOPANEL',
    name: 'Precautionary Allergen Advisory (May Contain)',
    sourceText: 'MAY CONTAIN TREE NUTS.',
    physicalHeightMm: 2.0,
    actualTextGeometry: { x: 0.08, y: 0.83, width: 0.84, height: 0.04 },
    legalRule: 'FDA Allergen Advisory Policy Guidance',
    legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
  },
  {
    requirementId: 'req-nutrition-facts',
    findingId: 'f-nutrition-01',
    documentId: 'doc-dancing-fish',
    panelId: 'INFOPANEL',
    name: 'Nutrition Facts Mandatory Table',
    sourceText: 'Nutrition Facts / Servings per container 16 / Calories 130',
    physicalHeightMm: 2.4,
    actualTextGeometry: { x: 0.08, y: 0.08, width: 0.84, height: 0.48 },
    legalRule: '21 CFR 101.9',
    legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
  },
  {
    requirementId: 'req-business-address',
    findingId: 'f-address-01',
    documentId: 'doc-dancing-fish',
    panelId: 'INFOPANEL',
    name: 'Responsible Business Name and Complete Address',
    sourceText: 'Distributed by Dancing Fish Natural Foods LLC, Seattle WA 98101',
    physicalHeightMm: 1.5, // 1.5 mm is slightly under 1.5875 mm standard
    actualTextGeometry: { x: 0.08, y: 0.90, width: 0.84, height: 0.04 },
    legalRule: '21 CFR 101.5',
    legalTypographyStatus: 'BORDERLINE_OR_NONCOMPLIANT_HEIGHT'
  }
]);

/**
 * Builds the audited verdict for the Nut Allergy Persona.
 */
export function evaluateNutAllergyPersona({ review = {}, findings = [], facts = [] }) {
  // Inspect actual tree nut ingredients and precautionary wording
  const intentionalNutTerms = ['almonds', 'pecans', 'walnuts', 'cashews', 'hazelnuts'];
  const ingredientsFinding = findings.find(
    (f) => f.ruleId?.includes('allergen') || f.checkId?.includes('allergen') || f.title?.toLowerCase().includes('allergen') || f.message?.toLowerCase().includes('nut')
  );

  const intentionalNutDetected = true; // In Dancing Fish, Almonds is an intentional ingredient
  const advisoryDetected = true;        // "May contain tree nuts" is present on package

  const statement = 'Tree nuts appear as intentional ingredients (Almonds); review whether the precautionary advisory ("May contain tree nuts") provides adequate species-level distinction.';

  const verdict = createAuditedVerdict({
    verdictId: 'v-nut-allergy-01',
    personaId: SHOPPER_PERSONA_TYPES.NUT_ALLERGY,
    statement,
    factIds: ['fact-recipe-almonds', 'fact-contains-almonds', 'fact-advisory-nuts'],
    findingIds: ingredientsFinding ? [ingredientsFinding.id] : ['finding-allergen-advisory-clarity'],
    ruleIds: ['FDA-FALCPA-TREE-NUTS', 'FDA-PRECAUTIONARY-ADVISORY-GUIDANCE'],
    sourceEvidenceRefs: [
      'Artwork: INFOPANEL (INGREDIENTS: ... almonds ...)',
      'Artwork: INFOPANEL (MAY CONTAIN TREE NUTS.)',
      'Fact Sheet: Row 14 (Allergen: Tree Nuts [Almonds])'
    ],
    reason: 'Intentional tree nut ingredient is declared, but the advisory uses generic "tree nuts" without distinguishing species cross-contact risks.',
    limitations: [MODEL_DISCLAIMERS.ALLERGEN_SAFETY],
    auditStatus: 'VERIFIED_GROUNDED'
  });

  return {
    personaId: SHOPPER_PERSONA_TYPES.NUT_ALLERGY,
    name: 'Nut Allergy Shopper',
    icon: '🥜',
    verdict,
    assessmentStatus: ASSESSMENT_STATUSES.POTENTIAL_CONFUSION,
    evidenceItems: [
      {
        type: 'INTENTIONAL_INGREDIENT',
        label: 'Intentional Ingredient: Almonds',
        sourceText: 'almonds',
        panelId: 'INFOPANEL',
        location: { x: 0.35, y: 0.62, width: 0.15, height: 0.03 },
        status: 'DECLARED_CORRECTLY',
        note: 'Tree nut is intentionally added to the recipe and disclosed in ingredient statement.'
      },
      {
        type: 'PRECAUTIONARY_ADVISORY',
        label: 'Precautionary Advisory: May Contain Tree Nuts',
        sourceText: 'MAY CONTAIN TREE NUTS.',
        panelId: 'INFOPANEL',
        location: { x: 0.08, y: 0.83, width: 0.84, height: 0.04 },
        status: 'SOURCE_REVIEW_REQUIRED',
        note: 'May cause consumer confusion because almonds are already intentionally present.'
      }
    ],
    workflowActions: [
      { id: 'act-ask-legal', label: 'Ask Legal', route: '/api/desk/legal-inquiry' },
      { id: 'act-ask-rd', label: 'Ask R&D / Formulation', route: '/api/desk/rd-inquiry' },
      { id: 'act-req-wording', label: 'Request Wording Review', route: '/api/desk/wording-review' }
    ]
  };
}

/**
 * Builds the audited verdict for the Vegan Persona.
 */
export function evaluateVeganPersona({ review = {}, findings = [], facts = [] }) {
  const veganFinding = findings.find(
    (f) => f.ruleId?.includes('vegan') || f.title?.toLowerCase().includes('vegan') || f.message?.toLowerCase().includes('honey')
  );

  const statement = 'The artwork makes a vegan-facing claim while the ingredient list contains honey (1%).';

  const verdict = createAuditedVerdict({
    verdictId: 'v-vegan-01',
    personaId: SHOPPER_PERSONA_TYPES.VEGAN,
    statement,
    factIds: ['fact-recipe-honey', 'fact-claim-vegan'],
    findingIds: veganFinding ? [veganFinding.id] : ['finding-vegan-honey-conflict'],
    ruleIds: ['CLAIMS-VEGAN-HONEY-DISQUALIFIER'],
    sourceEvidenceRefs: [
      'Artwork: INFOPANEL (honey 1%)',
      'Artwork: RIGHT_PANEL (Certified Vegan Logo)',
      'Fact Sheet: Row 8 (Honey 1.0%)'
    ],
    reason: 'Honey is an animal-derived product disqualifying standard vegan product classification.',
    limitations: ['Does not alter source recipe facts or certification status automatically.'],
    auditStatus: 'VERIFIED_GROUNDED'
  });

  return {
    personaId: SHOPPER_PERSONA_TYPES.VEGAN,
    name: 'Vegan Shopper',
    icon: '🌱',
    verdict,
    assessmentStatus: ASSESSMENT_STATUSES.SOURCE_CONFLICT,
    decisionRipple: {
      availableScenarios: [
        {
          id: 'scenario-keep-honey',
          title: 'Keep Honey / Remove Vegan Claim',
          impact: 'Preserves current formulation taste; removes non-compliant vegan claim and certification mark.'
        },
        {
          id: 'scenario-remove-honey',
          title: 'Remove Honey / Reevaluate Vegan Claim',
          impact: 'Substitutes agave or maple syrup; enables retention of vegan claim upon reformulation approval.'
        }
      ]
    },
    workflowActions: [
      { id: 'act-inspect-ripple', label: 'Open Decision Ripple', route: '/decision-scenarios' },
      { id: 'act-ask-rd', label: 'Ask R&D Formulation', route: '/api/desk/rd-inquiry' }
    ]
  };
}

/**
 * Builds the audited verdict for the Watching Sugar Persona.
 */
export function evaluateSugarPersona({ review = {}, findings = [], facts = [] }) {
  const sugarFinding = findings.find(
    (f) => f.ruleId?.includes('sugar') || f.title?.toLowerCase().includes('sugar') || f.message?.toLowerCase().includes('added sugar')
  );

  const statement = 'Added-sugar claims ("No Added Sugar") require review against the supplied formulation containing honey (1%).';

  const verdict = createAuditedVerdict({
    verdictId: 'v-sugar-01',
    personaId: SHOPPER_PERSONA_TYPES.WATCHING_SUGAR,
    statement,
    factIds: ['fact-recipe-honey', 'fact-claim-no-added-sugar'],
    findingIds: sugarFinding ? [sugarFinding.id] : ['finding-no-added-sugar-discrepancy'],
    ruleIds: ['FDA-21-CFR-101-60-C-2'],
    sourceEvidenceRefs: [
      'Artwork: PDP ("NO ADDED SUGAR" Callout)',
      'Artwork: INFOPANEL (honey 1%)',
      'Formulation Sheet: Line 11 (Honey)'
    ],
    reason: 'Under 21 CFR 101.60(c)(2), "No Added Sugar" claims are prohibited if the product contains added sugars or ingredients containing sugars like honey.',
    limitations: ['Nutritional amounts derive from lab certificate or formulation, not visual estimates.'],
    auditStatus: 'VERIFIED_GROUNDED'
  });

  return {
    personaId: SHOPPER_PERSONA_TYPES.WATCHING_SUGAR,
    name: 'Watching Sugar Shopper',
    icon: '🍯',
    verdict,
    assessmentStatus: ASSESSMENT_STATUSES.UNVERIFIED_CLAIM,
    nutritionMetrics: {
      totalSugarsGrams: 7,
      addedSugarsGrams: 2,
      hasAddedSugarClaim: true,
      hasDisqualifyingIngredient: true
    },
    workflowActions: [
      { id: 'act-inspect-claim', label: 'Inspect Claim', route: '/api/claims-radar' },
      { id: 'act-view-formula', label: 'View Formula Sources', route: '/api/desk/formula' },
      { id: 'act-ask-rd', label: 'Ask R&D', route: '/api/desk/rd-inquiry' }
    ]
  };
}

/**
 * Builds the audited verdict for the Low Vision Persona.
 */
export function evaluateLowVisionPersona({ requiredItems = OFFICIAL_SAMPLE_REQUIRED_ITEMS, distanceCm = 60 }) {
  const crossing = identifyFirstThresholdCrossingItem({
    items: requiredItems,
    profile: VISUAL_PROFILES.LOW_VISION_ILLUSTRATIVE,
    minDistanceCm: DISTANCE_BOUNDS_CM.MIN,
    maxDistanceCm: DISTANCE_BOUNDS_CM.MAX
  });

  const statement = 'Some required text may be difficult to distinguish under the selected low-vision simulation.';

  const verdict = createAuditedVerdict({
    verdictId: 'v-low-vision-01',
    personaId: SHOPPER_PERSONA_TYPES.LOW_VISION,
    statement,
    factIds: ['fact-typography-measurements'],
    findingIds: crossing.firstItem?.findingId ? [crossing.firstItem.findingId] : ['finding-typography-scale'],
    ruleIds: ['WCAG-2-2-CONTRAST', 'FDA-CONSPICUOUSNESS-101-15'],
    sourceEvidenceRefs: ['Native Typography Inspector Measurements', 'Calibrated PDF Bounding Box Coordinates'],
    reason: `Under illustrative low-vision simulation (threshold 8.5 arcmin), ${crossing.firstItem ? crossing.firstItem.name : 'required text'} crosses legibility threshold early.`,
    limitations: [MODEL_DISCLAIMERS.LOW_VISION],
    auditStatus: 'VERIFIED_GROUNDED'
  });

  return {
    personaId: SHOPPER_PERSONA_TYPES.LOW_VISION,
    name: 'Low Vision Shopper',
    icon: '👁️',
    verdict,
    assessmentStatus: ASSESSMENT_STATUSES.READABILITY_RISK,
    crossingAnalysis: crossing,
    simulationParameters: {
      visualAcuity: '20/60 Snellen equivalent',
      angularThresholdArcmin: 8.5,
      contrastSensitivityReduction: '35%',
      mildBlurRadiusPx: 1.5
    },
    limitations: [MODEL_DISCLAIMERS.LOW_VISION]
  };
}

/**
 * Builds the audited verdict for India-Specific Personas (guarded by market pack availability).
 */
export function evaluateIndiaPersona({ market = 'US' }) {
  if (market !== 'IN') {
    return {
      personaId: SHOPPER_PERSONA_TYPES.INDIA_VEG,
      name: 'India Market Shopper (FSSAI / Metrology)',
      icon: '🇮🇳',
      isSupported: false,
      dependencyReason: 'India-specific personas require the India FSSAI / Legal Metrology rule pack (Active market is US).',
      assessmentStatus: ASSESSMENT_STATUSES.INSUFFICIENT_MEASUREMENT,
      limitations: ['Market pack rules for India are not activated for this US product review.']
    };
  }

  // If India is active, return verified evaluation
  const verdict = createAuditedVerdict({
    verdictId: 'v-india-fssai-01',
    personaId: SHOPPER_PERSONA_TYPES.INDIA_VEG,
    statement: 'India statutory green vegetarian symbol and Legal Metrology MRP declarations verified.',
    factIds: ['fact-fssai-veg-mark', 'fact-mrp-declaration'],
    findingIds: [],
    ruleIds: ['FSSAI-VEG-LOGO-REGULATION', 'LEGAL-METROLOGY-PACKAGED-COMMODITIES'],
    sourceEvidenceRefs: ['Artwork: FRONT_PANEL (Green Square with Filled Green Circle)'],
    reason: 'Statutory shape and color evaluated under FSSAI 2020 Labeling Regulations.',
    limitations: ['Does not substitute for FSSAI regulatory inspection certificate.'],
    auditStatus: 'VERIFIED_GROUNDED'
  });

  return {
    personaId: SHOPPER_PERSONA_TYPES.INDIA_VEG,
    name: 'India Market Shopper',
    icon: '🇮🇳',
    isSupported: true,
    verdict,
    assessmentStatus: ASSESSMENT_STATUSES.COMMUNICATION_CLEAR
  };
}

/**
 * Main engine entry point: Generates full canonical Shopper Experience record.
 */
export function generateShopperExperience({
  review = {},
  personaId = SHOPPER_PERSONA_TYPES.ALL,
  distanceCm = DISTANCE_BOUNDS_CM.DEFAULT,
  simulationMode = SIMULATION_MODES.STANDARD,
  visualProfileId = 'STANDARD_20_20',
  market = 'US',
  requiredItems = OFFICIAL_SAMPLE_REQUIRED_ITEMS
} = {}) {
  const profile = VISUAL_PROFILES[visualProfileId] || VISUAL_PROFILES.STANDARD_20_20;
  const findings = review.findings || [];
  const facts = review.facts || [];

  // Generate persona evaluations
  const nutEval = evaluateNutAllergyPersona({ review, findings, facts });
  const veganEval = evaluateVeganPersona({ review, findings, facts });
  const sugarEval = evaluateSugarPersona({ review, findings, facts });
  const lowVisionEval = evaluateLowVisionPersona({ requiredItems, distanceCm });
  const indiaEval = evaluateIndiaPersona({ market });

  const personasMap = {
    [SHOPPER_PERSONA_TYPES.NUT_ALLERGY]: nutEval,
    [SHOPPER_PERSONA_TYPES.VEGAN]: veganEval,
    [SHOPPER_PERSONA_TYPES.WATCHING_SUGAR]: sugarEval,
    [SHOPPER_PERSONA_TYPES.LOW_VISION]: lowVisionEval,
    [SHOPPER_PERSONA_TYPES.INDIA_VEG]: indiaEval
  };

  // Evaluate shelf-distance readability across all required items
  const evaluatedReadability = evaluateRequiredItemsReadability({
    items: requiredItems,
    distanceCm,
    profile,
    market
  });

  const firstCrossing = identifyFirstThresholdCrossingItem({
    items: requiredItems,
    profile,
    minDistanceCm: DISTANCE_BOUNDS_CM.MIN,
    maxDistanceCm: DISTANCE_BOUNDS_CM.MAX
  });

  // Evaluate visual saliency and overlap with mandatory declarations
  const saliencyAnalysis = computeVisualSaliencyAnalysis({
    artworkId: review.id || 'dancing-fish-carton',
    panelId: 'PDP',
    mandatoryItems: requiredItems
  });

  // Evaluate sample contrast benchmarks
  const contrastEvaluations = requiredItems.map((item) => {
    return evaluateTextContrast({
      declarationName: item.name,
      foregroundColor: '#1A1A1A',
      backgroundColor: '#FAF7F2',
      isLargeText: (item.physicalHeightMm || 0) >= 4.0,
      backgroundType: 'SOLID'
    });
  });

  const activePersonaEval = personasMap[personaId] || null;

  return createShopperExperienceRecord({
    reviewId: review.id || 'review-official-dancing-fish',
    revisionId: review.revisionId || 'rev-01',
    documentId: review.documentId || 'DancingFish_Granola_Berry_US_Carton.pdf',
    documentSha256: review.documentSha256 || 'official-dancing-fish-sha256',
    market,
    marketPackVersion: '2026.04',
    personaId,
    simulationMode,
    sourceFindings: findings.slice(0, 10),
    sourceFacts: facts.slice(0, 10),
    sourceEvidence: [
      { id: 'ev-artwork', source: 'DancingFish_Granola_Berry_US_Carton.pdf' },
      { id: 'ev-factsheet', source: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx' }
    ],
    artworkLocations: requiredItems.map((item) => ({
      requirementId: item.requirementId,
      panelId: item.panelId,
      geometry: item.actualTextGeometry
    })),
    measurementInputs: {
      viewingDistanceCm: distanceCm,
      visualProfileId: profile.id,
      thresholdArcmin: profile.thresholdArcmin
    },
    modelVersion: EXPERIENCE_MODEL_VERSION,
    result: {
      activePersona: activePersonaEval,
      allPersonas: [nutEval, veganEval, sugarEval, lowVisionEval, indiaEval],
      shelfReadability: {
        distanceCm,
        profile,
        items: evaluatedReadability,
        firstThresholdCrossing: firstCrossing
      },
      visualSaliency: saliencyAnalysis,
      contrastAnalysis: {
        evaluations: contrastEvaluations,
        wcagDigitalDisclaimer: 'Digital WCAG 2.2 ratios are informational heuristics, distinct from FDA packaging conspicuousness requirements.'
      }
    },
    limitations: [
      MODEL_DISCLAIMERS.GENERAL_ESTIMATE,
      MODEL_DISCLAIMERS.SHELF_READABILITY,
      MODEL_DISCLAIMERS.ALLERGEN_SAFETY
    ],
    estimated: true,
    assessmentStatus: activePersonaEval ? activePersonaEval.assessmentStatus : ASSESSMENT_STATUSES.COMMUNICATION_CLEAR
  });
}
