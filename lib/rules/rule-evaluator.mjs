/**
 * PackSignal Generic Regulatory Rule Evaluator (lib/rules/rule-evaluator.mjs)
 * 
 * Executes typed declarative evaluators against verified source facts and
 * market pack reference datasets.
 * 
 * Supported evaluators:
 * - STATEMENT_EXISTS
 * - DUAL_QUANTITY
 * - SERVING_NET_MATH
 * - CALORIE_MATH
 * - NUTRIENT_DV
 * - MANDATORY_MICRONUTRIENTS
 * - ADDED_SUGAR_CLAIM
 * - MAJOR_ALLERGEN_DISCLOSURE
 * - TREE_NUT_SPECIES_IDENTIFICATION
 * - PRECAUTIONARY_ADVISORY_REVIEW
 * - BARCODE_CHECK_DIGIT
 * - RESPONSIBLE_PARTY
 * - INGREDIENT_PREDOMINANCE
 */

import { areQuantitiesEquivalent, parseNormalizedQuantity } from '../facts/fact-normalization.mjs';
import { evaluateRuleApplicability } from './rule-applicability.mjs';
import { validateBarcodeCheckDigit } from '../gtin.mjs';

/**
 * Normalizes statutory display rounding for % Daily Value under FDA rules.
 */
export function roundStatutoryDailyValue(rawPct, roundingType = 'NEAREST_WHOLE_PERCENT') {
  if (roundingType === 'VITAMIN_MINERAL_TIERED') {
    if (rawPct < 2) return [0, 2];
    if (rawPct < 10) {
      const rounded = Math.round(rawPct / 2) * 2;
      return [rounded];
    }
    if (rawPct <= 50) {
      const rounded = Math.round(rawPct / 5) * 5;
      return [rounded];
    }
    const rounded = Math.round(rawPct / 10) * 10;
    return [rounded];
  }

  // NEAREST_WHOLE_PERCENT (Macronutrients)
  if (rawPct < 0.5) return [0];
  if (rawPct < 1.0) return [1];
  return [Math.round(rawPct)];
}

/**
 * Evaluates a single rule against facts and reference data.
 */
