/**
 * PackSignal Nutrient Component Consistency Engine (lib/nutrition/consistency.mjs)
 * Verifies chemical subsets:
 * 1. Total Sugars <= Total Carbohydrate
 * 2. Added Sugars <= Total Sugars
 * 3. Saturated Fat <= Total Fat
 * Incorporates statutory rounding intervals to avoid false defects.
 */

import { convertUnits } from './units.mjs';
import { compatibleUnderlyingInterval } from './rounding.mjs';

export function verifySugarsVsCarbohydrate({
  totalSugars,
  totalSugarsUnit = 'g',
  totalCarbohydrate,
  totalCarbUnit = 'g'
}) {
  if (totalSugars == null || totalCarbohydrate == null) {
    return { status: 'unable', reason: 'Total sugars or total carbohydrate value missing.' };
  }

  const sConv = convertUnits(totalSugars, totalSugarsUnit, 'g');
  const cConv = convertUnits(totalCarbohydrate, totalCarbUnit, 'g');

  if (!sConv.ok || !cConv.ok) {
    return { status: 'unable', reason: 'Incompatible units for sugars vs carbohydrate comparison.' };
  }

  const sVal = sConv.value;
  const cVal = cConv.value;

  if (sVal <= cVal) {
    return {
      status: 'match',
      rule: 'totalSugars <= totalCarbohydrate',
      totalSugars: sVal,
      totalCarbohydrate: cVal,
      explanation: `Total sugars (${sVal}g) does not exceed total carbohydrate (${cVal}g).`
    };
  }

  // Check if underlying rounding interval could explain the difference
  const [sMin] = compatibleUnderlyingInterval('total_sugars', sVal);
  const [, cMax] = compatibleUnderlyingInterval('total_carbohydrate', cVal);

  if (sMin <= cMax) {
    return {
      status: 'review',
      rule: 'totalSugars <= totalCarbohydrate',
      totalSugars: sVal,
      totalCarbohydrate: cVal,
      explanation: `Declared total sugars (${sVal}g) nominally exceeds total carbohydrate (${cVal}g), but may be explained by rounded label intervals ([${sMin.toFixed(2)}g] vs [${cMax.toFixed(2)}g]). Confirm unrounded laboratory values.`
    };
  }

  return {
    status: 'issue',
    rule: 'totalSugars <= totalCarbohydrate',
    totalSugars: sVal,
    totalCarbohydrate: cVal,
    explanation: `Total sugars (${sVal}g) exceeds total carbohydrate (${cVal}g) outside statutory rounding tolerances. Sugars are a chemical subset of carbohydrates.`
  };
}

export function verifyAddedSugarsVsTotalSugars({
  addedSugars,
  addedSugarsUnit = 'g',
  totalSugars,
  totalSugarsUnit = 'g'
}) {
  if (addedSugars == null || totalSugars == null) {
    return { status: 'unable', reason: 'Added sugars or total sugars value missing.' };
  }

  const aConv = convertUnits(addedSugars, addedSugarsUnit, 'g');
  const tConv = convertUnits(totalSugars, totalSugarsUnit, 'g');

  if (!aConv.ok || !tConv.ok) {
    return { status: 'unable', reason: 'Incompatible units for added sugars vs total sugars comparison.' };
  }

  const aVal = aConv.value;
  const tVal = tConv.value;

  if (aVal <= tVal) {
    return {
      status: 'match',
      rule: 'addedSugars <= totalSugars',
      addedSugars: aVal,
      totalSugars: tVal,
      explanation: `Added sugars (${aVal}g) does not exceed total sugars (${tVal}g).`
    };
  }

  const [aMin] = compatibleUnderlyingInterval('added_sugars', aVal);
  const [, tMax] = compatibleUnderlyingInterval('total_sugars', tVal);

  if (aMin <= tMax) {
    return {
      status: 'review',
      rule: 'addedSugars <= totalSugars',
      addedSugars: aVal,
      totalSugars: tVal,
      explanation: `Declared added sugars (${aVal}g) exceeds total sugars (${tVal}g), but lies within overlapping rounding intervals. Confirm unrounded recipe formulation.`
    };
  }

  return {
    status: 'issue',
    rule: 'addedSugars <= totalSugars',
    addedSugars: aVal,
    totalSugars: tVal,
    explanation: `Added sugars (${aVal}g) exceeds total sugars (${tVal}g) outside rounding bounds. Added sugars cannot exceed total sugars.`
  };
}

