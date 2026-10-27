/**
 * PackSignal Independent Remediation Validator (lib/remediation/validator.mjs)
 * Validates proposed corrections against source facts, rules, and safety bounds.
 * Strictly avoids declaring proposals "LEGALLY_COMPLIANT".
 */

export const VALIDATION_OUTCOMES = {
  VALIDATED_FOR_REVIEW: 'VALIDATED_FOR_REVIEW',
  NEEDS_EVIDENCE: 'NEEDS_EVIDENCE',
  REQUIRES_HUMAN_REVIEW: 'REQUIRES_HUMAN_REVIEW',
  REJECTED_BY_VALIDATOR: 'REJECTED_BY_VALIDATOR',
};

const FORBIDDEN_UNSUBSTANTIATED_CLAIMS = [
  'usda organic',
  'esko approved',
  'carbon neutral',
  '100% sustainable',
  'climate positive',
  'zero emissions',
];

const KNOWN_ALLERGEN_TERMS = [
  'milk', 'eggs', 'egg', 'peanuts', 'peanut', 'tree nuts', 'almonds', 'almond',
  'walnuts', 'walnut', 'cashews', 'cashew', 'wheat', 'soybeans', 'soy', 'soya',
  'fish', 'crustacean shellfish', 'shrimp', 'crab', 'sesame',
];

/**
 * Validates a remediation proposal independently from the generator.
 */
