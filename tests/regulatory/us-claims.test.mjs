/**
 * PackSignal US Regulatory Preflight — Check US-007: Claim-to-Evidence Verification
 * Legal Basis: 21 CFR 101.13, 21 CFR 101.54, 16 CFR Part 260 (FTC Green Guides)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsClaimVerificationCheck, SUPPORTED_CLAIM_PATTERNS } from '../../lib/regulatory/us/claims-evidence.mjs';

test('US-007: Supported claim patterns recognize nutrient, agricultural, and environmental claims', () => {
  const ids = SUPPORTED_CLAIM_PATTERNS.map(p => p.id);
  assert.ok(ids.includes('high_protein'));
  assert.ok(ids.includes('low_fat'));
  assert.ok(ids.includes('no_added_sugar'));
  assert.ok(ids.includes('organic'));
  assert.ok(ids.includes('recyclable'));
  assert.ok(ids.includes('eco_friendly'));
  assert.ok(ids.includes('recycled_content'));
  assert.ok(ids.includes('carbon_neutral'));
  assert.ok(ids.includes('compostable'));
});

test('US-007: Claim matching approved claims register with linked evidence matches', () => {
  const res = executeUsClaimVerificationCheck({
    artworkText: 'Delicious organic oat milk. 100% Recyclable Carton. Made With Recycled Content.',
    approvedClaimsRegister: [
      { id: 'recyclable', claimText: '100% Recyclable', approvedWording: '100% Recyclable', evidenceDocumentId: 'doc-lca-01' },
      { id: 'recycled_content', claimText: 'Made With Recycled Content', approvedWording: 'Made With Recycled Content', evidenceDocumentId: 'doc-pcr-02' },
      { id: 'organic', claimText: 'Organic', approvedWording: 'Organic', evidenceDocumentId: 'doc-usda-cert' },
    ],
    evidenceDocuments: [
      { id: 'doc-lca-01', role: 'substantiation' },
      { id: 'doc-pcr-02', role: 'substantiation' },
      { id: 'doc-usda-cert', role: 'substantiation' },
    ],
  });
  assert.equal(res.checkId, 'US-007');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /Claim-to-evidence verified/i);
});

test('US-007: Claim explicitly prohibited in approved specification flags ISSUE', () => {
  const res = executeUsClaimVerificationCheck({
    artworkText: '100% Organic Oat Drink with No Added Sugar',
    approvedClaimsRegister: [
      { id: 'organic', claimText: 'Organic', approved: false, status: 'PROHIBITED', reason: 'Formulation not yet certified under USDA NOP' },
    ],
  });
  assert.equal(res.checkId, 'US-007');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Contradicted claim on artwork.*explicitly prohibited or rejected/i);
});

test('US-007: Unsubstantiated environmental claim routes to REVIEW under FTC Green Guides', () => {
  const res = executeUsClaimVerificationCheck({
    artworkText: 'Our packaging is Eco-Friendly, Carbon Neutral, and 100% Compostable.',
    approvedClaimsRegister: [], // No registered evidence
  });
  assert.equal(res.checkId, 'US-007');
  assert.equal(res.findingStatus, 'review');
  assert.match(res.explanation, /Unsubstantiated claim review.*FTC Green Guides/i);
});

test('US-007: Artwork with no detected claims returns not applicable match', () => {
  const res = executeUsClaimVerificationCheck({
    artworkText: 'Simple packaging copy without any claims.',
    approvedClaimsRegister: [],
  });
  assert.equal(res.checkId, 'US-007');
  assert.equal(res.applicability, 'not_applicable');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /No regulated nutrient content, organic, or environmental marketing claims/i);
});
