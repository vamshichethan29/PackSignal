/**
 * PackSignal US Regulatory Preflight — Integration Tests
 * Tests full orchestrator runUsFoodPreflight across real organizer sample and controlled fixture.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { runUsFoodPreflight } from '../../lib/regulatory/us/index.mjs';
import { buildUsProductProfile } from '../../lib/regulatory/us/applicability.mjs';

test('Integration: Controlled fictional fixture executes all 7 checks with verified status', () => {
  const review = {
    name: 'Fieldday Oat Milk Controlled US Fixture',
    artworkText: `
      Fieldday Organic Oat Milk
      NET WT 32 FL OZ (1 QT) 946 mL
      Ingredients: Filtered Water, Organic Rolled Oats, Sunflower Oil, Sea Salt.
      Contains: Oats.
      Distributed by Fieldday Organics Inc., 100 Natural Way, Eugene, OR 97401
      Nutrition Facts
      4 servings per container
      Serving size 1 cup (240mL)
      Calories 120
      Total Fat 2.5g
      Saturated Fat 0.5g
      Trans Fat 0g
      Cholesterol 0mg
      Sodium 230mg
      Total Carbohydrate 22g
      Dietary Fiber 3g
      Total Sugars 7g
      Includes 4g Added Sugars
      Protein 3g
      Vitamin D 2mcg
      Calcium 260mg
      Iron 1mg
      Potassium 350mg
      100% Recyclable Packaging
    `,
    facts: [
      { field: 'net_quantity', value: '32 fl oz (946 mL)' },
      { field: 'business_name', value: 'Fieldday Organics Inc.' },
      { field: 'ingredients', value: 'Filtered Water, Organic Rolled Oats, Sunflower Oil, Sea Salt.' },
      { field: 'calories', value: '120' },
      { field: 'total_fat', value: '2.5' },
      { field: 'total_carbohydrate', value: '22' },
      { field: 'protein', value: '3' },
      { field: 'sodium', value: '230' },
      { field: 'sodium_dv', value: '10' },
      { field: 'nutrition_basis', value: 'per_serving' },
    ],
    claimsRegister: [
      { id: 'recyclable', claimText: '100% Recyclable', approvedWording: '100% Recyclable', evidenceDocumentId: 'doc-lca-01' },
    ],
    documents: [
      { id: 'doc-lca-01', role: 'substantiation' },
      { id: 'spec-01', role: 'spec', approved: true },
    ],
    options: {
      completeArtwork: true,
      nutritionBasisConfirmed: true,
      sourceAuthorityConfirmed: true,
    },
  };

  const preflight = runUsFoodPreflight(review);
  assert.equal(preflight.packId, 'us-food-preflight');
  assert.equal(preflight.jurisdiction, 'US');
  assert.equal(preflight.version, '1.0.0');
  assert.equal(preflight.checks.length, 7);

  // Check IDs match statutory designations
  const checkIds = preflight.checks.map(c => c.checkId);
  assert.deepEqual(checkIds, ['US-001', 'US-002', 'US-003', 'US-004', 'US-005', 'US-006', 'US-007']);

  // Verify coverage stats
  assert.equal(preflight.coverage.total, 7);
  assert.ok(preflight.coverage.match >= 6);

  // Verify statutory disclaimers are present and honest
  assert.ok(preflight.limitations.length >= 4);
  assert.ok(preflight.limitations.some(l => l.includes('inspection aid, not an FDA legal approval authority')));
});

test('Integration: Organizer sample with draft unconfirmed sources preserves REVIEW / UNABLE', () => {
  const organizerReview = {
    name: 'Dancing Fish Berry Crunch Organizer Sample',
    artworkText: `
      Dancing Fish Berry Crunch Granola
      NET WT 480g
      PRODUCED BY DANCING FISH GRANOLA CO.
      Ingredients: Oats, Sugar, Blueberries, Almonds.
      Allergens: May contain nuts.
      Nutrition Facts
      Calories 166
      Total Fat 15g
      Total Carbohydrate 66g
      Protein 34g
      Sodium 23mg
    `,
    facts: [
      // Draft Excel sheet values with unconfirmed authority
      { field: 'business_name', value: 'Dancing Fish Granola Co.' },
      { field: 'nutrition_basis', value: 'unresolved' },
    ],
    claimsRegister: [],
    options: {
      sourceAuthorityConfirmed: false,
      nutritionBasisConfirmed: false,
      completeArtwork: false,
    },
  };

  const preflight = runUsFoodPreflight(organizerReview);
  assert.equal(preflight.packId, 'us-food-preflight');
  assert.equal(preflight.checks.length, 7);

  // With unconfirmed sources, checks route safely to REVIEW or UNABLE rather than false passes
  const reviewOrUnable = preflight.checks.filter(c => c.findingStatus === 'review' || c.findingStatus === 'unable');
  assert.ok(reviewOrUnable.length >= 2, 'Unconfirmed draft sources must yield at least 2 REVIEW/UNABLE checks');

  // Business address without city/state/zip should not pass
  const bizCheck = preflight.checks.find(c => c.checkId === 'US-002');
  assert.ok(['unable', 'issue', 'review'].includes(bizCheck.findingStatus));
});

test('Integration: Applicability profile correctly identifies target food category', () => {
  const profile = buildUsProductProfile({
    options: {
      productCategory: 'conventional_food',
      population: 'adults_and_children_4_plus',
      nutritionFormat: 'standard',
    },
  });
  assert.equal(profile.market, 'US');
  assert.equal(profile.regulator, 'FDA');
  assert.equal(profile.productCategory, 'conventional_food');
  assert.equal(profile.population, 'adults_and_children_4_plus');
  assert.equal(profile.nutritionFormat, 'standard');
});