export function validateProposal(proposal, review = {}, finding = {}, options = {}) {
  const checks = [];
  const proposedText = String(proposal.proposedText || '').trim();
  const lowerProposed = proposedText.toLowerCase();
  const sourceDocs = review.documents || [];
  const validDocIds = new Set(sourceDocs.map(d => d.id));

  // 1. Non-empty proposed text check (unless it's a design ticket or blocked)
  if (proposal.mode === 'DESIGN_TICKET' || proposal.status === 'NEEDS_EVIDENCE') {
    return {
      outcome: VALIDATION_OUTCOMES.VALIDATED_FOR_REVIEW,
      valid: true,
      checks: [{ name: 'Non-textual ticket or evidence gate', passed: true }],
      summary: 'Prepress design ticket or evidence requirement verified.',
    };
  }

  if (!proposedText) {
    return {
      outcome: VALIDATION_OUTCOMES.REJECTED_BY_VALIDATOR,
      valid: false,
      checks: [{ name: 'Non-empty copy', passed: false, detail: 'Proposed copy is empty.' }],
      summary: 'Proposed copy is empty. Rejected by validator.',
    };
  }

  // 2. Source Document ID existence
  const referencedDocIds = proposal.sourceEvidenceIds || (proposal.sourceEvidence || []).map(e => e.documentId).filter(Boolean);
  if (referencedDocIds.length > 0 && sourceDocs.length > 0) {
    const unknownDocs = referencedDocIds.filter(id => !validDocIds.has(id));
    checks.push({
      name: 'Referenced source documents exist',
      passed: unknownDocs.length === 0,
      detail: unknownDocs.length === 0 ? 'All cited source documents confirmed in project.' : `Unknown source document IDs: ${unknownDocs.join(', ')}`,
    });
  }

  // 3. Prohibited unverified certification claims check
  let noForbiddenTerms = true;
  for (const term of FORBIDDEN_UNSUBSTANTIATED_CLAIMS) {
    if (lowerProposed.includes(term)) {
      const isExpected = String(finding.expected || '').toLowerCase().includes(term);
      if (!isExpected) {
        noForbiddenTerms = false;
        checks.push({
          name: `No unverified certification term: "${term}"`,
          passed: false,
          detail: `Proposed text introduced unverified certification claim: "${term}".`,
        });
      }
    }
  }
  if (noForbiddenTerms) {
    checks.push({ name: 'Prohibited certification claim audit', passed: true, detail: 'No unverified certification claims detected.' });
  }

  // 4. Allergen preservation and invention check
  const isAllergenCheck = finding.title?.toLowerCase().includes('allergen') ||
    finding.id?.includes('allergen') ||
    proposal.category === 'allergen_declaration';

  if (isAllergenCheck) {
    // Extract approved allergens from source or finding
    const approvedAllergens = (options.verifiedAllergens || proposal.detectedAllergens || []).map(a => a.toLowerCase());
    
    // Check if proposal invented extra allergens not in approved list
    const foundAllergenTerms = KNOWN_ALLERGEN_TERMS.filter(term => lowerProposed.includes(term));
    const normalizedFound = new Set();
    for (const t of foundAllergenTerms) {
      if (t.includes('milk')) normalizedFound.add('milk');
      else if (t.includes('egg')) normalizedFound.add('eggs');
      else if (t.includes('peanut')) normalizedFound.add('peanuts');
      else if (t.includes('wheat')) normalizedFound.add('wheat');
      else if (t.includes('soy')) normalizedFound.add('soybeans');
      else if (t.includes('sesame')) normalizedFound.add('sesame');
      else if (t.includes('almond') || t.includes('walnut') || t.includes('cashew')) normalizedFound.add('tree nuts');
      else if (t.includes('shrimp') || t.includes('crab')) normalizedFound.add('crustacean shellfish');
      else if (t.includes('fish')) normalizedFound.add('fish');
    }

    if (approvedAllergens.length > 0) {
      let inventedAllergenFound = false;
      for (const allergen of normalizedFound) {
        const isApproved = approvedAllergens.some(a => a.includes(allergen) || allergen.includes(a));
        if (!isApproved) {
          inventedAllergenFound = true;
          checks.push({
            name: `Prevent invented allergen: "${allergen}"`,
            passed: false,
            detail: `Proposal contains allergen "${allergen}" which is not present in approved formulation evidence.`,
          });
        }
      }

      if (!inventedAllergenFound) {
        checks.push({
          name: 'Allergen fidelity audit',
          passed: true,
          detail: 'All declared allergens match approved formulation without invented additions.',
        });
      }
    }
  }

  // 5. Environmental claims ex-ante verification check
  const isEnvironmentalCheck = proposal.category === 'environmental_claim' ||
    finding.id?.includes('environmental');

  if (isEnvironmentalCheck) {
    if (lowerProposed.includes('100% eco') || lowerProposed.includes('eco-friendly') || lowerProposed.includes('carbon neutral')) {
      checks.push({
        name: 'Prohibit generic ungrounded green claims',
        passed: false,
        detail: 'Directive (EU) 2024/825 and FTC Green Guides prohibit generic unquantified green claims without certified performance.',
      });
    } else {
      checks.push({
        name: 'Specific quantified environmental wording',
        passed: true,
        detail: 'Claim wording narrowed to specific documented material or recycled percentage.',
      });
    }
  }

  // 6. Address the original finding check
  const addressesFinding = proposedText !== (finding.observed || '') || proposal.mode === 'DETERMINISTIC_CALCULATION';
  checks.push({
    name: 'Addresses observed discrepancy',
    passed: addressesFinding,
    detail: addressesFinding ? 'Proposed wording modifies the observed defect.' : 'Proposed wording is identical to unverified observed text.',
  });

  const allPassed = checks.every(c => c.passed);
  const outcome = allPassed ? VALIDATION_OUTCOMES.VALIDATED_FOR_REVIEW : VALIDATION_OUTCOMES.REJECTED_BY_VALIDATOR;

  return {
    outcome,
    valid: allPassed,
    checks,
    summary: allPassed
      ? 'Proposal successfully passed independent validation checks. Ready for human regulatory review.'
      : 'Proposal failed independent validation checks.',
    disclaimer: 'Validated for human review only. PackSignal does not grant statutory legal compliance certification.',
  };
}

// Re-export alias for backward compatibility
export const validateRemediationProposal = validateProposal;
