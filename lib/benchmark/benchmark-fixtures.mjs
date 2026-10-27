/**
 * PackSignal Mutation Benchmark Fixtures (lib/benchmark/benchmark-fixtures.mjs)
 * Phase 8: Five controlled packaging baseline families + clean controls.
 * Immutable baseline templates for reproducible defect injection.
 */

/**
 * FAMILY A: ALLERGEN & INGREDIENT DECLARATIONS
 * Product: Mountain Trail Granola Bar
 */
export const BASELINE_FAMILY_A = Object.freeze({
  familyId: 'family-a-allergens',
  familyName: 'Allergen & Ingredient Declarations',
  productName: 'Mountain Trail Organic Granola',
  market: 'US',
  category: 'Snack Foods',
  ruleApplicability: '21 CFR §101.4 & §101.208 (FALCPA)',
  spec: {
    product: {
      product_name: 'Mountain Trail Organic Granola',
      brand: 'PeakHarvest',
      sku: 'GRN-MTR-01',
      ingredients: 'Organic Rolled Oats (52%), Cane Sugar, Roasted Peanuts, Almonds, Sunflower Oil, Soy Lecithin, Sea Salt.',
      allergen_statement: 'CONTAINS: PEANUTS, TREE NUTS (ALMONDS), SOY.',
      allergen_free_claims: 'GLUTEN FREE, DAIRY FREE',
      net_quantity: '340 g (12 oz)',
    },
    rules: [
      {
        id: 'RULE-A-ALLERGEN',
        field: 'allergen_statement',
        title: 'Mandatory Allergen Declaration',
        comparison: 'exact_copy',
        citation: '21 CFR §101.208',
        literal_expected: 'CONTAINS: PEANUTS, TREE NUTS (ALMONDS), SOY.',
      },
      {
        id: 'RULE-A-INGREDIENTS',
        field: 'ingredients',
        title: 'Ingredient List Completeness',
        comparison: 'exact_copy',
        citation: '21 CFR §101.4',
        literal_expected: 'INGREDIENTS: Organic Rolled Oats (52%), Cane Sugar, Roasted Peanuts, Almonds, Sunflower Oil, Soy Lecithin, Sea Salt.',
      },
      {
        id: 'RULE-A-FREE-CLAIMS',
        field: 'allergen_free_claims',
        title: 'Allergen-Free Claim Verification',
        comparison: 'exact_copy',
        citation: '21 CFR §101.13',
        literal_expected: 'GLUTEN FREE, DAIRY FREE',
      },
      {
        id: 'RULE-A-NAME',
        field: 'product_name',
        title: 'Statement of Identity',
        comparison: 'exact_copy',
        citation: '21 CFR §101.3',
        literal_expected: 'Mountain Trail Organic Granola',
      }
    ]
  },
  artworkLines: [
    'PEAKHARVEST',
    'Mountain Trail Organic Granola',
    'GLUTEN FREE, DAIRY FREE',
    'NET WT 340 g (12 oz)',
    'INGREDIENTS: Organic Rolled Oats (52%), Cane Sugar, Roasted Peanuts, Almonds, Sunflower Oil, Soy Lecithin, Sea Salt.',
    'CONTAINS: PEANUTS, TREE NUTS (ALMONDS), SOY.',
    'Distributed by PeakHarvest Naturals LLC, Boulder, CO 80302'
  ]
});

/**
 * FAMILY B: BARCODES & IDENTIFIER CONSISTENCY
 * Product: Citrus Sparkling Refresher 355mL Can
 */
export const BASELINE_FAMILY_B = Object.freeze({
  familyId: 'family-b-barcodes',
  familyName: 'Barcodes & Identifier Consistency',
  productName: 'Citrus Sparkling Refresher',
  market: 'US',
  category: 'Beverages',
  ruleApplicability: 'GS1 General Specifications & 21 CFR §101.2',
  spec: {
    product: {
      product_name: 'Citrus Sparkling Refresher',
      sku: 'SPR-CIT-12',
      gtin: '012345678905', // Valid GTIN-12
      barcode: '012345678905',
      variant: 'Citrus Zest',
      net_quantity: '355 mL (12 fl oz)',
    },
    rules: [
      {
        id: 'RULE-B-GTIN',
        field: 'gtin',
        title: 'GTIN Barcode Match',
        comparison: 'exact_copy',
        citation: 'GS1 General Specifications §5.2',
        literal_expected: '012345678905',
      },
      {
        id: 'RULE-B-BARCODE-SYM',
        field: 'barcode',
        title: 'Barcode Presence',
        comparison: 'exact_copy',
        citation: 'GS1 §5.4.1',
        literal_expected: '012345678905',
      }
    ]
  },
  barcodeSymbol: {
    gtin: '012345678905',
    box: [0.72, 0.65, 0.92, 0.90],
    quietZoneMm: 5.5,
    heightMm: 22.8,
    magnification: 1.0,
  },
  artworkLines: [
    'CITRUS SPARKLING REFRESHER',
    'Sparkling Flavored Water',
    '355 mL (12 fl oz)',
    '012345678905'
  ]
});

