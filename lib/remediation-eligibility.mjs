/**
 * PackSignal Remediation Eligibility Engine
 * Determines the safe, evidence-backed remediation path for packaging inspection findings.
 */

export const REMEDIATION_PATHS = {
  DETERMINISTIC_REPLACEMENT: 'DETERMINISTIC_REPLACEMENT',
  AI_REWRITE: 'AI_REWRITE',
  NEEDS_EVIDENCE: 'NEEDS_EVIDENCE',
  DESIGN_ONLY_TICKET: 'DESIGN_ONLY_TICKET',
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
    title.includes('iron') ||
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

  // Allergen statement
  if (
    title.includes('allergen') ||
    title.includes('contains') ||
    id.includes('allergen') ||
    ruleText.includes('allergen') ||
    explanation.includes('allergen')
  ) {
    return FINDING_CATEGORIES.ALLERGEN_DECLARATION;
  }

  // Ingredients statement
  if (
    title.includes('ingredient') ||
    id.includes('ingredient') ||
    ruleText.includes('ingredient') ||
    explanation.includes('ingredient')
  ) {
    return FINDING_CATEGORIES.INGREDIENT_LIST;
  }

  // Environmental claim
  if (
    title.includes('environmental') ||
    title.includes('eco-friendly') ||
    title.includes('green') ||
    title.includes('sustainable') ||
    title.includes('recycled') ||
    title.includes('biodegradable') ||
    title.includes('compostable') ||
    title.includes('carbon') ||
    id.includes('environmental') ||
    ruleText.includes('environmental')
  ) {
    return FINDING_CATEGORIES.ENVIRONMENTAL_CLAIM;
  }

  // Storage instructions
  if (
    title.includes('storage') ||
    title.includes('refrigerate') ||
    title.includes('cool, dry') ||
    ruleText.includes('storage')
  ) {
    return FINDING_CATEGORIES.STORAGE_INSTRUCTION;
  }

  // Contact / Manufacturer info
  if (
    title.includes('manufacturer') ||
    title.includes('contact') ||
    title.includes('distributor') ||
    title.includes('address')
  ) {
    return FINDING_CATEGORIES.CONTACT_WORDING;
  }

  // Missing required phrase
  if (
    title.includes('missing') ||
    finding.observed === 'Not detected in extracted content' ||
    finding.observed === 'Missing reference value'
  ) {
    return FINDING_CATEGORIES.MISSING_PHRASE;
  }

  // Marketing claim
  if (
    title.includes('claim') ||
    ruleText.includes('claim') ||
    id.includes('claim')
  ) {
    return FINDING_CATEGORIES.MARKETING_CLAIM;
  }

  return FINDING_CATEGORIES.EXACT_COPY;
}

/**
 * Evaluates finding eligibility and specifies remediation path.
 */
