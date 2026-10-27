/**
 * PackSignal Phase 2 — Fact Conflict Engine Unit Tests
 * (tests/fact-conflicts.test.mjs)
 * 
 * Verifies:
 * - Honey 1% vs 9% value conflict detection.
 * - Carbohydrate 15g vs 66g value conflict on common per-serving basis.
 * - Net quantity 480 g vs 16.9 oz equivalence (NO FALSE CONFLICT!).
 * - Ingredient list semantic additions & compound ingredient preservation.
 * - AI meaning conflicts (Honey + Vegan claim, No Added Sugar + sweeteners).
 * - Preservation of both sources, both quotations, both locations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectFactConflicts, parseIngredientTokens } from '../lib/facts/fact-conflicts.mjs';
import { createFactRecord } from '../lib/facts/fact-schema.mjs';
import { parseNormalizedQuantity } from '../lib/facts/fact-normalization.mjs';

describe('Phase 2 — Value & Semantic Conflict Engine', () => {

  it('1. Detects Honey 1% vs 9% value conflict on comparable percentage basis', () => {
    const artHoney = createFactRecord({
      field: 'ingredient.honey.percentage',
      value: '1%',
      normalizedValue: parseNormalizedQuantity('1%'),
      documentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      panelId: 'Back panel',
      quote: 'Honey (1%)'
    });

    const specHoney = createFactRecord({
      field: 'ingredient.honey.percentage',
      value: '9%',
      normalizedValue: parseNormalizedQuantity('9%'),
      documentId: 'Content_Sheet.xlsx',
      documentSha256: 'sha_spec',
      documentRole: 'specification',
      cell: 'B26',
      quote: 'Honey (9%)',
      sourceAuthority: 'DRAFT',
      qualifiers: ['NEEDS_SOURCE_CONFIRMATION']
    });

    const conflicts = detectFactConflicts([artHoney, specHoney]);
    const honeyConflict = conflicts.find(c => c.conflictId === 'CONFLICT-HONEY-PERCENTAGE');

    assert.ok(honeyConflict, 'Must detect CONFLICT-HONEY-PERCENTAGE');
    assert.equal(honeyConflict.conflictType, 'VALUE_CONFLICT');
    assert.equal(honeyConflict.observedValues.artwork, '1%');
    assert.equal(honeyConflict.observedValues.specification, '9%');
    assert.equal(artHoney.verificationState, 'CONFLICTED');
    assert.equal(specHoney.verificationState, 'CONFLICTED');
    assert.ok(honeyConflict.suggestedQuestions.length > 0);
  });

  it('2. Detects Total Carbohydrate conflict when comparing like-for-like per-serving bases', () => {
    const artCarb = createFactRecord({
      field: 'nutrition.carbohydrate.total',
      value: '66g',
      normalizedValue: parseNormalizedQuantity('66g', 'per_serving'),
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      panelId: 'Left panel',
      quote: 'Total Carbohydrate 66g'
    });

    const specCarb = createFactRecord({
      field: 'nutrition.carbohydrate.total',
      value: '15g',
      normalizedValue: parseNormalizedQuantity('15g', 'per_serving'),
      documentId: 'spec.xlsx',
      documentSha256: 'sha_spec',
      documentRole: 'specification',
      cell: 'B53',
      quote: '15g'
    });

    const conflicts = detectFactConflicts([artCarb, specCarb]);
    const carbConflict = conflicts.find(c => c.conflictId === 'CONFLICT-TOTAL-CARBOHYDRATE');

    assert.ok(carbConflict, 'Must detect CONFLICT-TOTAL-CARBOHYDRATE');
    assert.equal(carbConflict.conflictType, 'VALUE_CONFLICT');
    assert.equal(carbConflict.observedValues.artwork, '66g');
    assert.equal(carbConflict.observedValues.specification, '15g');
  });

  it('3. Net Quantity: 480 g vs 16.9 oz does NOT produce a false conflict', () => {
    const q1 = createFactRecord({
      field: 'net_quantity',
      value: '480g',
      normalizedValue: parseNormalizedQuantity('480g'),
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      quote: '480g'
    });

    const q2 = createFactRecord({
      field: 'net_quantity',
      value: '16.9 oz',
      normalizedValue: parseNormalizedQuantity('16.9 oz'),
      documentId: 'spec.docx',
      documentSha256: 'sha_spec',
      documentRole: 'specification',
      quote: '16.9 oz'
    });

    const conflicts = detectFactConflicts([q1, q2]);
    const netConflict = conflicts.find(c => c.field === 'net_quantity');

    assert.equal(netConflict, undefined, '480 g vs 16.9 oz must NOT produce a conflict');
    assert.notEqual(q1.verificationState, 'CONFLICTED');
    assert.notEqual(q2.verificationState, 'CONFLICTED');
  });

  it('4. Ingredient list semantic diff preserves compound ingredients and detects additions', () => {
    const specIngText = 'INGREDIENTS: Organic Wholegrain Oat Flakes (79%), Almonds, Pecans, Sunflower Seeds, Honey (9%).';
    const artIngText = 'INGREDIENTS: Organic Wholegrain Oat Flakes (79%), Almonds, Pecans, Walnuts, Flax Seeds, Honey (1%), Crystallized Ginger (cane sugar).';

    const tokens = parseIngredientTokens(artIngText);
    assert.ok(tokens.includes('Crystallized Ginger (cane sugar)'), 'Must preserve parenthetical compound ingredient');
    assert.ok(tokens.includes('Walnuts'));
    assert.ok(tokens.includes('Flax Seeds'));

    const artFact = createFactRecord({
      field: 'ingredient.list',
      value: artIngText,
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      quote: artIngText
    });

    const specFact = createFactRecord({
      field: 'ingredient.list',
      value: specIngText,
      documentId: 'spec.xlsx',
      documentSha256: 'sha_spec',
      documentRole: 'specification',
      cell: 'B26',
      quote: specIngText
    });

    const conflicts = detectFactConflicts([artFact, specFact]);
    const ingConflict = conflicts.find(c => c.conflictId === 'CONFLICT-INGREDIENT-LIST-DIFF');

    assert.ok(ingConflict);
    assert.equal(ingConflict.conflictType, 'INGREDIENT_LIST_DIFF');
    assert.ok(ingConflict.addedIngredientsOnArtwork.includes('Walnuts'));
    assert.ok(ingConflict.addedIngredientsOnArtwork.includes('Flax Seeds'));
  });

  it('5. Detects AI Meaning Conflict: Honey present + Vegan claim present', () => {
    const honeyFact = createFactRecord({
      field: 'ingredient.honey.percentage',
      value: '1%',
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      quote: 'Honey (1%)'
    });

    const veganFact = createFactRecord({
      field: 'claims.dietary.vegan_text',
      value: 'Suitable for Vegans.',
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      quote: 'Suitable for Vegans.'
    });

    const conflicts = detectFactConflicts([honeyFact, veganFact]);
    const meaningConflict = conflicts.find(c => c.conflictId === 'CONFLICT-MEANING-HONEY-VEGAN');

    assert.ok(meaningConflict, 'Must detect CLAIM_COMPATIBILITY_CONCERN for honey vs vegan');
    assert.equal(meaningConflict.conflictType, 'CLAIM_COMPATIBILITY_CONCERN');
    assert.equal(meaningConflict.authorityStatus, 'REGULATORY_REVIEW_REQUIRED');
  });

  it('6. Detects AI Meaning Conflict: "No Added Sugar" claim + Sweeteners present', () => {
    const noSugarFact = createFactRecord({
      field: 'claims.nutrition.no_added_sugar',
      value: 'NO ADDED SUGAR',
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      quote: 'NO ADDED SUGAR'
    });

    const ingFact = createFactRecord({
      field: 'ingredient.list',
      value: 'INGREDIENTS: Oats, Honey (1%), Coconut Sugar, Cane Sugar.',
      documentId: 'carton.pdf',
      documentSha256: 'sha_art',
      documentRole: 'artwork',
      quote: 'Oats, Honey (1%), Coconut Sugar'
    });

    const conflicts = detectFactConflicts([noSugarFact, ingFact]);
    const sugarConflict = conflicts.find(c => c.conflictId === 'CONFLICT-MEANING-NO-ADDED-SUGAR');

    assert.ok(sugarConflict, 'Must flag No Added Sugar contradiction with added sweeteners');
    assert.ok(sugarConflict.reason.includes('FDA 21 CFR 101.60(c)'));
  });
});
