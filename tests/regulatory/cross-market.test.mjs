/**
 * Tests for Cross-Market Comparison & Regulatory Switcher
 * Evaluates USA, EU, and India concurrently in the 3-column matrix.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJurisdiction, evaluateAllMarkets } from '../../lib/regulatory/evaluator.mjs';

test('1. Three-Market Comparison Matrix evaluates USA, EU, and India for the same packaging artwork', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        // Artwork designed primarily with US Nutrition Facts and FSSAI license
        text: 'NUTRITION FACTS\nServing Size 1 cup (240ml)\nCalories 150\nFat 5g\nSodium 200mg\nAdded Sugars 12g (24% DV)\nIngredients: Milk, cocoa, sugar.\nContains milk.\nNet Wt 8 fl oz (236 mL)\nDistributed by Dairy Corp, Chicago IL 60601\nFSSAI Lic. No. 10015011000999\nVegetarian',
      },
    ],
    facts: [
      { field: 'net_quantity', value: '8 fl oz (236 mL)' },
      { field: 'allergens', value: 'Milk' },
    ],
  };

  const comp = evaluateAllMarkets(review, { effectiveDate: '2026-10-23' });

  assert.ok(comp.us);
  assert.ok(comp.eu);
  assert.ok(comp.india);
  assert.ok(Array.isArray(comp.comparisonMatrix));
  assert.equal(comp.comparisonMatrix.length, 8); // 8 standardized regulatory requirement rows

  // Check Nutrition Basis row in matrix
  const basisRow = comp.comparisonMatrix.find(r => r.topic === 'Nutrition Display Basis');
  assert.ok(basisRow);
  assert.equal(basisRow.usa.status, 'match'); // US accepts per-serving
  assert.equal(basisRow.eu.status, 'issue'); // EU flags issue: missing mandatory per 100g/ml declaration
  assert.match(basisRow.keyDifference, /EU requires per-100g\/ml/i);

  // Check Dual Energy row in matrix
  const energyRow = comp.comparisonMatrix.find(r => r.topic === 'Energy Declaration Units');
  assert.ok(energyRow);
  assert.equal(energyRow.usa.status, 'match'); // Calories declared on artwork
  assert.equal(energyRow.eu.status, 'review'); // Energy statement requires dual kJ/kcal verification
  assert.match(energyRow.keyDifference, /EU strictly requires kilojoules/i);

  // Check Veg Mark row in matrix
  const vegRow = comp.comparisonMatrix.find(r => r.topic === 'Vegetarian / Non-Vegetarian Logo');
  assert.ok(vegRow);
  assert.equal(vegRow.usa.status, 'not_applicable'); // USA has no statutory veg logo
  assert.equal(vegRow.eu.status, 'not_applicable'); // EU has no statutory veg logo
  assert.equal(vegRow.india.status, 'review'); // Text cue found, visual inspection needed

  // Check FSSAI License row in matrix
  const licRow = comp.comparisonMatrix.find(r => r.topic === 'Regulatory Authority License');
  assert.ok(licRow);
  assert.equal(licRow.india.status, 'match'); // 14-digit license present
  assert.equal(licRow.usa.status, 'not_applicable');
  assert.equal(licRow.eu.status, 'review');
});

test('2. Instant switching preserves artwork and does not require re-uploading', () => {
  const review = {
    id: 'test-review-123',
    documents: [
      {
        role: 'artwork',
        text: 'NUTRITION FACTS\nServing Size 100g\nCalories 200\nTotal Fat 4g\nSodium 100mg\nSalt 0.25g\nEnergy 840 kJ / 200 kcal\nNet Wt 100g\nFSSAI Lic. No. 10012345678901\nVegetarian',
      },
    ],
    facts: [],
  };

  // Switch to US
  const usRes = evaluateJurisdiction(review, 'us');
  assert.equal(usRes.jurisdiction, 'us');

  // Switch to EU without modifying review documents
  const euRes = evaluateJurisdiction(review, 'eu');
  assert.equal(euRes.jurisdiction, 'eu');

  // Switch to India without modifying review documents
  const indiaRes = evaluateJurisdiction(review, 'india');
  assert.equal(indiaRes.jurisdiction, 'india');

  // Same artwork document retained across all evaluations
  assert.equal(review.documents[0].role, 'artwork');
});
