/**
 * PackSignal Remediation Orchestrator (lib/remediation/index.mjs)
 * Master orchestrator for AI Auto-Fix & Copy Remediation Studio.
 *
 * Coordinates:
 * - Eligibility classification
 * - Authoritative source fact resolution & conflict gating
 * - Deterministic exact copy and nutrition %DV / calorie arithmetic
 * - FALCPA / FASTER Act allergen statement formulation
 * - FTC / EU environmental claim substantiation screening
 * - Bounded Gemini rewrite with strict prompt-injection safeguards
 * - Independent multi-point validation
 * - Designer correction ticket generation & proposal storage
 */

import {
  determineRemediationEligibility,
  classifyFindingCategory,
  REMEDIATION_PATHS,
  FINDING_CATEGORIES,
} from './eligibility.mjs';

import { resolveSourceEvidence } from './source-resolver.mjs';
import { remediateExactCopy } from './exact-copy.mjs';
import { remediateNutritionFacts, remediateCalorieFacts } from './nutrition.mjs';
import { remediateAllergenDeclaration } from './allergens.mjs';
import { evaluateEnvironmentalClaim } from './claims.mjs';
import { generateAIRewrite } from './generator.mjs';
import { validateProposal, VALIDATION_OUTCOMES } from './validator.mjs';
import {
  PROPOSAL_LIFECYCLE,
  buildDesignerCorrectionTicket,
  computeSourceHash,
  recordReviewerDecision,
} from './proposal-store.mjs';
import { remediateIngredientList } from '../ingredient-remediation.mjs';

/**
 * Core Orchestrator Function: generateRemediation(review, findingId, options)
 * Supports both generateRemediation(review, findingId, options) and generateRemediation(findingId, review, options).
 */
