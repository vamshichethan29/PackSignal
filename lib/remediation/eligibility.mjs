/**
 * PackSignal Remediation Eligibility Engine (lib/remediation/eligibility.mjs)
 * Determines the safe, evidence-backed remediation path for packaging inspection findings.
 */

export const REMEDIATION_PATHS = {
  DETERMINISTIC_EXACT_FIX: 'DETERMINISTIC_EXACT_FIX',
  DETERMINISTIC_CALCULATION: 'DETERMINISTIC_CALCULATION',
  AI_ASSISTED_REWRITE: 'AI_ASSISTED_REWRITE',
  BLOCKED_OR_NEEDS_EVIDENCE: 'BLOCKED_OR_NEEDS_EVIDENCE',
  DESIGN_ONLY_TICKET: 'DESIGN_ONLY_TICKET',
  // Backward compatibility aliases
  DETERMINISTIC_REPLACEMENT: 'DETERMINISTIC_EXACT_FIX',
  AI_REWRITE: 'AI_ASSISTED_REWRITE',
  NEEDS_EVIDENCE: 'BLOCKED_OR_NEEDS_EVIDENCE',
};

export const FINDING_CATEGORIES = {
  EXACT_COPY: 'exact_copy',
  NET_QUANTITY: 'net_quantity',
  INGREDIENT_LIST: 'ingredient_list',
  ALLERGEN_DECLARATION: 'allergen_declaration',
  ENVIRONMENTAL_CLAIM: 'environmental_claim',
  MARKETING_CLAIM: 'marketing_claim',
  STORAGE_INSTRUCTION: 'storage_instruction',
  CONTACT_WORDING: 'contact_wording',
  MISSING_PHRASE: 'missing_phrase',
  NUTRITION_FACTS: 'nutrition_facts',
  CALORIE_CALCULATION: 'calorie_calculation',
  DESIGN_PREPRESS: 'design_prepress',
  UNKNOWN: 'unknown',
};

/**
 * Classifies the functional category of a finding.
 */
export function classifyFindingCategory(finding) {
  const title = (finding.title || '').toLowerCase();
  const id = (finding.id || '').toLowerCase();
  const explanation = (finding.explanation || '').toLowerCase();
  const observed = (finding.observed || '').toLowerCase();
  const ruleText = (finding.rule?.text || '').toLowerCase();

  // Design & Prepress geometry / technical
  if (
    title.includes('barcode') ||
    title.includes('quiet zone') ||
    title.includes('bleed') ||
    title.includes('trim') ||
    title.includes('font size') ||
    title.includes('point size') ||
    title.includes('typography') ||
    title.includes('color separation') ||
    title.includes('separation') ||
    title.includes('rich black') ||
    title.includes('panel placement') ||
    title.includes('occluded') ||
    id.includes('preflight') ||
    id.includes('barcode') ||
    id.includes('bleed') ||
    id.includes('typography')
  ) {
    return FINDING_CATEGORIES.DESIGN_PREPRESS;
  }

  // Calorie plausibility / energy
  if (
    title.includes('calorie') ||
    id.includes('calorie') ||
    explanation.includes('calorie') ||
    title.includes('energy') ||
    title.includes('atwater')
  ) {
    return FINDING_CATEGORIES.CALORIE_CALCULATION;
  }

  // Nutrition Facts / %DV
  if (
    title.includes('daily value') ||
    title.includes('%dv') ||
    title.includes('nutrition') ||
    id.includes('nutrition') ||
    id.includes('dv') ||
    title.includes('sodium') ||
    title.includes('saturated fat') ||
    title.includes('cholesterol') ||
    title.includes('dietary fiber') ||
    title.includes('added sugar') ||
    title.includes('vitamin d') ||
    title.includes('potassium') ||
    title.includes('calcium') ||
    /\biron\b/i.test(title) ||
    ruleText.includes('daily value') ||
    ruleText.includes('%dv')
  ) {
    return FINDING_CATEGORIES.NUTRITION_FACTS;
  }

  // Net quantity
  if (
    title.includes('quantity') ||
    title.includes('volume') ||
    title.includes('weight') ||
    title.includes('net wt') ||
    id.includes('quantity') ||
    ruleText.includes('quantity')
  ) {
    return FINDING_CATEGORIES.NET_QUANTITY;
  }

  // Allergens
  if (
    title.includes('allergen') ||
    id.includes('allergen') ||
    explanation.includes('allergen') ||
    ruleText.includes('allergen') ||
    title.includes('contains:') ||
    title.includes('contains')
  ) {
    return FINDING_CATEGORIES.ALLERGEN_DECLARATION;
  }

  // Environmental Claims
  if (
    title.includes('eco') ||
    title.includes('green') ||
    title.includes('sustainable') ||
    title.includes('recycled') ||
    title.includes('compostable') ||
    title.includes('biodegradable') ||
    title.includes('carbon') ||
    title.includes('environmental') ||
    id.includes('environmental') ||
    id.includes('eco') ||
    observed.includes('eco') ||
    observed.includes('green') ||
    observed.includes('sustainable') ||
    observed.includes('recycled') ||
    observed.includes('carbon')
  ) {
    return FINDING_CATEGORIES.ENVIRONMENTAL_CLAIM;
  }

  // Ingredient list
  if (
    title.includes('ingredient') ||
    id.includes('ingredient') ||
    explanation.includes('ingredient') ||
    ruleText.includes('ingredient')
  ) {
    return FINDING_CATEGORIES.INGREDIENT_LIST;
  }

  // Storage instruction
  if (
    title.includes('storage') ||
    title.includes('refrigerate') ||
    title.includes('keep cool') ||
    id.includes('storage')
  ) {
    return FINDING_CATEGORIES.STORAGE_INSTRUCTION;
  }

  // Contact / Manufacturer
  if (
    title.includes('contact') ||
    title.includes('manufacturer') ||
    title.includes('distributor') ||
    title.includes('address')
  ) {
    return FINDING_CATEGORIES.CONTACT_WORDING;
  }

  // Marketing / descriptive claim
  if (
    title.includes('claim') ||
    title.includes('marketing') ||
    id.includes('claim')
  ) {
    return FINDING_CATEGORIES.MARKETING_CLAIM;
  }

  // Missing required phrase
  if (
    title.includes('missing') ||
    title.includes('required phrase') ||
    explanation.includes('not detected')
  ) {
    return FINDING_CATEGORIES.MISSING_PHRASE;
  }

  return FINDING_CATEGORIES.EXACT_COPY;
}

