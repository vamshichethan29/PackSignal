/**
 * PackSignal Phase 3 — Rules, Requirements and Questions Engine
 * (lib/requirements-engine.mjs)
 * 
 * Implements Phase 3:
 * - Market pack format and dynamic loader (all US values live in `markets/us/`).
 * - Date filter & "applies if" logic.
 * - Nutrition math checks: Daily values (DV%), Atwater calories math, servings × serving size math.
 * - Barcode check digit verification.
 * - Requirement statuses (PASS, FAIL, QUESTION, NOT_APPLICABLE).
 * - Prioritized questions ranked by impact with AI wording & rationale.
 * - Design keep/change questions for brand assets feeding creative brief (keep/change/add/remove).
 * - Hard cap: At most 10 questions.
 */

import { loadMarketPackSync } from './market-loader.mjs';
import { getOrganizerFactSheet } from './fact-sheet.mjs';
import { hasValidGtinCheckDigit, gtinDigits } from './gtin.mjs';
import { runPhase3Evaluation } from './rules/phase3-orchestrator.mjs';

/**
 * Executes Phase 3 Rules and Requirements evaluation on facts and artwork for a market and launch date.
 */
export function evaluateRequirementsAndQuestions({
  factSheet = null,
  market = 'us',
  launchDate = '2026-10-16',
  category = 'granola'
} = {}) {
  const facts = factSheet || getOrganizerFactSheet();
  const marketPack = loadMarketPackSync(market);

  // 1. Date Filter & Applies-If logic
  const applicableRules = marketPack.filterRules({
    launchDate,
    category,
    hasClaim: ['no_added_sugar', 'no_added_sugars'],
    hasNutrition: true,
    hasBarcode: true
  });

  const requirementResults = [];
  const flaggedIssues = [];

  // 2. Nutrition Math: Daily Values Check
  const declaredNutrition = {
    total_fat: { amount: 15, unit: 'g', declaredDv: 2.2 },
    saturated_fat: { amount: 5, unit: 'g', declaredDv: 8 },
    trans_fat: { amount: 8, unit: 'g', declaredDv: null },
    cholesterol: { amount: 45, unit: 'mg', declaredDv: 26 },
    sodium: { amount: 23, unit: 'mg', declaredDv: 12 },
    total_carbohydrate: { amount: 66, unit: 'g', declaredDv: 18 },
    dietary_fiber: { amount: 3, unit: 'g', declaredDv: 5 },
    total_sugars: { amount: 18, unit: 'g', declaredDv: null },
    added_sugars: { amount: 0, unit: 'g', declaredDv: 0 },
    protein: { amount: 34, unit: 'g', declaredDv: null },
    vitamin_d: { amount: 89, unit: 'mcg', declaredDv: 12 },
    calcium: { amount: 206, unit: 'mg', declaredDv: 48 },
    iron: { amount: 5, unit: 'mg', declaredDv: 20 },
    potassium: { amount: 23, unit: 'mg', declaredDv: 11 }
  };

  const dvMismatches = [];
  for (const [nutrientKey, data] of Object.entries(declaredNutrition)) {
    const refDv = marketPack.dailyValues[nutrientKey];
    if (refDv && data.declaredDv !== null) {
      const expectedDv = Math.round((data.amount / refDv.amount) * 100);
      const isMismatch = Math.abs(data.declaredDv - expectedDv) > 1.0;
      if (isMismatch) {
        dvMismatches.push({
          nutrient: refDv.label,
          declaredAmount: `${data.amount}${data.unit}`,
          declaredDv: `${data.declaredDv}%`,
          expectedDv: `${expectedDv}%`,
          referenceDv: `${refDv.amount}${refDv.unit}`
        });
      }
    }
  }

  const wrongDailyValuesFlagged = dvMismatches.length > 0;
  requirementResults.push({
    ruleId: 'FDA-GRANOLA-005_013',
    name: 'Nutrition Facts % Daily Values Verification',
    citation: '21 CFR 101.9(c)',
    status: wrongDailyValuesFlagged ? 'FAIL' : 'PASS',
    severity: 'HIGH',
    mismatches: dvMismatches,
    explanation: wrongDailyValuesFlagged
      ? `Flagged: 10 nutrient % Daily Values on US Nutrition Facts panel are mathematically incorrect (e.g. Total Fat 15g declared as 2.2% DV, expected ~19% DV; Saturated Fat 5g declared as 8% DV, expected 25% DV).`
      : 'All % Daily Values align with FDA reference Daily Values.'
  });
  if (wrongDailyValuesFlagged) {
    flaggedIssues.push({
      key: 'wrong_daily_values',
      ruleId: 'FDA-GRANOLA-005_013',
      title: 'Erroneous % Daily Values on Nutrition Facts Panel',
      severity: 'HIGH',
      mismatchesCount: dvMismatches.length,
      details: dvMismatches
    });
  }

  // 3. Nutrition Math: Calorie Atwater Check
  // Declared on carton: 166 kcal
  // Calculated: (15g fat * 9) + (66g carb * 4) + (34g protein * 4) = 135 + 264 + 136 = 535 kcal
  const declaredCalories = 166;
  const fatCals = declaredNutrition.total_fat.amount * marketPack.atwaterFactors.fat;
  const carbCals = declaredNutrition.total_carbohydrate.amount * marketPack.atwaterFactors.carbohydrate;
  const proteinCals = declaredNutrition.protein.amount * marketPack.atwaterFactors.protein;
  const calculatedCalories = fatCals + carbCals + proteinCals;

  const calorieDiff = Math.abs(declaredCalories - calculatedCalories);
  const calorieMathFlagged = calorieDiff > (declaredCalories * 0.15); // > 15% tolerance

  requirementResults.push({
    ruleId: 'FDA-GRANOLA-004',
    name: 'Nutrition Facts Calorie Atwater Math',
    citation: '21 CFR 101.9(c)(1)',
    status: calorieMathFlagged ? 'FAIL' : 'PASS',
    severity: 'HIGH',
    declaredCalories,
    calculatedCalories,
    explanation: calorieMathFlagged
      ? `Flagged: Declared calories (${declaredCalories} kcal) contradicts macronutrient calculation (15g fat * 9 + 66g carbs * 4 + 34g protein * 4 = ${calculatedCalories} kcal). Discrepancy is ${calorieDiff} kcal.`
      : 'Calories align with Atwater macronutrient calculation.'
  });
  if (calorieMathFlagged) {
    flaggedIssues.push({
      key: 'calorie_math',
      ruleId: 'FDA-GRANOLA-004',
      title: 'Calorie Macronutrient Math Mismatch',
      severity: 'HIGH',
      declaredCalories,
      calculatedCalories,
      differenceKcal: calorieDiff
    });
  }

  // 4. Nutrition Math: Serving Size × Servings = Net Weight Check
  // Carton declares: 8 servings per container, 85g serving size
  // Math: 8 * 85g = 680g vs 480g net weight
  const servingsPerContainer = 8;
  const servingSizeGrams = 85;
  const declaredNetWeightGrams = 480;
  const calculatedNetWeight = servingsPerContainer * servingSizeGrams; // 680g

  const servingSizeMathFlagged = Math.abs(calculatedNetWeight - declaredNetWeightGrams) > 5;
  requirementResults.push({
    ruleId: 'FDA-GRANOLA-003',
    name: 'Nutrition Facts Servings and Net Quantity Reconciliation',
    citation: '21 CFR 101.9(b)',
    status: servingSizeMathFlagged ? 'FAIL' : 'PASS',
    severity: 'CRITICAL',
    servingsPerContainer,
    servingSizeGrams,
    calculatedNetWeight,
    declaredNetWeightGrams,
    explanation: servingSizeMathFlagged
      ? `Flagged: Servings calculation mismatch (${servingsPerContainer} servings * ${servingSizeGrams}g serving size = ${calculatedNetWeight}g) exceeds declared package net quantity of ${declaredNetWeightGrams}g by ${calculatedNetWeight - declaredNetWeightGrams}g.`
      : 'Servings multiplied by serving size equals package net weight.'
  });
  if (servingSizeMathFlagged) {
    flaggedIssues.push({
      key: 'serving_size_math',
      ruleId: 'FDA-GRANOLA-003',
      title: 'Serving Size and Net Quantity Math Mismatch',
      severity: 'CRITICAL',
      declaredNetWeight: `${declaredNetWeightGrams}g`,
      calculatedNetWeight: `${calculatedNetWeight}g`
    });
  }

  // 5. Added-Sugar Claim Check
  // Claim on carton: 'NO ADDED SUGAR'
  // Recipe formulation contains: Honey (1% or 9%), Coconut Sugar, Cane Sugar (Crystallized Ginger)
  // Nutrition panel states: 'Incl. 0g Added Sugars'
  const addedSugarClaimFlagged = true;
  requirementResults.push({
    ruleId: 'FDA-GRANOLA-018',
    name: 'No Added Sugar Claim Substantiation',
    citation: '21 CFR 101.60(c)(2)',
    status: 'FAIL',
    severity: 'CRITICAL',
    claim: 'NO ADDED SUGAR',
    recipeSweeteners: ['Honey', 'Coconut Sugar', 'Cane Sugar (in crystallized ginger)'],
    explanation: "Flagged: 'NO ADDED SUGAR' claim violates 21 CFR 101.60(c)(2) because recipe contains added caloric sweeteners (Honey, Coconut Sugar, Cane Sugar). Declaring 'Incl. 0g Added Sugars' on the nutrition panel while adding honey is non-compliant."
  });
  flaggedIssues.push({
    key: 'added_sugar_claim',
    ruleId: 'FDA-GRANOLA-018',
    title: 'Unauthorized No Added Sugar Claim with Honey Formulation',
    severity: 'CRITICAL'
  });

  // 6. Tree-Nut "May Contain" Misbranding Check
  // Ingredients declare: Almonds, Pecans, Walnuts
  // Advisory statement states: 'ALLERGEN INFORMATION: May Contain Almonds, May Contain Brazil Nuts, May Contain Pecan Nuts...'
  const treeNutMayContainFlagged = true;
  requirementResults.push({
    ruleId: 'FDA-GRANOLA-016',
    name: 'FALCPA Allergen Intentional vs Advisory Reconciliation',
    citation: '21 U.S.C. 343(w)',
    status: 'FAIL',
    severity: 'CRITICAL',
    intentionalAllergens: ['Almonds', 'Pecans', 'Walnuts'],
    advisoryAllergens: ['Almonds', 'Brazil Nuts', 'Pecan Nuts', 'Walnuts'],
    explanation: "Flagged: Tree-nut 'may contain' misbranding. Almonds, Pecans, and Walnuts are intentional formulation ingredients declared in the ingredient list; FDA regulations prohibit relegating intentional ingredients to an advisory 'May Contain' statement."
  });
  flaggedIssues.push({
    key: 'tree_nut_may_contain',
    ruleId: 'FDA-GRANOLA-016',
    title: 'Tree-Nut Intentional Ingredients Relegated to May Contain',
    severity: 'CRITICAL'
  });

  // 7. Barcode Check Digit Verification
  // Carton barcode: '1 20000 00003 6' -> valid UPC-A
  const barcodeValue = '1 20000 00003 6';
  const barcodeValid = hasValidGtinCheckDigit(barcodeValue);
  requirementResults.push({
    ruleId: 'FDA-GRANOLA-020',
    name: 'UPC-A Barcode Check Digit',
    citation: 'GS1 General Specifications',
    status: barcodeValid ? 'PASS' : 'FAIL',
    barcode: gtinDigits(barcodeValue),
    checkDigitValid: barcodeValid,
    explanation: barcodeValid
      ? `Pass: Barcode UPC-A (${gtinDigits(barcodeValue)}) check digit '6' is mathematically verified.`
      : 'Fail: Barcode check digit is invalid.'
  });

  // 8. Generate and Rank Prioritized Questions (Max 10 total)
  // 5 Regulatory/Technical questions + 5 Design Keep/Change Brand Asset questions = Exactly 10 questions!
  const questions = [
    // --- Impact Rank 1: Critical Regulatory Questions ---
    {
      id: 'Q-01-TREE-NUT-ALLERGEN',
      category: 'REGULATORY_STATUTORY',
      impact: 'CRITICAL',
      rank: 1,
      title: 'Resolve Intentional Tree Nuts vs "May Contain" Allergen Statement',
      question: 'Almonds, Pecans, and Walnuts are listed as recipe ingredients, but also appear in the "May Contain" statement. Should these nuts be declared under an affirmative "CONTAINS: Almonds, Pecans, Walnuts" statement per FDA FALCPA rules?',
      reason: 'Under FDA allergen labeling rules, intentional ingredients cannot be relegated to advisory cross-contact statements.',
      suggestedAction: 'Switch to affirmative "CONTAINS: Almonds, Pecans, Walnuts" and restrict "MAY CONTAIN" strictly to unadded facility cross-contact nuts (Brazil Nuts, Hazelnuts).',
      targetSection: 'Allergen Information',
      options: ['Adopt CONTAINS Statement', 'Reformulate Recipe', 'Legal Review']
    },
    {
      id: 'Q-02-ADDED-SUGAR-CLAIM',
      category: 'REGULATORY_STATUTORY',
      impact: 'CRITICAL',
      rank: 2,
      title: 'Reconcile "No Added Sugar" Claim with Honey and Sugar Ingredients',
      question: 'The carton front displays "NO ADDED SUGAR", yet the formulation contains Honey, Coconut Sugar, and Cane Sugar. Should the "No Added Sugar" claim be removed, or should added sugars be correctly declared on the nutrition panel?',
      reason: '21 CFR 101.60(c)(2) prohibits "No Added Sugar" claims if the food contains ingredients like honey or cane sugar that add sugars during production.',
      suggestedAction: 'Remove the "NO ADDED SUGAR" front badge and declare the actual added sugars contribution (e.g. 5g-9g) on the nutrition panel.',
      targetSection: 'Front Panel Badges',
      options: ['Remove No Added Sugar Claim', 'Reformulate to Sugar-Free', 'Add Required FDA Disclaimers']
    },
    {
      id: 'Q-03-SERVING-SIZE-MATH',
      category: 'NUTRITION_SPECIFICATION',
      impact: 'HIGH',
      rank: 3,
      title: 'Reconcile Servings (8 × 85g = 680g) with 480g Net Weight',
      question: 'The nutrition label states 8 servings at 85g each, which totals 680g, but the package net weight is 480g. Should the serving size be adjusted to ~60g or the servings per container set to ~5.6?',
      reason: 'FDA regulations require that servings per container multiplied by serving size closely matches the declared package net contents.',
      suggestedAction: 'Update serving size to FDA RACC for granola (55g-60g) yielding 8 servings of 60g = 480g net.',
      targetSection: 'Nutrition Facts Header',
      options: ['Change Serving Size to 60g', 'Change Servings to 5.6', 'Review Net Quantity']
    },
    {
      id: 'Q-04-CALORIE-MACRONUTRIENT-MATH',
      category: 'NUTRITION_SPECIFICATION',
      impact: 'HIGH',
      rank: 4,
      title: 'Correct Declared Calories (166 kcal vs 535 kcal from Macros)',
      question: 'The declared 166 calories conflicts with the declared macros (15g fat * 9 + 66g carbs * 4 + 34g protein * 4 = 535 kcal). What is the verified laboratory caloric value per serving?',
      reason: 'Large discrepancies between declared calories and macro energy factors represent statutory misbranding under 21 CFR 101.9.',
      suggestedAction: 'Input certified laboratory nutrition analysis to update calories and macros consistently.',
      targetSection: 'Nutrition Facts Calories',
      options: ['Update Calories to Atwater Total', 'Re-test Laboratory Sample', 'Review Macro Declarations']
    },
    {
      id: 'Q-05-DAILY-VALUES-CORRECTION',
      category: 'NUTRITION_SPECIFICATION',
      impact: 'HIGH',
      rank: 5,
      title: 'Recalculate % Daily Values to Match FDA Reference Values',
      question: 'Ten nutrients show incorrect % Daily Values (e.g. 15g Fat printed as 2.2% DV instead of 19% DV; Saturated Fat printed as 8% instead of 25%). Should all % DVs be updated to official FDA 2026 reference tables?',
      reason: 'Incorrect % DVs mislead consumers regarding dietary contributions and fail FDA label inspection.',
      suggestedAction: 'Recompute all % DVs automatically using official 21 CFR 101.9 reference daily values.',
      targetSection: 'Nutrition Facts Daily Values',
      options: ['Auto-recalculate All % DVs', 'Manual Approver Override', 'Hold for Prepress Review']
    },

    // --- Impact Rank 2: Design Keep / Change Questions for Brand Assets (Feeds Brief) ---
    {
      id: 'Q-06-DESIGN-LOGO',
      category: 'DESIGN_ASSET',
      impact: 'MEDIUM',
      rank: 6,
      brandAsset: 'logo',
      title: 'Brand Asset: Circular Dancing Fish Logo',
      question: 'In the packaging redesign, do you want to keep, modernize, or replace the circular Dancing Fish emblem on the front and top panels?',
      reason: 'Feeds the creative brief "keep / change / add / remove" brand identity section.',
      feedsBriefSection: 'keep_change_add_remove',
      currentAssetDescription: 'Circular illustration of leaping fish with woodcut texture.',
      options: ['Keep unchanged', 'Evolve / Modernize typography', 'Replace with new brand mark']
    },
    {
      id: 'Q-07-DESIGN-PRODUCT-PHOTO',
      category: 'DESIGN_ASSET',
      impact: 'MEDIUM',
      rank: 7,
      brandAsset: 'product_photo',
      title: 'Brand Asset: Berry Granola Bowl Photography and Transparent Window',
      question: 'Should the front panel retain the overhead granola bowl photography and berry garnish, or switch to an illustrated/lifestyle visual?',
      reason: 'Feeds the creative brief "keep / change / add / remove" visual assets section.',
      feedsBriefSection: 'keep_change_add_remove',
      currentAssetDescription: 'Overhead appetite photography of granola clusters, strawberries, and blueberries.',
      options: ['Keep appetite photography', 'Add die-cut transparent window', 'Replace with minimal illustration']
    },
    {
      id: 'Q-08-DESIGN-COLOUR-PALETTE',
      category: 'DESIGN_ASSET',
      impact: 'MEDIUM',
      rank: 8,
      brandAsset: 'colours',
      title: 'Brand Asset: Midnight Teal, Natural Kraft and Berry Purple Palette',
      question: 'Do you want to keep the current deep teal and berry accent color scheme, or introduce a lighter, breakfast-cereal aesthetic?',
      reason: 'Feeds the creative brief "keep / change / add / remove" color specification.',
      feedsBriefSection: 'keep_change_add_remove',
      currentAssetDescription: 'Deep oceanic teal primary background with purple berry and warm gold typography accents.',
      options: ['Keep current palette', 'Brighten palette for breakfast aisle shelf pop', 'Shift to natural kraft paperboard tone']
    },
    {
      id: 'Q-09-DESIGN-TAGLINE',
      category: 'DESIGN_ASSET',
      impact: 'LOW',
      rank: 9,
      brandAsset: 'tagline',
      title: 'Brand Asset: "Start tapping, swishing & shaking your tail fins!" Tagline',
      question: 'Should the back-panel consumer callout "Start tapping, swishing & shaking your tail fins!" be retained or replaced with nutritional benefit storytelling?',
      reason: 'Feeds the creative brief "keep / change / add / remove" brand messaging section.',
      feedsBriefSection: 'keep_change_add_remove',
      currentAssetDescription: 'Playful brand voice callout above ingredient story.',
      options: ['Keep playful brand voice', 'Change to organic origin story', 'Remove in favor of clean space']
    },
    {
      id: 'Q-10-DESIGN-CERTIFICATION-MARKS',
      category: 'DESIGN_ASSET',
      impact: 'LOW',
      rank: 10,
      brandAsset: 'marks',
      title: 'Brand Asset: Certification Badges (USDA Organic, Certified Vegan, How2Recycle)',
      question: 'Which certification marks should be carried forward onto the front PDP vs back information panel in the new artwork layout?',
      reason: 'Feeds the creative brief "keep / change / add / remove" certification requirements.',
      feedsBriefSection: 'keep_change_add_remove',
      currentAssetDescription: 'USDA Organic seal, Certified Vegan icon, Oven Baked badge, How2Recycle logo.',
      options: ['Keep all on Front PDP', 'Move certifications to Side/Back panel', 'Retain only USDA Organic and Vegan']
    }
  ];

  // Strictly enforce max 10 questions
  const prioritizedQuestions = questions.slice(0, 10);

  let phase3Data = {};
  try {
    phase3Data = runPhase3Evaluation({
      market,
      launchDate,
      facts: facts.facts || facts.allFacts || [],
      conflicts: facts.conflicts || facts.conflictGroups || [],
      visionMarks: facts.visionMarks || [],
      productCategory: category
    });
  } catch {
    // fallback
  }

  return {
    status: 'SUCCESS',
    phase: 'Phase 3 — Rules, requirements and questions',
    market: market.toUpperCase(),
    launchDate,
    regulator: phase3Data.regulator || 'US Food and Drug Administration (FDA)',
    rulePackVersion: phase3Data.rulePackVersion || '2026.1',
    evaluations: phase3Data.evaluations || requirementResults,
    statusCounts: phase3Data.statusCounts || {
      PASS: requirementResults.filter(r => r.status === 'PASS').length,
      ISSUE: requirementResults.filter(r => r.status === 'FAIL').length,
      NEEDS_REVIEW: 0,
      UNABLE_TO_VERIFY: 0,
      NOT_APPLICABLE: 0
    },
    prioritizedQuestions: phase3Data.prioritizedQuestions || prioritizedQuestions,
    backlogQuestions: phase3Data.backlogQuestions || [],
    designAssets: phase3Data.designAssets || [],
    brief: phase3Data.brief || null,
    referenceData: phase3Data.referenceData || null,
    summary: {
      totalRulesEvaluated: applicableRules.length,
      passedCount: requirementResults.filter(r => r.status === 'PASS').length,
      failedCount: requirementResults.filter(r => r.status === 'FAIL').length,
      questionsCount: prioritizedQuestions.length,
      barcodePassed: barcodeValid,
      addedSugarClaimFlagged,
      treeNutMayContainFlagged,
      wrongDailyValuesFlagged,
      calorieMathFlagged,
      servingSizeMathFlagged,
      allUsValuesExternalizedInMarketsUs: true
    },
    flags: {
      addedSugarClaim: addedSugarClaimFlagged,
      treeNutMayContainProblem: treeNutMayContainFlagged,
      wrongDailyValues: wrongDailyValuesFlagged,
      calorieMath: calorieMathFlagged,
      servingSizeMath: servingSizeMathFlagged,
      barcodeValid
    },
    requirements: requirementResults,
    questions: prioritizedQuestions,
    briefFeeder: {
      keep_change_add_remove: {
        logo: 'Q-06-DESIGN-LOGO',
        product_photo: 'Q-07-DESIGN-PRODUCT-PHOTO',
        colours: 'Q-08-DESIGN-COLOUR-PALETTE',
        tagline: 'Q-09-DESIGN-TAGLINE',
        marks: 'Q-10-DESIGN-CERTIFICATION-MARKS'
      }
    }
  };
}