export function verifySaturatedFatVsTotalFat({
  saturatedFat,
  saturatedFatUnit = 'g',
  totalFat,
  totalFatUnit = 'g'
}) {
  if (saturatedFat == null || totalFat == null) {
    return { status: 'unable', reason: 'Saturated fat or total fat value missing.' };
  }

  const sConv = convertUnits(saturatedFat, saturatedFatUnit, 'g');
  const fConv = convertUnits(totalFat, totalFatUnit, 'g');

  if (!sConv.ok || !fConv.ok) {
    return { status: 'unable', reason: 'Incompatible units for saturated fat vs total fat comparison.' };
  }

  const sVal = sConv.value;
  const fVal = fConv.value;

  if (sVal <= fVal) {
    return {
      status: 'match',
      rule: 'saturatedFat <= totalFat',
      saturatedFat: sVal,
      totalFat: fVal,
      explanation: `Saturated fat (${sVal}g) does not exceed total fat (${fVal}g).`
    };
  }

  const [sMin] = compatibleUnderlyingInterval('saturated_fat', sVal);
  const [, fMax] = compatibleUnderlyingInterval('total_fat', fVal);

  if (sMin <= fMax) {
    return {
      status: 'review',
      rule: 'saturatedFat <= totalFat',
      saturatedFat: sVal,
      totalFat: fVal,
      explanation: `Declared saturated fat (${sVal}g) exceeds total fat (${fVal}g) on printed label, but lies within overlapping rounding intervals. Confirm analytical lipid profile.`
    };
  }

  return {
    status: 'issue',
    rule: 'saturatedFat <= totalFat',
    saturatedFat: sVal,
    totalFat: fVal,
    explanation: `Saturated fat (${sVal}g) exceeds total fat (${fVal}g) outside rounding tolerance. Saturated fat is a chemical constituent of total fat.`
  };
}

export function screenSugarsVersusCarbohydrates({
  totalSugarsGrams,
  totalCarbGrams,
  servingBasis = 'PER_SERVING'
}) {
  const v = verifySugarsVsCarbohydrate({
    totalSugars: totalSugarsGrams,
    totalCarbohydrate: totalCarbGrams
  });
  const passes = v.status === 'match';
  const proof = {
    proofId: `proof:consistency:sugars-carbs:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    checkId: 'consistency:sugars_carbs',
    formulaId: 'TOTAL_SUGARS_LEQ_TOTAL_CARB',
    formulaVersion: '1.0',
    inputValues: { totalSugars: totalSugarsGrams, totalCarbohydrate: totalCarbGrams },
    inputUnits: { totalSugars: 'g', totalCarbohydrate: 'g' },
    servingBasis,
    unroundedResult: null,
    displayedExpectedResult: `${totalSugarsGrams}g <= ${totalCarbGrams}g`,
    printedResult: `${totalSugarsGrams}g / ${totalCarbGrams}g`,
    comparisonOutcome: v.status.toUpperCase(),
    limitations: ['Underlying unrounded analytical intervals considered (21 CFR 101.9(c)).']
  };
  return {
    passes,
    status: v.status,
    lowerNutrient: { name: 'Total Sugars', declaredValue: totalSugarsGrams },
    upperNutrient: { name: 'Total Carbohydrate', declaredValue: totalCarbGrams },
    explanation: v.explanation,
    proof
  };
}

export function screenAddedSugarsVersusTotalSugars({
  addedSugarsGrams,
  totalSugarsGrams,
  servingBasis = 'PER_SERVING'
}) {
  const v = verifyAddedSugarsVsTotalSugars({
    addedSugars: addedSugarsGrams,
    totalSugars: totalSugarsGrams
  });
  const passes = v.status === 'match';
  const proof = {
    proofId: `proof:consistency:added-total-sugars:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    checkId: 'consistency:added_total_sugars',
    formulaId: 'ADDED_SUGARS_LEQ_TOTAL_SUGARS',
    formulaVersion: '1.0',
    inputValues: { addedSugars: addedSugarsGrams, totalSugars: totalSugarsGrams },
    inputUnits: { addedSugars: 'g', totalSugars: 'g' },
    servingBasis,
    unroundedResult: null,
    displayedExpectedResult: `${addedSugarsGrams}g <= ${totalSugarsGrams}g`,
    printedResult: `${addedSugarsGrams}g / ${totalSugarsGrams}g`,
    comparisonOutcome: v.status.toUpperCase(),
    limitations: ['Underlying unrounded analytical intervals considered (21 CFR 101.9(c)).']
  };
  return {
    passes,
    status: v.status,
    lowerNutrient: { name: 'Added Sugars', declaredValue: addedSugarsGrams },
    upperNutrient: { name: 'Total Sugars', declaredValue: totalSugarsGrams },
    explanation: v.explanation,
    proof
  };
}

export function screenSaturatedFatVersusTotalFat({
  saturatedFatGrams,
  totalFatGrams,
  servingBasis = 'PER_SERVING'
}) {
  const v = verifySaturatedFatVsTotalFat({
    saturatedFat: saturatedFatGrams,
    totalFat: totalFatGrams
  });
  const passes = v.status === 'match';
  const proof = {
    proofId: `proof:consistency:sat-total-fat:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    checkId: 'consistency:sat_total_fat',
    formulaId: 'SAT_FAT_LEQ_TOTAL_FAT',
    formulaVersion: '1.0',
    inputValues: { saturatedFat: saturatedFatGrams, totalFat: totalFatGrams },
    inputUnits: { saturatedFat: 'g', totalFat: 'g' },
    servingBasis,
    unroundedResult: null,
    displayedExpectedResult: `${saturatedFatGrams}g <= ${totalFatGrams}g`,
    printedResult: `${saturatedFatGrams}g / ${totalFatGrams}g`,
    comparisonOutcome: v.status.toUpperCase(),
    limitations: ['Underlying unrounded analytical intervals considered (21 CFR 101.9(c)).']
  };
  return {
    passes,
    status: v.status,
    lowerNutrient: { name: 'Saturated Fat', declaredValue: saturatedFatGrams },
    upperNutrient: { name: 'Total Fat', declaredValue: totalFatGrams },
    explanation: v.explanation,
    proof
  };
}