export function assessRemediationEligibility(finding, review = {}) {
  const category = classifyFindingCategory(finding);
  const blockers = [];
  const requiredEvidence = [];

  // Check 1: Design / prepress finding -> Design-only ticket
  if (category === FINDING_CATEGORIES.DESIGN_PREPRESS) {
    return {
      eligible: true,
      path: REMEDIATION_PATHS.DESIGN_ONLY_TICKET,
      category,
      actionLabel: 'Create Correction Ticket',
      reason: 'Physical and geometry defects (barcode quiet zones, bleed margins, font sizes, ink separations) require layout adjustment in vector CAD/design software rather than copy rewriting.',
      blockers: [],
      requiredEvidence: ['Vector layout file (AI/PDF/ArtPro+)', 'Dieline CAD specification'],
      isTextual: false,
      sourceApproved: true,
    };
  }

  // Check 2: Unresolved source conflicts in review
  const hasConflict = Boolean(
    (Array.isArray(review.conflicts) && review.conflicts.length > 0) ||
    finding.expected === 'Source conflict unresolved'
  );
  if (hasConflict) {
    blockers.push('Conflicting reference values exist in supplied sources: multiple documents disagree on the required value.');
    requiredEvidence.push('Authoritative source resolution selecting single approved specification.');
    return {
      eligible: false,
      path: REMEDIATION_PATHS.NEEDS_EVIDENCE,
      category,
      actionLabel: 'Request Source Evidence',
      reason: 'Multiple supplied source documents disagree on the required value. The brand owner or packaging team must resolve source authority before copy can be suggested.',
      blockers,
      requiredEvidence,
      isTextual: true,
      sourceApproved: false,
      hasConflict: true,
    };
  }

  // Check 3: Draft source document status
  const deepSourceStatus = review.deepVerification?.sourceDoc?.approvalStatus;
  const docDraftStatus = review.documents?.some(d => d.status === 'draft' || /draft/i.test(d.name || ''));
  const findingEvidenceDraft = finding.evidence?.some(e => e.isDraft || e.status === 'draft' || /draft/i.test(e.name || ''));
  const isDraftSource = Boolean(
    (deepSourceStatus && /draft|in review|preliminary/i.test(deepSourceStatus)) ||
    docDraftStatus ||
    findingEvidenceDraft
  );

  // Check 4: Category-specific rules

  // Ingredient list
  if (category === FINDING_CATEGORIES.INGREDIENT_LIST) {
    const hasOrderEvidence = Boolean(
      finding.evidence?.some(e => e.location?.includes('Order') || e.location?.includes('predominance')) ||
      review.deepVerification?.ingredientAudit?.predominanceOrderConfirmed
    );

    if (!hasOrderEvidence) {
      blockers.push('Predominance-by-weight order is not documented in approved source records.');
      requiredEvidence.push('Approved formulation specification documenting ingredient weight descending hierarchy (21 CFR 101.4).');
      return {
        eligible: false,
        path: REMEDIATION_PATHS.NEEDS_EVIDENCE,
        category,
        actionLabel: 'Request Formulation Order',
        reason: 'Cannot safely produce a final ingredient declaration because the approved predominance-by-weight order is unavailable. Inferring order from artwork appearance is strictly prohibited.',
        blockers,
        requiredEvidence,
        isTextual: true,
        sourceApproved: !isDraftSource,
        hasConflict: false,
      };
    }
    return {
      eligible: true,
      path: REMEDIATION_PATHS.AI_REWRITE,
      category,
      actionLabel: 'Generate Suggested Fix',
      reason: 'Verified formulation data is available to structure a 21 CFR 101.4 compliant ingredient declaration proposal.',
      blockers: isDraftSource ? ['Source document has Draft / In Review status. Proposal is for draft review only.'] : [],
      requiredEvidence: [],
      isTextual: true,
      sourceApproved: !isDraftSource,
      hasConflict: false,
    };
  }

  // Allergen declaration
  if (category === FINDING_CATEGORIES.ALLERGEN_DECLARATION) {
    const hasAllergenSources = Boolean(
      finding.evidence?.length > 0 ||
      review.deepVerification?.allergenChecks?.length > 0
    );

    if (!hasAllergenSources && !finding.expected) {
      blockers.push('No verified allergen source derivation or formulation facts attached.');
      requiredEvidence.push('Specification allergen disclosure list or ingredient source derivatives.');
      return {
        eligible: false,
        path: REMEDIATION_PATHS.NEEDS_EVIDENCE,
        category,
        actionLabel: 'Request Allergen Data',
        reason: 'Cannot propose allergen wording without verified formulation allergen disclosure. Fabricating allergen presence or absence is prohibited.',
        blockers,
        requiredEvidence,
        isTextual: true,
        sourceApproved: !isDraftSource,
        hasConflict: false,
      };
    }

    return {
      eligible: true,
      path: REMEDIATION_PATHS.AI_REWRITE,
      category,
      actionLabel: 'Generate Suggested Fix',
      reason: 'Allergen sources are documented. An evidence-backed statutory Contains statement proposal can be prepared for human review.',
      blockers: [],
      requiredEvidence: [],
      isTextual: true,
      sourceApproved: !isDraftSource,
      hasConflict: false,
    };
  }

  // Nutrition Facts / %DV
  if (category === FINDING_CATEGORIES.NUTRITION_FACTS) {
    const hasServingBasis = !finding.servingBasisUnknown &&
      !/serving basis unknown|unknown serving|basis unconfirmed/i.test(finding.title || '') &&
      !/serving basis unknown|unknown serving|basis unconfirmed/i.test(finding.explanation || '');

    if (!hasServingBasis) {
      blockers.push('Nutrition serving basis unknown: serving size is unconfirmed in product specifications.');
      requiredEvidence.push('Approved product specification confirming serving size and basis of declaration.');
      return {
        eligible: false,
        path: REMEDIATION_PATHS.NEEDS_EVIDENCE,
        category,
        actionLabel: 'Request Serving Basis',
        reason: 'Nutrition serving basis unknown. Cannot generate %DV calculation without confirmed serving size.',
        blockers,
        requiredEvidence,
        isTextual: true,
        sourceApproved: !isDraftSource,
        hasConflict: false,
      };
    }

    return {
      eligible: true,
      path: REMEDIATION_PATHS.DETERMINISTIC_REPLACEMENT,
      category,
      actionLabel: 'Generate Suggested Fix',
      reason: 'Authoritative Daily Reference Value and mathematical formula available for deterministic %DV correction.',
      blockers: isDraftSource ? ['Source document has Draft / In Review status.'] : [],
      requiredEvidence: [],
      isTextual: true,
      sourceApproved: !isDraftSource,
      hasConflict: false,
    };
  }

  // Calorie calculation
  if (category === FINDING_CATEGORIES.CALORIE_CALCULATION) {
    return {
      eligible: true,
      path: REMEDIATION_PATHS.DETERMINISTIC_REPLACEMENT,
      category,
      actionLabel: 'Generate Suggested Fix',
      reason: 'Calorie calculation uses verified specification values or Atwater 4-4-9 screening heuristic.',
      blockers: isDraftSource ? ['Source document has Draft / In Review status.'] : [],
      requiredEvidence: [],
      isTextual: true,
      sourceApproved: !isDraftSource,
      hasConflict: false,
    };
  }

  // Environmental claim
  if (category === FINDING_CATEGORIES.ENVIRONMENTAL_CLAIM) {
    const hasSubstantiation = Boolean(
      finding.evidence?.some(e => e.role === 'spec' || e.role === 'register' || e.quote?.match(/\d+%/))
    );

    if (!hasSubstantiation) {
      blockers.push('No substantiation document, testing certificate, or certified recycled percentage supplied.');
      requiredEvidence.push('Certified material composition report or substantiation test data.');
      return {
        eligible: false,
        path: REMEDIATION_PATHS.NEEDS_EVIDENCE,
        category,
        actionLabel: 'Request Claim Substantiation',
        reason: 'Unable to substantiate this environmental claim from the supplied materials. Under Directive (EU) 2024/825 and FTC Green Guides, generic environmental claims without verified substantiation must not be rewritten into alternative marketing copy.',
        blockers,
        requiredEvidence,
        isTextual: true,
        sourceApproved: false,
        hasConflict: false,
      };
    }

    return {
      eligible: true,
      path: REMEDIATION_PATHS.AI_REWRITE,
      category,
      actionLabel: 'Generate Suggested Fix',
      reason: 'Substantiation records exist. A narrower, factual claim matching the evidence can be proposed for packaging review.',
      blockers: [],
      requiredEvidence: [],
      isTextual: true,
      sourceApproved: true,
      hasConflict: false,
    };
  }

  // Deterministic copy replacement (Net quantity, storage statement, exact copy)
  if (
    finding.expected &&
    finding.expected !== 'Missing reference value' &&
    finding.expected !== 'Source conflict unresolved' &&
    finding.expected !== 'Rule needs interpretation'
  ) {
    return {
      eligible: true,
      path: REMEDIATION_PATHS.DETERMINISTIC_REPLACEMENT,
      category,
      actionLabel: 'Generate Suggested Fix',
      reason: 'A verified source document explicitly provides the required approved wording. Exact replacement requires no generative modification.',
      blockers: isDraftSource ? ['Source document has Draft / In Review status.'] : [],
      requiredEvidence: [],
      isTextual: true,
      sourceApproved: !isDraftSource,
      hasConflict: false,
    };
  }

  // Default fallback when evidence is incomplete
  return {
    eligible: false,
    path: REMEDIATION_PATHS.NEEDS_EVIDENCE,
    category,
    actionLabel: 'Request Evidence',
    reason: 'Approved reference wording is unavailable in the supplied source documents.',
    blockers: ['No approved expected value or specification text provided.'],
    requiredEvidence: ['Approved product specification document'],
    isTextual: true,
    sourceApproved: false,
    hasConflict: false,
  };
}

export const determineRemediationEligibility = assessRemediationEligibility;
