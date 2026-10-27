/**
 * Tests for European Union Engine (Regulation (EU) No 1169/2011)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJurisdiction } from '../../lib/regulatory/evaluator.mjs';

test('1. EU Regulation 1169/2011: Verified per 100g basis and dual energy (kJ and kcal)', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Nutrition Information per 100 g\nEnergy 1868 kJ / 445 kcal\nFat 15 g\nof which saturates 2.5 g\nCarbohydrate 68 g\nof which sugars 22 g\nProtein 7.5 g\nSalt 0.45 g\nIngredients: Oats, sugar, sunflower oil.\nNet quantity: 375 g e\nBest before: 31/12/2027\nDistributed by EuroSnacks SAS, 75008 Paris, France',
      },
    ],
    facts: [
      { field: 'energy_kj', value: '1868 kJ' },
      { field: 'energy_kcal', value: '445 kcal' },
      { field: 'salt', value: '0.45 g' },
    ],
  };

  const res = evaluateJurisdiction(review, 'eu');
  assert.equal(res.jurisdiction, 'eu');

  const basisFinding = res.findings.find(f => f.key.includes('ART30-BASIS'));
  assert.ok(basisFinding);
  assert.equal(basisFinding.status, 'match');

  const energyFinding = res.findings.find(f => f.key.includes('ART30-DUAL-ENERGY'));
  assert.ok(energyFinding);
  assert.equal(energyFinding.status, 'match');

  const nutrientFinding = res.findings.find(f => f.key.includes('ART30-7-NUTRIENTS'));
  assert.ok(nutrientFinding);
  assert.equal(nutrientFinding.status, 'match');
});

test('2. EU Regulation 1169/2011: Per-serving-only declaration flags issue under Art 32(2)', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        // US-style per-serving only without mandatory per 100g declaration
        text: 'Nutrition Facts\nServing Size 1 bar (30g)\nCalories 120\nFat 3g\nSodium 50mg',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'eu');
  const basisFinding = res.findings.find(f => f.key.includes('ART30-BASIS'));
  assert.ok(basisFinding);
  assert.equal(basisFinding.status, 'issue');
  assert.match(basisFinding.explanation, /mandatory nutrition declaration must be given per 100 g or per 100 ml/i);
});

test('3. EU Regulation 1169/2011: Energy declared in kcal without kJ flags issue under Art 30(1)', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        text: 'Nutrition per 100g: Energy 250 kcal. Fat 5g. Protein 10g.',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'eu');
  const energyFinding = res.findings.find(f => f.key.includes('ART30-DUAL-ENERGY'));
  assert.ok(energyFinding);
  assert.equal(energyFinding.status, 'issue');
  assert.match(energyFinding.explanation, /dual declaration in both kJ and kcal/i);
});

test('4. EU Regulation 1169/2011: Declaring Sodium instead of mandatory Salt flags issue under Art 30(1)', () => {
  const review = {
    documents: [
      {
        role: 'artwork',
        // Declares sodium instead of mandatory salt
        text: 'Typical values per 100g: Energy 1500 kJ / 350 kcal, Fat 10g, of which saturates 2g, Carbohydrate 50g, of which sugars 15g, Protein 8g, Sodium 400mg',
      },
    ],
    facts: [],
  };

  const res = evaluateJurisdiction(review, 'eu');
  const nutrientFinding = res.findings.find(f => f.key.includes('ART30-SALT'));
  assert.ok(nutrientFinding);
  assert.equal(nutrientFinding.status, 'issue');
  assert.match(nutrientFinding.explanation, /salt/i);
});
