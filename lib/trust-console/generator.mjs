/**
 * PackSignal Trust Console Test Case Generator (lib/trust-console/generator.mjs)
 * Phase 8: Automatically generates synthetic broken test cases with planted defects
 * across Net Quantity, Allergens, Nutrition Facts, Claims, Obsolete Copy, and Prepress,
 * alongside clean control cases and ambiguous cases.
 */

export const DEFECT_CATEGORIES = {
  QUANTITY: 'net_quantity',
  ALLERGEN: 'allergen_disclosure',
  NUTRITION: 'nutrition_facts',
  CLAIMS: 'marketing_claims',
  STORAGE: 'storage_statement',
  ADDRESS: 'legal_address',
  PREPRESS: 'prepress_technical',
};

/**
 * Standard baseline evaluation cases with known ground truth outcomes.
 */
export const BASELINE_CASES = [
  {
    id: 'tc-gen-01-net-qty-mismatch',
    name: 'Net Quantity Mismatch (750mL vs 1000mL)',
    group: 'defect',
    category: DEFECT_CATEGORIES.QUANTITY,
    kind: 'quantity',
    field: 'net_quantity',
    reference: '1000 mL',
    artwork: ['NET QUANTITY: 750 mL'],
    complete: true,
    netConfirmed: true,
    expected: 'issue',
    severity: 'critical',
    statutoryRule: '21 CFR §101.7',
    description: 'Printed label declares 750 mL whereas approved product specification mandates 1000 mL.',
  },
  {
    id: 'tc-gen-02-clean-storage',
    name: 'Storage Statement Exact Match',
    group: 'clean',
    category: DEFECT_CATEGORIES.STORAGE,
    kind: 'copy',
    field: 'storage_statement',
    reference: 'Refrigerate after opening.',
    artwork: ['Refrigerate after opening.'],
    complete: true,
    expected: 'match',
    severity: 'pass',
    statutoryRule: '21 CFR §101.100',
    description: 'Storage copy matches approved reference character-for-character.',
  },
  {
    id: 'tc-gen-03-negated-storage',
    name: 'Contradictory Storage Condition',
    group: 'defect',
    category: DEFECT_CATEGORIES.STORAGE,
    kind: 'copy',
    field: 'storage_statement',
    reference: 'Keep refrigerated',
    artwork: ['Do not keep refrigerated.'],
    complete: true,
    expected: 'issue',
    severity: 'critical',
    statutoryRule: '21 CFR §101.100',
    description: 'Artwork contains a negated instruction contradicting the refrigeration requirement.',
  },
  {
    id: 'tc-gen-04-obsolete-copy',
    name: 'Superseded Draft Packaging Copy',
    group: 'defect',
    category: DEFECT_CATEGORIES.STORAGE,
    kind: 'copy',
    field: 'storage_statement',
    reference: 'Refrigerate after opening.',
    artwork: ['OLD COPY: Refrigerate after opening.'],
    complete: true,
    expected: 'issue',
    severity: 'high',
    statutoryRule: 'Prepress Spec Sheet',
    description: 'Artwork mistakenly retains marked obsolete text from previous formulation iteration.',
  },
  {
    id: 'tc-gen-05-decimal-dosage-error',
    name: 'Numerical Decimal Value Misplaced (1.0g vs 10g)',
    group: 'defect',
    category: DEFECT_CATEGORIES.CLAIMS,
    kind: 'copy',
    field: 'marketing_copy',
    reference: 'Only 1.0 g sugar',
    artwork: ['Only 10 g sugar per serving'],
    complete: true,
    expected: 'issue',
    severity: 'critical',
    statutoryRule: '21 CFR §101.60',
    description: 'Sugar claim drops decimal point, multiplying nutritional claim tenfold on front panel.',
  },
  {
    id: 'tc-gen-06-draft-conflict',
    name: 'Conflicting Draft Specifications',
    group: 'ambiguous',
    category: DEFECT_CATEGORIES.STORAGE,
    kind: 'conflict',
    field: 'storage_statement',
    references: ['Refrigerate after opening.', 'Store in a cool place.'],
    artwork: ['Refrigerate after opening.'],
    complete: true,
    expected: 'review',
    severity: 'medium',
    statutoryRule: 'Quality Manual §4.2',
    description: 'Two unapproved specification drafts disagree on storage conditions; engine must request reviewer clarification.',
  },
  {
    id: 'tc-gen-07-unconfirmed-coverage',
    name: 'Unverified Panel Absence Check',
    group: 'unreadable',
    category: DEFECT_CATEGORIES.STORAGE,
    kind: 'copy',
    field: 'storage_statement',
    reference: 'Refrigerate after opening.',
    artwork: ['Oat drink front panel'],
    complete: false,
    expected: 'unable',
    severity: 'low',
    statutoryRule: 'PackSignal Inspection Standard',
    description: 'Absence of statement cannot be declared a defect when side panels are unmapped; safely routes to UNABLE.',
  },
  {
    id: 'tc-gen-08-dual-unit-equivalence',
    name: 'Equivalent Volume Unit Match (1 L vs 1000 mL)',
    group: 'clean',
    category: DEFECT_CATEGORIES.QUANTITY,
    kind: 'quantity',
    field: 'net_quantity',
    reference: '1 L',
    artwork: ['NET QUANTITY: 1000 mL'],
    complete: true,
    netConfirmed: true,
    expected: 'match',
    severity: 'pass',
    statutoryRule: 'NIST Handbook 130',
    description: 'Unit math engine verifies mathematical equivalence between metric liter and milliliter representations.',
  },
  {
    id: 'tc-gen-09-allergen-tree-nuts-omission',
    name: 'Allergen Advisory Missing Almond Declaration',
    group: 'defect',
    category: DEFECT_CATEGORIES.ALLERGEN,
    kind: 'copy',
    field: 'allergen_statement',
    reference: 'CONTAINS: ALMONDS, OATS.',
    artwork: ['CONTAINS: OATS.'],
    complete: true,
    expected: 'issue',
    severity: 'critical',
    statutoryRule: 'FALCPA / FASTER Act 21 U.S.C. 343(w)',
    description: 'Specification recipe includes 8% almonds but packaging allergen banner omits tree nut declaration.',
  },
  {
    id: 'tc-gen-10-honey-vegan-claim-clash',
    name: 'Vegan Claim with Honey Formulation',
    group: 'defect',
    category: DEFECT_CATEGORIES.CLAIMS,
    kind: 'copy',
    field: 'dietary_claim',
    reference: 'Vegetarian Formulation (Contains Honey 9%)',
    artwork: ['CERTIFIED 100% VEGAN GRANOLA'],
    complete: true,
    expected: 'issue',
    severity: 'high',
    statutoryRule: 'FTC Green Guides / 21 CFR §101',
    description: 'Front panel claims 100% Vegan while ingredient specification includes honey.',
  },
  {
    id: 'tc-gen-11-sodium-dv-math-mismatch',
    name: 'Sodium Daily Value Math Error',
    group: 'defect',
    category: DEFECT_CATEGORIES.NUTRITION,
    kind: 'copy',
    field: 'nutrition.sodium_mg',
    reference: '140 mg (6% DV)',
    artwork: ['Sodium 140mg (12% DV)'],
    complete: true,
    expected: 'issue',
    severity: 'high',
    statutoryRule: '21 CFR §101.9(c)(9)',
    description: 'Sodium declaration on nutrition panel computes 12% DV instead of correct statutory 6% DV (based on 2300mg reference).',
  },
  {
    id: 'tc-gen-12-clean-full-nutrition-panel',
    name: 'Compliant Nutrition Facts Verification',
    group: 'clean',
    category: DEFECT_CATEGORIES.NUTRITION,
    kind: 'copy',
    field: 'nutrition.calories',
    reference: '240 Calories per serving',
    artwork: ['Calories 240', 'Servings Per Container about 8'],
    complete: true,
    expected: 'match',
    severity: 'pass',
    statutoryRule: '21 CFR §101.9',
    description: 'Nutritional disclosures completely match laboratory analytical formulation.',
  },
];

