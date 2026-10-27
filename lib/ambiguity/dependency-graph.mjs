/**
 * PackSignal Ambiguity Resolution Engine — Dependency Graph & Evaluator Registry
 * (lib/ambiguity/dependency-graph.mjs)
 */

export const EVALUATOR_REGISTRY = {
  'nutrition_source_comparison': {
    checkId: 'nutrition_source_comparison',
    title: 'Nutrition Facts Source Comparison',
    category: 'Nutrition',
    inputFactFields: [
      'nutrition.basis',
      'nutrition.calories',
      'nutrition.totalfat',
      'nutrition.saturatedfat',
      'nutrition.transfat',
      'nutrition.cholesterol',
      'nutrition.sodium',
      'nutrition.totalcarbohydrate',
      'nutrition.dietaryfiber',
      'nutrition.totalsugars',
      'nutrition.incladdedsugars',
      'nutrition.protein',
      'nutrition.vitamind',
      'nutrition.calcium',
      'nutrition.iron',
      'nutrition.potassium',
      'nutrition.energy_kj',
      'nutrition.energy_kcal',
      'nutrition.energy',
    ],
    inputOptions: ['nutritionVariant', 'nutritionBasisConfirmed', 'factChoices'],
    outputFindingKeys: [
      'rule:nutrition.energy',
      'rule:nutrition.totalfat',
      'rule:nutrition.sodium',
      'rule:nutrition.totalcarbohydrate',
      'rule:nutrition.protein',
      'rule:nutrition.dietaryfiber',
      'rule:nutrition.totalsugars',
    ],
    evaluatorVersion: '1.0.0',
  },
  'us_daily_value_arithmetic': {
    checkId: 'us_daily_value_arithmetic',
    title: 'US-005 Percent Daily Value Arithmetic',
    category: 'Daily Values',
    inputFactFields: [
      'nutrition.basis',
      'nutrition.sodium',
      'nutrition.totalfat',
      'nutrition.saturatedfat',
      'nutrition.cholesterol',
      'nutrition.totalcarbohydrate',
      'nutrition.dietaryfiber',
      'nutrition.incladdedsugars',
      'nutrition.vitamind',
      'nutrition.calcium',
      'nutrition.iron',
      'nutrition.potassium',
      'serving_size',
    ],
    inputOptions: ['nutritionBasisConfirmed'],
    outputFindingKeys: [
      'us-preflight-us-005',
      'us-preflight-us-004',
      'math:dv:sodium',
      'math:dv:totalfat',
    ],
    evaluatorVersion: '1.0.0',
  },
  'calorie_sanity': {
    checkId: 'calorie_sanity',
    title: 'US-006 Calorie & Macronutrient Sanity',
    category: 'Calorie Plausibility',
    inputFactFields: [
      'nutrition.basis',
      'nutrition.calories',
      'nutrition.totalfat',
      'nutrition.totalcarbohydrate',
      'nutrition.protein',
      'serving_size',
    ],
    inputOptions: ['nutritionBasisConfirmed'],
    outputFindingKeys: [
      'us-preflight-us-006',
      'math:atwater:calories',
    ],
    evaluatorVersion: '1.0.0',
  },
  'net_quantity_check': {
    checkId: 'net_quantity_check',
    title: 'US-001 Net Quantity of Contents',
    category: 'Net Quantity',
    inputFactFields: ['net_quantity'],
    inputOptions: ['netQuantityConfirmed', 'factChoices'],
    outputFindingKeys: [
      'rule:net_quantity',
      'us-preflight-us-001',
      'pdp:net_quantity_placement',
    ],
    evaluatorVersion: '1.0.0',
  },
  'business_address_check': {
    checkId: 'business_address_check',
    title: 'US-002 Manufacturer and Business Address',
    category: 'Business Information',
    inputFactFields: ['manufacturer', 'business_details', 'address', 'customer_care'],
    inputOptions: ['factChoices'],
    outputFindingKeys: [
      'rule:business_details',
      'rule:manufacturer',
      'us-preflight-us-002',
    ],
    evaluatorVersion: '1.0.0',
  },
  'ingredients_allergens_check': {
    checkId: 'ingredients_allergens_check',
    title: 'US-003 Ingredients & Major Allergens',
    category: 'Ingredients & Allergens',
    inputFactFields: ['ingredients', 'allergen_statement', 'formulation'],
    inputOptions: ['factChoices'],
    outputFindingKeys: [
      'rule:ingredients',
      'rule:allergen_statement',
      'us-preflight-us-003',
    ],
    evaluatorVersion: '1.0.0',
  },
  'claims_verification': {
    checkId: 'claims_verification',
    title: 'US-007 Claim-to-Evidence Verification',
    category: 'Claims & Evidence',
    inputFactFields: ['claims', 'approved_claims'],
    inputOptions: ['aiRulesConfirmed'],
    outputFindingKeys: [
      'rule:claims',
      'us-preflight-us-007',
    ],
    evaluatorVersion: '1.0.0',
  },
  'barcode_check': {
    checkId: 'barcode_check',
    title: 'Barcode Linework & Checksum',
    category: 'Barcodes & Identifiers',
    inputFactFields: ['barcode', 'upc', 'gtin'],
    inputOptions: [],
    outputFindingKeys: [
      'barcode:quiet-zone',
      'barcode:checksum',
      'rule:barcode',
    ],
    evaluatorVersion: '1.0.0',
  },
  'storage_comparison': {
    checkId: 'storage_comparison',
    title: 'Storage & Handling Disclosure',
    category: 'Storage Instructions',
    inputFactFields: ['storage_statement'],
    inputOptions: ['factChoices'],
    outputFindingKeys: [
      'rule:storage_statement',
    ],
    evaluatorVersion: '1.0.0',
  },
  'source_authority_check': {
    checkId: 'source_authority_check',
    title: 'Specification Authority Verification',
    category: 'Specification Authority',
    inputFactFields: ['source.authority'],
    inputOptions: ['sourceConfirmed'],
    outputFindingKeys: [
      'source-status',
    ],
    evaluatorVersion: '1.0.0',
  },
};

