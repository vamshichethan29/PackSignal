/**
 * Tests for USA FDA Regulatory Engine (21 CFR Part 101)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJurisdiction } from '../../lib/regulatory/evaluator.mjs';

test('1. USA FDA: Valid standard Nutrition Facts panel detected', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'NUTRITION FACTS\nServing Size 1 bar (40g)\nCalories 180\nTotal Fat 8g (10% DV)\nSodium 115mg (5% DV)\nTotal Carbohydrate 24g\nAdded Sugars 10g (20% DV)\nProtein 4g\nIngredients: Oats, honey, crisp rice, almonds.\nContains almonds. May contain peanuts.\nNet Wt 40g (1.4 oz)\nDistributed by Natural Foods Inc, Boulder, CO 80301',
      },
    ],
    facts: [
      { field: 'net_quantity', value: '40g (1.4 oz)' },
      { field: 'allergens', value: 'Almonds' },
    ],
  };

  const res = evaluateJurisdiction(review, 'us', { effectiveDate: '2026-10-23' });
  assert.equal(res.jurisdiction, 'us');
  assert.ok(res.findings.length > 0);

  const panelFinding = res.findings.find(f => f.key.includes('PANEL'));
  assert.ok(panelFinding);
  assert.equal(panelFinding.status, 'match');

  const caloriesFinding = res.findings.find(f => f.key.includes('CALORIES'));
  assert.ok(caloriesFinding);
  assert.equal(caloriesFinding.status, 'match');

  const allergenFinding = res.findings.find(f => f.key.includes('ALLERGENS'));
  assert.ok(allergenFinding);
  assert.equal(allergenFinding.status, 'match');
});

test('2. USA FDA: Missing Nutrition Facts panel flags issue under 21 CFR 101.9', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Delicious Granola Bar. Net Wt 50g. Made in USA.',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'us', { effectiveDate: '2026-10-23' });
  const panelFinding = res.findings.find(f => f.key.includes('PANEL'));
  assert.ok(panelFinding);
  assert.equal(panelFinding.status, 'issue');
  assert.match(panelFinding.explanation, /Nutrition Facts panel/i);
});

test('3. USA FDA: Major allergens verification flags omitted source-backed allergen', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Nutrition Facts\nCalories 100\nIngredients: Wheat flour, sugar, vegetable oil.\nNet Wt 100g',
      },
    ],
    facts: [
      // Specification says product contains sesame, but artwork copy does not declare sesame
      { field: 'allergens', value: 'Wheat, Sesame' },
    ],
  };

  const res = evaluateJurisdiction(review, 'us');
  const allergenFinding = res.findings.find(f => f.key.includes('ALLERGENS'));
  assert.ok(allergenFinding);
  assert.equal(allergenFinding.status, 'issue');
  assert.match(allergenFinding.explanation, /sesame/i);
});

test('4. USA FDA: Net quantity declaration verifies dual units (metric and US customary)', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Nutrition Facts\nCalories 100\nNet Wt 12 oz (340g)',
      },
    ],
    facts: [{ field: 'net_quantity', value: '12 oz (340g)' }],
  };

  const res = evaluateJurisdiction(review, 'us');
  const qtyFinding = res.findings.find(f => f.key.includes('NET-QTY'));
  assert.ok(qtyFinding);
  assert.equal(qtyFinding.status, 'match');
});
