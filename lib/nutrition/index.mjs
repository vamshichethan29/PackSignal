/**
 * lib/nutrition/index.mjs
 * 
 * PackSignal Nutrition Validation Engine (Phase 2)
 * Primary Entrypoint: validateNutrition(review, options)
 * 
 * Provides deterministic, source-backed nutrition verification,
 * mathematical proofs, multi-panel support, dual-route %DV calculations,
 * Atwater calorie plausibility, nutrient consistency screening,
 * and serving arithmetic.
 */

import { parseArtworkNutritionPanels, normalizeSourceNutrients } from './parser.mjs';
import { matchNutrientRecords } from './panel-matcher.mjs';
import { calculateDailyValue, FDA_2016_DAILY_VALUES } from './daily-values.mjs';
import { screenCaloriePlausibility } from './calories.mjs';
import {
  screenSugarsVersusCarbohydrates,
  screenAddedSugarsVersusTotalSugars,
  screenSaturatedFatVersusTotalFat
} from './consistency.mjs';
import { screenServingQuantityPlausibility } from './serving-basis.mjs';
import { getNutrientDefinition } from './nutrient-registry.mjs';
import { resolveSourceCellEvidence, resolveArtworkBoxEvidence } from './evidence.mjs';

export const NUTRITION_VALIDATOR_VERSION = '2.0.0';
export const NUTRITION_RULE_PACK_VERSION = '2016-FDA-US-21CFR101.9';

/**
 * Validates packaging artwork nutrition declarations against approved source specifications
 * and regulatory calculation rules.
 * 
 * @param {Object} review - The PackSignal review object (artwork, sources, selected facts, etc.)
 * @param {Object} [options={}] - Validation options (e.g. populationCategory, nutritionVariant, nutritionBasisConfirmed)
 * @returns {Object} Comprehensive, deterministic, versioned validation snapshot
 */
