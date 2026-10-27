/**
 * PackSignal Mutation Operators (lib/benchmark/mutation-operators.mjs)
 * Phase 8: 31 Controlled Packaging Defect Mutation Operators across 5 Families.
 * Deterministic, reproducible, immutable transformations for mutation testing.
 */

import { getBaselineFixture } from './benchmark-fixtures.mjs';

/**
 * Helper to build an analysis-ready review object from fixture components.
 */
function buildReviewFromFixture(fixture, artworkLines = null, customOptions = {}) {
  const lines = (artworkLines || fixture.artworkLines || []).map((text, idx) => ({
    text,
    page: 1,
    line: idx + 1,
    box: [0.1, 0.08 + idx * 0.07, 0.85, 0.12 + idx * 0.07],
  }));

  const artworkDoc = {
    id: 'artwork-doc',
    name: 'packaging-artwork.pdf',
    role: 'artwork',
    text: lines.map(l => l.text).join('\n'),
    lines,
    pages: [{
      number: 1,
      width: 1200,
      height: 860,
      image: 'page-1.png',
      method: 'pdf_text',
      unit: 'pt',
    }],
    cells: [],
    data: null,
  };

  const specDoc = {
    id: 'spec-doc',
    name: 'approved-product-specification.json',
    role: 'spec',
    text: JSON.stringify(fixture.spec.product || {}),
    lines: [],
    pages: [],
    cells: [],
    data: {
      status: 'APPROVED',
      product: fixture.spec.product || {},
      nutrition: fixture.spec.nutrition || {},
      preflight: fixture.spec.preflight || {},
    },
  };

  const rulesDoc = {
    id: 'rules-doc',
    name: 'statutory-rules.json',
    role: 'rules',
    text: 'Approved Statutory Packaging Rules',
    lines: [],
    pages: [],
    cells: [],
    data: {
      rules: fixture.spec.rules || [],
    },
  };

  return {
    id: `eval-${fixture.familyId}`,
    name: `${fixture.productName} Review`,
    market: fixture.market || 'US',
    engine: 'PackSignal Deterministic v1.0',
    documents: [artworkDoc, specDoc, rulesDoc],
    options: {
      completeArtwork: true,
      netQuantityConfirmed: true,
      nutritionBasisConfirmed: true,
      ...customOptions,
    },
    decisions: {},
    audit: [],
  };
}

// ============================================================================
// FAMILY A: ALLERGEN & INGREDIENT MUTATIONS (A1 - A7)
// ============================================================================

export function mutateA1_removeAllergen(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const mutatedLines = baseline.artworkLines.filter(line => !line.startsWith('CONTAINS:'));
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'A1',
      family: 'family-a-allergens',
      operator: 'mutateA1_removeAllergen',
      targetField: 'allergen_statement',
      expectedEffect: 'Mandatory allergen statement deleted from artwork',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-ALLERGEN',
      groundTruthEvidence: 'Artwork lacks required allergen declaration: CONTAINS: PEANUTS, TREE NUTS (ALMONDS), SOY.',
      tier: 1,
    },
  };
}

export function mutateA2_replaceApprovedAllergen(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const mutatedLines = baseline.artworkLines.map(line => 
    line.startsWith('CONTAINS:') ? 'CONTAINS: MILK.' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'A2',
      family: 'family-a-allergens',
      operator: 'mutateA2_replaceApprovedAllergen',
      targetField: 'allergen_statement',
      expectedEffect: 'Approved allergen statement replaced with conflicting allergen disclosure',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-ALLERGEN',
      groundTruthEvidence: 'Artwork declares CONTAINS: MILK instead of approved PEANUTS, TREE NUTS, SOY',
      tier: 1,
    },
  };
}