/**
 * Evaluates whether a finding is eligible for automated remediation and selects the appropriate path.
 */
export function determineRemediationEligibility(finding, review = {}, options = {}) {
  const category = classifyFindingCategory(finding);
  const title = (finding.title || '').toLowerCase();
  const explanation = (finding.explanation || '').toLowerCase();

  // Check 1: Design / prepress finding -> Design-only ticket
  if (category === FINDING_CATEGORIES.DESIGN_PREPRESS) {
    return {
      eligible: false,
      isTextFix: false,
      path: REMEDIATION_PATHS.DESIGN_ONLY_TICKET,
      category,
      reason: 'Physical/prepress geometry finding (quiet zone, bleed, trim, font size, ink separation). Requires CAD/Illustrator adjustment, not textual rewrite.',
      blockers: [],
    };
  }

  // Check 2: Unreadable / ambiguous artwork
  if (
    finding.status === 'unable' ||
    title.includes('unreadable') ||
    explanation.includes('unreadable') ||
    explanation.includes('extraction coverage has not been verified') ||
    (explanation.includes('unconfirmed') && !explanation.includes('source'))
  ) {
    return {
      eligible: false,
      isTextFix: false,
      path: REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE,
      category,
      reason: 'Artwork extraction coverage is unconfirmed or text region is unreadable. Automated remediation blocked to avoid guessing.',
      blockers: ['Confirm artwork text readability and extraction coverage.'],
      requiredEvidence: ['Clear raster crop or native vector text extraction of the affected region.'],
    };
  }

  // Check 3: Conflicting source specifications
  if (
    title.includes('conflict') ||
    explanation.includes('conflicting source') ||
    explanation.includes('source conflict unresolved')
  ) {
    return {
      eligible: false,
      isTextFix: false,
      path: REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE,
      category,
      reason: 'Conflicting source specifications detected. Human reviewer must select the authoritative specification before automated copy proposal.',
      blockers: ['Resolve conflicting source values in the Sources tab.'],
      requiredEvidence: ['Single authoritative approved specification.'],
    };
  }

  // Check 4: Draft or unconfirmed source document
  if (
    title.includes('draft') ||
    title.includes('source approval needs confirmation') ||
    explanation.includes('draft') ||
    explanation.includes('unconfirmed source') ||
    explanation.includes('draft or unconfirmed source')
  ) {
    return {
      eligible: false,
      isTextFix: false,
      path: REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE,
      category,
      reason: 'Source specification is marked as DRAFT or UNCONFIRMED. Approved reference required before proposing final packaging copy.',
      blockers: ['Confirm source authority before relying on draft specifications.'],
      requiredEvidence: ['Approved/Released specification signed off by regulatory QA.'],
    };
  }

  // Check 5: Deterministic Numeric Calculation (%DV, Calories)
  if (category === FINDING_CATEGORIES.NUTRITION_FACTS || category === FINDING_CATEGORIES.CALORIE_CALCULATION) {
    // Check if serving basis is unconfirmed
    if (
      options.servingBasisUnknown ||
      finding.servingBasisUnknown ||
      title.includes('serving basis unknown') ||
      explanation.includes('serving basis unknown') ||
      explanation.includes('nutrition basis unconfirmed')
    ) {
      return {
        eligible: false,
        isTextFix: false,
        path: REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE,
        category,
        reason: 'Nutrition serving basis unknown. Cannot calculate %DV without confirmed serving weight or volume.',
        blockers: ['Serving size (grams or volume per serving) is unconfirmed in product specifications.'],
        requiredEvidence: ['Approved product specification confirming serving size and basis of declaration.'],
      };
    }

    return {
      eligible: true,
      isTextFix: true,
      path: REMEDIATION_PATHS.DETERMINISTIC_CALCULATION,
      category,
      reason: 'Eligible for deterministic mathematical calculation using statutory Daily Reference Values or Atwater screening factors. Avoids LLM numeric generation.',
      blockers: [],
    };
  }

  // Check 6: Deterministic Exact Replacement (Quantity, Storage, Exact Copy)
  if (
    category === FINDING_CATEGORIES.NET_QUANTITY ||
    category === FINDING_CATEGORIES.STORAGE_INSTRUCTION ||
    category === FINDING_CATEGORIES.CONTACT_WORDING ||
    category === FINDING_CATEGORIES.EXACT_COPY ||
    category === FINDING_CATEGORIES.MISSING_PHRASE
  ) {
    const hasExpected = Boolean(finding.expected && finding.expected !== 'Missing reference value');
    if (hasExpected) {
      return {
        eligible: true,
        isTextFix: true,
        path: REMEDIATION_PATHS.DETERMINISTIC_EXACT_FIX,
        category,
        reason: 'Approved source reference provides exact replacement wording. Deterministic copy replacement without generative AI.',
        blockers: [],
      };
    }
  }

  // Check 7: Allergen Declaration
  if (category === FINDING_CATEGORIES.ALLERGEN_DECLARATION) {
    return {
      eligible: true,
      isTextFix: true,
      path: REMEDIATION_PATHS.AI_ASSISTED_REWRITE,
      category,
      reason: 'Requires structured formulation analysis and statutory FALCPA / FASTER Act Contains statement construction for human QA review.',
      blockers: [],
    };
  }

  // Check 8: Environmental Claims
  if (category === FINDING_CATEGORIES.ENVIRONMENTAL_CLAIM) {
    return {
      eligible: true,
      isTextFix: true,
      path: REMEDIATION_PATHS.AI_ASSISTED_REWRITE,
      category,
      reason: 'Environmental claim requires substantiation verification under Directive (EU) 2024/825 and FTC Green Guides.',
      blockers: [],
    };
  }

  // Check 9: Marketing / Formulation Rewrite
  if (
    category === FINDING_CATEGORIES.MARKETING_CLAIM ||
    category === FINDING_CATEGORIES.INGREDIENT_LIST
  ) {
    return {
      eligible: true,
      isTextFix: true,
      path: REMEDIATION_PATHS.AI_ASSISTED_REWRITE,
      category,
      reason: 'Eligible for source-bounded generative rewrite (e.g. 21 CFR 101.4 descending order or clarity options).',
      blockers: [],
    };
  }

  // Default fallback
  return {
    eligible: Boolean(finding.expected && finding.expected !== 'Missing reference value'),
    isTextFix: true,
    path: finding.expected ? REMEDIATION_PATHS.DETERMINISTIC_EXACT_FIX : REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE,
    category,
    reason: finding.expected ? 'Exact approved copy available.' : 'Missing approved reference data.',
    blockers: finding.expected ? [] : ['Approved source reference required.'],
  };
}
