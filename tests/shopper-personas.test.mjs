import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOPPER_PERSONA_IDS,
  SHOPPER_PERSONA_REGISTRY,
  getShopperPersona,
  getAllShopperPersonas,
  isFindingRelevantToPersona,
  getPersonaImpactSummary
} from '../lib/shopper-personas.mjs';

test('Shopper Personas — Core Registry (Upgrade #42)', async (t) => {
  await t.test('1. All three required personas exist in the registry', () => {
    assert.ok(SHOPPER_PERSONA_REGISTRY[SHOPPER_PERSONA_IDS.NUT_ALLERGY], 'Nut Allergy Persona exists');
    assert.ok(SHOPPER_PERSONA_REGISTRY[SHOPPER_PERSONA_IDS.VEGAN], 'Vegan Persona exists');
    assert.ok(SHOPPER_PERSONA_REGISTRY[SHOPPER_PERSONA_IDS.SUGAR_WATCHER], 'Sugar Watcher Persona exists');
    
    const all = getAllShopperPersonas();
    assert.equal(all.length, 3, 'Exactly 3 personas registered');
  });

  await t.test('2. Each persona specifies required metadata schema', () => {
    const requiredProps = [
      'personaId', 'displayName', 'shortName', 'icon', 'badgeText',
      'description', 'relevantCheckTypes', 'relevantFieldTypes',
      'relevantClaimTypes', 'governingRegulations', 'primaryDepartment',
      'collaboratingDepartments', 'disclaimer', 'version'
    ];

    for (const persona of getAllShopperPersonas()) {
      for (const prop of requiredProps) {
        assert.ok(persona[prop] != null, `Persona ${persona.personaId} missing property ${prop}`);
      }
      assert.ok(persona.relevantCheckTypes.length > 0, `${persona.personaId} has check types`);
      assert.ok(persona.relevantFieldTypes.length > 0, `${persona.personaId} has field types`);
      assert.ok(persona.governingRegulations.length > 0, `${persona.personaId} has governing regulations`);
    }
  });

  await t.test('3. Non-medical and non-certification disclaimers are preserved', () => {
    for (const persona of getAllShopperPersonas()) {
      assert.ok(typeof persona.disclaimer === 'string' && persona.disclaimer.length > 10, 'Disclaimer present');
      // Must not declare food safe or medical clearance
      assert.doesNotMatch(persona.disclaimer.toLowerCase(), /safe for consumption/i);
    }
  });

  await t.test('4. Engine verdicts remain immutable when filtered through personas', () => {
    const mockFinding = {
      id: 'DF-05',
      title: 'Dietary Suitability / Vegan Claim vs Honey Content',
      status: 'review',
      category: 'CLAIMS',
      observed: 'Suitable for Vegans',
      expected: 'Recipe Honey (9%)',
      rule: { field: 'claims.vegan', authority: 'ISO 23662' }
    };

    const initialStatus = mockFinding.status;
    const isRel = isFindingRelevantToPersona(mockFinding, SHOPPER_PERSONA_IDS.VEGAN);
    assert.equal(isRel, true, 'Finding is relevant to Vegan Shopper');
    assert.equal(mockFinding.status, initialStatus, 'Finding status remained REVIEW, never changed to ISSUE');
    assert.equal(mockFinding.status, 'review', 'Status was not mutated');
  });

  await t.test('5. getShopperPersona retrieves valid metadata by id', () => {
    const nut = getShopperPersona('nut-allergy');
    assert.equal(nut?.personaId, 'nut-allergy');
    assert.equal(nut?.icon, '🥜');
    
    const veg = getShopperPersona('vegan');
    assert.equal(veg?.personaId, 'vegan');
    assert.equal(veg?.icon, '🌱');

    const sugar = getShopperPersona('sugar-watcher');
    assert.equal(sugar?.personaId, 'sugar-watcher');
    assert.equal(sugar?.icon, '🍯');

    assert.equal(getShopperPersona('unknown'), null);
    assert.equal(getShopperPersona('all'), null);
  });

  await t.test('6. getPersonaImpactSummary calculates dynamic counts without hardcoding', () => {
    const mockReview = {
      findings: [
        { id: 'DF-02', title: 'Allergen Declaration Almonds', status: 'match', rule: { field: 'allergen' } },
        { id: 'DF-03', title: 'May Contain Tree Nuts Advisory', status: 'review', rule: { field: 'precautionary_allergen' } },
        { id: 'DF-05', title: 'Vegan Claim vs Honey', status: 'issue', rule: { field: 'claims.vegan' } },
        { id: 'DF-04', title: 'No Added Sugar Claim', status: 'issue', rule: { field: 'claims.sugar' } },
        { id: 'DF-08', title: 'Net Quantity 16.9 oz', status: 'match', rule: { field: 'net_quantity' } }
      ]
    };

    const nutSummary = getPersonaImpactSummary(mockReview, 'nut-allergy');
    assert.equal(nutSummary.totalRelevant, 2, '2 relevant checks for Nut Allergy');
    assert.equal(nutSummary.issues, 0);
    assert.equal(nutSummary.needsReview, 1);
    assert.equal(nutSummary.matches, 1);

    const veganSummary = getPersonaImpactSummary(mockReview, 'vegan');
    assert.equal(veganSummary.totalRelevant, 1);
    assert.equal(veganSummary.issues, 1);

    const sugarSummary = getPersonaImpactSummary(mockReview, 'sugar-watcher');
    assert.equal(sugarSummary.totalRelevant, 1);
    assert.equal(sugarSummary.issues, 1);
  });
});