export function mutateA3_omitIngredient(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('INGREDIENTS:')
      ? 'INGREDIENTS: Organic Rolled Oats (52%), Cane Sugar, Roasted Peanuts, Sunflower Oil, Soy Lecithin, Sea Salt.'
      : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'A3',
      family: 'family-a-allergens',
      operator: 'mutateA3_omitIngredient',
      targetField: 'ingredients',
      expectedEffect: 'Almonds omitted from printed ingredient list',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-INGREDIENTS',
      groundTruthEvidence: 'Approved ingredient Almonds missing from printed ingredient declaration',
      tier: 1,
    },
  };
}

export function mutateA4_changeIngredientPercentage(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('INGREDIENTS:')
      ? line.replace('52%', '35%')
      : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'A4',
      family: 'family-a-allergens',
      operator: 'mutateA4_changeIngredientPercentage',
      targetField: 'ingredients',
      expectedEffect: 'Main ingredient characterising percentage changed from 52% to 35%',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-INGREDIENTS',
      groundTruthEvidence: 'Rolled Oats declared as 35% on artwork vs approved 52%',
      tier: 1,
    },
  };
}

export function mutateA5_insertConflictingAllergenClaim(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.includes('GLUTEN FREE, DAIRY FREE')
      ? '100% PEANUT-FREE FACILITY'
      : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'A5',
      family: 'family-a-allergens',
      operator: 'mutateA5_insertConflictingAllergenClaim',
      targetField: 'allergen_free_claims',
      expectedEffect: 'Inserted contradictory Peanut-Free claim on product containing Roasted Peanuts',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-FREE-CLAIMS',
      groundTruthEvidence: 'Artwork claims Peanut-Free while ingredient list contains Roasted Peanuts',
      tier: 1,
    },
  };
}

export function mutateA6_invalidAllergenPlacement(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-A6-PLACEMENT',
        key: 'preflight:placement:allergen_statement',
        title: 'Mandatory allergen statement placed on unreadable fold flap',
        status: 'issue',
        severity: 'major',
        expected: 'Allergen declaration on Information Panel immediately contiguous to ingredients',
        observed: 'Allergen statement placed on fold-under bottom enclosure flap',
        check: 'placement_allergen',
        category: 'regulatory',
        rule: { id: 'RULE-A-ALLERGEN', source: '21 CFR §101.2(b)', text: 'Allergen statements must appear on the Information Panel.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'A6',
      family: 'family-a-allergens',
      operator: 'mutateA6_invalidAllergenPlacement',
      targetField: 'allergen_statement',
      expectedEffect: 'Mandatory allergen statement moved to obscure fold-under flap',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-ALLERGEN',
      groundTruthEvidence: 'Allergen declaration placed outside information panel on bottom enclosure flap',
      tier: 1,
    },
  };
}

export function mutateA7_corruptApprovedIngredientName(seed = 0) {
  const baseline = getBaselineFixture('family-a-allergens');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('INGREDIENTS:')
      ? line.replace('Organic Rolled Oats', 'High Fructose Corn Syrup')
      : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'A7',
      family: 'family-a-allergens',
      operator: 'mutateA7_corruptApprovedIngredientName',
      targetField: 'ingredients',
      expectedEffect: 'Approved organic oats substituted with high fructose corn syrup',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-A-INGREDIENTS',
      groundTruthEvidence: 'Artwork declares High Fructose Corn Syrup instead of Organic Rolled Oats',
      tier: 1,
    },
  };
}

// ============================================================================
// FAMILY B: BARCODE & IDENTIFIER MUTATIONS (B1 - B6)
// ============================================================================

export function mutateB1_changeGtinDataDigit(seed = 0) {
  const baseline = getBaselineFixture('family-b-barcodes');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.includes('012345678905') ? line.replace('012345678905', '012345678915') : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'B1',
      family: 'family-b-barcodes',
      operator: 'mutateB1_changeGtinDataDigit',
      targetField: 'gtin',
      expectedEffect: 'GTIN data digit altered (012345678905 -> 012345678915)',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-B-GTIN',
      groundTruthEvidence: 'Printed barcode digits 012345678915 do not match approved GTIN 012345678905',
      tier: 1,
    },
  };
}

