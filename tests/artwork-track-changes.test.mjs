/**
 * @file tests/artwork-track-changes.test.mjs
 * 
 * Unit tests for Phase 5A: Structured Content & Track Changes Diff Engine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffIngredients,
  diffAllergens,
  diffMarketingClaims,
  computeReviewContentDiff
} from '../lib/revisions/content-diff.mjs';

describe('Phase 5A — Structured Content & Track Changes Diff', () => {

  it('1. Ingredient sequence diff detects added, removed, and modified items (Honey 9% vs 1%)', () => {
    const specIngredients = 'Rolled Oats, Crisp Rice, Honey (9%), Dried Cranberries, Cane Sugar, Salt';
    const artworkIngredients = 'Rolled Oats, Crisp Rice, Honey (1%), Dried Cranberries, Natural Flavor, Salt';

    const diff = diffIngredients(specIngredients, artworkIngredients);

    assert.ok(diff.hasDifferences);
    assert.equal(diff.modified.length, 1);
    assert.equal(diff.modified[0].sourceItem, 'Honey (9%)');
    assert.equal(diff.modified[0].artworkItem, 'Honey (1%)');

    // Added on artwork: Natural Flavor
    assert.equal(diff.added.length, 1);
    assert.equal(diff.added[0].item, 'Natural Flavor');

    // Removed from spec: Cane Sugar
    assert.equal(diff.removed.length, 1);
    assert.equal(diff.removed[0].item, 'Cane Sugar');

    // Unchanged: Rolled Oats, Crisp Rice, Dried Cranberries, Salt
    assert.equal(diff.unchanged.length, 4);
  });

  it('2. Allergen diff detects intentional ingredients, specific species disclosure, and advisory changes', () => {
    const specAllergens = 'Contains: Almonds, Pecans. May contain: Milk, Soy.';
    const artworkAllergens = 'Contains: Tree Nuts (Almonds). May contain: Milk.';

    const diff = diffAllergens(specAllergens, artworkAllergens);

    assert.ok(diff.hasDifferences);
    // Pecans declared in spec but omitted on artwork
    assert.ok(diff.removedAllergens.includes('pecans'));
    // Almonds match
    assert.ok(diff.unchangedAllergens.includes('almonds'));
    // Advisory difference
    assert.equal(diff.advisoryDiff, 'ADVISORY_REMOVED_ON_ARTWORK');
  });

  it('3. Marketing claims diff tracks added, removed, and unchanged claims', () => {
    const refClaims = ['Good Source of Fiber', 'No Artificial Colors'];
    const artClaims = ['Good Source of Fiber', 'Certified Vegan'];

    const diff = diffMarketingClaims(refClaims, artClaims);

    assert.ok(diff.hasDifferences);
    assert.deepEqual(diff.added, ['Certified Vegan']);
    assert.deepEqual(diff.removed, ['No Artificial Colors']);
    assert.deepEqual(diff.unchanged, ['Good Source of Fiber']);
  });

  it('4. computeReviewContentDiff executes comprehensive diff across all categories', () => {
    const mockReview = {
      id: 'rev-sample-123',
      findings: [
        { id: 'DF-01', title: 'Ingredients Discrepancy', expected: 'Oats, Honey (9%)', observed: 'Oats, Honey (1%)' },
        { id: 'DF-02', title: 'Allergen Advisory', expected: 'Contains: Almonds', observed: 'Contains: Almonds' }
      ]
    };

    const reviewDiff = computeReviewContentDiff(mockReview, 'SOURCE_VS_ARTWORK');

    assert.equal(reviewDiff.mode, 'SOURCE_VS_ARTWORK');
    assert.equal(reviewDiff.reviewId, 'rev-sample-123');
    assert.ok(reviewDiff.ingredients);
    assert.ok(reviewDiff.allergens);
    assert.ok(reviewDiff.claims);
  });

});
