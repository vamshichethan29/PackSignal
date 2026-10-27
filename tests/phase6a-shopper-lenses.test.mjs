import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOPPER_PERSONAS,
  SHELF_READABILITY_ITEMS,
  identifyFirstUnreadableElement,
  GLANCE_HEATMAP_DATA,
  CONTRAST_AND_ACCESSIBILITY_DATA,
  getShopperLensesData,
  ESTIMATE_DISCLAIMER
} from '../lib/shopper-lenses.mjs';

test('1. Shopper personas provide audited one-line verdicts across health and ethical dimensions', () => {
  assert.ok(SHOPPER_PERSONAS.length >= 4, 'Must provide at least 4 core shopper personas');

  for (const persona of SHOPPER_PERSONAS) {
    assert.ok(persona.name, 'Persona must have a human name');
    assert.ok(persona.personaTitle, 'Persona must have a title');
    assert.ok(persona.oneLineVerdict, 'Persona must have an audited one-line verdict');
    assert.ok(persona.oneLineVerdict.length > 20, 'Verdict must be substantive');
    assert.ok(persona.shopperJourney, 'Must have realistic shopper experience description');
    assert.ok(persona.sources && persona.sources.length > 0, 'Must link to verbatim source files');
  }
});

test('2. Nut-allergy persona shows the "may contain" problem on the real carton with its sources', () => {
  const nutPersona = SHOPPER_PERSONAS.find(p => p.id === 'persona-nut-allergy');
  assert.ok(nutPersona, 'Nut allergy persona must exist');
  assert.equal(nutPersona.status, 'UNSAFE');
  
  // Audited one-line verdict must state the problem clearly
  assert.ok(nutPersona.oneLineVerdict.includes('May contain tree nuts') || nutPersona.oneLineVerdict.includes('walnut'));
  
  // Must cite FALCPA
  assert.ok(nutPersona.ruleCitation.includes('FALCPA') || nutPersona.ruleCitation.includes('343(w)'));
  
  // Must link to exact verbatim quote and sources
  const cartonSource = nutPersona.sources.find(s => s.file === 'DancingFish_Granola_Berry_US_Carton.pdf');
  assert.ok(cartonSource, 'Must cite carton PDF source');
  assert.equal(cartonSource.location, 'Back panel (Allergen Statement)');
  assert.equal(cartonSource.quote, 'Contains: Almonds. May contain tree nuts.');

  const formulaSource = nutPersona.sources.find(s => s.file === 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
  assert.ok(formulaSource, 'Must cite content sheet master formula source');
});

test('3. Vegan persona flags conflict between Certified Vegan mark and honey ingredient', () => {
  const veganPersona = SHOPPER_PERSONAS.find(p => p.id === 'persona-vegan');
  assert.ok(veganPersona, 'Vegan persona must exist');
  assert.equal(veganPersona.status, 'CONFLICT');
  assert.ok(veganPersona.oneLineVerdict.toLowerCase().includes('honey'));
  assert.ok(veganPersona.oneLineVerdict.toLowerCase().includes('vegan'));

  // Verifies sources for both mark and honey
  assert.ok(veganPersona.sources.some(s => s.quote.toLowerCase().includes('honey')));
  assert.ok(veganPersona.sources.some(s => s.quote.toLowerCase().includes('vegan')));
});

test('4. Sugar-watching persona flags "NO ADDED SUGAR" claim contradiction with 21 CFR 101.60', () => {
  const sugarPersona = SHOPPER_PERSONAS.find(p => p.id === 'persona-watching-sugar');
  assert.ok(sugarPersona, 'Sugar-watching persona must exist');
  assert.equal(sugarPersona.status, 'MISLEADING');
  assert.ok(sugarPersona.oneLineVerdict.includes('NO ADDED SUGAR'));
  assert.ok(sugarPersona.ruleCitation.includes('21 CFR 101.60'));
});

test('5. Shelf-distance test names the first required item to become unreadable and shows its numbers', () => {
  const dropoutAnalysis = identifyFirstUnreadableElement(0.6); // At arm's length (0.6m)

  // Must identify the first dropout
  assert.ok(dropoutAnalysis.firstDropoutElement, 'Must name the first required item to drop out');
  assert.ok(
    dropoutAnalysis.firstDropoutElement.includes('Responsible Business') ||
    dropoutAnalysis.firstDropoutElement.includes('Address') ||
    dropoutAnalysis.firstDropoutElement.includes('Ingredient'),
    `Expected business address or ingredient list as first dropout, got ${dropoutAnalysis.firstDropoutElement}`
  );

  // Must show its numbers
  assert.ok(dropoutAnalysis.firstDropoutFontPt > 0, 'Must show font size in points');
  assert.ok(dropoutAnalysis.firstDropoutCapHeightMm > 0, 'Must show cap height in mm');
  assert.ok(dropoutAnalysis.firstDropoutMaxDistanceM > 0, 'Must show max readable distance in meters');
  assert.ok(dropoutAnalysis.explanation.includes(String(dropoutAnalysis.firstDropoutFontPt)), 'Explanation must include font points');

  // Must identify unreadable items at arm's length
  assert.ok(dropoutAnalysis.unreadableCountAtDistance >= 2, 'At 0.6m, at least 2 small print items should be unreadable');
});

test('6. Every estimate in shelf readability and glance simulation is explicitly labelled as an estimate', () => {
  assert.ok(ESTIMATE_DISCLAIMER.includes('ESTIMATE'), 'Disclaimer must contain the word ESTIMATE');

  // Check shelf readability items
  for (const item of SHELF_READABILITY_ITEMS) {
    assert.ok(item.estimateLabel, `Item ${item.name} must carry estimateLabel`);
    assert.ok(item.estimateLabel.includes('ESTIMATE'));
  }

  // Check dropout analysis output
  const dropout = identifyFirstUnreadableElement(1.5);
  assert.equal(dropout.isEstimate, true);
  assert.ok(dropout.estimateLabel.includes('ESTIMATE'));

  // Check glance heatmap data
  assert.equal(GLANCE_HEATMAP_DATA.isEstimate, true);
  assert.ok(GLANCE_HEATMAP_DATA.estimateLabel.includes('ESTIMATE'));

  // Check complete shopper payload
  const fullData = getShopperLensesData(0.6);
  assert.equal(fullData.shelfReadability.isEstimate, true);
  assert.ok(fullData.shelfReadability.estimateDisclaimer.includes('ESTIMATE'));
});

test('7. 3-second glance heatmap tracks sequential attention share and notes back panel blindness', () => {
  assert.equal(GLANCE_HEATMAP_DATA.durationSeconds, 3.0);
  assert.equal(GLANCE_HEATMAP_DATA.gazeSequence.length, 4);

  // Check sequential phases
  assert.ok(GLANCE_HEATMAP_DATA.gazeSequence[0].focusTarget.includes('Logo'));
  assert.ok(GLANCE_HEATMAP_DATA.gazeSequence[1].focusTarget.includes('Photography') || GLANCE_HEATMAP_DATA.gazeSequence[1].focusTarget.includes('Bowl'));
  assert.ok(GLANCE_HEATMAP_DATA.gazeSequence[2].focusTarget.includes('SUGAR'));

  // Back panel receives 0% attention in first 3 seconds
  assert.equal(GLANCE_HEATMAP_DATA.backPanelAttentionDuringGlance.attentionSharePercent, 0);
  assert.ok(GLANCE_HEATMAP_DATA.backPanelAttentionDuringGlance.observation.includes('0%'));
});

test('8. Accessibility module evaluates color-blindness modes and flags WCAG contrast failures', () => {
  assert.equal(CONTRAST_AND_ACCESSIBILITY_DATA.colorBlindnessModes.length, 5);

  const failCase = CONTRAST_AND_ACCESSIBILITY_DATA.contrastChecks.find(c => c.status === 'FAIL');
  assert.ok(failCase, 'Must identify at least one contrast failure');
  assert.ok(failCase.contrastRatio < 4.5, 'Failed contrast must be below 4.5:1');

  const passCase = CONTRAST_AND_ACCESSIBILITY_DATA.contrastChecks.find(c => c.status === 'PASS');
  assert.ok(passCase, 'Must identify passing contrast cases');
  assert.ok(passCase.contrastRatio >= 4.5);
});

test('9. Before / after wipe presents original hazards and senior reviewer remediations', () => {
  const data = getShopperLensesData();
  const wipe = data.beforeAfterWipe;

  assert.ok(wipe.beforeState.hazards.length >= 4, 'Before state must list packaging hazards');
  assert.ok(wipe.afterState.remediations.length >= 4, 'After state must list audited remediations');
  assert.ok(wipe.beforeState.hazards.some(h => h.includes('NO ADDED SUGAR')));
  assert.ok(wipe.beforeState.hazards.some(h => h.includes('May contain tree nuts')));
  assert.ok(wipe.afterState.remediations.some(r => r.includes('21 CFR 101.60')));
});