export function mutateB2_corruptGtinCheckDigit(seed = 0) {
  const baseline = getBaselineFixture('family-b-barcodes');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.includes('012345678905') ? line.replace('012345678905', '012345678904') : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);
  review.preflight = {
    findings: [
      {
        id: 'PF-B2-CHECKSUM',
        key: 'preflight:barcode:check_digit',
        title: 'GTIN check digit algorithm failure',
        status: 'issue',
        severity: 'critical',
        expected: 'Valid GS1 Modulo-10 check digit (5)',
        observed: 'Invalid check digit (4)',
        check: 'gtin_check_digit',
        category: 'barcode',
        rule: { id: 'RULE-B-GTIN', source: 'GS1 General Specifications §7.9', text: 'Barcodes must contain valid check digits.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'B2',
      family: 'family-b-barcodes',
      operator: 'mutateB2_corruptGtinCheckDigit',
      targetField: 'gtin',
      expectedEffect: 'GTIN check digit corrupted from 5 to 4',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-B-GTIN',
      groundTruthEvidence: 'GTIN 012345678904 fails GS1 modulo-10 check digit verification (expected 5, found 4)',
      tier: 1,
    },
  };
}

export function mutateB3_crossVariantGtinSwap(seed = 0) {
  const baseline = getBaselineFixture('family-b-barcodes');
  const siblingGtin = '012345678929';
  const mutatedLines = baseline.artworkLines.map(line =>
    line.includes('012345678905') ? line.replace('012345678905', siblingGtin) : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'B3',
      family: 'family-b-barcodes',
      operator: 'mutateB3_crossVariantGtinSwap',
      targetField: 'gtin',
      expectedEffect: 'GTIN swapped with sibling flavor variant SKU',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-B-GTIN',
      groundTruthEvidence: 'Artwork contains GTIN 012345678929 belonging to a different variant',
      tier: 1,
    },
  };
}

export function mutateB4_removeBarcodeSymbol(seed = 0) {
  const baseline = getBaselineFixture('family-b-barcodes');
  const mutatedLines = baseline.artworkLines.filter(line => !line.includes('012345678905'));
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'B4',
      family: 'family-b-barcodes',
      operator: 'mutateB4_removeBarcodeSymbol',
      targetField: 'barcode',
      expectedEffect: 'Barcode symbol and human-readable text completely missing from artwork',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-B-BARCODE-SYM',
      groundTruthEvidence: 'Mandatory scannable barcode symbol absent from packaging artwork',
      tier: 1,
    },
  };
}

export function mutateB5_violateBarcodeQuietZone(seed = 0) {
  const baseline = getBaselineFixture('family-b-barcodes');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-B5-QUIET-ZONE',
        key: 'preflight:barcode:quiet_zone',
        title: 'Barcode quiet zone violated by promotional graphics',
        status: 'issue',
        severity: 'major',
        expected: 'Clear quiet zone margin (GS1 specifications ≥ 5.0 mm)',
        observed: 'Clearance is 1.2 mm due to encroaching promotional starburst',
        check: 'barcode_quiet_zone',
        category: 'barcode',
        rule: { id: 'RULE-B-BARCODE-SYM', source: 'GS1 General Specifications §5.2.1.4.1', text: 'Barcodes must maintain unobstructed quiet zones.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'B5',
      family: 'family-b-barcodes',
      operator: 'mutateB5_violateBarcodeQuietZone',
      targetField: 'barcode',
      expectedEffect: 'Text artwork encroaches into the GS1 required 5.0 mm quiet zone margin',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-B-BARCODE-SYM',
      groundTruthEvidence: 'Barcode quiet zone clearance < 2.0 mm due to encroaching promotional text',
      tier: 1,
    },
  };
}

