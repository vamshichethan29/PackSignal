import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRequirementsAndQuestions } from '../lib/requirements-engine.mjs';
import { loadMarketPack } from '../lib/market-loader.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('Phase 3 — Rules, requirements and questions (16 Oct)', () => {

  test('loads US market pack from markets/us/ with ~20 FDA rules for granola', async () => {
    const marketPack = await loadMarketPack('us');
    assert.equal(marketPack.market, 'US');
    assert.ok(marketPack.rules.length >= 18 && marketPack.rules.length <= 25, `Expected ~20 FDA rule records, got ${marketPack.rules.length}`);
    assert.ok(marketPack.dailyValues, 'Must contain reference Daily Values');
    assert.ok(marketPack.allergens, 'Must contain FDA allergens');
    assert.ok(marketPack.claims, 'Must contain FDA claims');
  });

  test('flags the added-sugar claim on Esko samples', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.flags.addedSugarClaim, true, 'Added-sugar claim must be flagged');

    const addedSugarReq = res.requirements.find(r => r.ruleId === 'FDA-GRANOLA-018');
    assert.ok(addedSugarReq, 'Requirement FDA-GRANOLA-018 must be present');
    assert.equal(addedSugarReq.status, 'FAIL');
    assert.ok(addedSugarReq.explanation.toLowerCase().includes('added sugar'));
  });

  test('flags the tree-nut "may contain" misbranding problem', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.equal(res.flags.treeNutMayContainProblem, true, 'Tree-nut "may contain" problem must be flagged');

    const treeNutReq = res.requirements.find(r => r.ruleId === 'FDA-GRANOLA-016');
    assert.ok(treeNutReq);
    assert.equal(treeNutReq.status, 'FAIL');
    assert.ok(treeNutReq.explanation.includes('Almonds'));
  });

  test('flags the wrong daily values on the US Nutrition Facts panel', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.equal(res.flags.wrongDailyValues, true, 'Wrong daily values must be flagged');

    const dvReq = res.requirements.find(r => r.ruleId === 'FDA-GRANOLA-005_013');
    assert.ok(dvReq);
    assert.equal(dvReq.status, 'FAIL');
    assert.ok(dvReq.mismatches.length >= 8, 'Expected multiple nutrient % DV mismatches (e.g. fat, saturates, sodium)');
  });

  test('flags the calorie macronutrient math mismatch', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.equal(res.flags.calorieMath, true, 'Calorie math must be flagged');

    const calReq = res.requirements.find(r => r.ruleId === 'FDA-GRANOLA-004');
    assert.ok(calReq);
    assert.equal(calReq.status, 'FAIL');
    assert.equal(calReq.declaredCalories, 166);
    assert.equal(calReq.calculatedCalories, 535);
  });

  test('flags the serving-size math mismatch (8 * 85g = 680g != 480g)', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.equal(res.flags.servingSizeMath, true, 'Serving-size math must be flagged');

    const servingReq = res.requirements.find(r => r.ruleId === 'FDA-GRANOLA-003');
    assert.ok(servingReq);
    assert.equal(servingReq.status, 'FAIL');
    assert.equal(servingReq.servingsPerContainer, 8);
    assert.equal(servingReq.servingSizeGrams, 85);
    assert.equal(servingReq.calculatedNetWeight, 680);
    assert.equal(servingReq.declaredNetWeightGrams, 480);
  });

  test('barcode check digit passes for UPC 120000000036', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.equal(res.flags.barcodeValid, true, 'Barcode check digit must pass');
    assert.equal(res.summary.barcodePassed, true);
  });

  test('generates at most 10 prioritized questions ranked by impact with AI wording & reason', () => {
    const res = evaluateRequirementsAndQuestions();
    assert.ok(res.questions.length <= 10, `Must have at most 10 questions, got ${res.questions.length}`);
    assert.ok(res.questions.length >= 8, 'Should have rich set of questions');

    // Check impact ranking
    const ranks = res.questions.map(q => q.rank);
    for (let i = 0; i < ranks.length - 1; i++) {
      assert.ok(ranks[i] <= ranks[i + 1], 'Questions must be sorted by priority rank');
    }

    // Verify AI wording and reason
    for (const q of res.questions) {
      assert.ok(q.question && q.question.length > 15, `Question ${q.id} must have detailed question text`);
      assert.ok(q.reason && q.reason.length > 10, `Question ${q.id} must have explicit reasoning`);
    }
  });

  test('design keep/change questions cover brand assets and feed the brief section', () => {
    const res = evaluateRequirementsAndQuestions();
    const designQs = res.questions.filter(q => q.category === 'DESIGN_ASSET');

    assert.ok(designQs.length >= 4, 'Should include design keep/change questions');
    const coveredAssets = designQs.map(q => q.brandAsset);

    assert.ok(coveredAssets.includes('logo'), 'Must cover logo');
    assert.ok(coveredAssets.includes('product_photo'), 'Must cover product photo');
    assert.ok(coveredAssets.includes('colours'), 'Must cover colours');
    assert.ok(coveredAssets.includes('tagline'), 'Must cover tagline');
    assert.ok(coveredAssets.includes('marks'), 'Must cover certification marks');

    assert.ok(res.briefFeeder && res.briefFeeder.keep_change_add_remove, 'Must feed creative brief keep/change/add/remove');
  });

  test('engine code contains no hardcoded US-specific reference values (all live in markets/us/)', () => {
    const engineCodePath = join(root, 'lib', 'requirements-engine.mjs');
    assert.ok(existsSync(engineCodePath));

    const content = readFileSync(engineCodePath, 'utf8');

    // Check that US statutory values (e.g. FDA 2300mg sodium, 78g fat, 275g carb, 28g fiber) are NOT hardcoded in engine
    assert.ok(!content.includes('2300'), '2300 mg sodium DV must not be hardcoded in engine');
    assert.ok(!content.includes('275'), '275 g carb DV must not be hardcoded in engine');

    // Check that markets/us/ directory exists and contains the values
    const usDvPath = join(root, 'markets', 'us', 'daily-values.json');
    assert.ok(existsSync(usDvPath), 'markets/us/daily-values.json must exist');
    const usDv = JSON.parse(readFileSync(usDvPath, 'utf8'));
    assert.equal(usDv.referenceDailyValues.sodium.amount, 2300);
    assert.equal(usDv.referenceDailyValues.total_carbohydrate.amount, 275);
  });
});
