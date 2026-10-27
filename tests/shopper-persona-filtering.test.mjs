import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFindingRelevantToPersona,
  getFindingPersonaMapping
} from '../lib/shopper-personas.mjs';

test('Shopper Persona Filtering & Filter Composition (Upgrade #42)', async (t) => {
  const sampleFindings = [
    {
      id: 'DF-02',
      canonicalId: 'DF-02',
      title: 'Tree Nut Allergen Identification (Almonds, Pecans, Walnuts)',
      status: 'match',
      category: 'ALLERGENS',
      primaryDepartment: 'Legal & Regulatory',
      collaboratingDepartments: ['R&D & Food Science'],
      observed: 'Almonds, Pecans, Walnuts in ingredients',
      expected: 'Recipe tree nut disclosure',
      rule: { field: 'allergen_declaration' }
    },
    {
      id: 'DF-03',
      canonicalId: 'DF-03',
      title: 'Precautionary Advisory Statement Co-existence',
      status: 'review',
      category: 'ALLERGENS',
      primaryDepartment: 'Legal & Regulatory',
      collaboratingDepartments: ['Quality Assurance'],
      observed: 'May Contain tree nuts',
      expected: 'Voluntary advisory wording verification',
      rule: { field: 'precautionary_allergen' }
    },
    {
      id: 'DF-05',
      canonicalId: 'DF-05',
      title: 'Vegan Marketing Copy vs Honey Ingredient Deck',
      status: 'issue',
      category: 'CLAIMS',
      primaryDepartment: 'Brand & Marketing',
      collaboratingDepartments: ['Legal & Regulatory', 'R&D & Food Science'],
      observed: 'Suitable for Vegans',
      expected: 'Honey (1% / 9%) in formulation',
      rule: { field: 'claims.vegan' }
    },
    {
      id: 'DF-04',
      canonicalId: 'DF-04',
      title: 'No Added Sugar Claim vs Nutritive Sweeteners',
      status: 'issue',
      category: 'CLAIMS',
      primaryDepartment: 'Legal & Regulatory',
      collaboratingDepartments: ['R&D & Food Science'],
      observed: 'NO ADDED SUGAR',
      expected: 'Honey, Coconut Sugar, Cane Sugar in Ginger',
      rule: { field: 'claims.sugar' }
    },
    {
      id: 'DF-10',
      canonicalId: 'DF-10',
      title: 'Nutrition Facts Cholesterol Declaration',
      status: 'review',
      category: 'NUTRITION',
      primaryDepartment: 'R&D & Food Science',
      collaboratingDepartments: ['Legal & Regulatory'],
      observed: 'Cholesterol 45mg',
      expected: 'Plant and honey ingredients contain <2mg cholesterol',
      rule: { field: 'nutrition.cholesterol' }
    },
    {
      id: 'DF-08',
      canonicalId: 'DF-08',
      title: 'Net Quantity PDP Requirement',
      status: 'match',
      category: 'MANDATORY',
      primaryDepartment: 'Packaging Prepress',
      collaboratingDepartments: ['Legal & Regulatory'],
      observed: '16.9 oz (480g)',
      expected: '16.9 oz (480g)',
      rule: { field: 'net_quantity' }
    }
  ];

  await t.test('1. Structured relevance mapping matches on rule field and categories', () => {
    const nutFindings = sampleFindings.filter(f => isFindingRelevantToPersona(f, 'nut-allergy'));
    assert.deepEqual(nutFindings.map(f => f.id), ['DF-02', 'DF-03']);

    const veganFindings = sampleFindings.filter(f => isFindingRelevantToPersona(f, 'vegan'));
    assert.deepEqual(veganFindings.map(f => f.id), ['DF-05', 'DF-10']);

    const sugarFindings = sampleFindings.filter(f => isFindingRelevantToPersona(f, 'sugar-watcher'));
    assert.deepEqual(sugarFindings.map(f => f.id), ['DF-04']);
  });

  await t.test('2. Persona filters compose cleanly with Department filters', () => {
    // Vegan Shopper + Brand & Marketing department
    const veganBrand = sampleFindings.filter(f =>
      isFindingRelevantToPersona(f, 'vegan') &&
      (f.primaryDepartment === 'Brand & Marketing' || f.collaboratingDepartments?.includes('Brand & Marketing'))
    );
    assert.equal(veganBrand.length, 1);
    assert.equal(veganBrand[0].id, 'DF-05');

    // Nut Allergy + Legal & Regulatory department
    const nutLegal = sampleFindings.filter(f =>
      isFindingRelevantToPersona(f, 'nut-allergy') &&
      f.primaryDepartment === 'Legal & Regulatory'
    );
    assert.equal(nutLegal.length, 2);
  });

  await t.test('3. Persona filters compose cleanly with Finding Status filters', () => {
    // Nut Allergy + Needs Review (status === 'review')
    const nutReview = sampleFindings.filter(f =>
      isFindingRelevantToPersona(f, 'nut-allergy') && f.status === 'review'
    );
    assert.equal(nutReview.length, 1);
    assert.equal(nutReview[0].id, 'DF-03');

    // Sugar Watcher + Issues (status === 'issue')
    const sugarIssues = sampleFindings.filter(f =>
      isFindingRelevantToPersona(f, 'sugar-watcher') && f.status === 'issue'
    );
    assert.equal(sugarIssues.length, 1);
    assert.equal(sugarIssues[0].id, 'DF-04');
  });

  await t.test('4. Finding duplication is prevented when filtering', () => {
    const findingsList = sampleFindings.filter(f => isFindingRelevantToPersona(f, 'nut-allergy'));
    const uniqueIds = new Set(findingsList.map(f => f.id));
    assert.equal(findingsList.length, uniqueIds.size, 'No duplicates in result set');
  });

  await t.test('5. getFindingPersonaMapping returns structured metadata and why-it-matters', () => {
    const mapping = getFindingPersonaMapping(sampleFindings[1], 'nut-allergy');
    assert.ok(mapping, 'Mapping generated');
    assert.equal(mapping.personaId, 'nut-allergy');
    assert.equal(mapping.displayPriority, 'HIGH');
    assert.ok(mapping.consumerExplanation.shopperSees.includes('Almonds, Pecans, and Walnuts'));
    assert.ok(mapping.consumerExplanation.whyItMatters.includes('severe tree nut allergies'));
  });
});