export function mutateB6_invalidBarcodeSizing(seed = 0) {
  const baseline = getBaselineFixture('family-b-barcodes');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-B6-SIZE',
        key: 'preflight:barcode:size',
        title: 'Barcode symbol height truncated below 15 mm GS1 specification minimum',
        status: 'issue',
        severity: 'major',
        expected: 'Barcode symbol height ≥ 15.0 mm',
        observed: 'Measured barcode height is 4.5 mm',
        check: 'barcode_size',
        category: 'barcode',
        rule: { id: 'RULE-B-BARCODE-SYM', source: 'GS1 General Specifications §5.4.1', text: 'Barcodes must meet minimum readable symbol height.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'B6',
      family: 'family-b-barcodes',
      operator: 'mutateB6_invalidBarcodeSizing',
      targetField: 'barcode',
      expectedEffect: 'Barcode symbol height truncated below 15 mm GS1 specification minimum',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-B-BARCODE-SYM',
      groundTruthEvidence: 'Barcode height is only 4.5 mm, failing GS1 minimum readable height threshold',
      tier: 1,
    },
  };
}

// ============================================================================
// FAMILY C: NUTRITION MATHEMATICS MUTATIONS (C1 - C6)
// ============================================================================

export function mutateC1_alterDeclaredCalories(seed = 0) {
  const baseline = getBaselineFixture('family-c-nutrition');
  // Declare 110 kcal instead of 165 kcal. Triggers Atwater review prompt (>20% deviation).
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('Calories') ? 'Calories 110' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'C1',
      family: 'family-c-nutrition',
      operator: 'mutateC1_alterDeclaredCalories',
      targetField: 'nutrition.energy_kcal',
      expectedEffect: 'Calories altered to 110 kcal, causing 33% discrepancy with Atwater formula (165 kcal)',
      expectedFindingType: 'review',
      expectedRuleId: 'RULE-C-CALORIES',
      groundTruthEvidence: 'Declared 110 kcal differs significantly from macronutrient calculation (165 kcal)',
      tier: 1,
    },
  };
}

export function mutateC2_saturatesExceedTotalFat(seed = 0) {
  const baseline = getBaselineFixture('family-c-nutrition');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('Saturated Fat') ? 'Saturated Fat 8g 40%' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'C2',
      family: 'family-c-nutrition',
      operator: 'mutateC2_saturatesExceedTotalFat',
      targetField: 'nutrition.consistency',
      expectedEffect: 'Saturated fat (8g) declared higher than total fat (5g)',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-C-FAT',
      groundTruthEvidence: 'Saturated fat (8g) exceeds total fat (5g), violating physical nutrient composition',
      tier: 1,
    },
  };
}

export function mutateC3_sugarsExceedTotalCarbs(seed = 0) {
  const baseline = getBaselineFixture('family-c-nutrition');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('Total Sugars') ? 'Total Sugars 30g' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'C3',
      family: 'family-c-nutrition',
      operator: 'mutateC3_sugarsExceedTotalCarbs',
      targetField: 'nutrition.consistency',
      expectedEffect: 'Total sugars (30g) declared higher than total carbohydrate (25g)',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-C-CARBS',
      groundTruthEvidence: 'Total sugars (30g) exceeds total carbohydrate (25g), violating 21 CFR §101.9',
      tier: 1,
    },
  };
}

export function mutateC4_corruptProteinValue(seed = 0) {
  const baseline = getBaselineFixture('family-c-nutrition');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('Protein') ? 'Protein 0g' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'C4',
      family: 'family-c-nutrition',
      operator: 'mutateC4_corruptProteinValue',
      targetField: 'nutrition.protein_g',
      expectedEffect: 'Protein content corrupted from approved 5g to 0g',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-C-PROTEIN',
      groundTruthEvidence: 'Artwork declares Protein 0g while approved specification mandates 5g',
      tier: 1,
    },
  };
}

export function mutateC5_servingBasisMismatch(seed = 0) {
  const baseline = getBaselineFixture('family-c-nutrition');
  const mutatedLines = baseline.artworkLines.map(line => {
    if (line.startsWith('Calories')) return 'Calories 412';
    if (line.startsWith('Total Fat')) return 'Total Fat 12.5g 16%';
    if (line.startsWith('Total Carbohydrate')) return 'Total Carbohydrate 62.5g 23%';
    return line;
  });
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'C5',
      family: 'family-c-nutrition',
      operator: 'mutateC5_servingBasisMismatch',
      targetField: 'nutrition.energy_kcal',
      expectedEffect: '100g basis figures inserted under a 40g single-serving panel header',
      expectedFindingType: 'review',
      expectedRuleId: 'RULE-C-CALORIES',
      groundTruthEvidence: 'Declared 412 calories per 40g bar creates 150% deviation against expected 165 kcal',
      tier: 1,
    },
  };
}

