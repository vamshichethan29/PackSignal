import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEnvironmentalClaim,
  ENVIRONMENTAL_REGULATIONS,
} from '../../lib/remediation/claims.mjs';
import { generateRemediation } from '../../lib/remediation/index.mjs';

test('Environmental Claims: CASE 8 — "100% eco-friendly" claim without substantiation requests evidence or removal', async () => {
  const finding = {
    id: 'f-eco-generic',
    title: 'Environmental claim needs substantiation review',
    observed: '100% Eco-Friendly Packaging',
  };

  // Review has no substantiated testing certificates
  const review = {
    documents: [{ id: 'doc-spec', role: 'spec', name: 'Standard Spec.pdf', text: 'Product dimensions and carton board info.' }],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-eco-generic');

  assert.equal(proposal.status, 'NEEDS_EVIDENCE');
  assert.equal(proposal.proposedText, '');
  assert.ok(proposal.reasoningSummary.includes('Claim substantiation unavailable'));
  assert.ok(proposal.suggestedAction.includes('Remove unsupported generic claim'));
  assert.ok(proposal.blockers.length >= 1);
});

test('Environmental Claims: CASE 9 — Approved, relevant recycled-content percentage proposes narrow factual wording', async () => {
  const finding = {
    id: 'f-eco-substantiated',
    title: 'Environmental claim needs substantiation review',
    observed: 'Eco-Friendly Carton',
  };

  const review = {
    documents: [
      {
        id: 'doc-cert',
        role: 'spec',
        name: 'Packaging Composition Certificate.pdf',
        text: 'Third-party accredited testing confirms carton packaging contains 30% recycled material certified post-consumer content.',
      },
    ],
    findings: [finding],
  };

  const proposal = await generateRemediation(review, 'f-eco-substantiated');

  assert.equal(proposal.status, 'VALIDATED_FOR_REVIEW');
  assert.equal(proposal.proposedText, 'Packaging contains 30% recycled material');
  assert.ok(proposal.reasoningSummary.includes('Narrows generic claim'));
  assert.ok(proposal.changes.some(c => c.includes('30% recycled material')));
});

test('Environmental Claims: CASE 10 — EU Green Claims Directive proposal cited as current law is rejected', () => {
  const result = evaluateEnvironmentalClaim(
    'Recyclable bottle',
    [{ text: 'Standard recyclability test' }],
    { market: 'EU', citeProposedAsEnacted: true }
  );

  assert.equal(result.eligibleForRewrite, false);
  assert.equal(result.proposedWording, null);
  assert.ok(result.reasoning.includes('Proposal COM(2023) 166 (Green Claims Directive) is pending legislation'));
  assert.ok(result.blockers.some(b => b.includes('Cannot enforce proposed EU Green Claims Directive as current statutory law')));
});

test('Environmental Claims: Distinguishes enacted Directive 2024/825 from proposed COM(2023) 166', () => {
  assert.equal(ENVIRONMENTAL_REGULATIONS.EU_DIRECTIVE_2024_825.legalStatus, 'ENACTED_DIRECTIVE');
  assert.equal(ENVIRONMENTAL_REGULATIONS.EU_PROPOSED_GREEN_CLAIMS.legalStatus, 'PROPOSED_LEGISLATION');
  assert.equal(ENVIRONMENTAL_REGULATIONS.EU_PROPOSED_GREEN_CLAIMS.isEnacted, false);
});