export function validateNutrition(review = {}, options = {}) {
  const reviewId = review.id || 'review-adhoc';
  const artwork = review.artwork || {};
  const artworkHash = artwork.hash || artwork.sha256 || 'unknown-artwork-hash';
  const sources = review.sources || [];
  const selectedFacts = review.selected || review.facts || [];

  // Determine Source Authority
  const sourceAuthority = determineSourceAuthority(sources, review, options);

  // Parse Artwork Panels
  const panels = parseArtworkNutritionPanels(artwork);

  // Parse & Normalize Source Facts
  const sourceNutrients = normalizeSourceNutrients(selectedFacts);

  // Merged Options
  const mergedOptions = {
    ...review.options,
    ...options,
    populationCategory: options.populationCategory || review.options?.populationCategory || 'ADULTS_AND_CHILDREN_4_PLUS'
  };

  // Proofs repository
  const proofs = [];
  const addProof = (proof) => {
    if (proof && proof.proofId) proofs.push(proof);
    return proof;
  };

  // Match Source to Artwork Nutrients across panels
  const comparisons = matchNutrientRecords({
    sourceNutrients,
    panels,
    sourceAuthority,
    options: mergedOptions
  });

  // Track Calculation Results
  const dvCalculations = [];
  const blockers = [];
  const limitations = [
    'General 4-4-9 Atwater is an internal screening equation; specific food matrices may use specialized factors (21 CFR 101.9(c)(1)(i)).',
    'Total Sugars and Trans Fat have no established FDA Daily Reference Value; %DV is not permitted.',
    'Underlying unrounded analytical composition may differ from declared rounded amounts (21 CFR 101.9(c)).',
    'Serving count versus net quantity uses metric equivalents; mass-to-volume comparisons require verified product density.',
    'PackSignal provides deterministic packaging artwork verification and does not issue statutory certifications.'
  ];

  // 1. Printed %DV Calculations for Each Artwork Panel Column
  for (const panel of panels) {
    for (const col of panel.columns) {
      const artNutrients = panel.nutrientRecords.filter(r => r.columnId === col.id);

      for (const nut of artNutrients) {
        // Calculate %DV
        const dvResult = calculateDailyValue({
          nutrientId: nut.nutrientId,
          nutrientAmount: nut.printedAmount,
          nutrientUnit: nut.printedUnit,
          printedDvPercent: nut.printedDvPercent,
          servingBasis: nut.basis,
          populationCategory: mergedOptions.populationCategory,
          allowUnroundedInterval: true
        });

        if (dvResult.proof) addProof(dvResult.proof);

        const calculationRecord = {
          checkId: `dv:${nut.nutrientId}:${panel.panelId}:${col.id}`,
          nutrientId: nut.nutrientId,
          canonicalName: nut.canonicalName,
          panelId: panel.panelId,
          columnId: col.id,
          basis: nut.basis,
          artworkRecord: nut,
          result: dvResult
        };

        dvCalculations.push(calculationRecord);
      }
    }
  }

  // 2. Macronutrient Calorie Plausibility Screen
  const calorieScreens = [];
  for (const panel of panels) {
    for (const col of panel.columns) {
      const artNutrients = panel.nutrientRecords.filter(r => r.columnId === col.id);
      const getNutVal = (id) => artNutrients.find(n => n.nutrientId === id)?.printedAmount;

      const caloriesDeclared = panel.calories;
      const totalFat = getNutVal('total_fat');
      const totalCarb = getNutNutVal(artNutrients, 'total_carbohydrate');
      const protein = getNutVal('protein');

      if (caloriesDeclared !== null && totalFat !== undefined && totalCarb !== undefined && protein !== undefined) {
        const calScreen = screenCaloriePlausibility({
          caloriesDeclared,
          totalFatGrams: totalFat,
          totalCarbGrams: totalCarb,
          proteinGrams: protein,
          servingBasis: col.basis,
          toleranceRatio: 0.20
        });

        if (calScreen.proof) addProof(calScreen.proof);

        calorieScreens.push({
          checkId: `calories:${panel.panelId}:${col.id}`,
          panelId: panel.panelId,
          columnId: col.id,
          basis: col.basis,
          result: calScreen
        });
      }
    }
  }

  // 3. Consistency Inequalities (Sugars <= Carbs, Added Sugars <= Total Sugars, Sat Fat <= Total Fat)
  const consistencyScreens = [];
  for (const panel of panels) {
    for (const col of panel.columns) {
      const artNutrients = panel.nutrientRecords.filter(r => r.columnId === col.id);
      const getNut = (id) => artNutrients.find(n => n.nutrientId === id);

      const carbs = getNut('total_carbohydrate');
      const sugars = getNut('total_sugars');
      const addedSugars = getNut('added_sugars');
      const totalFat = getNut('total_fat');
      const satFat = getNut('saturated_fat');

      // Sugars <= Carbs
      if (sugars && carbs && sugars.printedAmount !== null && carbs.printedAmount !== null) {
        const res = screenSugarsVersusCarbohydrates({
          totalSugarsGrams: sugars.printedAmount,
          totalCarbGrams: carbs.printedAmount,
          servingBasis: col.basis
        });
        if (res.proof) addProof(res.proof);
        consistencyScreens.push({
          type: 'sugars_carbs',
          checkId: `consistency:sugars-carbs:${panel.panelId}:${col.id}`,
          panelId: panel.panelId,
          columnId: col.id,
          result: res
        });
      }

      // Added Sugars <= Total Sugars
      if (addedSugars && sugars && addedSugars.printedAmount !== null && sugars.printedAmount !== null) {
        const res = screenAddedSugarsVersusTotalSugars({
          addedSugarsGrams: addedSugars.printedAmount,
          totalSugarsGrams: sugars.printedAmount,
          servingBasis: col.basis
        });
        if (res.proof) addProof(res.proof);
        consistencyScreens.push({
          type: 'added_total_sugars',
          checkId: `consistency:added-total-sugars:${panel.panelId}:${col.id}`,
          panelId: panel.panelId,
          columnId: col.id,
          result: res
        });
      }

      // Sat Fat <= Total Fat
      if (satFat && totalFat && satFat.printedAmount !== null && totalFat.printedAmount !== null) {
        const res = screenSaturatedFatVersusTotalFat({
          saturatedFatGrams: satFat.printedAmount,
          totalFatGrams: totalFat.printedAmount,
          servingBasis: col.basis
        });
        if (res.proof) addProof(res.proof);
        consistencyScreens.push({
          type: 'sat_total_fat',
          checkId: `consistency:sat-total-fat:${panel.panelId}:${col.id}`,
          panelId: panel.panelId,
          columnId: col.id,
          result: res
        });
      }
    }
  }

  // 4. Serving Size x Servings Per Container ≈ Net Quantity Screen
  const servingScreens = [];
  for (const panel of panels) {
    const netFact = selectedFacts.find(f => f.field === 'net_quantity' || f.field === 'net_weight');
    const netQtyStr = netFact?.value || review.artwork?.netQuantityText || '';

    if (panel.servingSizeGrams && panel.servingsPerContainer && netQtyStr) {
      const netMatch = netQtyStr.match(/(\d+(?:\.\d+)?)\s*(g|kg|mg|ml|l|oz|lb)\b/i);
      if (netMatch) {
        const servRes = screenServingQuantityPlausibility({
          servingSize: panel.servingSizeGrams,
          servingSizeUnit: panel.servingSizeUnit || 'g',
          servingsPerContainer: panel.servingsPerContainer,
          netQuantity: Number(netMatch[1]),
          netQuantityUnit: netMatch[2].toLowerCase(),
          toleranceRatio: 0.05
        });
        if (servRes.proof) addProof(servRes.proof);
        servingScreens.push({
          checkId: `servings:${panel.panelId}`,
          panelId: panel.panelId,
          result: servRes
        });
      }
    }
  }

  // Handle ambiguous serving basis blockers
  const hasAmbiguousVariants = selectedFacts.some(f => f.ambiguous || (f.variants?.length > 1 && !mergedOptions.nutritionBasisConfirmed));
  if (hasAmbiguousVariants) {
    blockers.push({
      code: 'AMBIGUOUS_SERVING_BASIS',
      message: 'Source specification contains multiple nutrition columns; serving basis requires reviewer confirmation.',
      severity: 'WARNING'
    });
  }

  if (sourceAuthority === 'DRAFT' || sourceAuthority === 'UNKNOWN') {
    blockers.push({
      code: 'UNCONFIRMED_SOURCE_AUTHORITY',
      message: `Source specification authority is ${sourceAuthority}; definitive packaging failure verdicts are held in REVIEW.`,
      severity: 'INFO'
    });
  }

  // 5. Build PackSignal Finding Objects with Stable IDs
  const findings = buildNutritionFindings({
    comparisons,
    dvCalculations,
    calorieScreens,
    consistencyScreens,
    servingScreens,
    sourceAuthority,
    review,
    options: mergedOptions
  });

  // Calculate Summary
  let matches = 0;
  let issues = 0;
  let reviews = 0;
  let unables = 0;

  for (const f of findings) {
    if (f.status === 'match') matches++;
    else if (f.status === 'issue') issues++;
    else if (f.status === 'review') reviews++;
    else if (f.status === 'unable') unables++;
  }

  const calculationsExecuted = dvCalculations.filter(c => c.result.status !== 'UNABLE').length +
    calorieScreens.length + consistencyScreens.length + servingScreens.length;
  const calculationsBlocked = dvCalculations.filter(c => c.result.status === 'UNABLE').length;

  return {
    reviewId,
    artworkHash,
    selectedSourceHashes: sources.map(s => s.hash || s.sha256).filter(Boolean),
    validatorVersion: NUTRITION_VALIDATOR_VERSION,
    rulePackVersion: NUTRITION_RULE_PACK_VERSION,
    populationCategory: mergedOptions.populationCategory,
    sourceAuthority,
    panels,
    sourceNutrients,
    comparisons,
    calculations: {
      dailyValues: dvCalculations,
      calories: calorieScreens,
      consistency: consistencyScreens,
      servings: servingScreens
    },
    proofs,
    evidence: {
      sourceCells: resolveSourceCellEvidence(sourceNutrients),
      artworkBoxes: resolveArtworkBoxEvidence(panels)
    },
    findings,
    summary: {
      nutrientsCompared: comparisons.length,
      matches,
      issues,
      reviews,
      unables,
      calculationsExecuted,
      calculationsBlocked
    },
    blockers,
    limitations
  };
}