export function mutateC6_impossibleMassBalance(seed = 0) {
  const baseline = getBaselineFixture('family-c-nutrition');
  const mutatedLines = baseline.artworkLines.map(line => {
    if (line.startsWith('Total Fat')) return 'Total Fat 20g 26%';
    if (line.startsWith('Total Carbohydrate')) return 'Total Carbohydrate 30g 11%';
    if (line.startsWith('Protein')) return 'Protein 10g';
    if (line.startsWith('Calories')) return 'Calories 340';
    return line;
  });
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'C6',
      family: 'family-c-nutrition',
      operator: 'mutateC6_impossibleMassBalance',
      targetField: 'nutrition.energy_kcal',
      expectedEffect: 'Sum of declared macronutrients (60g) exceeds physical serving size (40g)',
      expectedFindingType: 'review',
      expectedRuleId: 'RULE-C-CALORIES',
      groundTruthEvidence: 'Macronutrients total 60g in a 40g portion, violating physical mass conservation',
      tier: 1,
    },
  };
}

// ============================================================================
// FAMILY D: QUANTITY, CLAIMS & REQUIRED COPY MUTATIONS (D1 - D6)
// ============================================================================

export function mutateD1_changeNetQuantity(seed = 0) {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('NET') ? 'NET 750 mL (25.4 FL OZ)' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'D1',
      family: 'family-d-quantity-claims',
      operator: 'mutateD1_changeNetQuantity',
      targetField: 'net_quantity',
      expectedEffect: 'Net quantity altered from approved 1000 mL to 750 mL',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-D-NET-QTY',
      groundTruthEvidence: 'Declared 750 mL on packaging differs from approved specification 1000 mL',
      tier: 1,
    },
  };
}

export function mutateD2_alterServingSize(seed = 0) {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('Serving size') ? 'Serving size 1/2 cup (125 mL)' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'D2',
      family: 'family-d-quantity-claims',
      operator: 'mutateD2_alterServingSize',
      targetField: 'serving_size',
      expectedEffect: 'Serving size changed from approved 250 mL to 125 mL',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-D-SERVING-SIZE',
      groundTruthEvidence: 'Serving size 125 mL contradicts approved product reference 250 mL',
      tier: 1,
    },
  };
}

export function mutateD3_packMassArithmeticConflict(seed = 0) {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('4 servings') ? '2 servings per container' : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'D3',
      family: 'family-d-quantity-claims',
      operator: 'mutateD3_packMassArithmeticConflict',
      targetField: 'servings',
      expectedEffect: 'Servings per container changed to 2, causing 50% pack mass arithmetic contradiction',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-D-SERVINGS',
      groundTruthEvidence: '2 servings × 250 mL = 500 mL, conflicting with declared 1000 mL bottle size',
      tier: 1,
    },
  };
}

export function mutateD4_removeStorageStatement(seed = 0) {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  const mutatedLines = baseline.artworkLines.filter(line => !line.startsWith('Store in a cool'));
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'D4',
      family: 'family-d-quantity-claims',
      operator: 'mutateD4_removeStorageStatement',
      targetField: 'storage_statement',
      expectedEffect: 'Mandatory storage and refrigeration condition removed from artwork',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-D-STORAGE',
      groundTruthEvidence: 'Required storage instruction absent from extracted packaging text',
      tier: 1,
    },
  };
}

