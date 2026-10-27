/**
 * PackSignal Daily Value Reference Registry & Calculation Engine (lib/nutrition/daily-values.mjs)
 * Implements 21 CFR 101.9 (2016 Revision) reference standards and dual permitted %DV evaluation routes.
 */

import { convertUnits } from './units.mjs';
import { roundDailyValuePercent, getPermittedVitaminMineralDvOptions, compatibleUnderlyingInterval } from './rounding.mjs';

export const FDA_2016_DAILY_VALUES = {
  total_fat: { id: 'total_fat', name: 'Total Fat', standardValue: 78, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  saturated_fat: { id: 'saturated_fat', name: 'Saturated Fat', standardValue: 20, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  cholesterol: { id: 'cholesterol', name: 'Cholesterol', standardValue: 300, unit: 'mg', cfr: '21 CFR 101.9(c)(9)' },
  sodium: { id: 'sodium', name: 'Sodium', standardValue: 2300, unit: 'mg', cfr: '21 CFR 101.9(c)(9)' },
  total_carbohydrate: { id: 'total_carbohydrate', name: 'Total Carbohydrate', standardValue: 275, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  dietary_fiber: { id: 'dietary_fiber', name: 'Dietary Fiber', standardValue: 28, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  added_sugars: { id: 'added_sugars', name: 'Added Sugars', standardValue: 50, unit: 'g', cfr: '21 CFR 101.9(c)(9)' },
  protein: { id: 'protein', name: 'Protein', standardValue: 50, unit: 'g', cfr: '21 CFR 101.9(c)(7)', conditional: true },
  vitamin_d: { id: 'vitamin_d', name: 'Vitamin D', standardValue: 20, unit: 'mcg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  calcium: { id: 'calcium', name: 'Calcium', standardValue: 1300, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  iron: { id: 'iron', name: 'Iron', standardValue: 18, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' },
  potassium: { id: 'potassium', name: 'Potassium', standardValue: 4700, unit: 'mg', cfr: '21 CFR 101.9(c)(8)(iv)' }
};

export const NO_DAILY_VALUE_NUTRIENTS = new Set([
  'total_sugars',
  'trans_fat',
  'polyunsaturated_fat',
  'monounsaturated_fat',
  'soluble_fiber',
  'insoluble_fiber',
  'sugar_alcohol'
]);

export function getDailyValueReference(nutrientId, population = 'ADULTS_AND_CHILDREN_4_PLUS') {
  if (population !== 'ADULTS_AND_CHILDREN_4_PLUS') {
    return {
      supported: false,
      reason: `Population category "${population}" requires specialized regulatory reference tables not currently loaded.`
    };
  }

  if (NO_DAILY_VALUE_NUTRIENTS.has(nutrientId)) {
    return {
      supported: false,
      hasDailyValue: false,
      reason: `Nutrient "${nutrientId}" has no established % Daily Value under US FDA regulations.`
    };
  }

  const ref = FDA_2016_DAILY_VALUES[nutrientId];
  if (!ref) {
    return { supported: false, reason: `Unknown Daily Value reference for "${nutrientId}".` };
  }

  return { supported: true, hasDailyValue: true, ...ref, population };
}

/**
 * Calculates % Daily Value evaluating dual permitted FDA routes:
 * Route A: Using declared rounded amount
 * Route B: Using underlying unrounded interval
 */
export function evaluateDailyValueMatch({
  nutrientId,
  declaredAmount,
  declaredUnit,
  printedDvPercent,
  unroundedAmount = null,
  population = 'ADULTS_AND_CHILDREN_4_PLUS',
  hasProteinClaim = false
}) {
  const ref = getDailyValueReference(nutrientId, population);
  if (!ref.supported) {
    return {
      status: ref.hasDailyValue === false ? 'not_applicable' : 'unable',
      reason: ref.reason,
      nutrientId
    };
  }

  // Protein conditional handling
  if (nutrientId === 'protein' && !hasProteinClaim && (printedDvPercent == null || printedDvPercent === '')) {
    return {
      status: 'match',
      nutrientId,
      omittedPermitted: true,
      explanation: 'Protein % Daily Value declaration is optional when no protein claims are made for conventional foods.'
    };
  }

  // Convert declared amount to reference unit
  const conv = convertUnits(declaredAmount, declaredUnit || ref.unit, ref.unit);
  if (!conv.ok) {
    return {
      status: 'unable',
      nutrientId,
      error: conv.error,
      reason: `Could not convert declared amount (${declaredAmount} ${declaredUnit}) to reference standard unit (${ref.unit}).`
    };
  }

  const normalizedDeclared = conv.value;
  const rawPercentA = (normalizedDeclared / ref.standardValue) * 100;
  const roundedPercentA = roundDailyValuePercent(rawPercentA);

  // Parse printed percentage
  const printed = Number(String(printedDvPercent ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(printed)) {
    return {
      status: 'review',
      nutrientId,
      rawPercent: rawPercentA,
      expectedPercent: roundedPercentA,
      printedPercent: null,
      explanation: `Artwork does not declare a valid printed numeric %DV for ${ref.name}.`
    };
  }

  // Check permitted vitamin & mineral rounding options if applicable
  const isVitMin = ['vitamin_d', 'calcium', 'iron', 'potassium'].includes(nutrientId);
  const permittedOptionsA = isVitMin ? getPermittedVitaminMineralDvOptions(rawPercentA) : [roundedPercentA];

  const matchesRouteA = permittedOptionsA.includes(printed) || Math.abs(printed - roundedPercentA) <= 0.5;

  // Route B: check underlying unrounded interval
  let matchesRouteB = false;
  let intervalDetails = null;
  if (!matchesRouteA) {
    const [minUnderlying, maxUnderlying] = unroundedAmount != null
      ? [unroundedAmount, unroundedAmount]
      : compatibleUnderlyingInterval(nutrientId, declaredAmount);

    const convMin = convertUnits(minUnderlying, declaredUnit || ref.unit, ref.unit);
    const convMax = convertUnits(maxUnderlying, declaredUnit || ref.unit, ref.unit);

    if (convMin.ok && convMax.ok) {
      const minPercent = (convMin.value / ref.standardValue) * 100;
      const maxPercent = (convMax.value / ref.standardValue) * 100;
      const minRounded = roundDailyValuePercent(minPercent);
      const maxRounded = roundDailyValuePercent(maxPercent);

      intervalDetails = { minUnderlying, maxUnderlying, minRounded, maxRounded };
      if (printed >= minRounded && printed <= maxRounded) {
        matchesRouteB = true;
      }
    }
  }

  const isMatch = matchesRouteA || matchesRouteB;
  const difference = Number((printed - roundedPercentA).toFixed(1));

  return {
    status: isMatch ? 'match' : 'issue',
    nutrientId,
    nutrientName: ref.name,
    declaredAmount,
    declaredUnit: declaredUnit || ref.unit,
    standardValue: ref.standardValue,
    referenceUnit: ref.unit,
    cfr: ref.cfr,
    rawPercent: Number(rawPercentA.toFixed(2)),
    expectedPercent: roundedPercentA,
    printedPercent: printed,
    difference,
    matchesRouteA,
    matchesRouteB,
    intervalDetails,
    formula: `${declaredAmount} ${ref.unit} / ${ref.standardValue} ${ref.unit} × 100 = ${rawPercentA.toFixed(1)}% (rounds to ${roundedPercentA}%)`,
    explanation: isMatch
      ? (matchesRouteA
          ? `Printed ${printed}% DV matches standard calculation (${roundedPercentA}% DV).`
          : `Printed ${printed}% DV is permissible under unrounded analytical composition interval.`)
      : `Printed ${printed}% DV conflicts with calculated ${roundedPercentA}% DV (${declaredAmount} ${ref.unit} / ${ref.standardValue} ${ref.unit}).`
  };
}

/**
 * Primary calculateDailyValue API specified in Step 8
 */
export function calculateDailyValue({
  nutrientId,
  nutrientAmount,
  nutrientUnit,
  printedDvPercent = null,
  servingBasis = 'PER_SERVING',
  populationCategory = 'ADULTS_AND_CHILDREN_4_PLUS',
  allowUnroundedInterval = true
}) {
  const ref = getDailyValueReference(nutrientId, populationCategory);

  if (!ref.supported) {
    const isNoDv = ref.hasDailyValue === false;
    return {
      nutrientId,
      status: isNoDv ? 'NOT_APPLICABLE' : 'UNABLE',
      dailyValueReference: null,
      referenceUnit: null,
      unroundedPercent: null,
      expectedDisplayedPercent: null,
      printedPercent: printedDvPercent != null ? Number(String(printedDvPercent).replace(/[^0-9.]/g, '')) : null,
      difference: null,
      regulatoryCitation: '21 CFR 101.9(c)',
      explanation: ref.reason,
      proof: null
    };
  }

  const evalRes = evaluateDailyValueMatch({
    nutrientId,
    declaredAmount: nutrientAmount,
    declaredUnit: nutrientUnit,
    printedDvPercent,
    population: populationCategory
  });

  if (evalRes.omittedPermitted) {
    return {
      nutrientId,
      status: 'MATCH',
      dailyValueReference: ref.standardValue,
      referenceUnit: ref.unit,
      unroundedPercent: null,
      expectedDisplayedPercent: null,
      printedPercent: null,
      difference: 0,
      regulatoryCitation: ref.cfr,
      explanation: evalRes.explanation,
      proof: null
    };
  }

  if (evalRes.status === 'unable') {
    return {
      nutrientId,
      status: 'UNABLE',
      dailyValueReference: ref.standardValue,
      referenceUnit: ref.unit,
      unroundedPercent: null,
      expectedDisplayedPercent: null,
      printedPercent: evalRes.printedPercent,
      difference: null,
      regulatoryCitation: ref.cfr,
      explanation: evalRes.reason || evalRes.error,
      proof: null
    };
  }

  const proof = {
    proofId: `proof:dv:${nutrientId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    checkId: `dv:${nutrientId}`,
    nutrientId,
    formulaId: 'FDA_21CFR101.9_DV_PERCENT',
    formulaVersion: '2016.1',
    inputValues: { amount: nutrientAmount, printedPercent: printedDvPercent },
    inputUnits: { amount: nutrientUnit, printedPercent: '%' },
    normalizedValues: { amount: evalRes.declaredAmount, standardValue: evalRes.standardValue },
    conversionSteps: [`${nutrientAmount} ${nutrientUnit || ref.unit} -> ${evalRes.declaredAmount} ${ref.unit}`],
    dailyValueReference: evalRes.standardValue,
    referenceUnit: evalRes.referenceUnit,
    servingBasis,
    roundingSteps: [`Raw calculation: ${evalRes.rawPercent}% -> rounded to ${evalRes.expectedPercent}%`],
    unroundedResult: evalRes.rawPercent,
    displayedExpectedResult: evalRes.expectedPercent,
    printedResult: evalRes.printedPercent,
    comparisonOutcome: evalRes.status.toUpperCase(),
    limitations: evalRes.matchesRouteB
      ? ['Permitted under dual-route unrounded analytical composition interval (21 CFR 101.9(c)).']
      : ['Evaluated under standard declared amount route (21 CFR 101.9(c)).']
  };

  return {
    nutrientId,
    status: evalRes.status.toUpperCase(), // 'MATCH', 'ISSUE', 'REVIEW'
    dailyValueReference: evalRes.standardValue,
    referenceUnit: evalRes.referenceUnit,
    unroundedPercent: evalRes.rawPercent,
    expectedDisplayedPercent: evalRes.expectedPercent,
    printedPercent: evalRes.printedPercent,
    difference: evalRes.difference,
    regulatoryCitation: evalRes.cfr,
    explanation: evalRes.explanation,
    matchesRouteA: evalRes.matchesRouteA,
    matchesRouteB: evalRes.matchesRouteB,
    proof
  };
}

