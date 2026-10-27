/**
 * PackSignal US Regulatory Preflight — Check US-003: Ingredients & Major Allergens
 * Legal Basis: 21 CFR 101.4, 21 U.S.C. 343(w) (FALCPA & FASTER Act 2021)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUsIngredientsAllergensCheck } from '../../lib/regulatory/us/ingredients-allergens.mjs';

test('US-003: Verified ingredient list and allergen statement matching formulation matches', () => {
  const res = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Whole Grain Rolled Oats, Cane Sugar, Canola Oil, Almonds, Sea Salt.\nContains: Almonds.',
    approvedIngredients: 'Whole Grain Rolled Oats, Cane Sugar, Canola Oil, Almonds, Sea Salt.',
    formulationAllergens: ['Tree nuts'],
  });
  assert.equal(res.checkId, 'US-003');
  assert.equal(res.findingStatus, 'match');
  assert.match(res.explanation, /satisfy 21 CFR 101.4 and FALCPA\/FASTER Act/i);
});

test('US-003: All 9 major US food allergens supported under FALCPA and FASTER Act', () => {
  // Test each of the 9 allergens
  const allergens = [
    { name: 'Milk', text: 'Ingredients: Milk, Sugar.\nContains: Milk.' },
    { name: 'Egg', text: 'Ingredients: Whole Eggs, Salt.\nContains: Egg.' },
    { name: 'Fish', text: 'Ingredients: Salmon, Olive Oil.\nContains: Fish (Salmon).' },
    { name: 'Crustacean shellfish', text: 'Ingredients: Shrimp, Garlic, Butter.\nContains: Crustacean Shellfish (Shrimp), Milk.' },
    { name: 'Tree nuts', text: 'Ingredients: Walnuts, Honey.\nContains: Tree nuts (Walnuts).' },
    { name: 'Peanuts', text: 'Ingredients: Roasted Peanuts, Salt.\nContains: Peanuts.' },
    { name: 'Wheat', text: 'Ingredients: Enriched Wheat Flour, Water.\nContains: Wheat.' },
    { name: 'Soybeans', text: 'Ingredients: Soy Protein Isolate, Water.\nContains: Soy.' },
    { name: 'Sesame', text: 'Ingredients: Sesame Seeds, Sea Salt.\nContains: Sesame.' },
  ];

  for (const item of allergens) {
    const res = executeUsIngredientsAllergensCheck({
      artworkText: item.text,
      approvedIngredients: item.text.replace(/Contains:.*$/s, '').replace(/Ingredients:\s*/i, '').trim(),
      formulationAllergens: [item.name],
    });
    assert.equal(res.findingStatus, 'match', `Failed for allergen: ${item.name}`);
  }
});

test('US-003: Verified missing major allergen (e.g., Sesame) flags FALCPA/FASTER Act ISSUE', () => {
  const res = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Chickpeas, Tahini, Olive Oil, Garlic, Salt.\nContains: None.',
    approvedIngredients: 'Chickpeas, Sesame Tahini, Olive Oil, Garlic, Salt.',
    formulationAllergens: ['Sesame'],
  });
  assert.equal(res.checkId, 'US-003');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /(?:FASTER Act Violation|Contains Statement Statutory Inconsistency).*Sesame/i);
});

test('US-003: Inconsistent "Contains" statement omitting allergen present in ingredients flags ISSUE', () => {
  // Artwork includes both Milk and Wheat in ingredients, but Contains statement only lists Milk
  const res = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Wheat Flour, Milk, Sugar, Salt.\nContains: Milk.',
    approvedIngredients: 'Wheat Flour, Milk, Sugar, Salt.',
  });
  assert.equal(res.checkId, 'US-003');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Contains Statement Statutory Inconsistency.*Wheat/i);
});

test('US-003: Unsupplied formulation specification routes extracted ingredients to REVIEW', () => {
  const res = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Rolled Oats, Sunflower Seeds, Flax Seeds, Maple Syrup.',
    approvedIngredients: null,
  });
  assert.equal(res.checkId, 'US-003');
  assert.equal(res.findingStatus, 'review');
  assert.match(res.explanation, /no approved formulation specification was supplied for verification/i);
});

test('US-003: Verified ingredient missing from artwork formulation flags statutory ISSUE', () => {
  const res = executeUsIngredientsAllergensCheck({
    artworkText: 'Ingredients: Oats, Sugar, Salt.',
    approvedIngredients: 'Oats, Sugar, Sunflower Oil, Salt.',
  });
  assert.equal(res.checkId, 'US-003');
  assert.equal(res.findingStatus, 'issue');
  assert.match(res.explanation, /Missing ingredient from approved formulation/i);
});
