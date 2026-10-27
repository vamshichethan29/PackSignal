import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMarketPack, loadMarketPackSync } from '../lib/market-loader.mjs';
import { getPackCanvasState } from '../lib/pack-canvas.mjs';
import { evaluateClaimsRadar, CARTON_CLAIMS_INVENTORY } from '../lib/claims-radar.mjs';
import { evaluateTimeMachine } from '../lib/time-machine.mjs';
import { getRequirementsMapGraph, answerRequirementsQuestion } from '../lib/requirements-map.mjs';

test('1. Adding markets/in/ needs no code change: dynamically loads ~20 FSSAI & Legal Metrology rules', async () => {
  // Asynchronous dynamic loader
  const inPack = await loadMarketPack('in');
  assert.equal(inPack.market, 'IN');
  assert.ok(inPack.rules.length >= 18 && inPack.rules.length <= 25, `Expected ~20 rules, got ${inPack.rules.length}`);
  assert.ok(inPack.dailyValues, 'Must contain ICMR-NIN reference daily values');
  assert.ok(inPack.vegMark, 'Must contain FSSAI green veg dot geometry');
  assert.ok(inPack.mandatoryElements.length >= 6, 'Must contain mandatory packaging elements');

  // Synchronous loader fallback
  const inSync = loadMarketPackSync('in');
  assert.equal(inSync.market, 'IN');
  assert.equal(inSync.rules.length, inPack.rules.length);
});

test('2. Switching to India adds veg mark, MRP, unit sale price, FSSAI licence, consumer care, and removes oz quantity', () => {
  const inState = getPackCanvasState({ market: 'IN' });

  // 1. Adds Green Veg Mark to PDP
  const vegMark = inState.blocks.find(b => b.id.includes('veg-mark'));
  assert.ok(vegMark, 'Must add FSSAI Green Veg Dot to PDP');
  assert.equal(vegMark.panelId, 'panel-front');
  assert.ok(vegMark.citation.includes('2.2.2.4'));

  // 2. Adds MRP declaration to Back panel
  const mrpBlock = inState.blocks.find(b => b.id.includes('mrp'));
  assert.ok(mrpBlock, 'Must add Maximum Retail Price');
  assert.equal(mrpBlock.panelId, 'panel-back');
  assert.ok(mrpBlock.text.includes('₹') || mrpBlock.text.includes('MRP'));
  assert.ok(mrpBlock.citation.includes('6(1)(e)'));

  // 3. Adds Unit Sale Price (USP)
  const uspBlock = inState.blocks.find(b => b.id.includes('usp'));
  assert.ok(uspBlock, 'Must add Unit Sale Price');
  assert.ok(uspBlock.citation.includes('Legal Metrology'));

  // 4. Adds 14-digit FSSAI License Number & Logo
  const fssaiBlock = inState.blocks.find(b => b.id.includes('fssai'));
  assert.ok(fssaiBlock, 'Must add 14-digit FSSAI license');
  assert.ok(fssaiBlock.text.includes('10012011000142') || fssaiBlock.text.includes('Lic. No.'));

  // 5. Adds Consumer Care details
  const careBlock = inState.blocks.find(b => b.id.includes('care'));
  assert.ok(careBlock, 'Must add Consumer Care grievance mechanism');
  assert.ok(careBlock.citation.includes('6(1)(f)'));

  // 6. Removes US Customary dual declaration (16.9 oz) from Net Quantity
  const netQty = inState.blocks.find(b => b.category === 'NET_QUANTITY');
  assert.ok(netQty, 'Must have Net Quantity block');
  assert.equal(netQty.text, 'NET WT 480 g', 'Must declare metric grams only (no oz)');
  assert.ok(!netQty.text.includes('16.9 oz'), 'Must remove US customary ounces');
  assert.ok(!netQty.text.includes('oz'), 'Must not contain oz');
});

test('3. The back panel overflows on the real dieline when switched to India', () => {
  const inState = getPackCanvasState({ market: 'IN' });

  assert.equal(inState.hasOverflow, true, 'India pack must trigger overflow');
  assert.equal(inState.overflowPanelId, 'panel-back', 'Overflow must occur on Back panel');

  const backMeter = inState.spaceMeters.find(m => m.panelId === 'panel-back');
  assert.ok(backMeter.hasOverflow, 'Back panel space meter must record overflow');
  assert.ok(backMeter.verticalOverflowMm > 0, `Must record positive vertical spill outside safe boundaries (got ${backMeter.verticalOverflowMm}mm)`);
  assert.ok(backMeter.blockCount >= 9, 'Must stack all required informational blocks');
});

