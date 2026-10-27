import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAllergenDisclosure } from '../lib/claims/added-sugar-screen.mjs';
import { parseIngredientList } from '../lib/ingredient-validator.mjs';

test('FALCPA tree nut disclosure acknowledges ingredient list naming as permitted route', () => {
  const ingredients = parseIngredientList('Oats, Almonds, Pecans, Walnuts, Honey, Salt');
  const result = evaluateAllergenDisclosure(ingredients, 'ALLERGEN INFORMATION: May Contain Nuts');

  assert.equal(result.declaredInIngredientList, true);
  assert.equal(result.hasContainsStatement, false);
  assert.equal(result.hasMayContainStatement, true);
  // Status is review, but explanation explicitly notes statutory legality under FALCPA
  assert.equal(result.status, 'review');
  assert.match(result.explanation, /fulfills mandatory disclosure/i);
  assert.match(result.explanation, /not legally required/i);
});

test('Explicit Contains statement with tree nuts passes evaluation', () => {
  const ingredients = parseIngredientList('Oats, Almonds, Salt');
  const result = evaluateAllergenDisclosure(ingredients, 'Contains: Almonds.');
  assert.equal(result.hasContainsStatement, true);
  assert.equal(result.status, 'match');
});
