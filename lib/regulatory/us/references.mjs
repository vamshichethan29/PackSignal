/**
 * PackSignal US Food Label Regulatory Preflight Pack — Statutory References
 * Master legal citations, scope definitions, and official Daily Value reference tables.
 *
 * Scope: US FDA-regulated conventional packaged food for adults and children >= 4 years.
 * Legal Citations: 21 CFR 101.9, 101.105, 101.4, 101.5, 101.3; 21 U.S.C. 343(w).
 */

export const US_PREFLIGHT_VERSION = '1.0.0';
export const US_JURISDICTION = 'US';
export const US_REGULATOR = 'FDA';

export const US_OUT_OF_SCOPE = [
  'USDA FSIS meat, poultry, and egg products (governed by 9 CFR)',
  'Dietary supplements (governed by 21 CFR 101.36)',
  'Infant formula (governed by 21 CFR Part 107)',
  'Foods for special medical purposes / medical foods',
  'Alcoholic beverages (governed by TTB 27 CFR)',
  'Alternative nutrition formats (dual-column, aggregate, tabular, linear) unless standard format confirmed',
  'Comprehensive typography print certification and visual contrast certification',
  'Full ISO/IEC barcode grading and verifier certification',
];

export const FDA_STATUTORY_CITATIONS = {
  US_001_NET_QUANTITY: {
    checkId: 'US-001',
    name: 'Net Quantity of Contents',
    citation: '21 CFR 101.105, 15 U.S.C. 1453 (FPLA)',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-G/section-101.105',
    summary: 'Requires prominent declaration of net quantity on principal display panel (PDP), in bottom 30%, in both US Customary and Metric units.',
  },
  US_002_BUSINESS_ADDRESS: {
    checkId: 'US-002',
    name: 'Manufacturer and Business Details',
    citation: '21 CFR 101.5',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.5',
    summary: 'Requires name and place of business of manufacturer, packer, or distributor with appropriate qualifying phrases and address.',
  },
  US_003_INGREDIENTS_ALLERGENS: {
    checkId: 'US-003',
    name: 'Ingredients and Major Food Allergens',
    citation: '21 CFR 101.4, 21 U.S.C. 343(w) (FALCPA / FASTER Act)',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.4',
    summary: 'Requires ingredients listed by common or usual name in descending order of predominance, declaring the 9 major food allergens.',
  },
  US_004_NUTRITION_FIELDS: {
    checkId: 'US-004',
    name: 'Nutrition Facts Required Fields',
    citation: '21 CFR 101.9',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9',
    summary: 'Mandates standard Nutrition Facts panel fields, serving size, servings per container, and mandatory core nutrients.',
  },
  US_005_DAILY_VALUES: {
    checkId: 'US-005',
    name: 'Percent Daily Value Arithmetic',
    citation: '21 CFR 101.9(c)(8), 21 CFR 101.9(c)(9)',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9',
    summary: 'Verifies mathematical accuracy of declared Percent Daily Values (%DV) using FDA statutory reference standards.',
  },
  US_006_CALORIE_SANITY: {
    checkId: 'US-006',
    name: 'Calorie and Macronutrient Sanity',
    citation: '21 CFR 101.9(c)(1)',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9',
    summary: 'General screening of declared calories against Atwater macronutrient calculation (4-4-9) with 20% tolerance screening band.',
  },
  US_007_CLAIMS_EVIDENCE: {
    checkId: 'US-007',
    name: 'Claim-to-Evidence Verification',
    citation: '21 CFR 101.13, 21 CFR 101.54, 16 CFR Part 260 (FTC Green Guides)',
    sourceUrl: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.13',
    summary: 'Inspects packaging marketing, nutrient content, and environmental claims against verified source substantiation records.',
  },
};

/**
 * Versioned FDA Reference Daily Values (Adults and Children >= 4 years)
 * Under 21 CFR 101.9(c)(8)(iv) and 101.9(c)(9).
 */
export const FDA_DAILY_VALUES_ADULT = {
  total_fat: { id: 'total_fat', name: 'Total Fat', amount: 78, unit: 'g', legalReference: '21 CFR 101.9(c)(9)' },
  saturated_fat: { id: 'saturated_fat', name: 'Saturated Fat', amount: 20, unit: 'g', legalReference: '21 CFR 101.9(c)(9)' },
  cholesterol: { id: 'cholesterol', name: 'Cholesterol', amount: 300, unit: 'mg', legalReference: '21 CFR 101.9(c)(9)' },
  sodium: { id: 'sodium', name: 'Sodium', amount: 2300, unit: 'mg', legalReference: '21 CFR 101.9(c)(9)' },
  total_carbohydrate: { id: 'total_carbohydrate', name: 'Total Carbohydrate', amount: 275, unit: 'g', legalReference: '21 CFR 101.9(c)(9)' },
  dietary_fiber: { id: 'dietary_fiber', name: 'Dietary Fiber', amount: 28, unit: 'g', legalReference: '21 CFR 101.9(c)(9)' },
  added_sugars: { id: 'added_sugars', name: 'Added Sugars', amount: 50, unit: 'g', legalReference: '21 CFR 101.9(c)(9)' },
  vitamin_d: { id: 'vitamin_d', name: 'Vitamin D', amount: 20, unit: 'mcg', legalReference: '21 CFR 101.9(c)(8)(iv)' },
  calcium: { id: 'calcium', name: 'Calcium', amount: 1300, unit: 'mg', legalReference: '21 CFR 101.9(c)(8)(iv)' },
  iron: { id: 'iron', name: 'Iron', amount: 18, unit: 'mg', legalReference: '21 CFR 101.9(c)(8)(iv)' },
  potassium: { id: 'potassium', name: 'Potassium', amount: 4700, unit: 'mg', legalReference: '21 CFR 101.9(c)(8)(iv)' },
};

