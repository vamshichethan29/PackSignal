/**
 * PackSignal US Food Label Preflight Pack — Check US-006: Calorie & Macronutrient Sanity
 * Legal Basis: 21 CFR 101.9(c)(1)
 */

import { FDA_STATUTORY_CITATIONS } from './references.mjs';

/**
 * Executes Check US-006: Calorie and Macronutrient Sanity Screening
 */
export function executeUsCalorieSanityCheck({
  declaredCalories = null,
  fatGrams = null,
  carbGrams = null,
  proteinGrams = null,
  dietaryFiberGrams = 0,
  specialFactorsKnown = false,
  evidenceBox = null,
} = {}) {
  const citation = FDA_STATUTORY_CITATIONS.US_006_CALORIE_SANITY;

  if (declaredCalories == null || fatGrams == null || carbGrams == null || proteinGrams == null) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'requires_evidence',
      findingStatus: 'unable',
      requiredInputs: ['declared_calories', 'fat_grams', 'carb_grams', 'protein_grams'],
      observedValue: `Calories: ${declaredCalories ?? 'missing'}, Fat: ${fatGrams ?? 'missing'}g, Carb: ${carbGrams ?? 'missing'}g, Protein: ${proteinGrams ?? 'missing'}g`,
      expectedValue: 'Complete declared calories and macronutrient values',
      calculation: null,
      evidence: null,
      explanation: 'Calorie sanity screening requires declared calories, total fat, total carbohydrate, and protein values per serving.',
      limitations: 'Calculations require per-serving macronutrient values.',
    };
  }

  const calNum = Number(declaredCalories);
  const fatNum = Number(fatGrams);
  const carbNum = Number(carbGrams);
  const protNum = Number(proteinGrams);

  // General Atwater 4-4-9 screening calculation
  const fatCalories = fatNum * 9;
  const carbCalories = carbNum * 4;
  const proteinCalories = protNum * 4;
  const generalEstimatedCalories = fatCalories + carbCalories + proteinCalories;

  const diff = Math.abs(calNum - generalEstimatedCalories);
  const diffPct = calNum > 0 ? (diff / calNum) * 100 : 0;

  const calculationSummary = `Estimate: (${fatNum}g fat × 9) + (${carbNum}g carb × 4) + (${protNum}g protein × 4) = ${generalEstimatedCalories} kcal vs declared ${calNum} kcal (diff: ${diff} kcal / ${diffPct.toFixed(1)}%)`;

  // Standard 20% tolerance screening band under 21 CFR 101.9(g) compliance guidance
  if (diffPct <= 20 || diff <= 15) {
    return {
      checkId: citation.checkId,
      title: citation.name,
      legalBasis: citation.citation,
      sourceUrl: citation.sourceUrl,
      applicability: 'applicable',
      executionStatus: 'executed',
      findingStatus: 'match',
      requiredInputs: ['declared_calories', 'fat_grams', 'carb_grams', 'protein_grams'],
      observedValue: `${calNum} Calories`,
      expectedValue: `Consistent with general Atwater estimate (~${generalEstimatedCalories} kcal)`,
      calculation: calculationSummary,
      evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: `Calories ${calNum}` }] : null,
      explanation: `Calorie and macronutrient values are plausible under general Atwater screening (within 20% tolerance). ${calculationSummary}.`,
      limitations: 'General screening estimate only; does not replace laboratory bomb calorimetry or specific food ingredient energy factor analysis.',
    };
  }

  // If discrepancy exceeds 20%, return REVIEW with clear regulatory caveats
  return {
    checkId: citation.checkId,
    title: citation.name,
    legalBasis: citation.citation,
    sourceUrl: citation.sourceUrl,
    applicability: 'applicable',
    executionStatus: 'executed',
    findingStatus: 'review',
    requiredInputs: ['declared_calories', 'fat_grams', 'carb_grams', 'protein_grams'],
    observedValue: `${calNum} Calories`,
    expectedValue: `Estimated ~${generalEstimatedCalories} kcal via 4-4-9 factor method`,
    calculation: calculationSummary,
    evidence: evidenceBox ? [{ role: 'artwork', box: evidenceBox, text: `Calories ${calNum}` }] : null,
    explanation: `Calorie plausibility review: Declared calories (${calNum}) differ by ${diffPct.toFixed(1)}% from general Atwater estimate (${generalEstimatedCalories} kcal). Caveats: 21 CFR 101.9(c)(1) permits multiple calculation methods, including subtracting insoluble dietary fiber, specific Atwater factors, or laboratory bomb calorimetry minus energy of excretion. Review formulation energy basis before declaring a label defect.`,
    limitations: 'PackSignal never automatically rewrites declared calories based on general 4-4-9 estimates.',
  };
}
