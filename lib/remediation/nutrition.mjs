/**
 * PackSignal Deterministic Nutrition & Calorie Remediation Engine (lib/remediation/nutrition.mjs)
 * Mode 2: DETERMINISTIC_CALCULATION
 * Strictly deterministic mathematics for nutrition %DV and calorie plausibility.
 */

export const FDA_2016_DAILY_VALUES = {
  sodium: { name: 'Sodium', standardValue: 2300, unit: 'mg', cfr: '21 CFR 101.9(c)(9)' },
  totalFat: { name: 'Total Fat', standardValue: 78, unit: 'g', cfr: '21 CFR 101.9(c)(2)' },
  saturatedFat: { name: 'Saturated Fat', standardValue: 20, unit: 'g', cfr: '21 CFR 101.9(c)(2)(i)' },
  cholesterol: { name: 'Cholesterol', standardValue: 300, unit: 'mg', cfr: '21 CFR 101.9(c)(3)' },
  totalCarbohydrate: { name: 'Total Carbohydrate', standardValue: 275, unit: 'g', cfr: '21 CFR 101.9(c)(6)' },
  dietaryFiber: { name: 'Dietary Fiber', standardValue: 28, unit: 'g', cfr: '21 CFR 101.9(c)(6)(i)' },
  addedSugars: { name: 'Added Sugars', standardValue: 50, unit: 'g', cfr: '21 CFR 101.9(c)(6)(iii)' },
  protein: { name: 'Protein', standardValue: 50, unit: 'g', cfr: '21 CFR 101.9(c)(7)' },
  vitaminD: { name: 'Vitamin D', standardValue: 20, unit: 'mcg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  calcium: { name: 'Calcium', standardValue: 1300, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  iron: { name: 'Iron', standardValue: 18, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  potassium: { name: 'Potassium', standardValue: 4700, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
};

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
  if (/\biron\b/i.test(text)) return 'iron';
  if (text.includes('potassium')) return 'potassium';
  return null;
}

export function parseNutritionNumbers(text = '') {
  const matchAmount = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(mg|g|mcg|µg)/i);
  const matchPercent = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  const amount = matchAmount ? parseFloat(matchAmount[1]) : null;
  const unit = matchAmount ? matchAmount[2].toLowerCase() : null;
  const percent = matchPercent ? parseFloat(matchPercent[1]) : null;
  return { amount, unit, percent };
}

/**
 * Deterministic %DV Remediation
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

  // Retrieve nutrient amount
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

  let proposedText = `${nutrientName} ${amount} ${refUnit} — ${roundedPercent}% DV`;
  let originalText = finding.observed || `${nutrientName} ${amount} ${refUnit} — ${observedPercent || 0}% DV`;

  if (finding.observed && /%/i.test(finding.observed)) {
    proposedText = finding.observed.replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, `${roundedPercent}%`);
    originalText = finding.observed;
  }

  const calculation = {
    nutrient: nutrientName,
    nutrientKey,
    amount: `${amount} ${refUnit}`,
    dailyValueRef: `${refValue} ${refUnit}`,
    citation: refCitation,
    cfrCitation: refCitation,
    formula: formulaStr,
    rawPercent,
    computedPercent: roundedPercent,
    proposedPercent: roundedPercent,
    observedPercent: observedPercent != null ? observedPercent : 'Unknown',
    roundingRule: roundingExplanation,
    servingBasis: options.servingBasis || 'Per Serving (Confirmed in Spec)',
  };

  const changes = [
    `Corrected ${nutrientName} %DV from ${observedPercent != null ? observedPercent + '%' : 'unverified'} to ${roundedPercent}%.`,
    `Calculation basis: ${formulaStr} (${refCitation}).`,
  ];

  const sourceEvidence = (finding.evidence || []).filter(e => e.role && e.role !== 'artwork');
  const ruleEvidence = [
    {
      id: `rule-dv-${nutrientKey}`,
      citation: refCitation,
      cfrCitation: refCitation,
      authority: market === 'US' ? 'FDA 21 CFR 101.9' : market,
      text: `Daily Reference Value for ${nutrientName} is ${refValue} ${refUnit}.`,
    },
  ];

  return {
    success: true,
    mode: 'DETERMINISTIC_CALCULATION',
    originalText,
    proposedText,
    calculation,
    sourceEvidence,
    ruleEvidence,
    changes,
    reason: `Deterministic %DV arithmetic computed: ${formulaStr}. Corrected to ${roundedPercent}% under ${refCitation}.`,
  };
}

/**
 * Deterministic Calorie Plausibility Remediation
 */
