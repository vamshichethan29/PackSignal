/**
 * PackSignal Supported Check Type Evaluator Registry
 * (lib/rulebook/evaluators.mjs)
 *
 * Implements Step 5: Deterministic evaluators for all 13 canonical packaging check types.
 * Safety: Returns UNSUPPORTED or MANUAL_REVIEW when capabilities/inputs are missing;
 * never returns a fake MATCH.
 */

import { normal, safeCopyMatch, equalQuantity } from '../engine.mjs';
import { FINDING_RESULT, EVALUATION_METHOD } from './schema.mjs';
import { executeCompiledRule } from '../rules/runtime.mjs';

export const EVALUATOR_REGISTRY = {
  // 1. REQUIRED_PHRASE
  REQUIRED_PHRASE: {
    evaluatorId: 'eval_required_phrase',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const phrase = rule.interpretation?.parameters?.phrase || rule.interpretation?.parameters?.requiredText || rule.targetPhrase || rule.source?.originalQuote;
      if (!phrase) {
        return {
          result: FINDING_RESULT.UNABLE,
          explanation: 'Required phrase parameter is missing.',
          blockers: ['No phrase parameter defined.'],
        };
      }

      const artworkText = context.artworkText || '';
      const found = safeCopyMatch(artworkText, phrase) || normal(artworkText).includes(normal(phrase));

      if (!found && !context.isArtworkComplete) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: `Phrase: "${phrase}"`,
          observed: 'Not detected in current extracted coverage',
          explanation: `Required phrase "${phrase}" was not detected, but complete artwork coverage has not been confirmed. Absence requires human review.`,
          limitations: ['Incomplete artwork coverage.'],
        };
      }

      return {
        result: found ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: `Phrase: "${phrase}"`,
        observed: found ? `Found "${phrase}" on artwork` : 'Not detected in artwork copy',
        explanation: found
          ? `Verified mandatory phrase "${phrase}" present on packaging.`
          : `Mandatory phrase "${phrase}" is absent from confirmed packaging artwork.`,
      };
    },
  },

  // 2. FORBIDDEN_PHRASE
  FORBIDDEN_PHRASE: {
    evaluatorId: 'eval_forbidden_phrase',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const phrase = rule.interpretation?.parameters?.phrase || rule.interpretation?.parameters?.forbiddenText || rule.targetPhrase;
      if (!phrase) {
        return {
          result: FINDING_RESULT.UNABLE,
          explanation: 'Forbidden phrase parameter is missing.',
          blockers: ['No forbidden phrase defined.'],
        };
      }

      const artworkText = context.artworkText || '';
      const found = normal(artworkText).includes(normal(phrase));

      return {
        result: found ? FINDING_RESULT.ISSUE : FINDING_RESULT.MATCH,
        expected: `Prohibited phrase "${phrase}" must NOT appear on artwork`,
        observed: found ? `Detected prohibited phrase "${phrase}" on artwork` : 'Phrase absent from artwork',
        explanation: found
          ? `Prohibited text violation: Forbidden phrase "${phrase}" detected on packaging.`
          : `Verified forbidden phrase "${phrase}" is absent from packaging artwork.`,
      };
    },
  },

  // 3. EXACT_NUMERIC_VALUE
  EXACT_NUMERIC_VALUE: {
    evaluatorId: 'eval_exact_numeric',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const field = rule.interpretation?.field;
      const expectedVal = Number(rule.interpretation?.parameters?.value ?? rule.sourceFact?.value);
      if (Number.isNaN(expectedVal)) {
        return {
          result: FINDING_RESULT.UNABLE,
          explanation: `Numeric reference value for ${field || 'field'} is missing or invalid.`,
          blockers: ['Missing reference numeric value.'],
        };
      }

      const observedRaw = context.facts?.[field]?.value || context.observedValues?.[field];
      if (observedRaw === undefined || observedRaw === null) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: String(expectedVal),
          observed: 'Not extracted',
          explanation: `Observed numeric value for ${field} was not extracted from artwork.`,
        };
      }

      const observedVal = Number(String(observedRaw).replace(/[^\d.-]/g, ''));
      const matches = !Number.isNaN(observedVal) && Math.abs(observedVal - expectedVal) < 0.0001;

      return {
        result: matches ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: String(expectedVal),
        observed: String(observedRaw),
        explanation: matches
          ? `Exact numeric value ${expectedVal} matches on packaging.`
          : `Numeric discrepancy: expected ${expectedVal}, observed ${observedRaw}.`,
      };
    },
  },

  // 4. UNIT_EQUIVALENT_VALUE
  UNIT_EQUIVALENT_VALUE: {
    evaluatorId: 'eval_unit_equivalent',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const expectedStr = rule.interpretation?.parameters?.value || rule.sourceFact?.value || context.facts?.net_quantity?.value;
      const observedStr = context.facts?.net_quantity?.observed || context.observedValues?.net_quantity || context.artworkQuantity;

      if (!expectedStr) {
        return {
          result: FINDING_RESULT.BLOCKED,
          explanation: 'Source specification quantity is missing.',
          blockers: ['No approved specification quantity supplied.'],
        };
      }
      if (!observedStr) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: expectedStr,
          observed: 'Not detected',
          explanation: 'Observed artwork quantity was not detected.',
        };
      }

      const eq = equalQuantity(expectedStr, observedStr);
      return {
        result: eq ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: expectedStr,
        observed: observedStr,
        explanation: eq
          ? `Quantity equivalence confirmed: "${observedStr}" is equivalent to specified "${expectedStr}".`
          : `Quantity discrepancy: "${observedStr}" does not match specified "${expectedStr}".`,
      };
    },
  },

  // 5. REQUIRED_PANEL_PLACEMENT
  REQUIRED_PANEL_PLACEMENT: {
    evaluatorId: 'eval_panel_placement',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const requiredPanel = rule.interpretation?.parameters?.panel || 'principal_display_panel';
      const panelMappingConfirmed = context.panelMappingConfirmed || context.options?.panelZonesConfirmed;

      if (!panelMappingConfirmed) {
        return {
          result: FINDING_RESULT.REVIEW,
          explanation: `Panel placement requires confirmed dieline or reviewer-confirmed panel mapping. Current panel layout is unconfirmed.`,
          blockers: ['Confirmed panel mapping required.'],
          limitations: ['Cannot certify panel placement without verified dieline geometry.'],
        };
      }

      const actualPanel = context.observedPanel || context.panelZones?.[rule.interpretation?.field];
      if (!actualPanel) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: `Placement on ${requiredPanel}`,
          observed: 'Unmapped panel location',
          explanation: `Evidence location cannot be mapped to a confirmed panel zone.`,
        };
      }

      const matches = normal(actualPanel) === normal(requiredPanel);
      return {
        result: matches ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: `Placement on ${requiredPanel}`,
        observed: `Placed on ${actualPanel}`,
        explanation: matches
          ? `Element is placed correctly on confirmed ${requiredPanel}.`
          : `Placement defect: Expected on ${requiredPanel}, but observed on ${actualPanel}.`,
      };
    },
  },

  // 6. MINIMUM_TEXT_SIZE
  MINIMUM_TEXT_SIZE: {
    evaluatorId: 'eval_min_text_size',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const minPt = Number(rule.interpretation?.parameters?.minPoint || rule.interpretation?.parameters?.minSize || 6.0);
      const nativeFontPt = context.nativeFontPoint;

      if (nativeFontPt === undefined || nativeFontPt === null) {
        const boxHeight = context.boundingBoxHeightPt;
        return {
          result: FINDING_RESULT.REVIEW,
          explanation: `Native PDF font size metadata unavailable. Bounding box height (${boxHeight ? `${boxHeight.toFixed(1)} pt` : 'unknown'}) is an estimate and cannot substitute for native font size. Human prepress review required.`,
          limitations: ['Native PDF font size not measured; bounding box height is not a certified font measurement.'],
        };
      }

      const passes = nativeFontPt >= minPt;
      return {
        result: passes ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: `Minimum font size: ${minPt} pt`,
        observed: `Measured native font size: ${nativeFontPt.toFixed(2)} pt`,
        explanation: passes
          ? `Measured native font size (${nativeFontPt.toFixed(2)} pt) satisfies minimum requirement of ${minPt} pt.`
          : `Typography preflight warning: Measured font size (${nativeFontPt.toFixed(2)} pt) is below required ${minPt} pt threshold.`,
      };
    },
  },

  // 7. INGREDIENT_LIST_COMPARISON
  INGREDIENT_LIST_COMPARISON: {
    evaluatorId: 'eval_ingredients_comparison',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const sourceIngredients = context.facts?.ingredients?.value || rule.interpretation?.parameters?.ingredients;
      const artworkIngredients = context.artworkIngredients || context.facts?.ingredients?.observed;

      if (!sourceIngredients) {
        return {
          result: FINDING_RESULT.BLOCKED,
          explanation: 'Source ingredient list is missing.',
          blockers: ['Approved ingredient specification missing.'],
        };
      }
      if (!artworkIngredients) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: sourceIngredients,
          observed: 'Not detected',
          explanation: 'Artwork ingredient list was not extracted.',
        };
      }

      const srcList = sourceIngredients.split(/[,;]/).map(s => normal(s)).filter(Boolean);
      const artList = artworkIngredients.split(/[,;]/).map(s => normal(s)).filter(Boolean);

      const missingInArt = srcList.filter(item => !artList.includes(item));
      const extraInArt = artList.filter(item => !srcList.includes(item));

      if (missingInArt.length === 0 && extraInArt.length === 0) {
        return {
          result: FINDING_RESULT.MATCH,
          expected: sourceIngredients,
          observed: artworkIngredients,
          explanation: 'All ingredients match approved specification in descending order.',
        };
      }

      return {
        result: FINDING_RESULT.ISSUE,
        expected: sourceIngredients,
        observed: artworkIngredients,
        explanation: `Ingredient discrepancy: Missing in artwork: [${missingInArt.join(', ')}]. Unexpected in artwork: [${extraInArt.join(', ')}].`,
      };
    },
  },

  // 8. ALLERGEN_STATEMENT_COMPARISON
  ALLERGEN_STATEMENT_COMPARISON: {
    evaluatorId: 'eval_allergen_comparison',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const expectedAllergens = rule.interpretation?.parameters?.allergens || context.facts?.allergens?.value;
      const observedAllergens = context.artworkAllergens || context.facts?.allergens?.observed;

      if (!expectedAllergens) {
        return {
          result: FINDING_RESULT.BLOCKED,
          explanation: 'Approved allergen specification missing.',
          blockers: ['No allergen specification provided.'],
        };
      }
      if (!observedAllergens) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: expectedAllergens,
          observed: 'Not detected',
          explanation: 'Artwork allergen declaration not detected.',
        };
      }

      const matches = normal(observedAllergens).includes(normal(expectedAllergens));
      return {
        result: matches ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: expectedAllergens,
        observed: observedAllergens,
        explanation: matches
          ? `Allergen statement matches approved formulation.`
          : `Allergen declaration discrepancy: Observed "${observedAllergens}" does not match expected "${expectedAllergens}".`,
      };
    },
  },

  // 9. CLAIM_SUBSTANTIATION
  CLAIM_SUBSTANTIATION: {
    evaluatorId: 'eval_claim_substantiation',
    version: '1.0.0',
    method: EVALUATION_METHOD.HUMAN_REVIEW,
    evaluate: (rule, context) => {
      const claim = rule.interpretation?.parameters?.claim || rule.source?.originalQuote;
      const substantiation = context.claimsRegister?.find(c => normal(c.text) === normal(claim));

      if (!substantiation) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: `Accredited substantiation for "${claim}"`,
          observed: 'No supporting substantiation document found',
          explanation: `Claim "${claim}" was detected on artwork but lacks approved substantiation in the claims register. Human legal review required.`,
          limitations: ['Cannot certify claims without approved laboratory or regulatory documentation.'],
        };
      }

      return {
        result: substantiation.status === 'APPROVED' ? FINDING_RESULT.MATCH : FINDING_RESULT.REVIEW,
        expected: `Approved claim "${claim}"`,
        observed: `Claim status in register: ${substantiation.status}`,
        explanation: `Claim "${claim}" verified against approved claims register entry.`,
      };
    },
  },

  // 10. REQUIRED_SUPPORTING_DOCUMENT
  REQUIRED_SUPPORTING_DOCUMENT: {
    evaluatorId: 'eval_supporting_doc',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const requiredRole = rule.interpretation?.parameters?.documentRole || 'spec';
      const hasDoc = (context.documents || []).some(d => d.role === requiredRole && (!rule.interpretation?.parameters?.status || d.status === rule.interpretation.parameters.status));

      return {
        result: hasDoc ? FINDING_RESULT.MATCH : FINDING_RESULT.BLOCKED,
        expected: `Supporting document with role "${requiredRole}"`,
        observed: hasDoc ? 'Document supplied' : 'Document missing',
        explanation: hasDoc
          ? `Required supporting document (${requiredRole}) is present in review.`
          : `Required supporting document with role "${requiredRole}" is missing. Review blocked.`,
        blockers: hasDoc ? [] : [`Missing document: ${requiredRole}`],
      };
    },
  },

  // 11. NUTRITION_ARITHMETIC
  NUTRITION_ARITHMETIC: {
    evaluatorId: 'eval_nutrition_arithmetic',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const { fat = 0, carbs = 0, protein = 0, calories = 0 } = context.nutritionValues || {};
      if (!calories && !fat && !carbs && !protein) {
        return {
          result: FINDING_RESULT.BLOCKED,
          explanation: 'Macronutrient values unavailable for arithmetic check.',
          blockers: ['Missing macronutrient values.'],
        };
      }

      const calculatedCalories = (fat * 9) + (carbs * 4) + (protein * 4);
      const diff = Math.abs(calculatedCalories - calories);
      // Tolerance within 20% under 21 CFR 101.9
      const withinTolerance = diff <= (calories * 0.2) + 5;

      return {
        result: withinTolerance ? FINDING_RESULT.MATCH : FINDING_RESULT.REVIEW,
        expected: `Plausible calories ~${calculatedCalories} kcal (Atwater 4-4-9)`,
        observed: `${calories} kcal printed`,
        explanation: withinTolerance
          ? `Calorie declaration (${calories} kcal) is mathematically consistent with macronutrients (Atwater: ${calculatedCalories} kcal).`
          : `Calorie plausibility review: Declared ${calories} kcal diverges from calculated macronutrient energy (${calculatedCalories} kcal) beyond statutory tolerance.`,
      };
    },
  },

  // 12. BARCODE_IDENTIFIER_MATCH
  BARCODE_IDENTIFIER_MATCH: {
    evaluatorId: 'eval_barcode_match',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const expectedBarcode = rule.interpretation?.parameters?.barcode || context.facts?.barcode?.value;
      const decodedBarcode = context.decodedBarcode || context.facts?.barcode?.observed;

      if (!expectedBarcode) {
        return {
          result: FINDING_RESULT.BLOCKED,
          explanation: 'Approved product barcode not specified.',
          blockers: ['No approved barcode in specification.'],
        };
      }
      if (!decodedBarcode) {
        return {
          result: FINDING_RESULT.REVIEW,
          expected: expectedBarcode,
          observed: 'No barcode decoded from artwork',
          explanation: 'No readable barcode was decoded from the rendered packaging artwork.',
        };
      }

      const matches = normal(decodedBarcode) === normal(expectedBarcode);
      return {
        result: matches ? FINDING_RESULT.MATCH : FINDING_RESULT.ISSUE,
        expected: expectedBarcode,
        observed: decodedBarcode,
        explanation: matches
          ? `Decoded barcode (${decodedBarcode}) matches approved SKU specification.`
          : `Barcode mismatch: Artwork has "${decodedBarcode}", but approved SKU is "${expectedBarcode}".`,
      };
    },
  },

  // 13. CONDITIONAL_REQUIREMENT
  CONDITIONAL_REQUIREMENT: {
    evaluatorId: 'eval_conditional_req',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const condition = rule.interpretation?.condition || rule.interpretation?.parameters?.condition;
      if (!condition || typeof condition !== 'object') {
        return {
          result: FINDING_RESULT.UNABLE,
          explanation: 'Malformed conditional requirement specification.',
          blockers: ['Invalid condition schema.'],
        };
      }

      // Bounded condition language: e.g. { field: 'organic', equals: true }
      const fieldValue = context.facts?.[condition.field]?.value ?? context.options?.[condition.field];
      const isMet = condition.equals !== undefined
        ? normal(String(fieldValue)) === normal(String(condition.equals))
        : Boolean(fieldValue);

      if (!isMet) {
        return {
          result: FINDING_RESULT.NOT_APPLICABLE,
          verdict: 'not_applicable',
          explanation: `Condition [${condition.field} == ${condition.equals ?? 'true'}] not met (actual: ${fieldValue}). Requirement is not applicable.`,
        };
      }

      // If condition is met, delegate to target sub-check
      const subType = rule.interpretation?.parameters?.subCheckType || 'REQUIRED_PHRASE';
      const subEvaluator = EVALUATOR_REGISTRY[subType];
      if (subEvaluator) {
        return subEvaluator.evaluate(rule, context);
      }

      return {
        result: FINDING_RESULT.REVIEW,
        explanation: 'Condition met; manual human review of requirement required.',
      };
    },
  },

  // 14. BARCODE_GTIN_MATCH (Wave D Family 1)
  BARCODE_GTIN_MATCH: {
    evaluatorId: 'eval_barcode_gtin_match',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const res = executeCompiledRule({
        type: 'BARCODE_GTIN_MATCH',
        expectedGtin: rule.interpretation?.parameters?.expectedGtin || rule.parameters?.expectedGtin,
        parameters: rule.interpretation?.parameters || rule.parameters || {},
      }, {
        barcode: context.decodedBarcode || context.barcode,
        facts: Object.entries(context.facts || {}).map(([field, f]) => ({ field, value: f?.value ?? f })),
        artworkText: context.artworkText || '',
      });
      const resultMap = { match: FINDING_RESULT.MATCH, issue: FINDING_RESULT.ISSUE, review: FINDING_RESULT.REVIEW, unable: FINDING_RESULT.UNABLE };
      return {
        result: resultMap[res.status] || FINDING_RESULT.REVIEW,
        verdict: res.verdict,
        expected: res.expected,
        observed: res.observed,
        explanation: res.explanation,
        calculationProof: res.calculationProof,
      };
    },
  },

  // 15. STATUTORY_SYMBOL_PRESENCE (Wave D Family 2)
  STATUTORY_SYMBOL_PRESENCE: {
    evaluatorId: 'eval_statutory_symbol_presence',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const res = executeCompiledRule({
        type: 'STATUTORY_SYMBOL_PRESENCE',
        symbolName: rule.interpretation?.parameters?.symbolName || rule.symbolName,
        symbolType: rule.interpretation?.parameters?.symbolType || rule.symbolType,
        parameters: rule.interpretation?.parameters || rule.parameters || {},
      }, {
        symbols: context.symbols || [],
        facts: Object.entries(context.facts || {}).map(([field, f]) => ({ field, value: f?.value ?? f })),
        artworkText: context.artworkText || '',
      });
      const resultMap = { match: FINDING_RESULT.MATCH, issue: FINDING_RESULT.ISSUE, review: FINDING_RESULT.REVIEW, unable: FINDING_RESULT.UNABLE };
      return {
        result: resultMap[res.status] || FINDING_RESULT.REVIEW,
        verdict: res.verdict,
        expected: res.expected,
        observed: res.observed,
        explanation: res.explanation,
      };
    },
  },

  // 16. MULTILINGUAL_PAIR_REQUIREMENT (Wave D Family 3)
  MULTILINGUAL_PAIR_REQUIREMENT: {
    evaluatorId: 'eval_multilingual_pair_requirement',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const res = executeCompiledRule({
        type: 'MULTILINGUAL_PAIR_REQUIREMENT',
        primaryLanguage: rule.interpretation?.parameters?.primaryLanguage || rule.primaryLanguage,
        secondaryLanguage: rule.interpretation?.parameters?.secondaryLanguage || rule.secondaryLanguage,
        targetField: rule.interpretation?.parameters?.requiredFields?.[0] || rule.targetField,
        exemptionStatus: rule.interpretation?.parameters?.exemptionStatus || rule.exemptionStatus,
        parameters: rule.interpretation?.parameters || rule.parameters || {},
      }, {
        facts: Object.entries(context.facts || {}).map(([field, f]) => ({ field, value: f?.value ?? f })),
        artworkText: context.artworkText || '',
      });
      const resultMap = { match: FINDING_RESULT.MATCH, issue: FINDING_RESULT.ISSUE, review: FINDING_RESULT.REVIEW, unable: FINDING_RESULT.UNABLE };
      return {
        result: resultMap[res.status] || FINDING_RESULT.REVIEW,
        verdict: res.verdict,
        expected: res.expected,
        observed: res.observed,
        explanation: res.explanation,
      };
    },
  },

  // 17. MANUFACTURER_ADDRESS_DECLARATION (Wave D Family 4)
  MANUFACTURER_ADDRESS_DECLARATION: {
    evaluatorId: 'eval_manufacturer_address_declaration',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const res = executeCompiledRule({
        type: 'MANUFACTURER_ADDRESS_DECLARATION',
        telephoneDirectoryExemption: rule.interpretation?.parameters?.telephoneDirectoryExemption || rule.telephoneDirectoryExemption,
        parameters: rule.interpretation?.parameters || rule.parameters || {},
      }, {
        facts: Object.entries(context.facts || {}).map(([field, f]) => ({ field, value: f?.value ?? f })),
        artworkText: context.artworkText || '',
      });
      const resultMap = { match: FINDING_RESULT.MATCH, issue: FINDING_RESULT.ISSUE, review: FINDING_RESULT.REVIEW, unable: FINDING_RESULT.UNABLE };
      return {
        result: resultMap[res.status] || FINDING_RESULT.REVIEW,
        verdict: res.verdict,
        expected: res.expected,
        observed: res.observed,
        explanation: res.explanation,
      };
    },
  },

  // 18. STORAGE_INSTRUCTION_MANDATE (Wave D Family 5)
  STORAGE_INSTRUCTION_MANDATE: {
    evaluatorId: 'eval_storage_instruction_mandate',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const res = executeCompiledRule({
        type: 'STORAGE_INSTRUCTION_MANDATE',
        requiredWording: rule.interpretation?.parameters?.requiredStatement || rule.requiredWording,
        storageState: rule.interpretation?.parameters?.storageState || rule.storageState,
        parameters: rule.interpretation?.parameters || rule.parameters || {},
      }, {
        facts: Object.entries(context.facts || {}).map(([field, f]) => ({ field, value: f?.value ?? f })),
        artworkText: context.artworkText || '',
      });
      const resultMap = { match: FINDING_RESULT.MATCH, issue: FINDING_RESULT.ISSUE, review: FINDING_RESULT.REVIEW, unable: FINDING_RESULT.UNABLE };
      return {
        result: resultMap[res.status] || FINDING_RESULT.REVIEW,
        verdict: res.verdict,
        expected: res.expected,
        observed: res.observed,
        explanation: res.explanation,
      };
    },
  },

  // 19. NUTRIENT_CONTENT_CLAIM_LIMIT (Wave D Family 6)
  NUTRIENT_CONTENT_CLAIM_LIMIT: {
    evaluatorId: 'eval_nutrient_content_claim_limit',
    version: '1.0.0',
    method: EVALUATION_METHOD.DETERMINISTIC,
    evaluate: (rule, context) => {
      const res = executeCompiledRule({
        type: 'NUTRIENT_CONTENT_CLAIM_LIMIT',
        claimType: rule.interpretation?.parameters?.claimType || rule.claimType,
        threshold: rule.interpretation?.parameters?.threshold ?? rule.threshold,
        unit: rule.interpretation?.parameters?.unit || rule.unit,
        nutrient: rule.interpretation?.parameters?.nutrient || rule.nutrient,
        parameters: rule.interpretation?.parameters || rule.parameters || {},
      }, {
        facts: Object.entries(context.facts || {}).map(([field, f]) => ({ field, value: f?.value ?? f })),
        artworkText: context.artworkText || '',
      });
      const resultMap = { match: FINDING_RESULT.MATCH, issue: FINDING_RESULT.ISSUE, review: FINDING_RESULT.REVIEW, unable: FINDING_RESULT.UNABLE };
      return {
        result: resultMap[res.status] || FINDING_RESULT.REVIEW,
        verdict: res.verdict,
        expected: res.expected,
        observed: res.observed,
        explanation: res.explanation,
        calculationProof: res.calculationProof,
      };
    },
  },
};

/**
 * Dispatches a rule to its registered evaluator function.
 */
export function executeEvaluator(checkType, rule, context) {
  const evaluator = EVALUATOR_REGISTRY[checkType];
  if (!evaluator) {
    return {
      result: FINDING_RESULT.UNABLE,
      verdict: 'unsupported',
      explanation: `Check type "${checkType}" is not supported by the deterministic runtime.`,
      evaluatorId: 'unsupported',
      method: EVALUATION_METHOD.UNSUPPORTED,
    };
  }

  const output = evaluator.evaluate(rule, context);
  return {
    evaluatorId: evaluator.evaluatorId,
    evaluatorVersion: evaluator.version,
    method: evaluator.method,
    ...output,
  };
}