/**
 * 9 Major US Food Allergens under 21 U.S.C. 321(qq) (FALCPA & FASTER Act 2021)
 */
export const FDA_MAJOR_ALLERGENS_LIST = [
  { id: 'milk', name: 'Milk', keywords: ['milk', 'whey', 'casein', 'butter', 'cream', 'cheese', 'yogurt', 'dairy', 'buttermilk'] },
  { id: 'egg', name: 'Egg', keywords: ['egg', 'albumin', 'lysozyme', 'ovalbumin', 'egg yolk', 'egg white'] },
  { id: 'fish', name: 'Fish', keywords: ['fish', 'salmon', 'cod', 'tuna', 'flounder', 'haddock', 'anchovy', 'bass', 'tilapia', 'halibut'] },
  { id: 'shellfish', name: 'Crustacean shellfish', keywords: ['crustacean', 'shellfish', 'crab', 'lobster', 'shrimp', 'prawn', 'crawfish', 'krill'] },
  { id: 'tree_nuts', name: 'Tree nuts', keywords: ['tree nut', 'almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'coconut'] },
  { id: 'peanuts', name: 'Peanuts', keywords: ['peanut', 'peanuts', 'arachis'] },
  { id: 'wheat', name: 'Wheat', keywords: ['wheat', 'spelt', 'semolina', 'durum', 'farina', 'graham'] },
  { id: 'soybeans', name: 'Soybeans', keywords: ['soy', 'soya', 'soybean', 'edamame', 'tofu', 'soy lecithin'] },
  { id: 'sesame', name: 'Sesame', keywords: ['sesame', 'tahini', 'benne', 'sesamum'] },
];

/**
 * Standard Mandatory Nutrition Fields under 21 CFR 101.9
 */
export const FDA_NUTRITION_FACTS_FIELDS = [
  { key: 'heading', label: 'Nutrition Facts Heading', required: true, isNutrient: false },
  { key: 'servings_per_container', label: 'Servings Per Container', required: true, isNutrient: false },
  { key: 'serving_size', label: 'Serving Size', required: true, isNutrient: false },
  { key: 'calories', label: 'Calories', required: true, isNutrient: true, unit: 'kcal' },
  { key: 'total_fat', label: 'Total Fat', required: true, isNutrient: true, unit: 'g', hasDv: true },
  { key: 'saturated_fat', label: 'Saturated Fat', required: true, isNutrient: true, unit: 'g', hasDv: true },
  { key: 'trans_fat', label: 'Trans Fat', required: true, isNutrient: true, unit: 'g', hasDv: false, note: 'No Daily Value established under FDA rules' },
  { key: 'cholesterol', label: 'Cholesterol', required: true, isNutrient: true, unit: 'mg', hasDv: true },
  { key: 'sodium', label: 'Sodium', required: true, isNutrient: true, unit: 'mg', hasDv: true },
  { key: 'total_carbohydrate', label: 'Total Carbohydrate', required: true, isNutrient: true, unit: 'g', hasDv: true },
  { key: 'dietary_fiber', label: 'Dietary Fiber', required: true, isNutrient: true, unit: 'g', hasDv: true },
  { key: 'total_sugars', label: 'Total Sugars', required: true, isNutrient: true, unit: 'g', hasDv: false, note: 'No Daily Value established under FDA rules' },
  { key: 'added_sugars', label: 'Includes Added Sugars', required: true, isNutrient: true, unit: 'g', hasDv: true },
  { key: 'protein', label: 'Protein', required: true, isNutrient: true, unit: 'g', hasDv: false, note: '%DV required only if claim made or for children < 4' },
  { key: 'vitamin_d', label: 'Vitamin D', required: true, isNutrient: true, unit: 'mcg', hasDv: true },
  { key: 'calcium', label: 'Calcium', required: true, isNutrient: true, unit: 'mg', hasDv: true },
  { key: 'iron', label: 'Iron', required: true, isNutrient: true, unit: 'mg', hasDv: true },
  { key: 'potassium', label: 'Potassium', required: true, isNutrient: true, unit: 'mg', hasDv: true },
];
