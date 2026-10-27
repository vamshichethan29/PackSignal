import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProposal,
  VALIDATION_OUTCOMES,
} from '../../lib/remediation/validator.mjs';

test('Remediation Validator: CASE 13 — Gemini invents an extra allergen -> validator rejects proposal', () => {
  const proposal = {
    proposedText: 'Contains: Milk, Soy, Wheat, Peanuts', // Peanuts was invented!
    category: 'allergen_declaration',
    mode: 'AI_ASSISTED_REWRITE',
  };

  const review = {
    documents: [{ id: 'doc-spec', role: 'spec', name: 'Formulation Spec.pdf' }],
  };

  const finding = {
    id: 'f-allergen',
    title: 'Allergen Statement Check',
    observed: 'Contains: Milk',
    expected: 'Contains: Milk, Soy, Wheat',
  };

  const options = {
    verifiedAllergens: ['Milk', 'Soy', 'Wheat'], // Only Milk, Soy, Wheat are verified
  };

  const validation = validateProposal(proposal, review, finding, options);

  assert.equal(validation.outcome, VALIDATION_OUTCOMES.REJECTED_BY_VALIDATOR);
  assert.equal(validation.valid, false);

  const allergenCheck = validation.checks.find(c => c.name.includes('Prevent invented allergen'));
  assert.ok(allergenCheck);
  assert.equal(allergenCheck.passed, false);
  assert.ok(allergenCheck.detail.includes('Peanuts') || allergenCheck.detail.includes('peanuts'));
});

test('Remediation Validator: Rejects unverified certification claims (USDA Organic, Carbon Neutral)', () => {
  const proposal = {
    proposedText: 'Delicious Oat Drink — USDA Organic & Carbon Neutral',
    category: 'marketing_claim',
    mode: 'AI_ASSISTED_REWRITE',
  };

  const review = { documents: [{ id: 'doc-spec', role: 'spec' }] };
  const finding = { id: 'f-desc', observed: 'Delicious Oat Drink', expected: 'Delicious Oat Drink' };

  const validation = validateProposal(proposal, review, finding);
  assert.equal(validation.outcome, VALIDATION_OUTCOMES.REJECTED_BY_VALIDATOR);
  assert.equal(validation.valid, false);
  assert.ok(validation.checks.some(c => c.name.includes('No unverified certification term')));
});

test('Remediation Validator: Valid proposals receive VALIDATED_FOR_REVIEW and never LEGALLY_COMPLIANT', () => {
  const proposal = {
    proposedText: 'NET 1000 mL',
    category: 'net_quantity',
    mode: 'EXACT_REPLACEMENT',
    sourceEvidenceIds: ['doc-spec'],
  };

  const review = { documents: [{ id: 'doc-spec', role: 'spec' }] };
  const finding = { id: 'f-qty', observed: 'NET 750 mL', expected: 'NET 1000 mL' };

  const validation = validateProposal(proposal, review, finding);
  assert.equal(validation.outcome, VALIDATION_OUTCOMES.VALIDATED_FOR_REVIEW);
  assert.equal(validation.valid, true);

  // Critical constraint: Never certify legal compliance
  assert.notEqual(validation.outcome, 'LEGALLY_COMPLIANT');
  assert.ok(validation.disclaimer.includes('does not grant statutory legal compliance certification'));
});
