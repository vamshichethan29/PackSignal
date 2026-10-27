import test from 'node:test';
import assert from 'node:assert/strict';
import { nutritionSanityFacts } from '../lib/prepress.mjs';
import { classifyFinding } from '../lib/finding-department-classifier.mjs';
import { generateClarificationMessage } from '../public/clarification-message.js';
import { renderAtwaterProofCard, isAtwaterFinding } from '../public/atwater-proof-card.js';

test('Case 27: Existing nutritionSanityFacts remains fully backward-compatible', () => {
  const facts = [
    { field: 'nutrition.energy_kcal', value: '210' },
    { field: 'nutrition.fat_g', value: '8' },
    { field: 'nutrition.carbohydrate_g', value: '30' },
    { field: 'nutrition.protein_g', value: '5' }
  ];

  const results = nutritionSanityFacts(facts);
  const atw = results.find(r => r.type === 'atwater');
  assert.ok(atw);
  assert.equal(atw.calories, 210);
  assert.equal(atw.estimate, 212); // 8*9 + 30*4 + 5*4 = 72 + 120 + 20 = 212
  assert.equal(atw.passes, true);
  assert.ok(atw.proof);
  assert.ok(atw.atwater);
});

test('Case 28: Deduplication ensures only one Atwater finding in review engine', async () => {
  const { analyze } = await import('../lib/engine.mjs');
  const review = {
    id: 'test-dedup-atwater',
    name: 'Atwater Dedup Test',
    selected: [
      { field: 'nutrition.energy_kcal', value: '166', evidence: { role: 'spec', quote: '166' } },
      { field: 'nutrition.fat_g', value: '15', evidence: { role: 'spec', quote: '15g' } },
      { field: 'nutrition.carbohydrate_g', value: '66', evidence: { role: 'spec', quote: '66g' } },
      { field: 'nutrition.protein_g', value: '34', evidence: { role: 'spec', quote: '34g' } }
    ],
    documents: [
      {
        role: 'artwork',
        pages: [{ number: 1, method: 'pdf_text', text: 'Nutrition Facts\nCalories 166\nTotal Fat 15g\nTotal Carbohydrate 66g\nProtein 34g' }]
      }
    ]
  };

  const evaluated = analyze(review);
  const atwaterFindings = evaluated.findings.filter(f =>
    f.id === 'nutrition-sanity:atwater' || f.id.startsWith('nutrition:calories:')
  );

  // Must only have 1 Atwater calorie finding
  assert.equal(atwaterFindings.length, 1);
  assert.equal(atwaterFindings[0].id, 'nutrition-sanity:atwater');
  assert.equal(atwaterFindings[0].status, 'review');
});

test('Case 31: Department classification routes Atwater findings to R&D with Legal collaborating', () => {
  const finding = {
    id: 'nutrition-sanity:atwater',
    title: 'Nutrition sanity · calories vs macronutrients',
    category: 'nutrition',
    rule: { field: 'nutrition.calories', citation: '21 CFR 101.9(c)(1)(i) screening' }
  };

  const routed = classifyFinding(finding);
  assert.equal(routed.primaryDepartment, 'rd');
  assert.ok(routed.collaboratingDepartments.includes('legal'));
});

test('Case 32: Ask Someone generates message with actual calorie and macronutrient figures', () => {
  const finding = {
    id: 'nutrition-sanity:atwater',
    title: 'Nutrition sanity · calories vs macronutrients',
    declaredCalories: 166,
    estimatedCalories: 535,
    basis: 'per serving',
    atwater: { declaredCalories: 166, estimatedCalories: 535, basis: 'per serving' }
  };

  const msg = generateClarificationMessage({
    finding,
    product: 'Dancing Fish Granola',
    platform: 'slack'
  });

  assert.match(msg, /Declared energy:\* 166 kcal/);
  assert.match(msg, /General 9\/4\/4 estimate:\* 535 kcal/);
  assert.match(msg, /Nutrition basis:\* per serving/);
  assert.match(msg, /Finding:\* nutrition-sanity:atwater/);
});

test('Case 26: Atwater proof card renders declared, estimated, and breakdown math', () => {
  const finding = {
    id: 'nutrition-sanity:atwater',
    status: 'review',
    title: 'Nutrition sanity · calories vs macronutrients',
    declaredCalories: 166,
    estimatedCalories: 535,
    differenceKcal: 369,
    percentDifference: 222,
    basis: 'PER_SERVING',
    macronutrients: {
      fat: { grams: 15, factor: 9, subtotalKcal: 135 },
      carbohydrate: { grams: 66, factor: 4, subtotalKcal: 264 },
      protein: { grams: 34, factor: 4, subtotalKcal: 136 }
    },
    massBalance: {
      passes: false,
      totalMacroGrams: 115,
      expectedMaxGrams: 60,
      excessGrams: 55
    }
  };

  assert.equal(isAtwaterFinding(finding), true);
  const html = renderAtwaterProofCard(finding, {});
  assert.match(html, /166/);
  assert.match(html, /535/);
  assert.match(html, /Total Fat/);
  assert.match(html, /135/);
  assert.match(html, /Carbohydrates/);
  assert.match(html, /264/);
  assert.match(html, /Protein/);
  assert.match(html, /136/);
  assert.match(html, /Macronutrient Mass-Balance Discrepancy/);
  assert.match(html, /Ask R&D/);
});