test('4. "No Added Sugar" and "Certified Vegan" are flagged in the US Claims Radar', () => {
  const usRadar = evaluateClaimsRadar({ market: 'US' });

  assert.equal(usRadar.market, 'US');
  assert.ok(usRadar.flaggedCount >= 2, 'Must flag at least 2 non-compliant claims in US');

  // "No Added Sugar" check
  const sugarClaim = usRadar.findings.find(f => f.claimText === 'NO ADDED SUGAR');
  assert.ok(sugarClaim, 'NO ADDED SUGAR claim must be found');
  assert.equal(sugarClaim.status, 'FLAGGED');
  assert.equal(sugarClaim.severity, 'CRITICAL');
  assert.ok(sugarClaim.ruleCitation.includes('21 CFR 101.60(c)(2)'));
  assert.ok(sugarClaim.violationReason.toLowerCase().includes('honey'));

  // "Certified Vegan" check
  const veganClaim = usRadar.findings.find(f => f.claimText === 'Certified Vegan');
  assert.ok(veganClaim, 'Certified Vegan claim must be found');
  assert.equal(veganClaim.status, 'FLAGGED');
  assert.ok(veganClaim.violationReason.toLowerCase().includes('honey'));
  assert.ok(veganClaim.suggestedFix.toLowerCase().includes('agave') || veganClaim.suggestedFix.toLowerCase().includes('remove'));
});

test('5. A July 2027 date in India shows the amendment rules (FSSAI 2027 FOPNL Star Rating)', () => {
  // A. Oct 2026: FOPNL amendment is not yet active
  const timeMachine2026 = evaluateTimeMachine({ market: 'IN', launchDate: '2026-10-18' });
  assert.equal(timeMachine2026.isJuly2027OrLater, false);
  assert.equal(timeMachine2026.fopnlAmendmentActive, false);

  // B. July 2027: FOPNL amendment rule becomes legally active
  const timeMachine2027 = evaluateTimeMachine({ market: 'IN', launchDate: '2027-07-15' });
  assert.equal(timeMachine2027.isJuly2027OrLater, true);
  assert.equal(timeMachine2027.fopnlAmendmentActive, true);
  assert.ok(timeMachine2027.activeRules.some(r => r.id === 'FSSAI-GRANOLA-020-AMENDMENT-2027'));

  const fopnlRule = timeMachine2027.activeRules.find(r => r.id === 'FSSAI-GRANOLA-020-AMENDMENT-2027');
  assert.equal(fopnlRule.effectiveDate, '2027-07-01');
  assert.ok(fopnlRule.citation.includes('2027'));
  assert.ok(fopnlRule.name.includes('FOPNL') || fopnlRule.name.includes('Indian Nutrition Rating'));
});

test('6. Requirements Map renders evidence board and answering a question turns nodes green', () => {
  // Initial state: Questions and dependent rules are RED or AMBER
  const initialMap = getRequirementsMapGraph({ market: 'US', answeredQuestionIds: [] });
  assert.ok(initialMap.nodes.length >= 12, 'Must contain rule, fact, question, and deliverable nodes');
  assert.ok(initialMap.edges.length >= 8, 'Must contain dependency edges');
  
  const initialSugarRule = initialMap.nodes.find(n => n.id === 'node-rule-sugar-claim');
  const initialSugarQ = initialMap.nodes.find(n => n.id === 'node-q-sugar-claim');
  const initialSugarDeliv = initialMap.nodes.find(n => n.id === 'node-deliv-pdp-art');
  
  assert.equal(initialSugarRule.status, 'RED');
  assert.equal(initialSugarQ.status, 'AMBER');
  assert.equal(initialSugarDeliv.status, 'AMBER');

  // Answering the question
  const answered = answerRequirementsQuestion('Q-CLAIM-SUGAR', []);
  const updatedMap = getRequirementsMapGraph({ market: 'US', answeredQuestionIds: answered });

  const updatedSugarRule = updatedMap.nodes.find(n => n.id === 'node-rule-sugar-claim');
  const updatedSugarQ = updatedMap.nodes.find(n => n.id === 'node-q-sugar-claim');
  const updatedSugarDeliv = updatedMap.nodes.find(n => n.id === 'node-deliv-pdp-art');

  assert.equal(updatedSugarRule.status, 'GREEN', 'Rule node must turn GREEN');
  assert.equal(updatedSugarQ.status, 'GREEN', 'Question node must turn GREEN');
  assert.equal(updatedSugarDeliv.status, 'GREEN', 'Deliverable node must turn GREEN');
  assert.ok(updatedMap.stats.greenNodes > initialMap.stats.greenNodes);
});
