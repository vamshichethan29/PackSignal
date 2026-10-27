/**
 * PackSignal US Food Label Regulatory Preflight Pack — 21 Targeted Test Cases
 * Exactly 3 test fixtures per each of the 7 executable checks.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { executeUsNetQuantityCheck } from '../../lib/regulatory/us/net-quantity.mjs';
import { executeUsBusinessAddressCheck } from '../../lib/regulatory/us/business-address.mjs';
import { executeUsIngredientsAllergensCheck } from '../../lib/regulatory/us/ingredients-allergens.mjs';
import { executeUsNutritionFieldsCheck } from '../../lib/regulatory/us/nutrition-fields.mjs';
import { executeUsDailyValueCheck } from '../../lib/regulatory/us/daily-values.mjs';
import { executeUsCalorieSanityCheck } from '../../lib/regulatory/us/calorie-sanity.mjs';
import { executeUsClaimVerificationCheck } from '../../lib/regulatory/us/claims-evidence.mjs';
import { runUsFoodPreflight } from '../../lib/regulatory/us/index.mjs';

// ============================================================================
// CHECK 1: US-001 NET QUANTITY (Cases 1, 2, 3)
// ============================================================================

test('Case 1: US-001 Correct equivalent US and metric quantity (Dual Declaration)', () => {
  const result = executeUsNetQuantityCheck({
    artworkText: 'ORGANIC OAT DRINK\nNET WT 14 OZ (396 g)\nKEEP REFRIGERATED',
    approvedSourceQty: '14 oz (396 g)',
    pdpMapped: true,
  });
  assert.equal(result.checkId, 'US-001');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /satisfies 21 CFR 101.105 dual declaration/i);
});

test('Case 2: US-001 Verified wrong net quantity flags issue against approved source', () => {
  const result = executeUsNetQuantityCheck({
    artworkText: 'NET WT 12 OZ (340 g)',
    approvedSourceQty: '14 oz (396 g)',
    pdpMapped: true,
  });
  assert.equal(result.checkId, 'US-001');
  assert.equal(result.findingStatus, 'issue');
  assert.match(result.explanation, /Net quantity declaration mismatch/i);
});

test('Case 3: US-001 Unmapped PDP notes placement pending without failing valid quantity', () => {
  const result = executeUsNetQuantityCheck({
    artworkText: '16 FL OZ (473 mL)',
    approvedSourceQty: '16 fl oz',
    pdpMapped: false,
  });
  assert.equal(result.checkId, 'US-001');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /placement within bottom 30% of PDP requires dieline zone confirmation/i);
});

// ============================================================================
// CHECK 2: US-002 BUSINESS ADDRESS (Cases 4, 5, 6)
// ============================================================================

test('Case 4: US-002 Complete valid source-backed business information matches', () => {
  const result = executeUsBusinessAddressCheck({
    artworkText: 'Distributed by Organic Foods Co., 123 Farm Way, Austin, TX 78701',
    approvedBusinessName: 'Organic Foods Co.',
  });
  assert.equal(result.checkId, 'US-002');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /satisfy 21 CFR 101.5/i);
});

test('Case 5: US-002 Verified missing city, state, or ZIP code flags statutory issue', () => {
  const result = executeUsBusinessAddressCheck({
    artworkText: 'Distributed by Organic Foods Co., Austin',
    approvedBusinessName: 'Organic Foods Co.',
    coverageConfirmed: true,
  });
  assert.equal(result.checkId, 'US-002');
  assert.equal(result.findingStatus, 'issue');
  assert.match(result.explanation, /Statutory Violation under 21 CFR 101.5/i);
});

test('Case 6: US-002 Street address exception routes to review under 21 CFR 101.5(d)', () => {
  const result = executeUsBusinessAddressCheck({
    artworkText: 'Distributed by Organic Foods Co., Austin, TX 78701',
    approvedBusinessName: 'Organic Foods Co.',
  });
  assert.equal(result.checkId, 'US-002');
  assert.equal(result.findingStatus, 'review');
  assert.match(result.explanation, /Street address exception review.*21 CFR 101.5\(d\)/i);
});

// ============================================================================
// CHECK 3: US-003 INGREDIENTS & ALLERGENS (Cases 7, 8, 9)
// ============================================================================

test('Case 7: US-003 Correct supported ingredient and allergen declaration matches', () => {
  const result = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Water, Organic Oats, Sunflower Oil, Sea Salt.\nContains: Oats.',
    approvedIngredients: 'Water, Organic Oats, Sunflower Oil, Sea Salt.',
  });
  assert.equal(result.checkId, 'US-003');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /satisfy 21 CFR 101.4 and FALCPA/i);
});

test('Case 8: US-003 Verified missing major allergen (e.g. Sesame) flags issue under FASTER Act', () => {
  const result = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Chickpeas, Water, Olive Oil, Salt.\nContains: None.',
    approvedIngredients: 'Chickpeas, Sesame Tahini, Olive Oil, Salt.',
    formulationAllergens: ['Sesame'],
  });
  assert.equal(result.checkId, 'US-003');
  assert.equal(result.findingStatus, 'issue');
  assert.match(result.explanation, /FALCPA \/ FASTER Act Violation.*Sesame/i);
});

test('Case 9: US-003 Unsupplied formulation specification routes extracted ingredients to review', () => {
  const result = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Water, Almonds, Cane Sugar, Vanilla Extract.',
    approvedIngredients: null,
  });
  assert.equal(result.checkId, 'US-003');
  assert.equal(result.findingStatus, 'review');
  assert.match(result.explanation, /no approved formulation specification was supplied for verification/i);
});

// ============================================================================
// CHECK 4: US-004 NUTRITION FACTS REQUIRED FIELDS (Cases 10, 11, 12)
// ============================================================================

test('Case 10: US-004 Standard panel contains all required mandatory fields', () => {
  const standardPanelText = `
    Nutrition Facts
    8 servings per container
    Serving size 1 cup (240mL)
    Calories 120
    Total Fat 2.5g
    Saturated Fat 0.5g
    Trans Fat 0g
    Cholesterol 0mg
    Sodium 100mg
    Total Carbohydrate 22g
    Dietary Fiber 3g
    Total Sugars 7g
    Includes 4g Added Sugars
    Protein 3g
    Vitamin D 2mcg
    Calcium 260mg
    Iron 1mg
    Potassium 350mg
  `;
  const result = executeUsNutritionFieldsCheck({
    artworkText: standardPanelText,
    formatType: 'standard',
  });
  assert.equal(result.checkId, 'US-004');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /satisfies 21 CFR 101.9/i);
});

test('Case 11: US-004 Mandatory field verified missing flags statutory issue', () => {
  const panelMissingTransFat = `
    Nutrition Facts
    1 serving per container
    Serving size 1 pouch (100g)
    Calories 90
    Total Fat 1g
    Saturated Fat 0g
    Cholesterol 0mg
    Sodium 50mg
    Total Carbohydrate 18g
    Dietary Fiber 2g
    Total Sugars 12g
    Includes 0g Added Sugars
    Protein 1g
    Vitamin D 0mcg
    Calcium 10mg
    Iron 0.5mg
    Potassium 80mg
  `; // Missing Trans Fat
  const result = executeUsNutritionFieldsCheck({
    artworkText: panelMissingTransFat,
    formatType: 'standard',
    coverageConfirmed: true,
  });
  assert.equal(result.checkId, 'US-004');
  assert.equal(result.findingStatus, 'issue');
  assert.match(result.explanation, /missing mandatory field.*Trans Fat/i);
});

test('Case 12: US-004 Simplified/exempt alternative format requires review', () => {
  const result = executeUsNutritionFieldsCheck({
    artworkText: 'Nutrition Facts\nCalories 0\nSodium 0mg',
    formatType: 'simplified',
  });
  assert.equal(result.checkId, 'US-004');
  assert.equal(result.findingStatus, 'review');
  assert.match(result.explanation, /Alternative nutrition panel format specified \(simplified\)/i);
});

// ============================================================================
// CHECK 5: US-005 DAILY VALUE ARITHMETIC (Cases 13, 14, 15)
// ============================================================================

test('Case 13: US-005 Correct sodium %DV calculation matches statutory standard', () => {
  // Sodium: 230 mg / 2300 mg reference = 10%
  const result = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 230,
    unit: 'mg',
    declaredDvPercent: 10,
    nutritionBasis: 'per_serving',
  });
  assert.equal(result.checkId, 'US-005');
  assert.equal(result.findingStatus, 'match');
  assert.equal(result.checkVerdict, 'MATH_MATCH');
});

test('Case 14: US-005 Incorrect sodium %DV flags MATH_MISMATCH issue', () => {
  // Sodium: 230 mg / 2300 mg = 10%, but printed is 18%
  const result = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 230,
    unit: 'mg',
    declaredDvPercent: 18,
    nutritionBasis: 'per_serving',
  });
  assert.equal(result.checkId, 'US-005');
  assert.equal(result.findingStatus, 'issue');
  assert.equal(result.checkVerdict, 'MATH_MISMATCH');
  assert.match(result.explanation, /Statutory Calculation Discrepancy under 21 CFR 101.9/i);
});

test('Case 15: US-005 Unresolved serving basis routes to review to avoid fake math failure', () => {
  const result = executeUsDailyValueCheck({
    nutrientKey: 'sodium',
    declaredAmount: 230,
    unit: 'mg',
    declaredDvPercent: 10,
    nutritionBasis: 'unresolved',
  });
  assert.equal(result.checkId, 'US-005');
  assert.equal(result.findingStatus, 'review');
  assert.equal(result.checkVerdict, 'INSUFFICIENT_INPUT');
  assert.match(result.explanation, /Serving basis unresolved/i);
});

// ============================================================================
// CHECK 6: US-006 CALORIE SANITY (Cases 16, 17, 18)
// ============================================================================

test('Case 16: US-006 Declared calories within 20% Atwater screening tolerance matches', () => {
  // Fat 2g (18 kcal), Carb 20g (80 kcal), Protein 3g (12 kcal) -> 110 kcal. Declared: 110 kcal.
  const result = executeUsCalorieSanityCheck({
    declaredCalories: 110,
    fatGrams: 2,
    carbGrams: 20,
    proteinGrams: 3,
  });
  assert.equal(result.checkId, 'US-006');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /plausible under general Atwater screening/i);
});

test('Case 17: US-006 Substantial discrepancy (>20%) routes to review with caveats, not fake fail', () => {
  // Fat 10g (90 kcal), Carb 30g (120 kcal), Protein 10g (40 kcal) -> 250 kcal. Declared: 140 kcal (44% diff).
  const result = executeUsCalorieSanityCheck({
    declaredCalories: 140,
    fatGrams: 10,
    carbGrams: 30,
    proteinGrams: 10,
  });
  assert.equal(result.checkId, 'US-006');
  assert.equal(result.findingStatus, 'review');
  assert.match(result.explanation, /Calorie plausibility review.*21 CFR 101.9\(c\)\(1\) permits multiple calculation methods/i);
});

test('Case 18: US-006 Missing macronutrient inputs returns unable without guessing', () => {
  const result = executeUsCalorieSanityCheck({
    declaredCalories: 120,
    fatGrams: null,
    carbGrams: 20,
    proteinGrams: null,
  });
  assert.equal(result.checkId, 'US-006');
  assert.equal(result.findingStatus, 'unable');
  assert.match(result.explanation, /requires declared calories, total fat, total carbohydrate, and protein/i);
});

// ============================================================================
// CHECK 7: US-007 CLAIMS & EVIDENCE (Cases 19, 20, 21)
// ============================================================================

test('Case 19: US-007 Claim matching approved register and verified evidence matches', () => {
  const result = executeUsClaimVerificationCheck({
    artworkText: 'Our Delicious Drink is Made With Recycled Content and 100% Recyclable.',
    approvedClaimsRegister: [
      { id: 'recyclable', claimText: '100% Recyclable', approvedWording: '100% Recyclable', evidenceDocumentId: 'lca-dossier-01' },
      { id: 'recycled_content', claimText: 'Made With Recycled Content', approvedWording: 'Made With Recycled Content', evidenceDocumentId: 'supply-chain-cert' },
    ],
    evidenceDocuments: [{ id: 'lca-dossier-01', role: 'substantiation' }, { id: 'supply-chain-cert', role: 'substantiation' }],
  });
  assert.equal(result.checkId, 'US-007');
  assert.equal(result.findingStatus, 'match');
  assert.match(result.explanation, /Claim-to-evidence verified/i);
});

test('Case 20: US-007 Claim contradicting approved specification flags issue', () => {
  const result = executeUsClaimVerificationCheck({
    artworkText: '100% Organic Oat Drink',
    approvedClaimsRegister: [
      { id: 'organic', claimText: 'Organic', approved: false, status: 'PROHIBITED', reason: 'Formulation not yet certified under USDA NOP' },
    ],
  });
  assert.equal(result.checkId, 'US-007');
  assert.equal(result.findingStatus, 'issue');
  assert.match(result.explanation, /Contradicted claim on artwork.*explicitly prohibited or rejected/i);
});

test('Case 21: US-007 Unsubstantiated environmental claim routes to review under FTC Green Guides', () => {
  const result = executeUsClaimVerificationCheck({
    artworkText: 'Our packaging is Eco-Friendly and Carbon Neutral.',
    approvedClaimsRegister: [], // No registered substantiation
  });
  assert.equal(result.checkId, 'US-007');
  assert.equal(result.findingStatus, 'review');
  assert.match(result.explanation, /Unsubstantiated claim review.*FTC Green Guides/i);
});

// ============================================================================
// FULL ORCHESTRATOR INTEGRATION TEST
// ============================================================================

test('Orchestrator: runUsFoodPreflight executes all 7 checks and produces structured scorecard', () => {
  const mockReview = {
    name: 'Dancing Fish Fictional Controlled Spec',
    artworkText: `
      Dancing Fish Original Oat Milk
      NET WT 14 OZ (396 g)
      Ingredients: Water, Organic Oats, Sunflower Oil, Sea Salt.
      Contains: Oats.
      Distributed by Fish Brand LLC, 100 Ocean Dr, Portland, OR 97201
      Nutrition Facts
      8 servings per container
      Serving size 1 cup (240mL)
      Calories 120
      Total Fat 2.5g
      Saturated Fat 0.5g
      Trans Fat 0g
      Cholesterol 0mg
      Sodium 230mg
      Total Carbohydrate 22g
      Dietary Fiber 3g
      Total Sugars 7g
      Includes 4g Added Sugars
      Protein 3g
      Vitamin D 2mcg
      Calcium 260mg
      Iron 1mg
      Potassium 350mg
      100% Recyclable Packaging
    `,
    facts: [
      { field: 'product_name', value: 'Dancing Fish Original Oat Milk' },
      { field: 'net_quantity', value: '14 oz (396 g)' },
      { field: 'business_name', value: 'Fish Brand LLC' },
      { field: 'ingredients', value: 'Water, Organic Oats, Sunflower Oil, Sea Salt.' },
      { field: 'calories', value: '120' },
      { field: 'total_fat', value: '2.5' },
      { field: 'total_carbohydrate', value: '22' },
      { field: 'protein', value: '3' },
      { field: 'sodium', value: '230' },
      { field: 'sodium_dv', value: '10' },
      { field: 'nutrition_basis', value: 'per_serving' },
    ],
    claimsRegister: [
      { id: 'recyclable', claimText: '100% Recyclable', approvedWording: '100% Recyclable', evidenceDocumentId: 'doc-subst-1' },
    ],
    documents: [
      { id: 'doc-subst-1', role: 'substantiation' },
      { id: 'spec-1', role: 'spec', approved: true },
    ],
    options: {
      completeArtwork: true,
      nutritionBasisConfirmed: true,
      sourceAuthorityConfirmed: true,
    },
  };

  const preflight = runUsFoodPreflight(mockReview);
  assert.equal(preflight.packId, 'us-food-preflight');
  assert.equal(preflight.checks.length, 7);
  assert.equal(preflight.coverage.total, 7);
  assert.ok(preflight.coverage.match >= 6);
  assert.equal(preflight.jurisdiction, 'US');
  assert.ok(preflight.limitations.length > 0);
});
