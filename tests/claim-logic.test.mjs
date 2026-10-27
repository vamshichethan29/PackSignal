import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenNoAddedSugarClaim,
  screenDeclaredAddedSugars,
  screenVeganClaim
} from '../lib/claims/added-sugar-screen.mjs';
import { parseIngredientList } from '../lib/ingredient-validator.mjs';

test('No Added Sugar claim screener flags caloric sweeteners in formulation', () => {
  const ingredients = parseIngredientList('Oats, Honey (9%), Coconut Sugar, Cane Sugar, Salt');
  const result = screenNoAddedSugarClaim('NO ADDED SUGAR', ingredients);
  assert.equal(result.hasConflict, true);
  assert.equal(result.status, 'review');
  assert.equal(result.findingStatus, 'CLAIM_FORMULATION_CONFLICT');
  assert.equal(result.cfrReference, '21 CFR 101.60(c)(2)');
  assert.ok(result.conflictingIngredients.length >= 3);
});

test('No Added Sugar claim passes when recipe contains no added sugars', () => {
  const ingredients = parseIngredientList('Organic Rolled Oats, Dried Blueberries, Cinnamon');
  const result = screenNoAddedSugarClaim('NO ADDED SUGAR', ingredients);
  assert.equal(result.hasConflict, false);
  assert.equal(result.status, 'match');
});

test('Declared 0g added sugars requires formulation review when recipe contains sweeteners', () => {
  const ingredients = parseIngredientList('Organic Oats, Honey (1%), Coconut Sugar, Salt');
  const result = screenDeclaredAddedSugars('Incl. 0g Added Sugars', ingredients);
  assert.equal(result.hasDiscrepancy, true);
  assert.equal(result.status, 'review');
  assert.equal(result.findingStatus, 'ADDED_SUGAR_VALUE_QUESTION');
});

test('Vegan claim screener flags honey and significant cholesterol', () => {
  const ingredients = parseIngredientList('Organic Oats, Almonds, Pecans, Honey (1%), Coconut Sugar');
  const result = screenVeganClaim('DIETARY INFORMATION: Suitable for Vegans.', ingredients, { cholesterol: 45 });
  assert.equal(result.status, 'review');
  assert.equal(result.findingStatus, 'VEGAN_CLAIM_SUBSTANTIATION_REVIEW');
  assert.equal(result.hasCholesterol, true);
  assert.equal(result.animalDerivatives[0].term, 'honey');
});