export function mutateD5_insertContradictoryClaim(seed = 0) {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  const mutatedLines = [
    'DAIRY COW FRESH MILK · REAL DAIRY',
    ...baseline.artworkLines.filter(l => !l.includes('100% Plant Based')),
  ];
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'D5',
      family: 'family-d-quantity-claims',
      operator: 'mutateD5_insertContradictoryClaim',
      targetField: 'marketing_claim',
      expectedEffect: 'Contradictory Dairy Milk claim inserted on 100% plant-based oat drink',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-D-CLAIM',
      groundTruthEvidence: 'Artwork claims Real Dairy Milk on an approved 100% Plant Based Oat product',
      tier: 1,
    },
  };
}

export function mutateD6_alterManufacturerAddress(seed = 0) {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  const mutatedLines = baseline.artworkLines.map(line =>
    line.startsWith('Manufactured for')
      ? 'Manufactured for Unknown Entity, P.O. Box 9999, Nowhere, NV 00000'
      : line
  );
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'D6',
      family: 'family-d-quantity-claims',
      operator: 'mutateD6_alterManufacturerAddress',
      targetField: 'manufacturer',
      expectedEffect: 'Approved manufacturer name and address altered',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-D-MFG',
      groundTruthEvidence: 'Printed business address differs from approved specification',
      tier: 1,
    },
  };
}

// ============================================================================
// FAMILY E: PDF VECTOR & PREPRESS ARTWORK MUTATIONS (E1 - E6)
// ============================================================================

export function mutateE1_opaqueOccluderOverMandatoryCopy(seed = 0) {
  const baseline = getBaselineFixture('family-e-prepress');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-E1-OCCLUDER',
        key: 'preflight:visibility:occluded_text',
        title: 'Opaque vector occluder covers mandatory text',
        status: 'issue',
        severity: 'critical',
        expected: 'Mandatory packaging text must remain 100% visible and unoccluded',
        observed: 'Net weight text occluded 100% by subsequent opaque white rectangle',
        check: 'occluded_text',
        category: 'visibility',
        rule: { id: 'RULE-E-NAME', source: 'Prepress Standard §4.1', text: 'Text must not be occluded.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'E1',
      family: 'family-e-prepress',
      operator: 'mutateE1_opaqueOccluderOverMandatoryCopy',
      targetField: 'product_name',
      expectedEffect: 'Opaque white rectangle placed over mandatory net weight declaration in PDF stream',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-E-NAME',
      groundTruthEvidence: 'Net weight text occluded 100% by subsequent opaque white vector path in paint order',
      tier: 1,
    },
  };
}

export function mutateE2_moveTextIntoTrimSafetyZone(seed = 0) {
  const baseline = getBaselineFixture('family-e-prepress');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-E2-TRIM',
        key: 'preflight:trim_safety:boundary',
        title: 'Mandatory text encroaches into forbidden trim safety boundary',
        status: 'issue',
        severity: 'major',
        expected: 'Safe margin ≥ 3.0 mm from cut line',
        observed: 'Measured clearance is 0.8 mm',
        check: 'trim_safety',
        category: 'bleed_trim',
        rule: { id: 'RULE-E-NAME', source: 'ISO 12647-2', text: 'Text must maintain safe margin from trim line.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'E2',
      family: 'family-e-prepress',
      operator: 'mutateE2_moveTextIntoTrimSafetyZone',
      targetField: 'product_name',
      expectedEffect: 'Mandatory text moved within 0.8 mm of trim cut line (minimum safe margin is 3.0 mm)',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-E-NAME',
      groundTruthEvidence: 'Artwork text encroaches into trim safety boundary (0.8 mm < 3.0 mm minimum)',
      tier: 1,
    },
  };
}

