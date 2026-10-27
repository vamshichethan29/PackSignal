import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  remediateAllergenDeclaration,
  normalizeAllergenTerm,
  extractVerifiedAllergensFromSource,
} from '../../lib/remediation/allergens.mjs';
import { generateRemediation } from '../../lib/remediation/index.mjs';

test('Allergen Remediation: CASE 3 — Verified Milk, Soy, and Wheat produces constrained proposal without "(gluten)"', async () => {
  const finding = {
    id: 'f-allergen-contains',
    title: 'Allergen Contains Statement Mismatch',
    observed: 'Contains: Milk',
    expected: 'Contains: Milk, Soybeans, Wheat',
  };

  const review = {
    documents: [
      {
        id: 'doc-spec',
        role: 'spec',
        name: 'Approved Formulation Spec.pdf',
        text: 'Formulation Ingredients: Whole milk powder, soy lecithin, enriched wheat flour. Allergen declaration: Milk, Soy, Wheat.',
      },
    ],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-allergen-contains');

  assert.equal(proposal.mode, 'ALLERGEN_PROPOSAL');
  assert.equal(proposal.status, 'VALIDATED_FOR_REVIEW');
  assert.ok(proposal.proposedText.includes('Contains:'));
  assert.ok(proposal.proposedText.includes('Milk'));
  assert.ok(proposal.proposedText.includes('Soybeans'));
  assert.ok(proposal.proposedText.includes('Wheat'));

  // Critical requirement: NEVER automatically add (gluten) or equate wheat with gluten
  assert.equal(proposal.proposedText.includes('(gluten)'), false, 'Must NOT contain (gluten)');
  assert.equal(proposal.proposedText.includes('(Gluten)'), false, 'Must NOT contain (Gluten)');

  // Critical requirement: Requires human review
  assert.equal(proposal.requiresHumanReview, true);
  assert.ok(proposal.legalDisclaimer.includes('Not legally compliant copy'));
});

test('Allergen Remediation: CASE 4 — Unverified allergen list blocks and requests formulation details', async () => {
  const finding = {
    id: 'f-allergen-unverified',
    title: 'Allergen Declaration Verification',
    observed: 'Contains: Tree nuts',
  };

  // Review contains no approved formulation document
  const review = {
    documents: [{ id: 'doc-rules', role: 'rules', name: 'General Rules.docx', text: 'All products must comply with FALCPA.' }],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-allergen-unverified');

  assert.equal(proposal.status, 'NEEDS_EVIDENCE');
  assert.equal(proposal.proposedText, '');
  assert.ok(proposal.reasoningSummary.includes('Approved ingredient and allergen-source information is required'));
  assert.ok(proposal.blockers.length >= 1);
  assert.ok(proposal.requiredEvidence.length >= 1);
});

test('Allergen Remediation: Phase 5 — Typography emphasis generates design instruction rather than rewriting ingredients', async () => {
  const finding = {
    id: 'f-allergen-bold',
    title: 'EU Allergen Emphasis Formatting Required',
    observed: 'Ingredients: Water, oats, almonds, salt.',
    explanation: 'Mandatory allergen terms must be emphasized using distinct typography under Regulation (EU) 1169/2011 Art. 21.',
  };

  const review = {
    market: 'EU',
    documents: [{ id: 'doc-spec', role: 'spec', name: 'Spec.pdf', text: 'Ingredients: Water, oats, almonds, salt. Allergens: Almonds.' }],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-allergen-bold');

  assert.equal(proposal.mode, 'ALLERGEN_TYPOGRAPHY_INSTRUCTION');
  assert.ok(proposal.proposedText.includes('Prepress Instruction'));
  assert.ok(proposal.reasoningSummary.includes('visual typographic emphasis'));
});

test('Allergen Remediation: FASTER Act inclusion of Sesame as statutory major allergen', () => {
  const term1 = normalizeAllergenTerm('organic tahini');
  const term2 = normalizeAllergenTerm('sesame seeds');
  assert.equal(term1, 'Sesame');
  assert.equal(term2, 'Sesame');
});
