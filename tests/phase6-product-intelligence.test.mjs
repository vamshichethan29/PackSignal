import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEvidenceCompleteness,
  EVIDENCE_CATEGORIES
} from '../lib/evidence-completeness.mjs';
import {
  createClaimEntry,
  CLAIM_TYPES,
  CLAIM_APPROVAL_STATUSES
} from '../lib/claims/registry.mjs';
import {
  evaluateClaimSubstantiation
} from '../lib/claims/substantiation.mjs';
import {
  createApprovedPhrasePair,
  matchApprovedPhrase,
  MULTILINGUAL_OUTCOMES
} from '../lib/multilingual/approved-pairs.mjs';

test('Evidence Completeness: calculates explicit numerator/denominator without confidence scores', () => {
  const mockReview = {
    id: 'rev-comp-test',
    documents: [
      { id: 'doc-art', role: 'artwork', pages: [{ number: 1, unit: 'pt' }] },
      { id: 'doc-spec', role: 'spec', data: { status: 'approved' } }
    ],
    options: { completeArtwork: true, sourceConfirmed: true }
  };

  const mockFindings = [
    { id: 'f-1', status: 'match', expected: '1000 mL', observed: '1000 mL' },
    { id: 'f-2', status: 'issue', expected: 'Contains: Milk', observed: 'Contains: Soy' },
    { id: 'f-3', status: 'review', expected: 'Store cool', observed: 'Store cool' }
  ];

  const result = computeEvidenceCompleteness(mockReview, mockFindings, []);

  assert.equal(result.denominator, 3);
  assert.equal(result.numerator, 2); // f-1 and f-2 are machine-completed
  assert.equal(result.counts.humanVerificationRequired, 1); // f-3 requires human review
  assert.ok(result.display.includes('2 / 3'));
});

test('Claims Substantiation: evaluates claims against register, SKU, dates, and supporting documents', () => {
  const register = [
    createClaimEntry({
      claimId: 'claim-recycled-01',
      claimText: '100% Recyclable Carton',
      claimType: CLAIM_TYPES.RECYCLABILITY,
      sku: 'SKU-GRANOLA-01',
      market: 'US',
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      supportingDocumentReferences: ['recycled-pulp-cert.pdf']
    })
  ];

  // 1. Missing supporting document yields review
  const evalWithoutDoc = evaluateClaimSubstantiation({
    detectedClaim: { quote: '100% Recyclable Carton' },
    claimRegister: register,
    activeSku: 'SKU-GRANOLA-01',
    activeMarket: 'US',
    reviewEffectiveDate: '2026-06-01',
    availableDocuments: []
  });

  assert.equal(evalWithoutDoc.findingStatus, 'review');
  assert.equal(evalWithoutDoc.hasSupportingDocuments, false);

  // 2. Attached supporting document yields match
  const evalWithDoc = evaluateClaimSubstantiation({
    detectedClaim: { quote: '100% Recyclable Carton' },
    claimRegister: register,
    activeSku: 'SKU-GRANOLA-01',
    activeMarket: 'US',
    reviewEffectiveDate: '2026-06-01',
    availableDocuments: [{ name: 'recycled-pulp-cert.pdf' }]
  });

  assert.equal(evalWithDoc.findingStatus, 'match');
  assert.equal(evalWithDoc.hasSupportingDocuments, true);

  // 3. Expired claim yields review
  const evalExpired = evaluateClaimSubstantiation({
    detectedClaim: { quote: '100% Recyclable Carton' },
    claimRegister: register,
    activeSku: 'SKU-GRANOLA-01',
    activeMarket: 'US',
    reviewEffectiveDate: '2027-06-01',
    availableDocuments: [{ name: 'recycled-pulp-cert.pdf' }]
  });

  assert.equal(evalExpired.findingStatus, 'review');
  assert.ok(evalExpired.explanation.includes('expired'));
});

test('Multilingual Intelligence: Unicode NFKC matching preserves script and disclaims translation accuracy', () => {
  const hindiPair = createApprovedPhrasePair({
    pairId: 'pair-hi-storage',
    field: 'storage_statement',
    language: 'Hindi',
    languageCode: 'hi',
    approvedText: 'ठंडी और सूखी जगह में रखें।'
  });

  // 1. Matching Hindi text
  const matchResult = matchApprovedPhrase({
    approvedPhrase: hindiPair,
    artworkText: 'Dancing Fish\nठंडी और सूखी जगह में रखें।\nNet Wt 340g',
    artworkCoverage: true
  });

  assert.equal(matchResult.outcome, MULTILINGUAL_OUTCOMES.EXACT_APPROVED_MATCH);
  assert.equal(matchResult.status, 'match');
  assert.ok(matchResult.explanation.includes('does not certify semantic translation accuracy'));

  // 2. Missing with unconfirmed coverage yields unable
  const unableResult = matchApprovedPhrase({
    approvedPhrase: hindiPair,
    artworkText: 'Dancing Fish\nNet Wt 340g',
    artworkCoverage: false
  });

  assert.equal(unableResult.outcome, MULTILINGUAL_OUTCOMES.ARTWORK_EXTRACTION_UNCERTAIN);
  assert.equal(unableResult.status, 'unable');
});