export async function generateRemediation(arg1, arg2, options = {}) {
  let review, findingId;
  if (typeof arg1 === 'string') {
    findingId = arg1;
    review = arg2 || {};
  } else {
    review = arg1 || {};
    findingId = typeof arg2 === 'string' ? arg2 : (arg2?.id || options.findingId);
  }

  if (!review) throw new Error('Review object is required for remediation generation.');
  if (!findingId) throw new Error('Finding ID is required for remediation generation.');

  const findings = review.findings || review.discrepancies || [];
  const finding = findings.find(f => f.id === findingId) || {
    id: findingId,
    title: options.title || 'Packaging Discrepancy',
    observed: options.observed || '',
    expected: options.expected || '',
    evidence: options.evidence || [],
    rule: options.rule || null,
  };

  const eligibility = determineRemediationEligibility(finding, review, options);

  // 1. Non-textual prepress findings or explicit designer ticket action -> Designer Correction Ticket
  if (options.forceTicket || eligibility.path === REMEDIATION_PATHS.DESIGN_ONLY_TICKET) {
    const ticket = buildDesignerCorrectionTicket(finding, review);
    const proposal = {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: 'DESIGN_TICKET',
      status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
      displayStatus: 'Designer Ticket Created',
      actionType: 'DESIGN_TICKET',
      originalText: finding.observed || 'Layout geometry issue',
      proposedText: `[Designer Correction Ticket Generated: ${ticket.title}]`,
      designerTicket: ticket,
      sourceEvidence: finding.evidence || [],
      ruleEvidence: finding.rule ? [finding.rule] : [],
      changes: ['Prepared Illustrator/ArtPro+ prepress geometry correction instructions.'],
      reasoningSummary: eligibility.reason,
      assumptions: [],
      blockers: [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
    proposal.verification = validateProposal(proposal, review, finding, options);
    return proposal;
  }

  // 2. Resolve source facts and check for source conflicts
  const sourceResolution = resolveSourceEvidence(finding, review, options);
  if (sourceResolution.hasConflict || sourceResolution.isDraft) {
    return {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: 'BLOCKED_OR_NEEDS_EVIDENCE',
      status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
      displayStatus: 'Source Conflict / Unapproved',
      actionType: 'BLOCKED',
      originalText: finding.observed || '',
      proposedText: '',
      sourceEvidence: sourceResolution.sourceEvidence,
      ruleEvidence: sourceResolution.ruleEvidence,
      changes: [],
      reasoningSummary: sourceResolution.blockerReason,
      assumptions: [],
      blockers: [sourceResolution.blockerReason],
      requiredEvidence: sourceResolution.requiredEvidence || [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
  }

  // 3. Needs Evidence eligibility gate
  if (eligibility.path === REMEDIATION_PATHS.BLOCKED_OR_NEEDS_EVIDENCE) {
    return {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: 'BLOCKED_OR_NEEDS_EVIDENCE',
      status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
      displayStatus: 'Needs More Evidence',
      actionType: 'BLOCKED',
      originalText: finding.observed || '',
      proposedText: '',
      sourceEvidence: finding.evidence || [],
      ruleEvidence: finding.rule ? [finding.rule] : [],
      changes: [],
      reasoningSummary: eligibility.reason,
      assumptions: [],
      blockers: eligibility.blockers || ['Missing authoritative reference data.'],
      requiredEvidence: eligibility.requiredEvidence || [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
  }

  // 4. Mode 2: Deterministic Nutrition %DV Calculation
  if (eligibility.category === FINDING_CATEGORIES.NUTRITION_FACTS) {
    const nutritionResult = remediateNutritionFacts(finding, review, options);
    if (!nutritionResult.success) {
      return {
        proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
        findingId: finding.id,
        category: eligibility.category,
        mode: 'DETERMINISTIC_CALCULATION',
        status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
        displayStatus: 'Nutrition Evidence Incomplete',
        originalText: finding.observed || '',
        proposedText: '',
        reasoningSummary: nutritionResult.reason,
        blockers: nutritionResult.blockers || [],
        requiredEvidence: nutritionResult.requiredEvidence || [],
        requiresHumanReview: true,
        legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
        sourceHash: computeSourceHash(review),
        createdAt: new Date().toISOString(),
      };
    }

    const proposal = {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: 'DETERMINISTIC_CALCULATION',
      status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
      displayStatus: 'Proposed Fix Ready',
      originalText: nutritionResult.originalText,
      proposedText: nutritionResult.proposedText,
      calculation: nutritionResult.calculation,
      options: [
        {
          id: 'opt-dv-calc',
          label: `${nutritionResult.calculation.nutrient} %DV Calculation`,
          text: nutritionResult.proposedText,
          description: `Exact arithmetic: ${nutritionResult.calculation.formula}. ${nutritionResult.calculation.roundingRule}`,
        },
      ],
      sourceEvidence: nutritionResult.sourceEvidence,
      ruleEvidence: nutritionResult.ruleEvidence,
      changes: nutritionResult.changes,
      reasoningSummary: nutritionResult.reason,
      assumptions: [],
      blockers: [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
    proposal.verification = validateProposal(proposal, review, finding, options);
    return proposal;
  }

  // 5. Mode 2: Calorie Plausibility & Specification Check
  if (eligibility.category === FINDING_CATEGORIES.CALORIE_CALCULATION) {
    const calorieResult = remediateCalorieFacts(finding, review, options);
    if (!calorieResult.success) {
      return {
        proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
        findingId: finding.id,
        category: eligibility.category,
        mode: 'CALORIE_SCREENING',
        status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
        displayStatus: 'Calorie Evidence Incomplete',
        originalText: finding.observed || '',
        proposedText: '',
        reasoningSummary: calorieResult.reason,
        blockers: calorieResult.blockers || [],
        requiredEvidence: calorieResult.requiredEvidence || [],
        requiresHumanReview: true,
        legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
        sourceHash: computeSourceHash(review),
        createdAt: new Date().toISOString(),
      };
    }

    const proposal = {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: calorieResult.mode,
      status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
      displayStatus: 'Proposed Fix Ready',
      originalText: calorieResult.originalText,
      proposedText: calorieResult.proposedText,
      calculation: calorieResult.calculation,
      options: [
        {
          id: 'opt-calorie-fix',
          label: calorieResult.mode === 'APPROVED_CALORIE_VALUE' ? 'Approved Specification Calories' : 'Atwater Screening Estimate',
          text: calorieResult.proposedText,
          description: calorieResult.reason,
        },
      ],
      sourceEvidence: calorieResult.sourceEvidence,
      ruleEvidence: calorieResult.ruleEvidence,
      changes: calorieResult.changes,
      reasoningSummary: calorieResult.reason,
      assumptions: [],
      blockers: [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
    proposal.verification = validateProposal(proposal, review, finding, options);
    return proposal;
  }

  // 6. Allergen Declaration Formulation (Phase 4 & 5)
  if (eligibility.category === FINDING_CATEGORIES.ALLERGEN_DECLARATION) {
    const allergenResult = remediateAllergenDeclaration(finding, review, options);
    if (!allergenResult.success) {
      return {
        proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
        findingId: finding.id,
        category: eligibility.category,
        mode: 'ALLERGEN_PROPOSAL',
        status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
        displayStatus: 'Allergen Evidence Incomplete',
        originalText: finding.observed || '',
        proposedText: '',
        reasoningSummary: allergenResult.reason,
        blockers: allergenResult.blockers,
        requiredEvidence: allergenResult.requiredEvidence,
        requiresHumanReview: true,
        legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
        sourceHash: computeSourceHash(review),
        createdAt: new Date().toISOString(),
      };
    }

    const proposal = {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: allergenResult.mode || 'ALLERGEN_PROPOSAL',
      status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
      displayStatus: allergenResult.isDesignInstruction ? 'Design Instruction Ready' : 'Proposed Fix Ready',
      originalText: finding.observed || '',
      proposedText: allergenResult.proposedText,
      detectedAllergens: allergenResult.detectedAllergens || [],
      options: allergenResult.options || [
        { id: 'opt-all', label: 'Allergen Fix', text: allergenResult.proposedText, description: allergenResult.reason },
      ],
      sourceEvidence: allergenResult.sourceEvidence,
      ruleEvidence: allergenResult.ruleEvidence,
      changes: allergenResult.changes,
      reasoningSummary: allergenResult.reason,
      assumptions: [],
      blockers: [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
    proposal.verification = validateProposal(proposal, review, finding, options);
    return proposal;
  }

  // 7. Environmental Claims Substantiation (Phase 10 & 11)
  if (eligibility.category === FINDING_CATEGORIES.ENVIRONMENTAL_CLAIM) {
    const claimResult = evaluateEnvironmentalClaim(
      finding.observed,
      review.documents?.filter(d => d.role === 'spec' || d.role === 'claims' || d.role === 'register') || [],
      options
    );

    if (!claimResult.eligibleForRewrite) {
      return {
        proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
        findingId: finding.id,
        category: eligibility.category,
        mode: 'SOURCE_BACKED_CLAIM',
        status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
        displayStatus: 'Substantiation Required',
        originalText: finding.observed || '',
        proposedText: '',
        reasoningSummary: claimResult.reasoning,
        blockers: claimResult.blockers,
        suggestedAction: claimResult.suggestedAction,
        ruleEvidence: claimResult.applicableRules,
        requiresHumanReview: true,
        legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
        sourceHash: computeSourceHash(review),
        createdAt: new Date().toISOString(),
      };
    }

    const proposal = {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: 'SOURCE_BACKED_CLAIM',
      status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
      displayStatus: 'Proposed Fix Ready',
      originalText: finding.observed || '',
      proposedText: claimResult.proposedWording,
      options: [
        {
          id: 'opt-narrow',
          label: 'Factual Substantiated Copy',
          text: claimResult.proposedWording,
          description: 'Narrows generic eco claim to specific verified recycled content percentage and material.',
        },
      ],
      sourceEvidence: claimResult.evidence,
      ruleEvidence: claimResult.applicableRules,
      changes: [`Replaced generic claim "${finding.observed}" with certified evidence "${claimResult.proposedWording}"`],
      reasoningSummary: claimResult.reasoning,
      assumptions: [],
      blockers: [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
    proposal.verification = validateProposal(proposal, review, finding, options);
    return proposal;
  }

  // 8. Ingredient List Descending Order
  if (eligibility.category === FINDING_CATEGORIES.INGREDIENT_LIST) {
    const ingResult = remediateIngredientList(finding, review);
    if (!ingResult.success) {
      return {
        proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
        findingId: finding.id,
        category: eligibility.category,
        mode: 'INGREDIENT_PROPOSAL',
        status: PROPOSAL_LIFECYCLE.NEEDS_EVIDENCE,
        displayStatus: 'Formulation Order Blocked',
        originalText: finding.observed || '',
        proposedText: '',
        reasoningSummary: ingResult.reason,
        blockers: ingResult.blockers,
        requiredEvidence: ingResult.requiredEvidence,
        requiresHumanReview: true,
        legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
        sourceHash: computeSourceHash(review),
        createdAt: new Date().toISOString(),
      };
    }

    const proposal = {
      proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
      findingId: finding.id,
      category: eligibility.category,
      mode: 'INGREDIENT_PROPOSAL',
      status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
      displayStatus: 'Proposed Fix Ready',
      originalText: finding.observed || '',
      proposedText: ingResult.proposedText,
      options: [
        {
          id: 'opt-std',
          label: 'Standard 21 CFR 101.4 Order',
          text: ingResult.proposedText,
          description: 'Ingredients declared in descending predominance by weight with parenthetical subingredients.',
        },
      ],
      sourceEvidence: ingResult.sourceEvidence,
      ruleEvidence: ingResult.ruleEvidence,
      changes: ingResult.changes,
      reasoningSummary: ingResult.reason,
      assumptions: [],
      blockers: [],
      requiresHumanReview: true,
      legalDisclaimer: 'Proposed copy or suggested fix only. Not legally compliant copy until approved by an authorized regulatory specialist.',
      sourceHash: computeSourceHash(review),
      createdAt: new Date().toISOString(),
    };
    proposal.verification = validateProposal(proposal, review, finding, options);
    return proposal;
  }

  // 9. Mode 1: Deterministic Exact Replacement (Quantity, Storage, Brand, Exact Copy)
  if (eligibility.path === REMEDIATION_PATHS.DETERMINISTIC_EXACT_FIX && finding.expected) {
    const exactResult = remediateExactCopy(finding, review, sourceResolution);
    if (exactResult.success) {
      const proposal = {
        proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
        findingId: finding.id,
        category: eligibility.category,
        mode: exactResult.mode,
        status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
        displayStatus: 'Proposed Fix Ready',
        originalText: exactResult.originalText,
        proposedText: exactResult.proposedText,
        options: exactResult.options,
        sourceEvidence: exactResult.sourceEvidence,
        ruleEvidence: exactResult.ruleEvidence,
        changes: exactResult.changes,
        reasoningSummary: exactResult.reasoningSummary,
        assumptions: exactResult.assumptions,
        blockers: exactResult.blockers,
        requiresHumanReview: true,
        sourceApproved: true,
        legalDisclaimer: exactResult.legalDisclaimer,
        sourceHash: computeSourceHash(review),
        createdAt: new Date().toISOString(),
      };
      proposal.verification = validateProposal(proposal, review, finding, options);
      return proposal;
    }
  }

  // 10. Mode 3: Safe AI-Assisted Rewrite Generation
  const aiProposal = await generateAIRewrite({
    finding,
    review,
    category: eligibility.category,
    sourceResolution,
    options,
  });

  const proposal = {
    proposalId: `prop-${finding.id}-${Date.now().toString(36)}`,
    findingId: finding.id,
    category: eligibility.category,
    mode: aiProposal.mode,
    status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
    displayStatus: 'AI-Assisted Proposals Ready',
    originalText: aiProposal.originalText,
    proposedText: aiProposal.proposedText,
    options: aiProposal.options,
    sourceEvidence: sourceResolution.sourceEvidence || [],
    ruleEvidence: sourceResolution.ruleEvidence || [],
    changes: aiProposal.changes,
    reasoningSummary: aiProposal.reasoningSummary,
    assumptions: aiProposal.assumptions,
    blockers: aiProposal.blockers,
    requiresHumanReview: true,
    legalDisclaimer: aiProposal.legalDisclaimer,
    sourceHash: computeSourceHash(review),
    createdAt: new Date().toISOString(),
  };

  proposal.verification = validateProposal(proposal, review, finding, options);
  return proposal;
}

/**
 * Hypothetical Text Revalidation (Phase 19)
 * Tests whether proposed copy satisfies rules in an isolated preview context.
 */
export function validateProposedFix(proposedText, finding, review = {}) {
  const checks = [];
  const cleanProposed = String(proposedText || '').trim();
  const expected = String(finding.expected || '').trim();

  if (!cleanProposed) {
    return {
      passed: false,
      summary: 'Proposed copy is empty.',
      checks: [{ name: 'Non-empty copy', passed: false, detail: 'Copy is blank.' }],
      message: 'Proposed copy is empty. No checks could be evaluated.',
    };
  }

  // Check 1: Deterministic match against expected specification
  if (expected && expected !== 'Missing reference value') {
    const normProposed = cleanProposed.toLowerCase().replace(/\s+/g, ' ');
    const normExpected = expected.toLowerCase().replace(/\s+/g, ' ');
    const exactMatch = normProposed === normExpected || normProposed.includes(normExpected);
    checks.push({
      name: 'Specification match',
      passed: exactMatch,
      detail: exactMatch ? 'Matches approved specification requirement.' : `Does not match expected: "${expected}"`,
    });
  }

  // Check 2: Allergen retention check
  if (finding.title?.toLowerCase().includes('allergen') || finding.id?.includes('allergen')) {
    const originalAllergens = (String(finding.observed || '').match(/milk|egg|peanut|wheat|soy|sesame|fish/gi) || []);
    let allergensRetained = true;
    for (const a of originalAllergens) {
      if (!cleanProposed.toLowerCase().includes(a.toLowerCase())) {
        allergensRetained = false;
        checks.push({
          name: `Preserve ${a}`,
          passed: false,
          detail: `Allergen "${a}" from original statement was dropped.`,
        });
      }
    }
    if (allergensRetained) {
      checks.push({ name: 'Allergen continuity', passed: true, detail: 'All observed allergens preserved.' });
    }
  }

  // Check 3: Unverified certification check
  const forbidden = ['usda organic', 'esko approved', 'carbon neutral', '100% sustainable'];
  let noForbidden = true;
  for (const term of forbidden) {
    if (cleanProposed.toLowerCase().includes(term) && !expected.toLowerCase().includes(term)) {
      noForbidden = false;
      checks.push({
        name: `Prohibit "${term}"`,
        passed: false,
        detail: `Introduces unverified certification phrase "${term}".`,
      });
    }
  }
  if (noForbidden) {
    checks.push({ name: 'Prohibited claim audit', passed: true, detail: 'No unverified certification terms added.' });
  }

  const passed = checks.every(c => c.passed);

  return {
    passed,
    checks,
    summary: passed
      ? 'Proposed wording passes the supported text checks. Upload revised artwork to verify the implemented correction.'
      : 'Hypothetical validation detected issues with the proposed wording.',
    evaluatedCount: checks.length,
    artworkUnchangedNotice: 'The original artwork file has not been modified. Final verification requires a revised packaging file upload.',
  };
}

// Re-export submodules and helpers for unified import
export {
  REMEDIATION_PATHS,
  FINDING_CATEGORIES,
  determineRemediationEligibility,
  classifyFindingCategory,
  resolveSourceEvidence,
  remediateExactCopy,
  remediateNutritionFacts,
  remediateCalorieFacts,
  remediateAllergenDeclaration,
  evaluateEnvironmentalClaim,
  generateAIRewrite,
  validateProposal,
  VALIDATION_OUTCOMES,
  PROPOSAL_LIFECYCLE,
  buildDesignerCorrectionTicket,
  computeSourceHash,
  recordReviewerDecision,
};

// Backward compatibility alias for generateRemediationProposal
export const generateRemediationProposal = async (findingId, review, options) => {
  return generateRemediation(review, findingId, options);
};
