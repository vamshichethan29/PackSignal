/**
 * PackSignal — Deterministic Nutrition & Calorie Remediation Engine (lib/remediation-nutrition.mjs)
 * Implements authoritative mathematical %DV corrections and Atwater calorie screening.
 * Strictly avoids non-deterministic LLM generation for numeric nutrition facts.
 *
 * Supported Standards:
 * - US FDA 21 CFR 101.9 (2016 Revision Daily Values)
 * - EU Regulation (EU) No 1169/2011 Annex XIII Reference Intakes
 * - India FSSAI (Labelling and Display Regulations, 2020) Schedule II
 */

import { FDA_2016_DAILY_VALUES, calculateDailyValuePercent, screenAtwaterCalories } from './nutrition-validator.mjs';

export const EU_1169_REFERENCE_INTAKES = {
  energy: { name: 'Energy', standardValueKj: 8400, standardValueKcal: 2000, cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
  totalFat: { name: 'Total Fat', standardValue: 70, unit: 'g', cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
  saturatedFat: { name: 'Saturates', standardValue: 20, unit: 'g', cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
  carbohydrate: { name: 'Carbohydrate', standardValue: 260, unit: 'g', cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
  sugars: { name: 'Sugars', standardValue: 90, unit: 'g', cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
  protein: { name: 'Protein', standardValue: 50, unit: 'g', cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
  salt: { name: 'Salt', standardValue: 6, unit: 'g', cfr: 'Regulation (EU) 1169/2011 Annex XIII' },
};

export const FSSAI_DAILY_VALUES = {
  energy: { name: 'Energy', standardValue: 2000, unit: 'kcal', standard: 'FSSAI 2020 Schedule II' },
  totalFat: { name: 'Total Fat', standardValue: 67, unit: 'g', standard: 'FSSAI 2020 Schedule II' },
  saturatedFat: { name: 'Saturated Fat', standardValue: 22, unit: 'g', standard: 'FSSAI 2020 Schedule II' },
  carbohydrate: { name: 'Carbohydrates', standardValue: 300, unit: 'g', standard: 'FSSAI 2020 Schedule II' },
  sodium: { name: 'Sodium', standardValue: 2000, unit: 'mg', standard: 'FSSAI 2020 Schedule II' },
  addedSugars: { name: 'Added Sugars', standardValue: 50, unit: 'g', standard: 'FSSAI 2020 Schedule II' },
};

/**
 * Detects the specific nutrient key from finding text or title.
 */
export function identifyNutrientKey(finding) {
  const text = `${finding.id || ''} ${finding.title || ''} ${finding.observed || ''} ${finding.explanation || ''}`.toLowerCase();

  if (text.includes('sodium') || text.includes('salt')) return 'sodium';
  if (text.includes('saturated fat') || text.includes('saturates')) return 'saturatedFat';
  if (text.includes('total fat') || text.includes('fat')) return 'totalFat';
  if (text.includes('cholesterol')) return 'cholesterol';
  if (text.includes('dietary fiber') || text.includes('fibre') || text.includes('fiber')) return 'dietaryFiber';
  if (text.includes('added sugar') || text.includes('added sugars')) return 'addedSugars';
  if (text.includes('carbohydrate') || text.includes('carbs')) return 'totalCarbohydrate';
  if (text.includes('protein')) return 'protein';
  if (text.includes('vitamin d')) return 'vitaminD';
  if (text.includes('calcium')) return 'calcium';
  if (text.includes('iron')) return 'iron';
  if (text.includes('potassium')) return 'potassium';

  return null;
}

/**
 * Parses numeric amount and printed percentage from strings like "Sodium 230 mg — 15% DV"
 */
export function parseNutritionNumbers(text = '') {
  const matchAmount = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(mg|g|mcg|µg)/i);
  const matchPercent = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);

  const amount = matchAmount ? parseFloat(matchAmount[1]) : null;
  const unit = matchAmount ? matchAmount[2].toLowerCase() : null;
  const percent = matchPercent ? parseFloat(matchPercent[1]) : null;

  return { amount, unit, percent };
}

/**
 * Core Deterministic Nutrition Facts Remediation
 */
export function remediateNutritionFacts(finding, review = {}, options = {}) {
  const market = (options.targetMarket || review.market || 'US').toUpperCase();
  const nutrientKey = identifyNutrientKey(finding) || options.nutrientKey;

  if (!nutrientKey) {
    return {
      success: false,
      reason: 'Could not determine the specific nutrient for Daily Value calculation.',
      blockers: ['Unknown nutrient type in finding copy.'],
      requiredEvidence: ['Nutrient name (e.g. Sodium, Total Fat, Vitamin D) and approved declared amount.'],
    };
  }

  // Check if serving basis is known
  const servingBasisUnknown = options.servingBasisUnknown ||
    finding.servingBasisUnknown ||
    /serving basis unknown|unknown serving|basis unconfirmed/i.test(finding.title || '') ||
    /serving basis unknown|unknown serving|basis unconfirmed/i.test(finding.explanation || '');

  if (servingBasisUnknown) {
    return {
      success: false,
      reason: 'Nutrition serving basis unknown. Cannot generate %DV calculation without confirmed serving size.',
      blockers: ['Serving size (grams or volume per serving) is unconfirmed in product specifications.'],
      requiredEvidence: ['Approved product specification confirming serving size and basis of declaration.'],
    };
  }

  // Retrieve nutrient amount from finding expected/evidence or options
  let amount = options.amount != null ? options.amount : null;
  let unit = options.unit || null;
  let observedPercent = options.observedPercent != null ? options.observedPercent : null;

  if (amount == null) {
    const parsedExpected = parseNutritionNumbers(finding.expected || '');
    if (parsedExpected.amount != null) {
      amount = parsedExpected.amount;
      unit = parsedExpected.unit;
    }
  }

  if (amount == null) {
    const parsedObserved = parseNutritionNumbers(finding.observed || '');
    if (parsedObserved.amount != null) {
      amount = parsedObserved.amount;
      unit = parsedObserved.unit;
    }
    if (parsedObserved.percent != null && observedPercent == null) {
      observedPercent = parsedObserved.percent;
    }
  }

  if (amount == null) {
    return {
      success: false,
      reason: 'Source nutrient amount is missing. Cannot calculate % Daily Value without an approved quantity.',
      blockers: ['Missing approved nutrient amount in product formulation/specification.'],
      requiredEvidence: ['Approved product specification showing nutrient value per serving.'],
    };
  }

  // Determine Daily Reference Value for jurisdiction
  let refValue = null;
  let refUnit = unit || 'mg';
  let refCitation = '';
  let nutrientName = nutrientKey;

  if (market === 'EU') {
    const euRef = EU_1169_REFERENCE_INTAKES[nutrientKey];
    if (euRef) {
      refValue = euRef.standardValue;
      refUnit = euRef.unit;
      refCitation = euRef.cfr;
      nutrientName = euRef.name;
    }
  } else if (market === 'IN' || market === 'INDIA') {
    const inRef = FSSAI_DAILY_VALUES[nutrientKey];
    if (inRef) {
      refValue = inRef.standardValue;
      refUnit = inRef.unit;
      refCitation = inRef.standard;
      nutrientName = inRef.name;
    }
  }

  // Default to US FDA 2016 21 CFR 101.9
  if (!refValue) {
    const fdaRef = FDA_2016_DAILY_VALUES[nutrientKey];
    if (fdaRef) {
      refValue = fdaRef.standardValue;
      refUnit = fdaRef.unit;
      refCitation = fdaRef.cfr;
      nutrientName = fdaRef.name;
    }
  }

  if (!refValue) {
    return {
      success: false,
      reason: `No official Daily Value reference found for "${nutrientKey}" in market "${market}".`,
      blockers: [`Jurisdiction ${market} Daily Reference Value for ${nutrientKey} not configured.`],
      requiredEvidence: ['Applicable statutory daily reference intake schedule.'],
    };
  }

  // Deterministic %DV Arithmetic
  const rawPercent = (amount / refValue) * 100;
  let roundedPercent = Math.round(rawPercent);
  if (rawPercent < 1.0 && rawPercent > 0) {
    roundedPercent = Math.round(rawPercent * 10) / 10;
  }

  const formulaStr = `${amount} ${refUnit} / ${refValue} ${refUnit} × 100 = ${rawPercent.toFixed(1)}%`;
  const roundingExplanation = `Rounded to ${roundedPercent}% under ${refCitation} (nearest whole percent).`;

  // Format proposed text
  let proposedText = `${nutrientName} ${amount} ${refUnit} — ${roundedPercent}% DV`;
  let originalText = finding.observed || `${nutrientName} ${amount} ${refUnit} — ${observedPercent || 0}% DV`;

  // If observed text exists, replace only the percentage
  if (finding.observed && /%/i.test(finding.observed)) {
    proposedText = finding.observed.replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, `${roundedPercent}%`);
    originalText = finding.observed;
  }

  const calculation = {
    nutrient: nutrientName,
    nutrientKey,
    amount: `${amount} ${refUnit}`,
    declaredAmount: amount,
    referenceDV: `${refValue} ${refUnit}`,
    standardValue: refValue,
    referenceBasis: 'Per serving',
    formula: formulaStr,
    rawPercent: Number(rawPercent.toFixed(2)),
    computedPercent: roundedPercent,
    observedPercent: observedPercent,
    difference: observedPercent != null ? Number((observedPercent - roundedPercent).toFixed(1)) : null,
    roundingRule: roundingExplanation,
    cfrCitation: refCitation,
    jurisdiction: market,
    method: 'DETERMINISTIC_CALCULATION',
  };

  const sourceDoc = review.documents?.find(d => d.role === 'spec' || d.role === 'reference') ||
    review.documents?.[0] || { id: 'doc-nutrition-spec', name: 'Approved Nutrition Specification' };

  return {
    success: true,
    proposedText,
    originalText,
    calculation,
    reason: `Deterministic FDA calculation: ${formulaStr}. Corrected %DV is ${roundedPercent}%.`,
    sourceEvidence: [
      {
        documentId: sourceDoc.id,
        documentName: sourceDoc.name,
        quote: `${nutrientName}: ${amount} ${refUnit}`,
        role: sourceDoc.role || 'spec',
      },
    ],
    ruleEvidence: [
      {
        id: refCitation,
        title: `${nutrientName} Daily Reference Value (${market})`,
        standard: `${refValue} ${refUnit}`,
        cfr: refCitation,
        jurisdiction: market,
      },
    ],
    changes: [
      `Updated ${nutrientName} Daily Value from ${observedPercent != null ? observedPercent + '%' : 'unverified'} to calculated ${roundedPercent}% DV.`,
    ],
  };
}

/**
 * Calorie Plausibility & Auto-Fix Remediation
 */
export function remediateCalorieFacts(finding, review = {}, options = {}) {
  const specCalories = options.approvedCalories ||
    review.deepVerification?.nutritionAudit?.declaredCalories ||
    (finding.expected && !isNaN(parseFloat(finding.expected)) ? parseFloat(finding.expected) : null);

  // If an approved nutrition specification explicitly provides validated calories, use exact approved value
  if (specCalories != null) {
    const proposedText = `${specCalories} Calories`;
    const sourceDoc = review.documents?.find(d => d.role === 'spec' || d.role === 'reference') ||
      review.documents?.[0] || { id: 'doc-nutrition-spec', name: 'Approved Nutrition Specification' };
    return {
      success: true,
      mode: 'APPROVED_CALORIE_VALUE',
      proposedText,
      originalText: finding.observed || '',
      reason: `Approved product nutrition specification explicitly confirms ${specCalories} kcal. Used approved value.`,
      calculation: {
        method: 'APPROVED_SPECIFICATION',
        approvedCalories: specCalories,
      },
      sourceEvidence: [
        {
          documentId: sourceDoc.id,
          documentName: sourceDoc.name,
          quote: `Calories: ${specCalories} kcal`,
          role: sourceDoc.role || 'spec',
        },
      ],
      ruleEvidence: [
        {
          id: 'FDA-21CFR101.9(c)(1)',
          title: 'Calorie Declaration (21 CFR 101.9(c)(1))',
          jurisdiction: 'US',
        },
      ],
      changes: [`Set declared calories to verified approved specification value: ${specCalories} Calories.`],
    };
  }

  // Otherwise, run Atwater macronutrient screening calculation (4-4-9)
  const fat = options.fatGrams ?? review.deepVerification?.nutritionAudit?.macronutrients?.fat;
  const carbs = options.carbGrams ?? review.deepVerification?.nutritionAudit?.macronutrients?.carbohydrate;
  const protein = options.proteinGrams ?? review.deepVerification?.nutritionAudit?.macronutrients?.protein;
  const declared = options.declaredCalories ?? (finding.observed ? parseFloat(finding.observed.replace(/[^0-9.]/g, '')) : null);

  if (fat == null || carbs == null || protein == null) {
    return {
      success: false,
      reason: 'Macronutrient values (Fat, Carbs, Protein) are unavailable for Atwater calculation.',
      blockers: ['Cannot evaluate calorie plausibility without verified macronutrient quantities.'],
      requiredEvidence: ['Approved product nutrition panel with confirmed Total Fat, Total Carbohydrate, and Protein values.'],
    };
  }

  const atwater = screenAtwaterCalories(fat, carbs, protein, declared);
  const estimatedKcal = atwater.estimatedCalories;

    const macroDoc = review.documents?.find(d => d.role === 'spec' || d.role === 'reference') ||
      review.documents?.[0] || { id: 'doc-macro-spec', name: 'Product Macronutrient Specification' };
    return {
      success: true,
      mode: 'CALORIE_ESTIMATE',
      proposedText: `${estimatedKcal} Calories (Screening Estimate)`,
      originalText: finding.observed || `${declared || 0} Calories`,
      reason: `Atwater 4-4-9 screening: (${fat}g × 9) + (${carbs}g × 4) + (${protein}g × 4) = ${estimatedKcal} kcal. Food-specific factors or insoluble fiber deductions may lawfully apply.`,
      calculation: {
        method: 'ATWATER_SCREENING_4_4_9',
        fatGrams: fat,
        carbGrams: carbs,
        proteinGrams: protein,
        estimatedCalories: estimatedKcal,
        declaredCalories: declared,
        difference: atwater.calorieDifference,
        percentDifference: atwater.percentDifference,
        formula: atwater.formula,
        isScreeningEstimate: true,
        toleranceNote: 'General 4-4-9 calculation is a screening heuristic. Final label calories require technical review if specific Atwater factors or dietary fiber deductions are used.',
      },
      sourceEvidence: [
        {
          documentId: macroDoc.id,
          documentName: macroDoc.name,
          quote: `Fat: ${fat}g, Carbs: ${carbs}g, Protein: ${protein}g`,
          role: macroDoc.role || 'spec',
        },
      ],
    ruleEvidence: [
      {
        id: 'FDA-21CFR101.9(c)(1)(i)',
        title: 'Calorie Calculation Methods (21 CFR 101.9(c)(1)(i))',
        jurisdiction: 'US',
      },
    ],
    changes: [
      `Computed Atwater 4-4-9 screening estimate (${estimatedKcal} kcal) from macronutrients.`,
    ],
  };
}