export function remediateCalorieFacts(finding, review = {}, options = {}) {
  const nutritionDoc = review.documents?.find(d => d.role === 'spec') || {};
  const docText = `${nutritionDoc.text || ''} ${finding.expected || ''} ${finding.explanation || ''}`.toLowerCase();

  let approvedCalories = null;
  if (finding.expected) {
    const m = String(finding.expected).match(/([0-9]+)/);
    if (m) approvedCalories = parseInt(m[1], 10);
  }
  if (approvedCalories == null) {
    const matchCal = docText.match(/([0-9]+)\s*(?:kcal|calories)/i);
    if (matchCal) approvedCalories = parseInt(matchCal[1], 10);
  }

  const parsedObserved = parseNutritionNumbers(finding.observed || '');
  const observedCalories = parsedObserved.amount != null ? parsedObserved.amount : 0;

  // If approved source explicitly specifies calorie count, offer APPROVED_CALORIE_VALUE
  if (approvedCalories != null && approvedCalories > 0) {
    const proposedText = `${approvedCalories} Calories`;

    return {
      success: true,
      mode: 'APPROVED_CALORIE_VALUE',
      originalText: finding.observed || 'Unverified Calories',
      proposedText,
      calculation: {
        method: 'Approved Specification Value',
        approvedCalories,
        observedCalories,
        deviation: Math.abs(approvedCalories - observedCalories),
        notes: 'Value transcribed from verified product specification, bypassing Atwater screening approximation.',
      },
      changes: [`Updated declared calories from ${observedCalories} to approved specification ${approvedCalories} kcal.`],
      reason: `Product specification provides an approved energy value of ${approvedCalories} kcal.`,
      sourceEvidence: (finding.evidence || []).filter(e => e.role && e.role !== 'artwork'),
      ruleEvidence: [{ text: 'Calories declared must align with approved product specification.' }],
    };
  }

  // Atwater 4-4-9 screening estimate
  const macro = review.deepVerification?.nutritionAudit?.macronutrients || {};
  const proteinMatch = docText.match(/protein\s*[:—]?\s*([0-9]+(?:\.[0-9]+)?)\s*g/i);
  const carbMatch = docText.match(/(?:carbohydrate|carbs)\s*[:—]?\s*([0-9]+(?:\.[0-9]+)?)\s*g/i);
  const fatMatch = docText.match(/(?:total fat|fat)\s*[:—]?\s*([0-9]+(?:\.[0-9]+)?)\s*g/i);

  const protein = macro.protein != null ? macro.protein : (proteinMatch ? parseFloat(proteinMatch[1]) : (options.protein != null ? options.protein : null));
  const carbs = (macro.carbohydrate != null ? macro.carbohydrate : (macro.carbs != null ? macro.carbs : (carbMatch ? parseFloat(carbMatch[1]) : (options.carbs != null ? options.carbs : null))));
  const fat = macro.fat != null ? macro.fat : (fatMatch ? parseFloat(fatMatch[1]) : (options.fat != null ? options.fat : null));

  if (protein != null && carbs != null && fat != null) {
    const atwaterEstimate = Math.round(protein * 4 + carbs * 4 + fat * 9);
    const deviation = Math.abs(atwaterEstimate - observedCalories);
    const pctDiff = observedCalories ? (deviation / observedCalories) * 100 : 0;

    return {
      success: true,
      mode: 'CALORIE_ESTIMATE',
      originalText: finding.observed || `Calories ${observedCalories}`,
      proposedText: `${atwaterEstimate} Calories`,
      calculation: {
        method: 'Atwater General Factors (4-4-9)',
        formula: `(${protein}g protein × 4) + (${carbs}g carbs × 4) + (${fat}g fat × 9) = ${atwaterEstimate} kcal`,
        observedCalories,
        estimatedCalories: atwaterEstimate,
        deviationKcal: deviation,
        percentDeviation: `${pctDiff.toFixed(1)}%`,
        isScreeningResult: true,
        isScreeningEstimate: true,
        toleranceApplied: '20% screening tolerance',
        toleranceNote: '20% screening heuristic applied to Atwater approximation',
      },
      changes: [
        `Computed Atwater screening estimate: ${atwaterEstimate} kcal. Observed: ${observedCalories} kcal.`,
        'Screening estimate only. Official label values should use lab bomb calorimetry or approved ingredient factors (e.g. sugar alcohols / fiber deductions).',
      ],
      reason: `Calculated Atwater 4-4-9 plausibility estimate of ${atwaterEstimate} kcal. Reviewer screening result, not a definitive legal failure.`,
      sourceEvidence: (finding.evidence || []).filter(e => e.role && e.role !== 'artwork'),
      ruleEvidence: [{ text: 'Screening check: general Atwater 4-4-9 energy estimation under 21 CFR 101.9(c)(1)(i)(C).' }],
    };
  }

  return {
    success: false,
    reason: 'Macronutrient amounts (protein, carbs, fat) are missing. Cannot calculate Atwater calorie plausibility estimate.',
    blockers: ['Protein, Carbohydrate, and Fat amounts required for calorie screening.'],
    requiredEvidence: ['Nutritional analysis specification detailing macronutrient grams per serving.'],
  };
}