/**
 * Procedurally generates broken and clean test cases with customizable seed,
 * defect injection rate, and categories.
 *
 * @param {Object} options
 * @param {number} [options.count=10]
 * @param {number} [options.defectRatio=0.7]
 * @param {string[]} [options.categories]
 * @returns {Array<Object>} Generated test cases
 */
export function generateBrokenTestCases({
  count = 10,
  defectRatio = 0.7,
  categories = Object.values(DEFECT_CATEGORIES),
} = {}) {
  const generated = [];
  const templates = [
    {
      category: DEFECT_CATEGORIES.QUANTITY,
      field: 'net_quantity',
      statutoryRule: '21 CFR §101.7',
      defect: {
        reference: '16 FL OZ (473 mL)',
        artwork: ['14 FL OZ (414 mL)'],
        desc: 'Net quantity underfilled by 2 fl oz on PDP lower 30%.',
      },
      clean: {
        reference: '16 FL OZ (473 mL)',
        artwork: ['16 FL OZ (473 mL)'],
        desc: 'Net quantity matches specification exactly.',
      },
    },
    {
      category: DEFECT_CATEGORIES.ALLERGEN,
      field: 'allergen_statement',
      statutoryRule: '21 CFR §101.4',
      defect: {
        reference: 'CONTAINS: MILK, SOY.',
        artwork: ['CONTAINS: SOY.'],
        desc: 'Milk allergen omission from statutory declaration.',
      },
      clean: {
        reference: 'CONTAINS: MILK, SOY.',
        artwork: ['CONTAINS: MILK, SOY.'],
        desc: 'Allergen declaration lists all 9 major statutory allergens present.',
      },
    },
    {
      category: DEFECT_CATEGORIES.CLAIMS,
      field: 'marketing_claims',
      statutoryRule: '21 CFR §101.60(c)',
      defect: {
        reference: 'Reduced Calorie · 45 kcal per serving',
        artwork: ['ZERO CALORIE DIET DRINK'],
        desc: 'Zero Calorie claim on product with >5 calories per serving.',
      },
      clean: {
        reference: 'Low Sodium · 85 mg per serving',
        artwork: ['Low Sodium'],
        desc: 'Low Sodium claim supported by <140mg analytical value.',
      },
    },
    {
      category: DEFECT_CATEGORIES.NUTRITION,
      field: 'nutrition.added_sugars',
      statutoryRule: '21 CFR §101.9(c)(6)(ii)',
      defect: {
        reference: 'Includes 12g Added Sugars (24% DV)',
        artwork: ['Includes 0g Added Sugars (0% DV)'],
        desc: 'Added sugars omitted on nutrition facts label despite corn syrup in formulation.',
      },
      clean: {
        reference: 'Includes 12g Added Sugars (24% DV)',
        artwork: ['Includes 12g Added Sugars (24% DV)'],
        desc: 'Added sugars correctly declared with accurate daily value percentage.',
      },
    },
    {
      category: DEFECT_CATEGORIES.STORAGE,
      field: 'storage_statement',
      statutoryRule: '21 CFR §101.100',
      defect: {
        reference: 'Keep frozen until use.',
        artwork: ['Store at room temperature.'],
        desc: 'Perishable frozen food labelled as ambient storage.',
      },
      clean: {
        reference: 'Keep frozen until use.',
        artwork: ['Keep frozen until use.'],
        desc: 'Storage directions accurately match cold-chain shipping spec.',
      },
    },
    {
      category: DEFECT_CATEGORIES.ADDRESS,
      field: 'legal_address',
      statutoryRule: '21 CFR §101.5',
      defect: {
        reference: 'Distributed by PackSignal Brands LLC, Chicago, IL 60601',
        artwork: ['PackSignal Brands, Chicago'],
        desc: 'Manufacturer address lacks street or postal zip code.',
      },
      clean: {
        reference: 'Distributed by PackSignal Brands LLC, Chicago, IL 60601',
        artwork: ['Distributed by PackSignal Brands LLC, Chicago, IL 60601'],
        desc: 'Complete legal distributor name, city, state, and zip code provided.',
      },
    },
  ];

  const pool = templates.filter(t => categories.includes(t.category));
  if (!pool.length) pool.push(...templates);

  for (let i = 0; i < count; i++) {
    const isDefect = Math.random() < defectRatio;
    const template = pool[i % pool.length];
    const item = isDefect ? template.defect : template.clean;

    generated.push({
      id: `tc-dyn-${Date.now().toString(36)}-${i + 1}`,
      name: `${template.category.replace('_', ' ').toUpperCase()} — ${isDefect ? 'Planted Defect' : 'Clean Control'} #${i + 1}`,
      group: isDefect ? 'defect' : 'clean',
      category: template.category,
      kind: 'copy',
      field: template.field,
      reference: item.reference,
      artwork: item.artwork,
      complete: true,
      netConfirmed: true,
      expected: isDefect ? 'issue' : 'match',
      severity: isDefect ? 'critical' : 'pass',
      statutoryRule: template.statutoryRule,
      description: item.desc,
      synthetic: true,
      createdAt: new Date().toISOString(),
    });
  }

  return generated;
}