export function mutateE3_violateBleedSpecification(seed = 0) {
  const baseline = getBaselineFixture('family-e-prepress');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-E3-BLEED',
        key: 'preflight:bleed:insufficient',
        title: 'Artwork bleed extension below 3.0 mm specification',
        status: 'issue',
        severity: 'major',
        expected: 'Bleed margin ≥ 3.0 mm on all edges',
        observed: 'Available bleed is 1.0 mm',
        check: 'bleed',
        category: 'bleed_trim',
        rule: { id: 'RULE-E-NAME', source: 'Packaging Prepress Guidelines §2.2', text: 'Artwork must extend into full bleed margin.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'E3',
      family: 'family-e-prepress',
      operator: 'mutateE3_violateBleedSpecification',
      targetField: 'product_name',
      expectedEffect: 'Artwork background bleed reduced to 1.0 mm (specification requires 3.0 mm)',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-E-NAME',
      groundTruthEvidence: 'Bleed extension is only 1.0 mm, risking unprinted white slivers during die-cutting',
      tier: 1,
    },
  };
}

export function mutateE4_reduceFontBelowStatutoryHeight(seed = 0) {
  const baseline = getBaselineFixture('family-e-prepress');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-E4-FONT',
        key: 'preflight:typography:height',
        title: 'Mandatory text height fails statutory 1.2 mm minimum',
        status: 'issue',
        severity: 'major',
        expected: 'Text height ≥ 1.2 mm (4.5 pt) for mandatory statements',
        observed: 'Measured glyph height is 0.8 mm (3.1 pt)',
        check: 'font_size',
        category: 'typography',
        rule: { id: 'RULE-E-NAME', source: '21 CFR §101.2(c)', text: 'Mandatory statements must meet minimum prominence.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'E4',
      family: 'family-e-prepress',
      operator: 'mutateE4_reduceFontBelowStatutoryHeight',
      targetField: 'product_name',
      expectedEffect: 'Mandatory copy height reduced to 0.8 mm (below 21 CFR §101.2 statutory 1.2 mm threshold)',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-E-NAME',
      groundTruthEvidence: 'Text height is 0.8 mm (approx 3.2 pt), failing statutory minimum readability requirement',
      tier: 1,
    },
  };
}

export function mutateE5_introduceStaleRevisionCopy(seed = 0) {
  const baseline = getBaselineFixture('family-e-prepress');
  const mutatedLines = [
    ...baseline.artworkLines,
    'OBSOLETE DRAFT: Internal review copy only — not approved for distribution',
  ];
  const review = buildReviewFromFixture(baseline, mutatedLines);

  return {
    review,
    manifest: {
      mutationId: 'E5',
      family: 'family-e-prepress',
      operator: 'mutateE5_introduceStaleRevisionCopy',
      targetField: 'product_name',
      expectedEffect: 'Artwork accidentally retains marked obsolete draft banner',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-E-NAME',
      groundTruthEvidence: 'Artwork contains marked obsolete draft text from pre-release iteration',
      tier: 1,
    },
  };
}

export function mutateE6_excessiveCmykTac(seed = 0) {
  const baseline = getBaselineFixture('family-e-prepress');
  const review = buildReviewFromFixture(baseline);
  review.preflight = {
    findings: [
      {
        id: 'PF-E6-TAC',
        key: 'preflight:ink_density:tac',
        title: 'CMYK Total Area Coverage 345% exceeds 300% press tolerance',
        status: 'issue',
        severity: 'major',
        expected: 'Maximum ink density ≤ 300% TAC',
        observed: 'Peak TAC measured at 345% in shadow regions',
        check: 'tac_coverage',
        category: 'ink_density',
        rule: { id: 'RULE-E-NAME', source: 'ISO 12647-2 Section 4.3.5', text: 'Ink density must not exceed maximum press limit.' },
      }
    ]
  };

  return {
    review,
    manifest: {
      mutationId: 'E6',
      family: 'family-e-prepress',
      operator: 'mutateE6_excessiveCmykTac',
      targetField: 'product_name',
      expectedEffect: 'Total Area Coverage (TAC) ink density reaches 345%, exceeding 300% press tolerance',
      expectedFindingType: 'issue',
      expectedRuleId: 'RULE-E-NAME',
      groundTruthEvidence: 'Maximum ink density is 345%, causing potential set-off and slow ink drying on press',
      tier: 1,
    },
  };
}

// ============================================================================
// CLEAN CONTROLS (One for each family)
// ============================================================================

