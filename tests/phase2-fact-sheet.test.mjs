import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFactSheet,
  getOrganizerFactSheet,
  areQuantitiesEquivalent,
  verifyQuote
} from '../lib/fact-sheet.mjs';

describe('Phase 2 — Facts and the quote check (15–16 Oct)', () => {

  test('samples produce facts with sources (each fact lists file, and panel or cell)', () => {
    const factSheet = getOrganizerFactSheet();
    assert.equal(factSheet.status, 'SUCCESS');
    assert.ok(factSheet.allFacts.length > 30, 'Should have extracted facts');

    for (const fact of factSheet.allFacts) {
      assert.ok(fact.source, `Fact ${fact.id} must have a source object`);
      assert.ok(fact.source.file, `Fact ${fact.id} must specify source file`);
      assert.ok(
        Boolean(fact.source.panel || fact.source.cell),
        `Fact ${fact.id} (${fact.label}) must show either its panel or cell coordinate`
      );
      assert.ok(
        ['PROVEN', 'AI_SUGGESTED', 'CONFLICT'].includes(fact.state),
        `Fact state must be one of the three states, got ${fact.state}`
      );
    }
  });

  test('value conflict: Honey 9% vs 1% becomes a conflict', () => {
    const factSheet = getOrganizerFactSheet();
    const honeyConflict = factSheet.conflicts.find(c => c.field === 'honey_percentage' || c.conflictId.includes('HONEY'));

    assert.ok(honeyConflict, 'Honey 9% vs 1% must be detected as a conflict');
    assert.equal(honeyConflict.conflictType, 'VALUE_CONFLICT');
    assert.equal(honeyConflict.specValue, '9%');
    assert.equal(honeyConflict.artworkValue, '1%');
  });

  test('value conflict: Carbohydrate 15 g vs 66 g becomes a conflict', () => {
    const factSheet = getOrganizerFactSheet();
    const carbConflict = factSheet.conflicts.find(c => c.field === 'total_carbohydrate' || c.conflictId.includes('CARBOHYDRATE'));

    assert.ok(carbConflict, 'Carbohydrate 15 g vs 66 g must be detected as a conflict');
    assert.equal(carbConflict.conflictType, 'VALUE_CONFLICT');
    assert.equal(carbConflict.specValue, '15g');
    assert.equal(carbConflict.artworkValue, '66g');
  });

  test('AI meaning conflict: Ingredient list differences become a conflict', () => {
    const factSheet = getOrganizerFactSheet();
    const ingConflict = factSheet.conflicts.find(c => c.field === 'ingredients' || c.conflictType === 'AI_MEANING_CONFLICT');

    assert.ok(ingConflict, 'Ingredient list differences must become a conflict');
    assert.equal(ingConflict.conflictType, 'AI_MEANING_CONFLICT');
    assert.ok(Array.isArray(ingConflict.unauthorizedAdditions), 'Must identify recipe additions');
    assert.ok(ingConflict.unauthorizedAdditions.length > 0, 'Must detect unauthorized ingredients (e.g. Walnuts, Flax Seeds)');
  });

  test('vision on rendered page: Certified Vegan mark is found', () => {
    const factSheet = getOrganizerFactSheet();
    assert.equal(factSheet.summary.certifiedVeganFound, true, 'Certified Vegan mark must be found');

    const veganMark = factSheet.visionMarks.find(vm => vm.mark === 'Certified Vegan');
    assert.ok(veganMark, 'Certified Vegan mark must be recorded in visionMarks');
    assert.equal(veganMark.status, 'DETECTED');
    assert.ok(veganMark.panel.includes('Front panel'), 'Mark location should be on Front panel (PDP)');
    assert.ok(Array.isArray(veganMark.box) && veganMark.box.length === 4, 'Mark must have bounding box');
  });

  test('unit conversion: 480 g vs 16.9 oz does NOT become a conflict', () => {
    // Direct unit conversion check
    assert.equal(areQuantitiesEquivalent('480 g', '16.9 oz'), true, '480 g and 16.9 oz must be commercially equivalent');
    assert.equal(areQuantitiesEquivalent('480g', '16.9oz'), true, 'No whitespace formatting variation');

    const factSheet = getOrganizerFactSheet();
    assert.equal(factSheet.summary.unitEquivalence480gVs16_9oz, true);

    const netQtyComparison = factSheet.comparisons.find(c => c.field === 'net_quantity');
    assert.ok(netQtyComparison, 'Must have net quantity comparison record');
    assert.equal(netQtyComparison.isConflict, false, '480 g vs 16.9 oz must NOT be a conflict');
  });

  test('sheet notes like "assumed" or "confirm" make a fact AI-suggested', () => {
    const factSheet = getOrganizerFactSheet();
    const suggestedFacts = factSheet.specFacts.filter(f => f.state === 'AI_SUGGESTED');

    assert.ok(suggestedFacts.length >= 3, 'Expected at least 3 AI-suggested facts based on provisional notes');
    for (const f of suggestedFacts) {
      assert.ok(
        /assumed|confirm|verify|provisional/i.test(f.notes || ''),
        `Fact ${f.label} marked AI_SUGGESTED must have a note containing assumed/confirm/verify`
      );
    }
  });

  test('quote check: verifies verbatim quotations and rejects altered numbers', () => {
    const source = 'INGREDIENTS: Organic Wholegrain Oat Flakes (79%), Almonds, Pecans, Honey (9%)';

    const validQuote = verifyQuote('Organic Wholegrain Oat Flakes (79%)', source);
    assert.equal(validQuote.verified, true);

    const hallucinatedQuote = verifyQuote('Organic Wholegrain Oat Flakes (95%)', source);
    assert.equal(hallucinatedQuote.verified, false, 'Altered numbers must fail quote verification');
  });

  test('caching by file fingerprint (SHA-256): deterministic second call', () => {
    const res1 = getOrganizerFactSheet();
    const res2 = getOrganizerFactSheet();

    assert.ok(res1.fingerprint, 'Fingerprint must be present');
    assert.equal(res1.fingerprint, res2.fingerprint, 'Fingerprints must match');
    assert.equal(res1.conflicts.length, res2.conflicts.length);
  });
});