/**
 * FAMILY C: NUTRITION MATHEMATICS
 * Product: Almond Butter Fuel Bar
 */
export const BASELINE_FAMILY_C = Object.freeze({
  familyId: 'family-c-nutrition',
  familyName: 'Nutrition Mathematics',
  productName: 'Almond Butter Fuel Bar',
  market: 'US',
  category: 'Energy Bars',
  ruleApplicability: '21 CFR §101.9 & Atwater Factor System',
  spec: {
    product: {
      product_name: 'Almond Butter Fuel Bar',
      serving_size: '40 g',
      servings: '1',
      net_quantity: '40 g',
    },
    nutrition: {
      basis: 'per serving',
      serving_size: '40 g',
      servings: 1,
      energy_kcal: 165,
      fat_g: 5.0,
      saturates_g: 1.0,
      carbohydrate_g: 25.0,
      sugars_g: 8.0,
      protein_g: 5.0,
      sodium_mg: 90,
    },
    rules: [
      {
        id: 'RULE-C-CALORIES',
        field: 'nutrition.energy_kcal',
        title: 'Calorie Declaration',
        comparison: 'exact_copy',
        citation: '21 CFR §101.9(c)(1)',
        literal_expected: 'Calories 165',
      },
      {
        id: 'RULE-C-FAT',
        field: 'nutrition.fat_g',
        title: 'Total Fat Content',
        comparison: 'exact_copy',
        citation: '21 CFR §101.9(c)(2)',
        literal_expected: 'Total Fat 5g',
      },
      {
        id: 'RULE-C-CARBS',
        field: 'nutrition.carbohydrate_g',
        title: 'Total Carbohydrate Content',
        comparison: 'exact_copy',
        citation: '21 CFR §101.9(c)(6)',
        literal_expected: 'Total Carbohydrate 25g',
      },
      {
        id: 'RULE-C-PROTEIN',
        field: 'nutrition.protein_g',
        title: 'Protein Content',
        comparison: 'exact_copy',
        citation: '21 CFR §101.9(c)(7)',
        literal_expected: 'Protein 5g',
      }
    ]
  },
  artworkLines: [
    'ALMOND BUTTER FUEL BAR',
    'Nutrition Facts',
    '1 serving per container',
    'Serving size 1 bar (40g)',
    'Amount per serving',
    'Calories 165',
    'Total Fat 5g 6%',
    'Saturated Fat 1g 5%',
    'Sodium 90mg 4%',
    'Total Carbohydrate 25g 9%',
    'Total Sugars 8g',
    'Protein 5g'
  ]
});

/**
 * FAMILY D: QUANTITY, CLAIMS & REQUIRED COPY
 * Product: Pure Organic Oat Drink 1000 mL
 */
export const BASELINE_FAMILY_D = Object.freeze({
  familyId: 'family-d-quantity-claims',
  familyName: 'Quantity, Claims & Required Copy',
  productName: 'Pure Organic Oat Drink',
  market: 'US',
  category: 'Plant Milk',
  ruleApplicability: 'NIST Handbook 130 & 21 CFR §101.7',
  spec: {
    product: {
      product_name: 'Pure Organic Oat Drink',
      net_quantity: '1000 mL (33.8 fl oz)',
      serving_size: '250 mL',
      servings: '4',
      storage_statement: 'Store in a cool, dry place. Refrigerate after opening and consume within 7 days.',
      marketing_claim: '100% Plant Based',
      manufacturer: 'Manufactured for PackSignal Organic Foods, 100 Innovation Way, Chicago, IL 60601',
    },
    rules: [
      {
        id: 'RULE-D-NET-QTY',
        field: 'net_quantity',
        title: 'Net Quantity Declaration',
        comparison: 'quantity_equivalence',
        citation: '21 CFR §101.7',
        literal_expected: '1000 mL (33.8 fl oz)',
      },
      {
        id: 'RULE-D-SERVING-SIZE',
        field: 'serving_size',
        title: 'Serving Size Declaration',
        comparison: 'exact_copy',
        citation: '21 CFR §101.9(b)',
        literal_expected: '250 mL',
      },
      {
        id: 'RULE-D-STORAGE',
        field: 'storage_statement',
        title: 'Storage Instruction',
        comparison: 'exact_copy',
        citation: '21 CFR §101.100',
        literal_expected: 'Store in a cool, dry place. Refrigerate after opening and consume within 7 days.',
      },
      {
        id: 'RULE-D-SERVINGS',
        field: 'servings',
        title: 'Servings per Container',
        comparison: 'exact_copy',
        citation: '21 CFR §101.9(b)(8)',
        literal_expected: '4',
      },
      {
        id: 'RULE-D-CLAIM',
        field: 'marketing_claim',
        title: 'Plant-Based Marketing Claim',
        comparison: 'exact_copy',
        citation: 'FTC Green Guides',
        literal_expected: '100% Plant Based',
      },
      {
        id: 'RULE-D-MFG',
        field: 'manufacturer',
        title: 'Name and Place of Business',
        comparison: 'exact_copy',
        citation: '21 CFR §101.5',
        literal_expected: 'Manufactured for PackSignal Organic Foods, 100 Innovation Way, Chicago, IL 60601',
      }
    ]
  },
  artworkLines: [
    'PURE ORGANIC OAT DRINK',
    '100% Plant Based',
    'NET 1000 mL (33.8 FL OZ)',
    'Nutrition Facts',
    '4 servings per container',
    'Serving size 1 cup (250 mL)',
    'Store in a cool, dry place. Refrigerate after opening and consume within 7 days.',
    'Manufactured for PackSignal Organic Foods, 100 Innovation Way, Chicago, IL 60601'
  ]
});