export function getCleanControlA() {
  const baseline = getBaselineFixture('family-a-allergens');
  return {
    review: buildReviewFromFixture(baseline),
    manifest: {
      mutationId: 'CTRL-A',
      family: 'family-a-allergens',
      isCleanControl: true,
      expectedEffect: 'Clean control for Allergens & Ingredients with 100% compliant declarations',
      expectedFindingType: 'clean',
    },
  };
}

export function getCleanControlB() {
  const baseline = getBaselineFixture('family-b-barcodes');
  return {
    review: buildReviewFromFixture(baseline),
    manifest: {
      mutationId: 'CTRL-B',
      family: 'family-b-barcodes',
      isCleanControl: true,
      expectedEffect: 'Clean control for Barcodes with valid GTIN and quiet zones',
      expectedFindingType: 'clean',
    },
  };
}

export function getCleanControlC() {
  const baseline = getBaselineFixture('family-c-nutrition');
  return {
    review: buildReviewFromFixture(baseline),
    manifest: {
      mutationId: 'CTRL-C',
      family: 'family-c-nutrition',
      isCleanControl: true,
      expectedEffect: 'Clean control for Nutrition Mathematics with verified Atwater and mass balance',
      expectedFindingType: 'clean',
    },
  };
}

export function getCleanControlD() {
  const baseline = getBaselineFixture('family-d-quantity-claims');
  return {
    review: buildReviewFromFixture(baseline),
    manifest: {
      mutationId: 'CTRL-D',
      family: 'family-d-quantity-claims',
      isCleanControl: true,
      expectedEffect: 'Clean control for Quantity and Claims matching reference specification',
      expectedFindingType: 'clean',
    },
  };
}

export function getCleanControlE() {
  const baseline = getBaselineFixture('family-e-prepress');
  return {
    review: buildReviewFromFixture(baseline),
    manifest: {
      mutationId: 'CTRL-E',
      family: 'family-e-prepress',
      isCleanControl: true,
      expectedEffect: 'Clean control for Prepress Artwork with compliant bleed, trim, and font sizes',
      expectedFindingType: 'clean',
    },
  };
}

export const ALL_MUTATION_OPERATORS = [
  // Family A (7)
  mutateA1_removeAllergen,
  mutateA2_replaceApprovedAllergen,
  mutateA3_omitIngredient,
  mutateA4_changeIngredientPercentage,
  mutateA5_insertConflictingAllergenClaim,
  mutateA6_invalidAllergenPlacement,
  mutateA7_corruptApprovedIngredientName,

  // Family B (6)
  mutateB1_changeGtinDataDigit,
  mutateB2_corruptGtinCheckDigit,
  mutateB3_crossVariantGtinSwap,
  mutateB4_removeBarcodeSymbol,
  mutateB5_violateBarcodeQuietZone,
  mutateB6_invalidBarcodeSizing,

  // Family C (6)
  mutateC1_alterDeclaredCalories,
  mutateC2_saturatesExceedTotalFat,
  mutateC3_sugarsExceedTotalCarbs,
  mutateC4_corruptProteinValue,
  mutateC5_servingBasisMismatch,
  mutateC6_impossibleMassBalance,

  // Family D (6)
  mutateD1_changeNetQuantity,
  mutateD2_alterServingSize,
  mutateD3_packMassArithmeticConflict,
  mutateD4_removeStorageStatement,
  mutateD5_insertContradictoryClaim,
  mutateD6_alterManufacturerAddress,

  // Family E (6)
  mutateE1_opaqueOccluderOverMandatoryCopy,
  mutateE2_moveTextIntoTrimSafetyZone,
  mutateE3_violateBleedSpecification,
  mutateE4_reduceFontBelowStatutoryHeight,
  mutateE5_introduceStaleRevisionCopy,
  mutateE6_excessiveCmykTac,
];

export const ALL_CLEAN_CONTROLS = [
  getCleanControlA,
  getCleanControlB,
  getCleanControlC,
  getCleanControlD,
  getCleanControlE,
];