/**
 * Returns the exact list of evaluator checks that consume any of the changed keys.
 * @param {string[]} changedKeys - List of changed fact fields or option keys
 * @returns {object[]} List of evaluator definitions from EVALUATOR_REGISTRY
 */
export function getDependentChecks(changedKeys = []) {
  const normKeys = new Set(changedKeys.map(k => String(k).toLowerCase().trim()));
  const dependent = [];

  for (const check of Object.values(EVALUATOR_REGISTRY)) {
    const isFieldDep = check.inputFactFields.some(f => normKeys.has(f.toLowerCase()) || normKeys.has('nutrition.basis') && f.startsWith('nutrition.'));
    const isOptionDep = check.inputOptions.some(o => normKeys.has(o.toLowerCase()));
    if (isFieldDep || isOptionDep) {
      dependent.push(check);
    }
  }

  return dependent;
}

/**
 * Builds a dry-run impact preview for answering a question with a given candidate.
 * @param {object} params
 * @param {object} params.question
 * @param {object} params.candidate
 * @param {object} params.review
 * @returns {object} Impact preview report
 */
export function buildDependencyPlan({ question, candidate, review }) {
  const changedKeys = [];
  if (question.field) changedKeys.push(question.field);
  if (question.type === 'NUTRITION_BASIS') {
    changedKeys.push('nutrition.basis', 'nutritionVariant', 'nutritionBasisConfirmed');
  }

  const dependentChecks = getDependentChecks(changedKeys);
  const dependentCheckIds = new Set(dependentChecks.map(c => c.checkId));
  const allChecks = Object.values(EVALUATOR_REGISTRY);
  const unaffectedChecks = allChecks.filter(c => !dependentCheckIds.has(c.checkId));

  const affectedFindingKeys = new Set(dependentChecks.flatMap(c => c.outputFindingKeys));
  const currentFindings = review.findings || [];

  // Find findings currently in review that will be affected
  const affectedFindings = currentFindings.filter(f => {
    return affectedFindingKeys.has(f.key) || (f.field && changedKeys.includes(f.field));
  });

  const unaffectedFindings = currentFindings.filter(f => !affectedFindings.some(af => af.id === f.id));

  // Stale decision warnings
  const decisions = review.decisions || {};
  const potentiallyStaleDecisions = Object.entries(decisions)
    .filter(([findingId]) => affectedFindings.some(af => af.id === findingId))
    .map(([findingId, d]) => ({ findingId, disposition: d.disposition, reviewerName: d.reviewerName }));

  return {
    questionId: question.questionId,
    field: question.field,
    proposedValue: candidate?.value || null,
    dependentChecks: dependentChecks.map(c => ({ checkId: c.checkId, title: c.title, category: c.category })),
    unaffectedChecks: unaffectedChecks.map(c => ({ checkId: c.checkId, title: c.title, category: c.category })),
    affectedFindingsCount: affectedFindings.length,
    unaffectedFindingsCount: unaffectedFindings.length,
    affectedFindingSummary: affectedFindings.map(f => ({ id: f.id, title: f.title, currentStatus: f.status })),
    potentiallyStaleDecisions,
  };
}
