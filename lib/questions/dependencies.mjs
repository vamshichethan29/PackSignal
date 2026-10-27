/**
 * PackSignal Packaging Dependency Graph (lib/questions/dependencies.mjs)
 * Implements Phase 23: Lightweight dependency model tracing:
 * SOURCE DOCUMENT -> EXTRACTED FACT -> APPROVED FACT -> APPLICABLE RULE -> EXECUTED CHECK -> FINDING -> DECISION
 */

export const CHECK_DEPENDENCIES = {
  DAILY_VALUE_ARITHMETIC: {
    requiredFacts: ['serving_size', 'nutrition.basis'],
    recommendedFacts: ['net_quantity'],
    description: 'Requires confirmed serving size in grams/mL and nutrition reference basis.',
  },
  CALORIE_PLAUSIBILITY_SCREEN: {
    requiredFacts: ['nutrition.calories', 'nutrition.totalfat', 'nutrition.totalcarbohydrate', 'nutrition.protein'],
    recommendedFacts: ['nutrition.basis'],
    description: 'Requires calories, total fat, total carb, and protein values.',
  },
  SERVING_SIZE_ARITHMETIC: {
    requiredFacts: ['serving_size', 'servings', 'net_quantity'],
    recommendedFacts: [],
    description: 'Requires serving size, servings per container, and net quantity.',
  },
  INGREDIENT_LIST_DIFFERENCE: {
    requiredFacts: ['ingredients'],
    recommendedFacts: ['allergens'],
    description: 'Requires approved formulation ingredient list.',
  },
  ALLERGEN_DISCLOSURE: {
    requiredFacts: ['allergens', 'ingredients'],
    recommendedFacts: [],
    description: 'Requires confirmed source allergen list and ingredient formulation.',
  },
  LEGAL_METROLOGY: {
    requiredFacts: ['net_quantity'],
    recommendedFacts: ['package_area_sq_in'],
    description: 'Requires approved net quantity value and target market.',
  },
  SOURCE_AUTHORITY_GATE: {
    requiredFacts: ['source_approval_status'],
    recommendedFacts: [],
    description: 'Requires confirmed source document authority.',
  },
};

/**
 * Returns list of missing fact fields that block execution of a given check.
 */
export function getMissingDependenciesForCheck(checkType, availableFacts = []) {
  const dep = CHECK_DEPENDENCIES[checkType];
  if (!dep) return [];

  const presentFields = new Set(availableFacts.map(f => f.field));
  return dep.requiredFacts.filter(reqField => !presentFields.has(reqField));
}

export function getMissingDependencies(checkType, state = {}) {
  if (Array.isArray(state)) {
    return getMissingDependenciesForCheck(checkType, state);
  }
  const missing = [];
  if (state.hasApprovedReferenceDv === false) missing.push('approved_reference_dv');
  if (state.hasResolvedServingBasis === false) missing.push('resolved_serving_basis');
  return missing;
}

