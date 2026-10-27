import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientList, compareIngredientLists, detectDuplicateIngredients } from '../lib/ingredient-validator.mjs';

test('Ingredient parser associates percentages with correct ingredient tokens', () => {
  const raw = 'INGREDIENTS: Organic Wholegrain Oat Flakes (79%), Honey (9%), Himalayan Pink Salt (0.5%).';
  const tokens = parseIngredientList(raw);
  assert.equal(tokens.length, 3);
  assert.equal(tokens[0].name, 'Organic Wholegrain Oat Flakes');
  assert.equal(tokens[0].percentage, 79);
  assert.equal(tokens[1].name, 'Honey');
  assert.equal(tokens[1].percentage, 9);
  assert.equal(tokens[2].name, 'Himalayan Pink Salt');
  assert.equal(tokens[2].percentage, 0.5);
});

test('Ingredient comparator detects percentage mismatch between source and artwork', () => {
  const source = 'Oats (80%), Honey (9%), Salt';
  const artwork = 'Oats (80%), Honey (1%), Salt';
  const diff = compareIngredientLists(source, artwork);
  assert.equal(diff.percentageMismatches.length, 1);
  assert.equal(diff.percentageMismatches[0].ingredient, 'Honey');
  assert.equal(diff.percentageMismatches[0].sourcePercentage, 9);
  assert.equal(diff.percentageMismatches[0].artworkPercentage, 1);
});

test('Ingredient comparator detects artwork-only ingredients on organizer sample', () => {
  const source = 'Organic Wholegrain Oat Flakes (79%), Almonds, Pecans, Sunflower Seeds, Vegetable Oils (in varying proportions), Dried Blueberries, Cranberries, Sunflower Seeds, Honey (9%), Coconut Sugar, Crystallized Ginger (cane sugar), Himalayan Pink Salt. Natural Flavoring.';
  const artwork = 'Organic Wholegrain Oat Flakes (79%), Almonds, Pecans, Walnuts, Flax Seeds, Vegetable Oil (Rapeseed and Sunflower in varying proportions), Dried Strawberries, Blueberries, Cranberries, Pumpkin Seeds, Sunflower Seeds, Honey (1%), Coconut Sugar, Crystallized Ginger (cane sugar), Himalayan Pink Salt. Natural Flavoring.';

  const diff = compareIngredientLists(source, artwork);
  const artworkOnlyNames = diff.artworkOnly.map(x => x.ingredient);
  assert.ok(artworkOnlyNames.includes('Walnuts'));
  assert.ok(artworkOnlyNames.includes('Flax Seeds'));
  assert.ok(artworkOnlyNames.includes('Dried Strawberries'));
  assert.ok(artworkOnlyNames.includes('Pumpkin Seeds'));
});

test('Duplicate ingredient detector catches repeated occurrences within list scope', () => {
  const source = 'Sunflower Seeds, Vegetable Oils, Dried Blueberries, Cranberries, Sunflower Seeds';
  const tokens = parseIngredientList(source);
  const duplicates = detectDuplicateIngredients(tokens);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].name, 'Sunflower Seeds');
  assert.equal(duplicates[0].firstOccurrence.sequence, 1);
  assert.equal(duplicates[0].secondOccurrence.sequence, 5);
});

test('Ingredient validator generalizes to unfamiliar products without hardcoding', () => {
  const source = 'Dark Chocolate (65%), Hazelnuts (20%), Cane Sugar (15%)';
  const artwork = 'Dark Chocolate (65%), Hazelnuts (10%), Cashews, Cane Sugar (15%)';
  const diff = compareIngredientLists(source, artwork);
  assert.equal(diff.percentageMismatches.length, 1);
  assert.equal(diff.percentageMismatches[0].ingredient, 'Hazelnuts');
  assert.equal(diff.artworkOnly.length, 1);
  assert.equal(diff.artworkOnly[0].ingredient, 'Cashews');
});
