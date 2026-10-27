import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification, getDancingFish16Checks } from '../lib/organizer-verification.mjs';
import {
  screenNoAddedSugarClaim,
  screenDeclaredAddedSugars,
  screenVeganClaim,
  evaluateAllergenDisclosure
} from '../lib/claims/added-sugar-screen.mjs';
import { parseIngredientList } from '../lib/ingredient-validator.mjs';

test('DF-02: Ingredient list difference identifies 4 artwork-only items and source duplicate', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const ingrCheck = suite.checks.find(c => c.canonicalId === 'DF-02');
  assert.ok(ingrCheck);
  assert.equal(ingrCheck.sourceCell, 'B26');
  assert.equal(ingrCheck.status, 'issue');
  assert.equal(ingrCheck.subassertions?.length, 2);

  const subA = ingrCheck.subassertions.find(s => s.subId === 'DF-02-A');
  assert.ok(subA);
  assert.match(subA.observed, /Walnuts/i);
  assert.match(subA.observed, /Flax Seeds/i);
  assert.match(subA.observed, /Dried Strawberries/i);
  assert.match(subA.observed, /Pumpkin Seeds/i);

  const subB = ingrCheck.subassertions.find(s => s.subId === 'DF-02-B');
  assert.ok(subB);
  assert.match(subB.observed, /Sunflower Seeds/i);
});

test('DF-03: Allergen disclosure applies FALCPA rules and does not falsely mandate a Contains box', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const allergenCheck = suite.checks.find(c => c.canonicalId === 'DF-03');
  assert.ok(allergenCheck);
  assert.equal(allergenCheck.status, 'review'); // Review, not illegal defect
  assert.equal(allergenCheck.department, 'LEGAL');
  assert.match(allergenCheck.limitations, /21 U\.S\.C\. 343\(w\)/i);
  assert.match(allergenCheck.limitations, /separate "Contains:" is not universally mandatory/i);

  // Pure evaluator check
  const parsed = parseIngredientList('Whole Grain Rolled Oats, Almonds, Pecans, Walnuts');
  const evalResult = evaluateAllergenDisclosure(parsed, 'ALLERGEN INFORMATION: May Contain Nuts');
  assert.equal(evalResult.status, 'review');
  assert.equal(evalResult.findingStatus, 'ALLERGEN_DECLARATION_REVIEW');
  assert.equal(evalResult.compliantWithFalcpa, true);
});

test('DF-04: No Added Sugar marketing claim and 0g Added Sugars declaration are evaluated with distinct regulatory criteria', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const df04 = suite.checks.find(c => c.canonicalId === 'DF-04');
  assert.ok(df04);
  assert.equal(df04.status, 'issue');
  assert.equal(df04.subassertions?.length, 2);

  const parsed = parseIngredientList('Honey (1%), Coconut Sugar, Cane Sugar');
  const claimRes = screenNoAddedSugarClaim('NO ADDED SUGAR', parsed);
  assert.equal(claimRes.findingStatus, 'CLAIM_FORMULATION_CONFLICT');
  assert.equal(claimRes.criteriaCheck['21_CFR_101_60_c_2'], false);

  const zeroRes = screenDeclaredAddedSugars('Incl. 0g Added Sugars', parsed);
  assert.equal(zeroRes.findingStatus, 'ADDED_SUGAR_VALUE_QUESTION');
});

test('DF-05: Vegan claim contradiction flags honey and cholesterol without fabricating a certified vegan logo', () => {
  const result = runOrganizerVerification();
  const suite = getDancingFish16Checks({ verificationResult: result });

  const veganCheck = suite.checks.find(c => c.canonicalId === 'DF-05');
  assert.ok(veganCheck);
  assert.equal(veganCheck.status, 'review');
  assert.match(veganCheck.observedValue, /Honey in recipe/i);
  assert.match(veganCheck.observedValue, /45mg cholesterol/i);

  // Pure evaluator
  const parsed = parseIngredientList('Rolled Oats, Honey (1%), Coconut Oil');
  const veganRes = screenVeganClaim('Suitable for Vegans', parsed, { cholesterol: 45 });
  assert.equal(veganRes.status, 'review');
  assert.equal(veganRes.findingStatus, 'VEGAN_CLAIM_SUBSTANTIATION_REVIEW');
  assert.equal(veganRes.honeyPresent, true);
});
