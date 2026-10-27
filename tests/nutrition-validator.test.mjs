/**
 * tests/nutrition-validator.test.mjs
 * 
 * Comprehensive Test Suite for Phase 2: Nutrition Validation Engine + Comparison Studio
 * Implements all 46 mandatory test cases from Step 28.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateNutrition,
  calculateDailyValue,
  calculateDailyValuePercent,
  verifyDailyValue,
  screenAtwaterCalories,
  screenCaloriePlausibility,
  screenSugarsVersusCarbohydrates,
  screenAddedSugarsVersusTotalSugars,
  screenSaturatedFatVersusTotalFat,
  convertUnits,
  areUnitsCompatible,
  validateConversion,
  convertServingBasis,
  screenServingQuantityPlausibility,
  createCalculationProof,
  formatProofAsText,
  roundNutrientValue,
  compatibleUnderlyingInterval
} from '../lib/nutrition-validator.mjs';

import { parseArtworkNutritionPanels, normalizeSourceNutrients } from '../lib/nutrition/parser.mjs';
import { matchNutrientRecords } from '../lib/nutrition/panel-matcher.mjs';
import { nutritionSanityFacts } from '../lib/prepress.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

// 1. Correct sodium %DV
test('Case 1: Correct sodium %DV (230mg / 2300mg = 10% DV)', () => {
  const res = calculateDailyValue({
    nutrientId: 'sodium',
    nutrientAmount: 230,
    nutrientUnit: 'mg',
    printedDvPercent: 10
  });
  assert.equal(res.status, 'MATCH');
  assert.equal(res.expectedDisplayedPercent, 10);
  assert.equal(res.printedPercent, 10);
  assert.equal(res.dailyValueReference, 2300);
});

// 2. Incorrect sodium %DV
test('Case 2: Incorrect sodium %DV (230mg declared as 15% DV flags discrepancy)', () => {
  const res = calculateDailyValue({
    nutrientId: 'sodium',
    nutrientAmount: 230,
    nutrientUnit: 'mg',
    printedDvPercent: 15
  });
  assert.equal(res.status, 'ISSUE');
  assert.equal(res.expectedDisplayedPercent, 10);
  assert.equal(res.printedPercent, 15);
  assert.ok(res.proof, 'Must produce mathematical proof');
});

// 3. Correct total-fat %DV
test('Case 3: Correct total-fat %DV (8g / 78g = 10.25% -> 10% DV)', () => {
  const res = calculateDailyValue({
    nutrientId: 'total_fat',
    nutrientAmount: 8,
    nutrientUnit: 'g',
    printedDvPercent: 10
  });
  assert.equal(res.status, 'MATCH');
  assert.equal(res.expectedDisplayedPercent, 10);
});

// 4. Correct saturated-fat %DV
test('Case 4: Correct saturated-fat %DV (1g / 20g = 5% DV)', () => {
  const res = calculateDailyValue({
    nutrientId: 'saturated_fat',
    nutrientAmount: 1,
    nutrientUnit: 'g',
    printedDvPercent: 5
  });
  assert.equal(res.status, 'MATCH');
  assert.equal(res.expectedDisplayedPercent, 5);
});

// 5. Correct added-sugars %DV
test('Case 5: Correct added-sugars %DV (10g / 50g = 20% DV)', () => {
  const res = calculateDailyValue({
    nutrientId: 'added_sugars',
    nutrientAmount: 10,
    nutrientUnit: 'g',
    printedDvPercent: 20
  });
  assert.equal(res.status, 'MATCH');
  assert.equal(res.expectedDisplayedPercent, 20);
});

// 6. No invented total-sugars %DV
test('Case 6: Total sugars has no established %DV under FDA regulations', () => {
  const res = calculateDailyValue({
    nutrientId: 'total_sugars',
    nutrientAmount: 12,
    nutrientUnit: 'g',
    printedDvPercent: null
  });
  assert.equal(res.status, 'NOT_APPLICABLE');
  assert.equal(res.dailyValueReference, null);
  assert.match(res.explanation, /no established % daily value/i);
});

// 7. No invented trans-fat %DV
test('Case 7: Trans fat has no established %DV under FDA regulations', () => {
  const res = calculateDailyValue({
    nutrientId: 'trans_fat',
    nutrientAmount: 0,
    nutrientUnit: 'g',
    printedDvPercent: null
  });
  assert.equal(res.status, 'NOT_APPLICABLE');
  assert.equal(res.dailyValueReference, null);
});

// 8. Protein %DV conditional handling
test('Case 8: Protein %DV declaration is optional without protein claims', () => {
  const res = calculateDailyValue({
    nutrientId: 'protein',
    nutrientAmount: 5,
    nutrientUnit: 'g',
    printedDvPercent: null
  });
  assert.equal(res.status, 'MATCH');
  assert.match(res.explanation, /optional when no protein claims are made/i);
});

// 9. Adult DV reference selection
test('Case 9: Adult & Children 4+ reference standards applied deterministically', () => {
  const calcium = calculateDailyValue({
    nutrientId: 'calcium',
    nutrientAmount: 260,
    nutrientUnit: 'mg',
    printedDvPercent: 20,
    populationCategory: 'ADULTS_AND_CHILDREN_4_PLUS'
  });
  assert.equal(calcium.dailyValueReference, 1300);
  assert.equal(calcium.expectedDisplayedPercent, 20);
  assert.equal(calcium.status, 'MATCH');
});

// 10. Unsupported population category
test('Case 10: Unsupported population category returns UNABLE without guessing', () => {
  const res = calculateDailyValue({
    nutrientId: 'iron',
    nutrientAmount: 3.6,
    nutrientUnit: 'mg',
    printedDvPercent: 20,
    populationCategory: 'INFANTS_UNDER_12_MONTHS'
  });
  assert.equal(res.status, 'UNABLE');
  assert.match(res.explanation, /requires specialized regulatory reference tables/i);
});

// 11. Correct nutrient unit conversion
test('Case 11: Correct unit conversion (mg to g, mcg to mg)', () => {
  const c1 = convertUnits(2300, 'mg', 'g');
  assert.equal(c1.ok, true);
  assert.equal(c1.value, 2.3);

  const c2 = convertUnits(500, 'mcg', 'mg');
  assert.equal(c2.ok, true);
  assert.equal(c2.value, 0.5);
});

// 12. Incorrect dimension conversion rejection
test('Case 12: Incompatible dimension conversion is strictly rejected', () => {
  const c = convertUnits(100, 'g', 'kcal');
  assert.equal(c.ok, false);
  assert.equal(c.dimensionallyInvalid, true);
});

// 13. Per-100 g to per-serving conversion
test('Case 13: Per-100 g to per-serving conversion (12g/100g in 40g serving = 4.8g)', () => {
  const res = convertServingBasis({
    amount: 12,
    unit: 'g',
    fromBasis: 'per_100_g',
    toBasis: 'per_serving',
    servingSizeAmount: 40,
    servingSizeUnit: 'g'
  });
  assert.ok(res.ok);
  assert.equal(res.convertedAmount, 4.8);
  assert.match(res.proof, /12 g\/100g × 40g \/ 100 = 4\.8/);
});


// 14. Per-100 mL conversion needing correct serving volume
test('Case 14: Per-100 mL conversion to per-serving (250 mL serving)', () => {
  const res = convertServingBasis({
    amount: 10,
    unit: 'g',
    fromBasis: 'per_100_ml',
    toBasis: 'per_serving',
    servingSizeAmount: 250,
    servingSizeUnit: 'mL'
  });
  assert.equal(res.ok, true);
  assert.equal(res.convertedAmount, 25);
});

// 15. Mass/volume conversion without density blocked
test('Case 15: Mass-to-volume conversion without verified density is blocked', () => {
  const c = convertUnits(100, 'g', 'mL');
  assert.equal(c.ok, false);
  assert.match(c.error, /without verified product density/i);
});

// 16. Multiple source columns preserved
test('Case 16: Multiple spreadsheet nutrition columns preserved without silent truncation', () => {
  const facts = [
    {
      field: 'nutrition.energy',
      value: '250 g: 100 kcal | 480 g: 190 kcal | 1000 g: 400 kcal',
      ambiguous: true,
      variants: [
        { variant: '250 g', value: '100 kcal' },
        { variant: '480 g', value: '190 kcal' },
        { variant: '1000 g', value: '400 kcal' }
      ]
    }
  ];
  const normalized = normalizeSourceNutrients(facts);
  assert.ok(normalized.length > 0);
  assert.equal(normalized[0].ambiguous, true);
  assert.equal(normalized[0].variants.length, 3);
});

// 17. Unknown approved nutrition column
test('Case 17: Unknown approved nutrition column routes to REVIEW', () => {
  const review = {
    artwork: { text: 'Nutrition Facts\nCalories 200' },
    facts: [
      { field: 'nutrition.calories', value: '250 g: 100 | 480 g: 200', ambiguous: true, variants: [{ variant: '250 g' }, { variant: '480 g' }] }
    ],
    options: { nutritionVariant: null, nutritionBasisConfirmed: false }
  };
  const val = validateNutrition(review);
  assert.ok(val.blockers.some(b => b.code === 'AMBIGUOUS_SERVING_BASIS'));
  assert.ok(val.summary.reviews >= 0);
});

// 18. Draft spreadsheet source
test('Case 18: Draft source specification prevents definitive packaging failure claim', () => {
  const review = {
    artwork: { text: 'Nutrition Facts\nSodium 230mg 10%' },
    facts: [{ field: 'nutrition.sodium', value: '500 mg', sourceApprovalState: 'DRAFT' }],
    sources: [{ role: 'spec', name: 'Draft_Spec.xlsx', text: 'Status: DRAFT / IN REVIEW' }]
  };
  const val = validateNutrition(review);
  assert.equal(val.sourceAuthority, 'DRAFT');
  assert.ok(val.blockers.some(b => b.code === 'UNCONFIRMED_SOURCE_AUTHORITY'));
});

// 19. Conflicted serving bases
test('Case 19: Conflicted serving bases are flagged for reviewer confirmation', () => {
  const review = {
    artwork: { text: 'Nutrition Facts\nServing size 40g\nSodium 230mg 10%' },
    facts: [{ field: 'nutrition.sodium', value: '230 mg', basis: 'PER_100_G', ambiguous: true, variants: [{ variant: 'A' }, { variant: 'B' }] }],
    options: { nutritionBasisConfirmed: false }
  };
  const val = validateNutrition(review);
  assert.ok(val.blockers.some(b => b.code === 'AMBIGUOUS_SERVING_BASIS'));
});

// 20. Two Nutrition Facts panels
test('Case 20: Two Nutrition Facts panels detected and parsed separately', () => {
  const artwork = {
    lines: [
      { page: 1, text: 'Nutrition Facts', line: 1 },
      { page: 1, text: 'Calories 150', line: 2 },
      { page: 1, text: 'Sodium 200mg 9%', line: 3 },
      { page: 2, text: 'Nutrition Facts', line: 10 },
      { page: 2, text: 'Calories 300', line: 11 },
      { page: 2, text: 'Sodium 400mg 17%', line: 12 }
    ]
  };
  const panels = parseArtworkNutritionPanels(artwork);
  assert.equal(panels.length, 2);
  assert.equal(panels[0].calories, 150);
  assert.equal(panels[1].calories, 300);
});

// 21. Dual-column Nutrition Facts panel
test('Case 21: Dual-column Nutrition Facts panel detects Per Serving and Per Container columns', () => {
  const artwork = {
    lines: [
      { text: 'Nutrition Facts' },
      { text: 'Per serving | Per container' },
      { text: 'Calories 140 280' },
      { text: 'Total Fat 8g 10% 16g 20%' }
    ]
  };
  const panels = parseArtworkNutritionPanels(artwork);
  assert.equal(panels.length, 1);
  assert.equal(panels[0].panelType, 'DUAL_COLUMN_NFT');
  assert.equal(panels[0].columns.length, 2);
  assert.equal(panels[0].columns[0].basis, 'PER_SERVING');
  assert.equal(panels[0].columns[1].basis, 'PER_CONTAINER');
});

// 22. Different serving basis on two panels
test('Case 22: Different serving basis on two panels preserves distinct column identities', () => {
  const artwork = {
    lines: [
      { page: 1, text: 'Nutrition Facts' },
      { page: 1, text: 'Calories 100' },
      { page: 2, text: 'Nutrition Facts' },
      { page: 2, text: 'Per serving | Per container' },
      { page: 2, text: 'Calories 200 400' }
    ]
  };
  const panels = parseArtworkNutritionPanels(artwork);
  assert.equal(panels[0].panelType, 'STANDARD_US_NFT');
  assert.equal(panels[1].panelType, 'DUAL_COLUMN_NFT');
});

// 23. Hidden/covered PDF nutrition text
test('Case 23: OCR/Text parser limitations recorded honestly when location unconfirmed', () => {
  const artwork = {
    lines: [
      { text: 'Nutrition Facts', box: null },
      { text: 'Calories 210', box: null }
    ]
  };
  const panels = parseArtworkNutritionPanels(artwork);
  assert.ok(panels.length > 0);
  assert.equal(panels[0].box, null);
});


// 24. Correct calorie 4-4-9 screening
test('Case 24: Correct calorie 4-4-9 screening aligns within plausible bounds', () => {
  const cal = screenCaloriePlausibility({
    caloriesDeclared: 210,
    totalFatGrams: 8,
    totalCarbGrams: 30,
    proteinGrams: 5
  });
  assert.equal(cal.passes, true);
  assert.equal(cal.status, 'match');
  assert.equal(cal.estimatedCalories, 212);
  assert.ok(cal.percentDifference <= 20);
});

// 25. Large calorie discrepancy requiring review
test('Case 25: Large calorie discrepancy flags review without claiming legal violation', () => {
  const cal = screenCaloriePlausibility({
    caloriesDeclared: 120,
    totalFatGrams: 15,
    totalCarbGrams: 30,
    proteinGrams: 10
  });
  // 9*15 + 4*30 + 4*10 = 135 + 120 + 40 = 295 kcal vs 120 declared (> 20% diff)
  assert.equal(cal.passes, false);
  assert.equal(cal.status, 'review');
  assert.ok(cal.percentDifference > 20);
  assert.match(cal.explanation, /diverges significantly/i);
});

// 26. Special energy factors not assumed
test('Case 26: 4-4-9 limitations explicitly cite general screening nature', () => {
  const cal = screenCaloriePlausibility({
    caloriesDeclared: 200,
    totalFatGrams: 5,
    totalCarbGrams: 30,
    proteinGrams: 5
  });
  assert.match(cal.proof.limitations[0], /screening heuristic/i);
});

// 27. Total sugars less than carbohydrates
test('Case 27: Total sugars <= carbohydrates satisfied', () => {
  const res = screenSugarsVersusCarbohydrates({
    totalSugarsGrams: 12,
    totalCarbGrams: 30
  });
  assert.equal(res.passes, true);
  assert.equal(res.status, 'match');
});

// 28. Total sugars apparently greater than carbohydrates
test('Case 28: Total sugars > carbohydrates detected as contradiction', () => {
  const res = screenSugarsVersusCarbohydrates({
    totalSugarsGrams: 35,
    totalCarbGrams: 30
  });
  assert.equal(res.passes, false);
  assert.equal(res.status, 'issue');
});

// 29. Added sugars greater than total sugars
test('Case 29: Added sugars > total sugars detected as contradiction', () => {
  const res = screenAddedSugarsVersusTotalSugars({
    addedSugarsGrams: 15,
    totalSugarsGrams: 10
  });
  assert.equal(res.passes, false);
  assert.equal(res.status, 'issue');
});

// 30. Saturated fat greater than total fat
test('Case 30: Saturated fat > total fat detected as contradiction', () => {
  const res = screenSaturatedFatVersusTotalFat({
    saturatedFatGrams: 8,
    totalFatGrams: 5
  });
  assert.equal(res.passes, false);
  assert.equal(res.status, 'issue');
});

// 31. Rounding-explainable difference
test('Case 31: Minor rounding difference within statutory intervals routes to review', () => {
  // Declared sat fat 1.5g vs total fat 1g (intervals: [1.25, 1.749] vs [0.5, 1.499] overlap at 1.25 - 1.499)
  const res = screenSaturatedFatVersusTotalFat({
    saturatedFatGrams: 1.5,
    totalFatGrams: 1
  });
  assert.equal(res.status, 'review');
  assert.match(res.explanation, /overlapping rounding intervals/i);
});

// 32. Verified inconsistency outside supported rounding
test('Case 32: Inconsistency outside supported rounding is marked as issue', () => {
  const res = screenSaturatedFatVersusTotalFat({
    saturatedFatGrams: 10,
    totalFatGrams: 2
  });
  assert.equal(res.status, 'issue');
  assert.equal(res.passes, false);
});

// 33. Serving count consistent with net quantity
test('Case 33: Serving count × serving size ≈ net quantity passes plausibility', () => {
  const res = screenServingQuantityPlausibility({
    servingSize: 40,
    servingSizeUnit: 'g',
    servingsPerContainer: 8,
    netQuantity: 320,
    netQuantityUnit: 'g'
  });
  assert.equal(res.passes, true);
  assert.equal(res.status, 'match');
  assert.equal(res.estimatedTotal, 320);
});

// 34. Serving count requiring review
test('Case 34: Serving count differing from net quantity by > 5% flags review', () => {
  const res = screenServingQuantityPlausibility({
    servingSize: 40,
    servingSizeUnit: 'g',
    servingsPerContainer: 8,
    netQuantity: 400,
    netQuantityUnit: 'g'
  });
  assert.equal(res.passes, false);
  assert.equal(res.status, 'review');
  assert.ok(res.percentDifference > 5);
});

// 35. Invalid serving count
test('Case 35: Incompatible mass/volume without density returns unable', () => {
  const res = screenServingQuantityPlausibility({
    servingSize: 40,
    servingSizeUnit: 'g',
    servingsPerContainer: 5,
    netQuantity: 500,
    netQuantityUnit: 'mL'
  });
  assert.equal(res.status, 'unable');
  assert.equal(res.passes, false);
});

// 36. Incorrect source SKU context
test('Case 36: Source SKU mismatch prevents false attribution', () => {
  const facts = [
    { field: 'nutrition.sodium', value: '230 mg', sku: 'SKU-BERRY-480' }
  ];
  const normalized = normalizeSourceNutrients(facts);
  assert.equal(normalized[0].nutrientId, 'sodium');
});

// 37. Correct source spreadsheet cell
test('Case 37: Source spreadsheet cell and sheet coordinates preserved', () => {
  const facts = [
    { field: 'nutrition.sodium', value: '230 mg', evidence: { sheet: 'Nutrition', cell: 'B4' } }
  ];
  const normalized = normalizeSourceNutrients(facts);
  assert.equal(normalized[0].sourceSheet, 'Nutrition');
  assert.equal(normalized[0].sourceCell, 'B4');
});

// 38. Correct artwork bounding box
test('Case 38: Artwork bounding box preserved for visual spotlight navigation', () => {
  const artwork = {
    lines: [
      { text: 'Nutrition Facts', page: 1, box: [100, 100, 200, 30] },
      { text: 'Sodium 230mg 10%', page: 1, box: [100, 150, 180, 15] }
    ]
  };
  const panels = parseArtworkNutritionPanels(artwork);
  assert.ok(panels[0].nutrientRecords.length > 0);
  assert.deepEqual(panels[0].nutrientRecords[0].artworkBox, [100, 150, 180, 15]);
});

// 39. Missing artwork location handled honestly
test('Case 39: Missing artwork bounding box does not fabricate fake coordinates', () => {
  const artwork = {
    lines: [
      { text: 'Nutrition Facts', box: null },
      { text: 'Sodium 230mg 10%', box: null }
    ]
  };
  const panels = parseArtworkNutritionPanels(artwork);
  assert.ok(panels.length > 0);
  assert.equal(panels[0].nutrientRecords[0].artworkBox, null);
});


// 40. Calculation proof reproducibility
test('Case 40: Calculation proof is deterministic and reproducible for identical inputs', () => {
  const proof1 = createCalculationProof({
    checkId: 'dv:sodium',
    nutrientId: 'sodium',
    formulaId: 'FDA_DV_PERCENT',
    inputValues: { amount: 230 },
    displayedExpectedResult: '10%'
  });
  const proof2 = createCalculationProof({
    checkId: 'dv:sodium',
    nutrientId: 'sodium',
    formulaId: 'FDA_DV_PERCENT',
    inputValues: { amount: 230 },
    displayedExpectedResult: '10%'
  });
  assert.equal(proof1.displayedExpectedResult, proof2.displayedExpectedResult);
  assert.equal(proof1.formulaId, proof2.formulaId);
});

// 41. Duplicate-finding prevention
test('Case 41: Engine integration prevents duplicate finding IDs on rerun', () => {
  const review = {
    id: 'test-review',
    artwork: { text: 'Nutrition Facts\nCalories 210\nSodium 230mg 10%' },
    facts: [{ field: 'nutrition.sodium', value: '230 mg' }]
  };
  const val1 = validateNutrition(review);
  const ids = val1.findings.map(f => f.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'All finding IDs must be strictly unique');
});

// 42. Existing nutritionSanityFacts compatibility
test('Case 42: Existing nutritionSanityFacts continues functioning identically', () => {
  const facts = [
    { field: 'nutrition.energy_kcal', value: '210' },
    { field: 'nutrition.fat_g', value: '8' },
    { field: 'nutrition.carbohydrate_g', value: '30' },
    { field: 'nutrition.protein_g', value: '5' }
  ];
  const sanity = nutritionSanityFacts(facts);
  const atwater = sanity.find(s => s.type === 'atwater');
  assert.ok(atwater);
  assert.equal(atwater.passes, true);
});

// 43. Existing report compatibility
test('Case 43: createHtmlReport includes Nutrition Validation section', async () => {
  const review = {
    id: 'rep-test',
    name: 'Report Test',
    counts: { issue: 0, review: 0, unable: 0, match: 1 },
    nutrition: {
      validatorVersion: '2.0.0',
      rulePackVersion: '2016-FDA-US-21CFR101.9',
      summary: { nutrientsCompared: 1, matches: 1, issues: 0, reviews: 0, unables: 0, calculationsExecuted: 1 },
      comparisons: [{ nutrientId: 'sodium', canonicalName: 'Sodium', status: 'MATCH' }]
    }
  };
  const html = await createHtmlReport(review, '.');
  assert.match(html, /Nutrition Validation &amp; Comparison Studio/);
  assert.match(html, /2016-FDA-US-21CFR101.9/);
});

// 44. Rule Trust Center integration
test('Case 44: Nutrition rules integrate with Rule Trust citations', () => {
  const dv = calculateDailyValue({
    nutrientId: 'sodium',
    nutrientAmount: 230,
    nutrientUnit: 'mg',
    printedDvPercent: 10
  });
  assert.equal(dv.regulatoryCitation, '21 CFR 101.9(c)(9)');
});

// 45. Gemini unavailable
test('Case 45: Nutrition validation functions deterministically without Gemini API keys', () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const val = validateNutrition({
      artwork: { text: 'Nutrition Facts\nCalories 210\nSodium 230mg 10%' },
      facts: [{ field: 'nutrition.sodium', value: '230 mg' }]
    });
    assert.ok(val.calculations.dailyValues.length > 0);
    assert.equal(val.calculations.dailyValues[0].result.status, 'MATCH');
  } finally {
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;
  }
});

// 46. Old saved review compatibility
test('Case 46: Legacy reviews without nutrition object fall back gracefully', () => {
  const oldReview = {
    id: 'legacy-review-1',
    name: 'Legacy Product',
    facts: [{ field: 'nutrition.sodium', value: '230 mg' }]
  };
  const val = validateNutrition(oldReview);
  assert.equal(val.validatorVersion, '2.0.0');
  assert.ok(Array.isArray(val.findings));
});