/**
 * Helper to extract nutrient value safely
 */
function getNutNutVal(records, nutrientId) {
  return records.find(n => n.nutrientId === nutrientId)?.printedAmount;
}

/**
 * Determines source authority based on document metadata and review options
 */
function determineSourceAuthority(sources, review, options) {
  if (options.sourceAuthority) return options.sourceAuthority;
  if (review.options?.sourceAuthority) return review.options.sourceAuthority;

  const specDoc = sources.find(s => s.role === 'spec' || s.name?.includes('Content_Sheet') || s.name?.includes('Spec'));
  if (specDoc) {
    const rawText = JSON.stringify(specDoc.data || specDoc.text || '').toLowerCase();
    if (rawText.includes('draft') || rawText.includes('in review')) {
      return 'DRAFT';
    }
    if (rawText.includes('approved') || rawText.includes('final')) {
      return 'APPROVED_SPECIFICATION';
    }
  }

  if (review.options?.nutritionVariant && review.options?.nutritionBasisConfirmed) {
    return 'REVIEWER_SELECTED';
  }

  return 'UNKNOWN';
}

/**
 * Builds standard PackSignal finding objects from calculations and comparisons
 */
function buildNutritionFindings({
  comparisons,
  dvCalculations,
  calorieScreens,
  consistencyScreens,
  servingScreens,
  sourceAuthority,
  review,
  options
}) {
  const findings = [];
  const artwork = review.artwork || {};

  // %DV Findings
  for (const calc of dvCalculations) {
    const { checkId, canonicalName, artworkRecord, result } = calc;
    const art = artworkRecord;
    const ev = [{
      role: 'artwork',
      page: art.artworkPage || 1,
      box: art.artworkBox || null,
      quote: art.artworkQuote || `${canonicalName} ${art.printedAmount}${art.printedUnit} ${art.printedDvPercent}%`
    }];

    if (result.status === 'NOT_APPLICABLE') {
      // Total sugars or trans fat - no %DV permitted
      if (art.printedDvPercent !== null) {
        findings.push({
          id: `nutrition:dv:${checkId}`,
          title: `Nutrition %DV · ${canonicalName} undeclared %DV required`,
          status: 'issue',
          expectation: `${canonicalName} must not declare a % Daily Value (21 CFR 101.9(c))`,
          observed: `Artwork declares ${art.printedDvPercent}% DV for ${canonicalName}`,
          explanation: result.explanation,
          evidence: ev,
          rule: { field: `nutrition.${calc.nutrientId}`, citation: result.regulatoryCitation },
          method: 'deterministic_nutrition_engine',
          severity: 'major',
          proofId: result.proof?.proofId
        });
      }
      continue;
    }

    if (result.status === 'UNABLE') {
      findings.push({
        id: `nutrition:dv:${checkId}`,
        title: `Nutrition %DV · ${canonicalName} calculation blocked`,
        status: 'unable',
        expectation: `Verified %DV calculation for ${canonicalName}`,
        observed: `Unable to compute %DV: ${result.explanation}`,
        explanation: result.explanation,
        evidence: ev,
        rule: { field: `nutrition.${calc.nutrientId}`, citation: result.regulatoryCitation },
        method: 'deterministic_nutrition_engine',
        severity: 'minor',
        proofId: result.proof?.proofId
      });
      continue;
    }

    if (result.status === 'REVIEW') {
      findings.push({
        id: `nutrition:dv:${checkId}`,
        title: `Nutrition %DV · ${canonicalName} review required`,
        status: 'review',
        expectation: `Expected %DV around ${result.expectedDisplayedPercent}% (analytical ${result.unroundedPercent}%)`,
        observed: `Artwork declares ${result.printedPercent ?? 'missing'}% DV`,
        explanation: result.explanation,
        evidence: ev,
        rule: { field: `nutrition.${calc.nutrientId}`, citation: result.regulatoryCitation },
        method: 'deterministic_nutrition_engine',
        severity: 'minor',
        proofId: result.proof?.proofId
      });
      continue;
    }

    if (result.status === 'ISSUE') {
      findings.push({
        id: `nutrition:dv:${checkId}`,
        title: `Nutrition %DV · ${canonicalName} discrepancy`,
        status: 'issue',
        expectation: `Calculated %DV is ${result.expectedDisplayedPercent}% (Daily Value reference: ${result.dailyValueReference} ${result.referenceUnit})`,
        observed: `Artwork declares ${result.printedPercent}% DV`,
        explanation: result.explanation,
        evidence: ev,
        rule: { field: `nutrition.${calc.nutrientId}`, citation: result.regulatoryCitation },
        method: 'deterministic_nutrition_engine',
        severity: 'major',
        proofId: result.proof?.proofId
      });
      continue;
    }

    if (result.status === 'MATCH') {
      findings.push({
        id: `nutrition:dv:${checkId}`,
        title: `Nutrition %DV · ${canonicalName}`,
        status: 'match',
        expectation: `Printed %DV matches calculated value (${result.expectedDisplayedPercent}% DV)`,
        observed: `Artwork declares ${result.printedPercent}% DV (Reference ${result.dailyValueReference} ${result.referenceUnit})`,
        explanation: result.explanation,
        evidence: ev,
        rule: { field: `nutrition.${calc.nutrientId}`, citation: result.regulatoryCitation },
        method: 'deterministic_nutrition_engine',
        severity: 'minor',
        proofId: result.proof?.proofId
      });
    }
  }

  // Calorie Plausibility Findings
  for (const cal of calorieScreens) {
    const res = cal.result;
    findings.push({
      id: `nutrition:calories:${cal.checkId}`,
      title: 'Nutrition Plausibility · Calories vs Macronutrients',
      status: res.passes ? 'match' : 'review',
      expectation: 'Calories within 20% of 4-4-9 Atwater screening equation (9×Fat + 4×Carb + 4×Protein)',
      observed: `Declared ${res.caloriesDeclared} kcal; 4-4-9 estimate ${res.estimatedCalories} kcal (${res.percentDifference}% difference)`,
      explanation: res.explanation,
      evidence: [],
      rule: { field: 'nutrition.calories', citation: '21 CFR 101.9(c)(1)(i) screening' },
      method: 'deterministic_nutrition_engine',
      severity: 'minor',
      proofId: res.proof?.proofId
    });
  }

  // Consistency Findings
  for (const con of consistencyScreens) {
    const res = con.result;
    const isIssue = !res.passes;
    findings.push({
      id: `nutrition:consistency:${con.checkId}`,
      title: `Nutrition Relationship · ${con.type === 'sugars_carbs' ? 'Sugars ≤ Carbs' : con.type === 'added_total_sugars' ? 'Added Sugars ≤ Total Sugars' : 'Saturated Fat ≤ Total Fat'}`,
      status: res.passes ? 'match' : isIssue ? 'issue' : 'review',
      expectation: `${con.type === 'sugars_carbs' ? 'Total Sugars must not exceed Total Carbohydrate' : con.type === 'added_total_sugars' ? 'Added Sugars must not exceed Total Sugars' : 'Saturated Fat must not exceed Total Fat'}`,
      observed: `${res.lowerNutrient.name}: ${res.lowerNutrient.declaredValue} g; ${res.upperNutrient.name}: ${res.upperNutrient.declaredValue} g`,
      explanation: res.explanation,
      evidence: [],
      rule: { field: 'nutrition.consistency', citation: 'Chemical composition inequality' },
      method: 'deterministic_nutrition_engine',
      severity: isIssue ? 'major' : 'minor',
      proofId: res.proof?.proofId
    });
  }

  // Serving Quantity Findings
  for (const srv of servingScreens) {
    const res = srv.result;
    findings.push({
      id: `nutrition:servings:${srv.checkId}`,
      title: 'Nutrition Plausibility · Serving Count vs Net Quantity',
      status: res.passes ? 'match' : 'review',
      expectation: 'Serving size × servings per container approximately equals net quantity (±5%)',
      observed: `Serving estimate: ${res.estimatedTotal} ${res.unit}; Declared net: ${res.declaredNet} ${res.unit} (${res.percentDifference}% difference)`,
      explanation: res.explanation,
      evidence: [],
      rule: { field: 'nutrition.serving_quantity', citation: 'Internal pack quantity screen' },
      method: 'deterministic_nutrition_engine',
      severity: 'minor',
      proofId: res.proof?.proofId
    });
  }

  // Source-to-Artwork Nutrient Comparisons
  for (const cmp of comparisons) {
    if (cmp.artworkRecord && cmp.sourceRecord) {
      const srcVal = cmp.convertedSourceValue ?? cmp.sourceRecord.value;
      const artVal = cmp.artworkRecord.printedAmount;
      const isMatch = srcVal !== null && artVal !== null && Math.abs(srcVal - artVal) < 0.001;

      // Check authority: if not approved, do not report definitive failure
      const isDefinitiveIssue = !isMatch && sourceAuthority === 'APPROVED_SPECIFICATION';
      const status = cmp.status === 'REVIEW' || cmp.status === 'UNABLE'
        ? cmp.status.toLowerCase()
        : isMatch ? 'match' : isDefinitiveIssue ? 'issue' : 'review';

      findings.push({
        id: `nutrition:comparison:${cmp.nutrientId}:${cmp.panelId}:${cmp.columnId}`,
        title: `Nutrient Declaration · ${cmp.canonicalName}`,
        status,
        expectation: `Approved source value: ${srcVal} ${cmp.targetUnit} (${cmp.sourceRecord.basis})`,
        observed: `Artwork declared: ${artVal ?? 'missing'} ${cmp.artworkRecord.printedUnit || ''} (${cmp.artworkRecord.basis})`,
        explanation: cmp.matchReason || (isMatch ? 'Artwork declared amount matches source specification' : 'Discrepancy between source specification and artwork declaration'),
        evidence: [
          {
            role: 'source',
            location: `${cmp.sourceRecord.sourceSheet}!${cmp.sourceRecord.sourceCell}`,
            sheet: cmp.sourceRecord.sourceSheet,
            cell: cmp.sourceRecord.sourceCell,
            quote: cmp.sourceRecord.sourceQuote
          },
          {
            role: 'artwork',
            page: cmp.artworkRecord.artworkPage || 1,
            box: cmp.artworkRecord.artworkBox || null,
            quote: cmp.artworkRecord.artworkQuote || `${cmp.canonicalName} ${artVal}`
          }
        ],
        rule: { field: `nutrition.${cmp.nutrientId}`, sourceAuthority },
        method: 'deterministic_nutrition_engine',
        severity: status === 'issue' ? 'major' : 'minor',
        sourceEvidence: {
          sheet: cmp.sourceRecord.sourceSheet,
          cell: cmp.sourceRecord.sourceCell,
          value: cmp.sourceRecord.value,
          unit: cmp.sourceRecord.unit,
          quote: cmp.sourceRecord.sourceQuote
        },
        artworkEvidence: {
          page: cmp.artworkRecord.artworkPage,
          box: cmp.artworkRecord.artworkBox,
          amount: artVal,
          unit: cmp.artworkRecord.printedUnit,
          quote: cmp.artworkRecord.artworkQuote
        }
      });
    }
  }

  return findings;
}