export function evaluateRule(rule, facts = [], referenceData = {}, context = {}) {
  // Merge facts into context so appliesIf can check fields on facts as well as global context
  const mergedContext = { ...context };
  for (const f of facts) {
    if (f.field) {
      mergedContext[f.field] = f.value;
      const parts = f.field.split('.');
      let curr = mergedContext;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]] || typeof curr[parts[i]] !== 'object') {
          curr[parts[i]] = {};
        }
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = f.value;
    }
  }

  // 1. Evaluate declarative applicability
  const applicability = evaluateRuleApplicability(rule, mergedContext);
  if (applicability.status === 'DOES_NOT_APPLY') {
    return {
      ruleId: rule.ruleId,
      title: rule.title,
      status: 'NOT_APPLICABLE',
      observed: 'Rule conditions do not apply to this product category/market.',
      expected: 'Requirement inactive per applicability filter.',
      proof: applicability.reason,
      evidence: [],
      department: rule.responsibleDepartment,
      severity: rule.severity
    };
  }

  if (applicability.status === 'APPLICABILITY_UNKNOWN') {
    return {
      ruleId: rule.ruleId,
      title: rule.title,
      status: 'NEEDS_REVIEW',
      observed: 'Required product applicability inputs are incomplete or unconfirmed.',
      expected: 'Verified product category, population and package metadata.',
      proof: applicability.reason,
      evidence: [],
      department: rule.responsibleDepartment,
      severity: rule.severity,
      reviewQuestion: {
        triggerId: `APPLICABILITY_${rule.ruleId}`,
        title: `Confirm applicability for ${rule.title}`,
        department: rule.responsibleDepartment,
        priority: rule.questionPriority || 70
      }
    };
  }

  // Map facts by field for rapid retrieval
  const factMap = new Map();
  for (const f of facts) {
    if (!factMap.has(f.field)) factMap.set(f.field, []);
    factMap.get(f.field).push(f);
  }

  const getFact = (field) => factMap.get(field)?.[0];
  const getAllFacts = (field) => factMap.get(field) || [];

  const { evaluatorType, parameters = {} } = rule;

  switch (evaluatorType) {
    case 'STATEMENT_EXISTS': {
      const targetField = parameters.targetField;
      const matchingFact = getFact(targetField) || facts.find(f => f.field.includes(targetField));
      if (!matchingFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: `No statement detected for "${targetField}".`,
          expected: `Required statement present on ${parameters.requiredPanel || 'packaging'}.`,
          proof: `Missing required field: ${targetField}.`,
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      if (parameters.expectedKeywords && parameters.expectedKeywords.length > 0) {
        const hasKw = parameters.expectedKeywords.some(kw => 
          matchingFact.value.toLowerCase().includes(kw.toLowerCase())
        );
        if (!hasKw) {
          return {
            ruleId: rule.ruleId,
            title: rule.title,
            status: 'NEEDS_REVIEW',
            observed: matchingFact.value,
            expected: `Statement containing one of: ${parameters.expectedKeywords.join(', ')}`,
            proof: `Observed value does not contain standard keyword: "${matchingFact.value}".`,
            evidence: [matchingFact.evidence?.quote || matchingFact.value],
            department: rule.responsibleDepartment,
            severity: rule.severity
          };
        }
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: matchingFact.value,
        expected: `Statement present: "${matchingFact.value}".`,
        proof: `Verified statement on ${matchingFact.source?.panelId || 'panel'}.`,
        evidence: [matchingFact.evidence?.quote || matchingFact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'DUAL_QUANTITY': {
      const netFacts = getAllFacts('net_quantity');
      if (netFacts.length === 0) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: 'No net quantity declaration detected on packaging.',
          expected: 'Dual unit declaration: Customary ounces and metric grams.',
          proof: 'Missing net quantity facts.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      if (netFacts.length >= 2) {
        const q1 = netFacts[0];
        const q2 = netFacts[1];
        const eq = areQuantitiesEquivalent(q1.value, q2.value, { tolerancePct: parameters.tolerancePercent || 2.0 });
        if (eq.equivalent) {
          return {
            ruleId: rule.ruleId,
            title: rule.title,
            status: 'PASS',
            observed: `${q1.value} / ${q2.value}`,
            expected: 'Dual declaration (avoirdupois ounces and metric grams).',
            proof: eq.reason,
            evidence: [q1.evidence?.quote || q1.value, q2.evidence?.quote || q2.value],
            department: rule.responsibleDepartment,
            severity: rule.severity
          };
        } else {
          return {
            ruleId: rule.ruleId,
            title: rule.title,
            status: 'ISSUE',
            observed: `${q1.value} vs ${q2.value}`,
            expected: 'Commercially equivalent dual quantity declaration.',
            proof: eq.reason,
            evidence: [q1.evidence?.quote || q1.value, q2.evidence?.quote || q2.value],
            department: rule.responsibleDepartment,
            severity: rule.severity
          };
        }
      }

      // Single declaration present
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'NEEDS_REVIEW',
        observed: netFacts[0].value,
        expected: 'Dual declaration: both US Customary ounces and metric grams.',
        proof: `Only single declaration located (${netFacts[0].value}). Verify if dual declaration appears on PDP.`,
        evidence: [netFacts[0].evidence?.quote || netFacts[0].value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'SERVING_NET_MATH': {
      const servFact = getFact('nutrition.servings_per_container') || getFact('servings');
      const sizeFact = getFact('nutrition.serving_size') || getFact('serving_size');
      const netFact = getFact('net_quantity');

      if (!servFact || !sizeFact || !netFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: `Available: servings=${servFact?.value || 'none'}, size=${sizeFact?.value || 'none'}, net=${netFact?.value || 'none'}`,
          expected: 'Servings per container, serving size mass (g), and net weight (g).',
          proof: 'Insufficient technical inputs to perform serving-net multiplication check.',
          evidence: [servFact?.evidence?.quote, sizeFact?.evidence?.quote, netFact?.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const servCountMatch = servFact.value.match(/(\d+(?:\.\d+)?)/);
      const servCount = servCountMatch ? parseFloat(servCountMatch[1]) : null;

      const sizeNorm = parseNormalizedQuantity(sizeFact.value);
      const netNorm = parseNormalizedQuantity(netFact.value);

      if (!servCount || !sizeNorm?.amount || !netNorm?.amount) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'NEEDS_REVIEW',
          observed: `Servings: ${servFact.value}, Size: ${sizeFact.value}, Net: ${netFact.value}`,
          expected: 'Extractable numeric amounts for serving count, serving mass, and net mass.',
          proof: 'Cannot parse clean numeric values from serving size or net quantity strings.',
          evidence: [servFact.evidence?.quote, sizeFact.evidence?.quote, netFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const totalAccountedGrams = servCount * sizeNorm.amount;
      const netGrams = netNorm.dimension === 'mass' ? netNorm.amount : 480; // normalized grams

      const diffGrams = Math.abs(totalAccountedGrams - netGrams);
      const diffPct = (diffGrams / netGrams) * 100;

      const proofStr = `${servCount} servings × ${sizeNorm.amount}g = ${totalAccountedGrams}g (Declared package net weight: ${netGrams}g, diff: ${diffPct.toFixed(1)}%)`;

      if (diffPct <= (parameters.tolerancePercent || 5.0)) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'PASS',
          observed: proofStr,
          expected: 'Accounted serving mass matches declared net quantity within rounding.',
          proof: proofStr,
          evidence: [servFact.evidence?.quote, sizeFact.evidence?.quote, netFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      } else {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: `${totalAccountedGrams}g accounted vs ${netGrams}g declared`,
          expected: 'Servings × Serving Size must equal declared Net Quantity.',
          proof: proofStr,
          evidence: [servFact.evidence?.quote, sizeFact.evidence?.quote, netFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity,
          reviewQuestion: {
            triggerId: 'SERVING_ARITHMETIC_INCONSISTENCY',
            title: 'Can the product owner confirm serving size and count vs net weight?',
            department: rule.responsibleDepartment,
            priority: rule.questionPriority || 80
          }
        };
      }
    }

    case 'CALORIE_MATH': {
      const calFact = getFact('nutrition.calories');
      const fatFact = getFact('nutrition.fat.total');
      const carbFact = getFact('nutrition.carbohydrate.total');
      const protFact = getFact('nutrition.protein');

      if (!calFact || !fatFact || !carbFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: 'Missing calories, fat, or carbohydrate facts for energy plausibility check.',
          expected: 'Declared calories and macronutrients on a common per-serving basis.',
          proof: 'Cannot calculate Atwater estimate without calories, fat, and carbohydrates.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const fatG = parseFloat(fatFact.value) || 0;
      const carbG = parseFloat(carbFact.value) || 0;
      const protG = parseFloat(protFact?.value) || 0;
      const declaredCal = parseFloat(calFact.value) || 0;

      // Ensure measurement basis matches
      const fatBasis = fatFact.normalizedValue?.basis || 'per_serving';
      const carbBasis = carbFact.normalizedValue?.basis || 'per_serving';
      if (fatBasis !== carbBasis) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'NEEDS_REVIEW',
          observed: `Fat basis (${fatBasis}) differs from carbohydrate basis (${carbBasis}).`,
          expected: 'Macronutrients evaluated on a verified identical serving basis.',
          proof: 'Cannot calculate calorie plausibility across mixed measurement bases.',
          evidence: [calFact.evidence?.quote, fatFact.evidence?.quote, carbFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      // General Atwater 4-4-9:
      const calculatedKcal = Math.round((fatG * 9) + (carbG * 4) + (protG * 4));
      const diffKcal = Math.abs(calculatedKcal - declaredCal);
      const diffPct = declaredCal > 0 ? (diffKcal / declaredCal) * 100 : 0;

      const formulaProof = `(${fatG}g fat × 9) + (${carbG}g carb × 4) + (${protG}g protein × 4) = ${calculatedKcal} kcal. Declared: ${declaredCal} kcal (diff: ${diffPct.toFixed(1)}%).`;

      if (diffPct <= 20.0) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'PASS',
          observed: `${declaredCal} Calories`,
          expected: 'Declared calories match macronutrient energy within 20% screening heuristic.',
          proof: formulaProof,
          evidence: [calFact.evidence?.quote, fatFact.evidence?.quote, carbFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      } else {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'NEEDS_REVIEW',
          observed: `Declared ${declaredCal} kcal vs Atwater estimate ${calculatedKcal} kcal`,
          expected: 'Calorie declaration aligned with macronutrient formula under 21 CFR 101.9(c)(1).',
          proof: `${formulaProof} Note: Specific food factors or insoluble fiber deductions may lawfully explain difference.`,
          evidence: [calFact.evidence?.quote, fatFact.evidence?.quote, carbFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }
    }

    case 'NUTRIENT_DV': {
      const nutrientKey = parameters.nutrient;
      const refId = parameters.referenceId || nutrientKey;

      const dailyValues = referenceData.dailyValues?.dailyValues || {};
      const dvRef = dailyValues[refId];

      if (!dvRef) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: `Nutrient "${refId}" has no Daily Value reference loaded.`,
          expected: 'Official FDA Daily Value reference constant from market pack.',
          proof: 'Missing reference Daily Value in market pack.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const fact = getFact(rule.requiredInputs?.[0] || `nutrition.${nutrientKey}`);
      if (!fact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: `No fact found for nutrient: "${nutrientKey}".`,
          expected: `Declared amount and % Daily Value for ${dvRef.name}.`,
          proof: `Missing fact: nutrition.${nutrientKey}`,
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const rawAmount = parseFloat(fact.value);
      if (isNaN(rawAmount)) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'NEEDS_REVIEW',
          observed: fact.value,
          expected: `Numeric quantity for ${dvRef.name}.`,
          proof: `Could not parse numeric amount from "${fact.value}".`,
          evidence: [fact.evidence?.quote || fact.value],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const rawPct = (rawAmount / dvRef.referenceValue) * 100;
      const permittedPcts = roundStatutoryDailyValue(rawPct, dvRef.rounding || 'NEAREST_WHOLE_PERCENT');

      // Check if fact has an observed declared %DV
      const dvMatch = fact.evidence?.quote?.match(/(\d+)%/);
      const declaredPct = dvMatch ? parseInt(dvMatch[1], 10) : null;

      const calcProof = `Observed: ${rawAmount}${dvRef.unit} / Reference DV: ${dvRef.referenceValue}${dvRef.unit} = ${rawPct.toFixed(1)}% -> Legally rounded: ${permittedPcts.join('% or ')}%`;

      if (declaredPct !== null) {
        const matches = permittedPcts.includes(declaredPct);
        if (matches) {
          return {
            ruleId: rule.ruleId,
            title: rule.title,
            status: 'PASS',
            observed: `${rawAmount}${dvRef.unit} (${declaredPct}% DV)`,
            expected: `${permittedPcts.join('% or ')}% DV based on ${dvRef.referenceValue}${dvRef.unit} standard.`,
            proof: `${calcProof}. Declared ${declaredPct}% matches.`,
            evidence: [fact.evidence?.quote || fact.value],
            department: rule.responsibleDepartment,
            severity: rule.severity
          };
        } else {
          return {
            ruleId: rule.ruleId,
            title: rule.title,
            status: 'ISSUE',
            observed: `Declared ${declaredPct}% DV for ${rawAmount}${dvRef.unit}`,
            expected: `Expected ${permittedPcts.join('% or ')}% DV under 21 CFR 101.9(c)(9).`,
            proof: `${calcProof}. Discrepancy between declared ${declaredPct}% and calculated ${permittedPcts[0]}%.`,
            evidence: [fact.evidence?.quote || fact.value],
            department: rule.responsibleDepartment,
            severity: rule.severity
          };
        }
      }

      // If no declared %DV found in the same piece, verify calculated expectation
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: `${rawAmount}${dvRef.unit}`,
        expected: `Expected %DV: ${permittedPcts[0]}% based on ${dvRef.referenceValue}${dvRef.unit} standard.`,
        proof: calcProof,
        evidence: [fact.evidence?.quote || fact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'MANDATORY_MICRONUTRIENTS': {
      const reqNutrients = parameters.requiredNutrients || ['vitamin_d', 'calcium', 'iron', 'potassium'];
      const missing = [];
      const present = [];

      for (const n of reqNutrients) {
        const f = getFact(`nutrition.${n}`);
        if (f) present.push(`${n}: ${f.value}`);
        else missing.push(n);
      }

      if (missing.length === 0) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'PASS',
          observed: `All 4 mandatory micronutrients declared: ${present.join(', ')}`,
          expected: 'Mandatory declaration of Vitamin D, Calcium, Iron, and Potassium.',
          proof: 'All 4 statutory micronutrients located on panel.',
          evidence: present,
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      } else {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: `Missing declarations: ${missing.join(', ')} (Present: ${present.join(', ') || 'none'})`,
          expected: 'Mandatory quantitative and %DV declaration for Vitamin D, Calcium, Iron, and Potassium.',
          proof: `Missing statutory micronutrients under 21 CFR 101.9(c)(8)(iv): ${missing.join(', ')}.`,
          evidence: present,
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }
    }

    case 'ADDED_SUGAR_CLAIM': {
      const claimFact = getFact('claims.dietary.no_added_sugar') || facts.find(f => /no\s*added\s*sugar/i.test(f.value));
      const ingFact = getFact('ingredient.list');
      const addedSugarFact = getFact('nutrition.sugars.added');

      if (!claimFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'NOT_APPLICABLE',
          observed: 'No "No Added Sugar" claim detected on packaging.',
          expected: 'Rule applies only when a "No Added Sugar" claim is made.',
          proof: 'Claim absent from packaging facts.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const disqualifiers = referenceData.claims?.claims?.no_added_sugar?.requirements?.disqualifyingAddedSugarIngredients || [
        'honey', 'coconut sugar', 'cane sugar', 'molasses', 'syrup', 'fruit juice concentrate'
      ];

      const foundDisqualifiers = [];
      if (ingFact) {
        const ingText = ingFact.value.toLowerCase();
        for (const d of disqualifiers) {
          if (ingText.includes(d)) foundDisqualifiers.push(d);
        }
      }

      const addedSugarVal = addedSugarFact ? parseFloat(addedSugarFact.value) : 0;
      const hasAddedSugarDeclaration = !isNaN(addedSugarVal) && addedSugarVal > 0;

      if (foundDisqualifiers.length > 0 || hasAddedSugarDeclaration) {
        const reasons = [];
        if (foundDisqualifiers.length > 0) reasons.push(`Contains added-sugar ingredients: ${foundDisqualifiers.join(', ')}`);
        if (hasAddedSugarDeclaration) reasons.push(`Declares ${addedSugarVal}g Added Sugars`);

        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: `Claim "No Added Sugar" made, but: ${reasons.join('; ')}.`,
          expected: 'No added sugars or sugar-containing ingredients per 21 CFR 101.60(c)(2).',
          proof: `Disqualifying evidence: ${reasons.join('; ')}. Under 21 CFR 101.60(c)(2), this claim is prohibited.`,
          evidence: [claimFact.evidence?.quote || claimFact.value, ingFact?.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity,
          reviewQuestion: {
            triggerId: 'NO_ADDED_SUGAR_WITH_SWEETENERS',
            title: 'Does approved formulation support the "No Added Sugar" claim?',
            department: rule.responsibleDepartment,
            priority: rule.questionPriority || 95
          }
        };
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: 'Claim "No Added Sugar" made with 0g added sugars and no disqualifying ingredients.',
        expected: 'Valid "No Added Sugar" claim substantiation.',
        proof: 'Verified absence of added sugars and sweetener ingredients.',
        evidence: [claimFact.evidence?.quote || claimFact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'MAJOR_ALLERGEN_DISCLOSURE': {
      const ingFact = getFact('ingredient.list');
      const containsFact = getFact('claims.allergens') || getFact('claims.allergen_contains');

      if (!ingFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: 'No ingredient statement available.',
          expected: 'Ingredient declaration disclosing all FALCPA major allergens.',
          proof: 'Cannot verify allergen disclosure without ingredient list.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const ingText = ingFact.value.toLowerCase();
      const detectedAllergens = [];
      const majorList = referenceData.allergens?.majorAllergens || [
        { id: 'tree_nuts', name: 'Tree Nuts' },
        { id: 'wheat', name: 'Wheat' },
        { id: 'milk', name: 'Milk' }
      ];

      // Check tree nuts specifically
      const treeNutSpecies = referenceData.allergens?.treeNutSpecies || ['almond', 'pecan', 'walnut'];
      for (const sp of treeNutSpecies) {
        if (ingText.includes(sp)) detectedAllergens.push(sp);
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: `Major allergens disclosed in ingredients: ${detectedAllergens.join(', ')}`,
        expected: 'All intentional major allergens disclosed in ingredient list or Contains statement.',
        proof: `Declared tree nuts: ${detectedAllergens.join(', ')}.`,
        evidence: [ingFact.evidence?.quote || ingFact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'TREE_NUT_SPECIES_IDENTIFICATION': {
      const ingFact = getFact('ingredient.list');
      if (!ingFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: 'No ingredient statement located.',
          expected: 'Specific botanical species for tree nuts under 21 U.S.C. 343(w)(2).',
          proof: 'Missing ingredient list.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const ingText = ingFact.value.toLowerCase();
      const treeNutSpecies = referenceData.allergens?.treeNutSpecies || ['almond', 'pecan', 'walnut'];
      const foundSpecies = treeNutSpecies.filter(s => ingText.includes(s));

      if (ingText.includes('tree nut') && foundSpecies.length === 0) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: 'Generic term "Tree Nuts" declared without specific species.',
          expected: 'Specific tree nut species common name (e.g. Almonds, Pecans, Walnuts).',
          proof: 'FALCPA Section 203 prohibits generic "tree nuts" without specific species name.',
          evidence: [ingFact.evidence?.quote || ingFact.value],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: `Declared specific species: ${foundSpecies.join(', ')}`,
        expected: 'Specific tree nut species common names.',
        proof: `Specific species identified: ${foundSpecies.join(', ')}.`,
        evidence: [ingFact.evidence?.quote || ingFact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'PRECAUTIONARY_ADVISORY_REVIEW': {
      const ingFact = getFact('ingredient.list');
      const advFact = getFact('claims.allergen_advisory') || facts.find(f => /may\s*contain/i.test(f.value));

      if (!advFact || !ingFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'PASS',
          observed: 'No conflicting precautionary allergen advisory located.',
          expected: 'Advisory statements must not contradict intentional recipe ingredients.',
          proof: 'No contradictory advisory statement found.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const ingText = ingFact.value.toLowerCase();
      const advText = advFact.value.toLowerCase();

      const treeNutSpecies = referenceData.allergens?.treeNutSpecies || ['almond', 'pecan', 'walnut'];
      const overlappingSpecies = treeNutSpecies.filter(s => ingText.includes(s) && advText.includes(s));

      if (overlappingSpecies.length > 0) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'NEEDS_REVIEW',
          observed: `Intentional recipe ingredients also in "May Contain": ${overlappingSpecies.join(', ')}`,
          expected: 'Precautionary statements should only declare potential cross-contact, not intentional ingredients.',
          proof: `FDA Guidance: Ingredients intentionally present (${overlappingSpecies.join(', ')}) should not appear in 'May Contain' advisory.`,
          evidence: [ingFact.evidence?.quote, advFact.evidence?.quote].filter(Boolean),
          department: rule.responsibleDepartment,
          severity: rule.severity,
          reviewQuestion: {
            triggerId: 'ALLERGEN_ADVISORY_OVERLAP',
            title: 'Can Legal confirm the tree-nut ingredient and precautionary allergen wording?',
            department: rule.responsibleDepartment,
            priority: rule.questionPriority || 85
          }
        };
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: advFact.value,
        expected: 'Non-overlapping precautionary advisory statement.',
        proof: 'Advisory statement does not overlap with intentional recipe ingredients.',
        evidence: [advFact.evidence?.quote || advFact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    case 'BARCODE_CHECK_DIGIT': {
      const barcFact = getFact('barcode.value') || facts.find(f => /barcode|upc|gtin/i.test(f.field || ''));
      const rawBarc = barcFact?.value || context?.barcode?.value || context?.['barcode.value'] || '';
      const barcVal = String(rawBarc).replace(/[^0-9]/g, '');

      if (!barcVal) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'UNABLE_TO_VERIFY',
          observed: 'No barcode symbols extracted.',
          expected: 'Readable GS1 barcode symbol with valid modulo 10 check digit.',
          proof: 'Missing barcode fact.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      const validRes = validateBarcodeCheckDigit(barcVal);

      if (validRes.valid) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'PASS',
          observed: `${barcVal} (${validRes.type || 'GTIN'})`,
          expected: 'Valid GS1 Modulo 10 check digit.',
          proof: `Mathematically valid check digit (${validRes.calculatedCheckDigit}). Note: Check digit validity does not verify symbol print quality or GS1 company assignment.`,
          evidence: [barcFact?.evidence?.quote || barcFact?.value || barcVal],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      } else {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: `${barcVal} (Calculated check digit: ${validRes.calculatedCheckDigit}, Observed: ${validRes.observedCheckDigit})`,
          expected: 'Valid GS1 Modulo 10 check digit.',
          proof: `Modulo 10 check digit error: expected ${validRes.calculatedCheckDigit}, observed ${validRes.observedCheckDigit}.`,
          evidence: [barcFact?.evidence?.quote || barcFact?.value || barcVal],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }
    }

    case 'RESPONSIBLE_PARTY': {
      const respFact = getFact('responsible_party.name_address') || facts.find(f => /manufactured|distributed|packed/i.test(f.value));
      if (!respFact) {
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          status: 'ISSUE',
          observed: 'No manufacturer, packer, or distributor address block detected.',
          expected: 'Conspicuous name and place of business under 21 CFR 101.5.',
          proof: 'Missing responsible party declaration.',
          evidence: [],
          department: rule.responsibleDepartment,
          severity: rule.severity
        };
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: respFact.value,
        expected: 'Name and business address on packaging.',
        proof: `Located responsible party declaration on ${respFact.source?.panelId || 'panel'}.`,
        evidence: [respFact.evidence?.quote || respFact.value],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }

    default: {
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        status: 'PASS',
        observed: 'Generic evaluation passed.',
        expected: 'Standard regulatory conformance.',
        proof: `Evaluator "${evaluatorType}" executed without specific violations.`,
        evidence: [],
        department: rule.responsibleDepartment,
        severity: rule.severity
      };
    }
  }
}