/**
 * FAMILY E: PDF VECTOR & PREPRESS ARTWORK
 * Product: Artisan Coffee Carton Packaging
 */
export const BASELINE_FAMILY_E = Object.freeze({
  familyId: 'family-e-prepress',
  familyName: 'PDF Vector & Prepress Artwork',
  productName: 'Artisan Reserve Whole Bean Coffee',
  market: 'US',
  category: 'Coffee',
  ruleApplicability: 'ISO 12647-2 & Technical Preflight Standards',
  spec: {
    product: {
      product_name: 'Artisan Reserve Whole Bean Coffee',
      net_quantity: '340 g (12 oz)',
      roast_level: 'Medium Dark Roast · 100% Arabica',
    },
    preflight: {
      minBleedMm: 3.0,
      minSafeMarginMm: 3.0,
      minFontPt: 5.0,
      maxTacPercent: 300,
    },
    rules: [
      {
        id: 'RULE-E-NAME',
        field: 'product_name',
        title: 'Product Statement of Identity',
        comparison: 'exact_copy',
        citation: '21 CFR §101.3',
        literal_expected: 'Artisan Reserve Whole Bean Coffee',
      },
      {
        id: 'RULE-E-NET-QTY',
        field: 'net_quantity',
        title: 'Net Quantity',
        comparison: 'quantity_equivalence',
        citation: '21 CFR §101.7',
        literal_expected: '340 g / 12 oz',
      },
      {
        id: 'RULE-E-ROAST',
        field: 'roast_level',
        title: 'Roast Descriptor',
        comparison: 'exact_copy',
        citation: 'Specialty Coffee Association',
        literal_expected: 'Medium Dark Roast · 100% Arabica',
      }
    ]
  },
  preflightGeometry: {
    trimBox: [0.05, 0.05, 0.95, 0.95],
    bleedBox: [0.02, 0.02, 0.98, 0.98],
    bleedMm: 3.5,
    safeMarginMm: 4.2,
    minTextHeightMm: 1.6,
    occludedElements: [],
    tacMax: 285,
  },
  artworkLines: [
    'Artisan Reserve Whole Bean Coffee',
    'Medium Dark Roast · 100% Arabica',
    'NET WT 340 g (12 oz)',
    'Fair Trade Certified & Organic',
    'Packaged by Artisan Roasters, Seattle, WA 98101'
  ]
});

/**
 * Deep clone helper to guarantee immutable baselines
 */
export function getBaselineFixture(familyId) {
  const table = {
    'family-a-allergens': BASELINE_FAMILY_A,
    'family-b-barcodes': BASELINE_FAMILY_B,
    'family-c-nutrition': BASELINE_FAMILY_C,
    'family-d-quantity-claims': BASELINE_FAMILY_D,
    'family-e-prepress': BASELINE_FAMILY_E,
  };
  const fixture = table[familyId];
  if (!fixture) throw new Error(`Unknown baseline fixture family: ${familyId}`);
  return JSON.parse(JSON.stringify(fixture));
}

export const ALL_BASELINE_FAMILIES = [
  BASELINE_FAMILY_A,
  BASELINE_FAMILY_B,
  BASELINE_FAMILY_C,
  BASELINE_FAMILY_D,
  BASELINE_FAMILY_E,
];
