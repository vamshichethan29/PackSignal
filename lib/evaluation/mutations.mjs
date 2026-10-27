/**
 * PackSignal Mutation Operators & Families (lib/evaluation/mutations.mjs)
 * Phase 8: Systematic packaging mutation operators spanning Categories A–J
 * with deterministic transformations and positive/negative controls.
 */

import crypto from 'node:crypto';
import { MUTATION_CATEGORIES, EXPECTED_OUTCOMES } from './case-schema.mjs';

/**
 * Computes deterministic sha256 hash of a string or buffer.
 */
export function hashContent(content) {
  return crypto.createHash('sha256').update(String(content || '')).digest('hex');
}

/**
 * Mutation operator catalog organized by Category A–J.
 */
export const MUTATION_OPERATORS = {
  // CATEGORY A — QUANTITY
  'QTY-01-MISMATCH': {
    id: 'QTY-01-MISMATCH',
    category: MUTATION_CATEGORIES.CATEGORY_A_QUANTITY,
    name: 'Net Quantity Numeric Mismatch',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'net_quantity',
    severity: 'critical',
    statutoryRule: '21 CFR §101.7 / Legal Metrology Act',
    apply(baseline) {
      const original = baseline.reference || '16 FL OZ (473 mL)';
      const mutated = '14 FL OZ (414 mL)';
      return {
        reference: original,
        artwork: [`NET WT ${mutated}`],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'net_quantity',
        description: 'PDP net quantity is declared as 14 FL OZ instead of approved 16 FL OZ specification.',
      };
    },
  },
  'QTY-02-EQUIVALENT-CLEAN': {
    id: 'QTY-02-EQUIVALENT-CLEAN',
    category: MUTATION_CATEGORIES.CATEGORY_A_QUANTITY,
    name: 'Net Quantity Equivalent Unit Match (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'net_quantity',
    severity: 'pass',
    statutoryRule: 'NIST Handbook 130',
    apply(baseline) {
      return {
        reference: '1 L',
        artwork: ['NET QUANTITY: 1000 mL'],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'net_quantity',
        description: 'Unit conversion between 1 L and 1000 mL is mathematically equivalent.',
      };
    },
  },
  'QTY-03-INVALID-CONVERSION': {
    id: 'QTY-03-INVALID-CONVERSION',
    category: MUTATION_CATEGORIES.CATEGORY_A_QUANTITY,
    name: 'Net Quantity Erroneous Metric Conversion',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'net_quantity',
    severity: 'critical',
    statutoryRule: '15 U.S.C. 1453(a)(2)',
    apply(baseline) {
      return {
        reference: '16 FL OZ (473 mL)',
        artwork: ['NET WT 16 FL OZ (350 mL)'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'net_quantity',
        description: 'Metric equivalent calculates 350 mL instead of mandatory 473 mL.',
      };
    },
  },

  // CATEGORY B — INGREDIENTS
  'ING-01-OMISSION': {
    id: 'ING-01-OMISSION',
    category: MUTATION_CATEGORIES.CATEGORY_B_INGREDIENTS,
    name: 'Ingredient Removal from Declared List',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'ingredients_list',
    severity: 'critical',
    statutoryRule: '21 CFR §101.4',
    apply(baseline) {
      const ref = 'Whole Grain Oats, Cane Sugar, Canola Oil, Sea Salt.';
      const art = 'INGREDIENTS: Whole Grain Oats, Cane Sugar, Canola Oil.';
      return {
        reference: ref,
        artwork: [art],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'ingredients_list',
        description: 'Approved formula ingredient Sea Salt is omitted from printed ingredient list.',
      };
    },
  },
  'ING-02-UNEXPECTED-ADDITION': {
    id: 'ING-02-UNEXPECTED-ADDITION',
    category: MUTATION_CATEGORIES.CATEGORY_B_INGREDIENTS,
    name: 'Undeclared Foreign Ingredient Addition',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'ingredients_list',
    severity: 'critical',
    statutoryRule: '21 CFR §101.4',
    apply(baseline) {
      return {
        reference: 'Organic Rolled Oats, Maple Syrup, Almonds, Sea Salt.',
        artwork: ['INGREDIENTS: Organic Rolled Oats, Maple Syrup, High Fructose Corn Syrup, Almonds, Sea Salt.'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'ingredients_list',
        description: 'Artwork introduces High Fructose Corn Syrup not present in approved formulation.',
      };
    },
  },
  'ING-03-CLEAN-LIST': {
    id: 'ING-03-CLEAN-LIST',
    category: MUTATION_CATEGORIES.CATEGORY_B_INGREDIENTS,
    name: 'Accurate Declared Ingredient Match (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'ingredients_list',
    severity: 'pass',
    statutoryRule: '21 CFR §101.4',
    apply(baseline) {
      const list = 'INGREDIENTS: Rolled Oats, Tapioca Syrup, Sunflower Oil, Sea Salt.';
      return {
        reference: list,
        artwork: [list],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'ingredients_list',
        description: 'Ingredient statement matches approved formulation verbatim.',
      };
    },
  },

  // CATEGORY C — ALLERGENS
  'ALL-01-TREE-NUT-OMISSION': {
    id: 'ALL-01-TREE-NUT-OMISSION',
    category: MUTATION_CATEGORIES.CATEGORY_C_ALLERGENS,
    name: 'Statutory Allergen Omission (Almond Tree Nut)',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'allergen_statement',
    severity: 'critical',
    statutoryRule: 'FALCPA / FASTER Act 21 U.S.C. 343(w)',
    apply(baseline) {
      return {
        reference: 'CONTAINS: ALMONDS, WHEAT.',
        artwork: ['CONTAINS: WHEAT.'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'allergen_statement',
        description: 'Specification lists almonds (8%) but allergen advisory omits Almond declaration.',
      };
    },
  },
  'ALL-02-CLEAN-ALLERGEN-BANNER': {
    id: 'ALL-02-CLEAN-ALLERGEN-BANNER',
    category: MUTATION_CATEGORIES.CATEGORY_C_ALLERGENS,
    name: 'Allergen Advisory Verification (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'allergen_statement',
    severity: 'pass',
    statutoryRule: '21 U.S.C. 343(w)',
    apply(baseline) {
      const banner = 'CONTAINS: MILK, SOY, WHEAT.';
      return {
        reference: banner,
        artwork: [banner],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'allergen_statement',
        description: 'Allergen warning statement declares all statutory allergens identified in specification.',
      };
    },
  },

  // CATEGORY D — NUTRITION
  'NUT-01-SODIUM-DV-MISMATCH': {
    id: 'NUT-01-SODIUM-DV-MISMATCH',
    category: MUTATION_CATEGORIES.CATEGORY_D_NUTRITION,
    name: 'Sodium Daily Value Percentage Arithmetic Mismatch',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'nutrition.sodium_mg',
    severity: 'critical',
    statutoryRule: '21 CFR §101.9(c)(9)',
    apply(baseline) {
      return {
        reference: '140 mg (6% DV)',
        artwork: ['Sodium 140mg (14% DV)'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'nutrition.sodium_mg',
        description: 'Sodium 140mg is declared as 14% DV rather than statutory 6% DV based on 2,300mg reference.',
      };
    },
  },
  'NUT-02-ATWATER-CALORIE-MISMATCH': {
    id: 'NUT-02-ATWATER-CALORIE-MISMATCH',
    category: MUTATION_CATEGORIES.CATEGORY_D_NUTRITION,
    name: 'Atwater 4-4-9 Calorie Math Inconsistency',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'nutrition.calories',
    severity: 'high',
    statutoryRule: '21 CFR §101.9(c)(1)',
    apply(baseline) {
      return {
        reference: '240 Calories (Fat 10g, Carb 30g, Protein 7g)',
        artwork: ['Calories 120', 'Total Fat 10g', 'Total Carb 30g', 'Protein 7g'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'nutrition.calories',
        description: 'Declared 120 calories conflicts with 4-4-9 macro sum of 238 kcal.',
      };
    },
  },
  'NUT-03-CLEAN-PANEL': {
    id: 'NUT-03-CLEAN-PANEL',
    category: MUTATION_CATEGORIES.CATEGORY_D_NUTRITION,
    name: 'Nutrition Facts Verification (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'nutrition.calories',
    severity: 'pass',
    statutoryRule: '21 CFR §101.9',
    apply(baseline) {
      return {
        reference: '200 Calories',
        artwork: ['Calories 200', 'Servings Per Container 8'],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'nutrition.calories',
        description: 'Nutritional declarations match analytical laboratory certificate of analysis.',
      };
    },
  },

  // CATEGORY E — CLAIMS
  'CLM-01-UNSUPPORTED-ZERO-SUGAR': {
    id: 'CLM-01-UNSUPPORTED-ZERO-SUGAR',
    category: MUTATION_CATEGORIES.CATEGORY_E_CLAIMS,
    name: 'Unsupported Zero Sugar Nutrient Content Claim',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'marketing_claims',
    severity: 'critical',
    statutoryRule: '21 CFR §101.60(c)',
    apply(baseline) {
      return {
        reference: 'Total Sugars 12g',
        artwork: ['ZERO SUGAR FORMULA · 100% NATURAL'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'marketing_claims',
        description: 'Zero Sugar PDP claim contradicts nutrition panel disclosing 12g sugars.',
      };
    },
  },
  'CLM-02-HONEY-VEGAN-CLASH': {
    id: 'CLM-02-HONEY-VEGAN-CLASH',
    category: MUTATION_CATEGORIES.CATEGORY_E_CLAIMS,
    name: 'Vegan Dietary Claim Clashing with Honey Ingredient',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'dietary_claim',
    severity: 'critical',
    statutoryRule: 'FTC Green Guides / Consumer Protection',
    apply(baseline) {
      return {
        reference: 'Vegetarian Formulation (Contains Honey 8%)',
        artwork: ['CERTIFIED 100% VEGAN GRANOLA'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'dietary_claim',
        description: 'Front panel claims 100% Vegan while formula includes 8% honey.',
      };
    },
  },
  'CLM-03-SUPPORTED-LOW-SODIUM-CLEAN': {
    id: 'CLM-03-SUPPORTED-LOW-SODIUM-CLEAN',
    category: MUTATION_CATEGORIES.CATEGORY_E_CLAIMS,
    name: 'Supported Low Sodium Claim (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'marketing_claims',
    severity: 'pass',
    statutoryRule: '21 CFR §101.61(b)',
    apply(baseline) {
      return {
        reference: 'Low Sodium',
        artwork: ['Low Sodium', 'Sodium 85mg'],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'marketing_claims',
        description: 'Low Sodium claim supported by <140mg analytical value.',
      };
    },
  },

  // CATEGORY F — DOCUMENT EVIDENCE
  'DOC-01-HIDDEN-NATIVE-TEXT': {
    id: 'DOC-01-HIDDEN-NATIVE-TEXT',
    category: MUTATION_CATEGORIES.CATEGORY_F_DOC_EVIDENCE,
    name: 'Hidden Non-Printing PDF Text Layer',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'storage_statement',
    severity: 'high',
    statutoryRule: 'PDF/X-4 Prepress Standards',
    apply(baseline) {
      return {
        reference: 'Refrigerate after opening.',
        artwork: ['[NON_PRINTING_DIELINE_GUIDE_LAYER]', 'Ambient carton front panel'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'storage_statement',
        description: 'Mandatory storage instruction placed on non-printing dieline guide layer, absent from visible artwork.',
      };
    },
  },

  // CATEGORY G — BARCODE
  'BAR-01-INVALID-CHECKSUM': {
    id: 'BAR-01-INVALID-CHECKSUM',
    category: MUTATION_CATEGORIES.CATEGORY_G_BARCODE,
    name: 'GTIN-12 Check Digit Arithmetic Failure',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'gtin_barcode',
    severity: 'critical',
    statutoryRule: 'GS1 General Specifications §7.9',
    apply(baseline) {
      return {
        reference: 'GTIN-12: 012345678905 (Valid check digit)',
        artwork: ['BARCODE: 012345678902'], // Ends in 2 instead of 5
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'gtin_barcode',
        description: 'Printed barcode check digit 2 fails modulo-10 algorithm for prefix 01234567890.',
      };
    },
  },
  'BAR-02-CLEAN-GTIN': {
    id: 'BAR-02-CLEAN-GTIN',
    category: MUTATION_CATEGORIES.CATEGORY_G_BARCODE,
    name: 'Verified GS1 GTIN-12 Barcode (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'gtin_barcode',
    severity: 'pass',
    statutoryRule: 'GS1 General Specifications §7.9',
    apply(baseline) {
      return {
        reference: '012345678905',
        artwork: ['BARCODE: 012345678905'],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'gtin_barcode',
        description: 'GTIN-12 symbol verifies cleanly against specification with authentic modulo-10 check digit.',
      };
    },
  },

  // CATEGORY H — REVISIONS
  'REV-01-NEW-DEFECT-IN-REV2': {
    id: 'REV-01-NEW-DEFECT-IN-REV2',
    category: MUTATION_CATEGORIES.CATEGORY_H_REVISIONS,
    name: 'Revision Regression (New Defect Introduced)',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'storage_statement',
    severity: 'critical',
    statutoryRule: 'Prepress Artwork Change Management',
    apply(baseline) {
      return {
        kind: 'revision',
        before: ['Refrigerate after opening.'],
        after: ['Store in direct sunlight.'],
        reference: 'Refrigerate after opening.',
        artwork: ['Store in direct sunlight.'],
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'storage_statement',
        description: 'Artwork revision 2 introduced contradictory ambient storage direction.',
      };
    },
  },

  // CATEGORY I — MARKET RULES
  'MKT-01-INDIA-FSSAI-VEG-MISSING': {
    id: 'MKT-01-INDIA-FSSAI-VEG-MISSING',
    category: MUTATION_CATEGORIES.CATEGORY_I_MARKET_RULES,
    name: 'India FSSAI Mandatory Green Veg Logo Missing',
    expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
    field: 'fssai_veg_logo',
    severity: 'critical',
    statutoryRule: 'FSSAI Packaging & Labelling Regulation 2020',
    apply(baseline) {
      return {
        reference: 'FSSAI Green Veg Logo Required on PDP',
        artwork: ['Organic Tea · Net Wt 250g'], // Missing veg mark
        expectedOutcome: EXPECTED_OUTCOMES.ISSUE,
        expectedField: 'fssai_veg_logo',
        description: 'Indian packaged food item PDP omits statutory green dot in green square vegetarian mark.',
      };
    },
  },

  // CATEGORY J — CLEAN CONTROLS & AMBIGUOUS COUNTEREXAMPLES
  'CLN-01-STORAGE-EXACT-MATCH': {
    id: 'CLN-01-STORAGE-EXACT-MATCH',
    category: MUTATION_CATEGORIES.CATEGORY_J_CLEAN_CONTROLS,
    name: 'Storage Copy Verbatim Match (Clean Control)',
    expectedOutcome: EXPECTED_OUTCOMES.MATCH,
    field: 'storage_statement',
    severity: 'pass',
    statutoryRule: '21 CFR §101.100',
    apply(baseline) {
      const copy = 'Refrigerate after opening.';
      return {
        reference: copy,
        artwork: [copy],
        expectedOutcome: EXPECTED_OUTCOMES.MATCH,
        expectedField: 'storage_statement',
        description: 'Storage copy matches approved reference character-for-character.',
      };
    },
  },
  'AMB-01-CONFLICTING-SPEC-DRAFTS': {
    id: 'AMB-01-CONFLICTING-SPEC-DRAFTS',
    category: MUTATION_CATEGORIES.CATEGORY_J_CLEAN_CONTROLS,
    name: 'Conflicting Specification Drafts (Ambiguous Routing)',
    expectedOutcome: EXPECTED_OUTCOMES.REVIEW,
    field: 'storage_statement',
    severity: 'medium',
    statutoryRule: 'Quality Manual §4.2',
    apply(baseline) {
      return {
        kind: 'conflict',
        field: 'storage_statement',
        references: ['Refrigerate after opening.', 'Store in a cool dry place.'],
        artwork: ['Refrigerate after opening.'],
        expectedOutcome: EXPECTED_OUTCOMES.REVIEW,
        expectedField: 'storage_statement',
        description: 'Two draft specs contradict each other; detector must abstain safely to human review.',
      };
    },
  },
  'UNV-01-UNCONFIRMED-PANEL-COVERAGE': {
    id: 'UNV-01-UNCONFIRMED-PANEL-COVERAGE',
    category: MUTATION_CATEGORIES.CATEGORY_J_CLEAN_CONTROLS,
    name: 'Unverified Panel Absence Check (Unable Routing)',
    expectedOutcome: EXPECTED_OUTCOMES.UNABLE,
    field: 'storage_statement',
    severity: 'low',
    statutoryRule: 'PackSignal Inspection Standard',
    apply(baseline) {
      return {
        kind: 'copy',
        field: 'storage_statement',
        reference: 'Refrigerate after opening.',
        artwork: ['Front panel oat drink'],
        complete: false,
        expectedOutcome: EXPECTED_OUTCOMES.UNABLE,
        expectedField: 'storage_statement',
        description: 'Absence of statement cannot be declared a defect when side panels are unmapped.',
      };
    },
  },
};
