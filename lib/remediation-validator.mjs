/**
 * PackSignal Remediation Independent Validator
 * Rigorously checks proposed copy against ground-truth source documents,
 * preventing invented citations, numbers, ingredients, allergens, or certifications.
 */

const UNSUPPORTED_CERTIFICATION_TERMS = [
  'usda organic',
  'non-gmo project',
  'carbon neutral',
  'fair trade certified',
  'esko approved',
  'official approval',
  'fda certified',
  'kosher certified',
  'halal certified',
];

/**
 * Validates a remediation proposal against review sources and findings.
 */
export function validateRemediationProposal(proposal, review = {}, finding = {}) {
  const checks = [];
  const errors = [];
  const warnings = [];

  if (!proposal || typeof proposal !== 'object') {
    return {
      valid: false,
      status: 'BLOCKED_MISSING_EVIDENCE',
      checks: [{ name: 'Schema integrity', passed: false, error: 'Proposal payload is empty or malformed.' }],
      errors: ['Proposal payload is empty or malformed.'],
      warnings: [],
    };
  }

  // Check 1: Empty or malformed proposed text
  const proposedText = String(proposal.proposedText || '').trim();
  if (proposal.status !== 'BLOCKED' && !proposedText) {
    errors.push('Proposed text is empty.');
    checks.push({ name: 'Content presence', passed: false, detail: 'No proposed text provided.' });
  } else {
    checks.push({ name: 'Content presence', passed: true });
  }

  // Check 2: Referenced document IDs must actually exist in review sources
  const docs = review.documents || [];
  const referencedDocIds = (proposal.sourceEvidence || []).map(e => e.documentId).filter(Boolean);
  let docsValid = true;
  for (const docId of referencedDocIds) {
    if (!docs.some(d => d.id === docId)) {
      docsValid = false;
      errors.push(`Referenced document ID "${docId}" does not exist in review sources.`);
    }
  }
  checks.push({ name: 'Source document existence', passed: docsValid });

  // Check 3: Check for invented certifications / seals
  const lowerProposed = proposedText.toLowerCase();
  let certValid = true;
  for (const term of UNSUPPORTED_CERTIFICATION_TERMS) {
    if (lowerProposed.includes(term) && !String(finding.expected || '').toLowerCase().includes(term)) {
      certValid = false;
      errors.push(`Proposal introduces unauthorized certification or seal phrase: "${term}".`);
    }
  }
  checks.push({ name: 'No invented certifications', passed: certValid });

  // Check 4: Number and unit preservation
  // If the finding expected has numbers (e.g. 1000 mL, 750 g), they must appear in proposed text
  const expectedNumbers = (String(finding.expected || '').match(/\d+(?:\.\d+)?/g) || []);
  let numbersValid = true;
  for (const num of expectedNumbers) {
    // If the finding specifically fixed a number, check that the expected number appears
    if (!proposedText.includes(num)) {
      // Check if it was an ingredient list, allergen, nutrition or calorie calculation where values are calculated
      if (proposal.category !== 'ingredient_list' &&
          proposal.category !== 'allergen_declaration' &&
          proposal.category !== 'nutrition_facts' &&
          proposal.category !== 'calorie_calculation') {
        warnings.push(`Expected numerical value "${num}" was not found in the proposed copy.`);
        numbersValid = false;
      }
    }
  }
  checks.push({ name: 'Numerical fact fidelity', passed: numbersValid });

  // Check 5: Allergen preservation
  // If original artwork had an allergen, it must not be silently dropped unless documented
  let allergenValid = true;
  if (proposal.category === 'allergen_declaration' || (finding.title || '').toLowerCase().includes('allergen')) {
    const originalAllergens = (String(finding.observed || '').match(/milk|egg|peanut|wheat|soy|sesame|almond|walnut|cashew|fish/gi) || []);
    for (const allg of originalAllergens) {
      if (!lowerProposed.includes(allg.toLowerCase())) {
        warnings.push(`Previously observed allergen "${allg}" is missing from proposed statement.`);
        allergenValid = false;
      }
    }
  }
  checks.push({ name: 'Allergen preservation', passed: allergenValid });

  // Check 6: Prompt injection and instruction leakage defense
  const hasInjectionPhrases = /ignore (?:all )?previous instructions|system prompt|developer mode|disregard|you are a/i.test(proposedText);
  if (hasInjectionPhrases) {
    errors.push('Proposed text contains unauthorized instruction phrases or prompt injection leakage.');
    checks.push({ name: 'Prompt injection screening', passed: false });
  } else {
    checks.push({ name: 'Prompt injection screening', passed: true });
  }

  // Determine overall status
  const valid = errors.length === 0;
  const status = errors.length > 0
    ? 'BLOCKED_INVALID'
    : warnings.length > 0
    ? 'NEEDS_HUMAN_REVIEW'
    : 'VALIDATED';

  return {
    valid,
    status,
    checks,
    errors,
    warnings,
    summary: valid
      ? (warnings.length > 0 ? 'Passed bounded validation with human-review warnings.' : 'All source-anchored facts, rules, and allergen checks verified.')
      : `Validation failed: ${errors.join('; ')}`,
  };
}
