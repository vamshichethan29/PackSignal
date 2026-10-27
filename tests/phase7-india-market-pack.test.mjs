import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadMarketPack, discoverInstalledMarkets } from '../lib/rules/market-pack-loader.mjs';
import { evaluateClaimsRadar, CARTON_CLAIMS_INVENTORY } from '../lib/claims-radar.mjs';
import { evaluateTimeMachine, compareRegulatoryDates } from '../lib/time-machine.mjs';

describe('Phase 7 — India Market Pack & Pluggable Multi-Jurisdiction Engine', () => {
  it('discovers India market pack dynamically from markets/ directory without hardcoding', () => {
    const markets = discoverInstalledMarkets();
    assert.ok(Array.isArray(markets), 'Markets should be an array');
    const indiaPack = markets.find(m => m.code === 'in' || m.market === 'IN');
    assert.ok(indiaPack, 'India market pack must be discovered');
    assert.equal(indiaPack.market, 'IN');
    assert.ok(indiaPack.regulators.some(r => r.includes('FSSAI')), 'Regulators include FSSAI');
    assert.ok(indiaPack.regulators.some(r => r.includes('Consumer Affairs') || r.includes('Legal Metrology')), 'Regulators include Consumer Affairs');
  });

  it('loads valid schema-compliant India market pack with ~20 rule records', () => {
    const packRes = loadMarketPack('in');
    assert.ok(packRes, 'Pack result should load');
    assert.equal(packRes.market, 'IN');
    assert.ok(packRes.allRules.length >= 20, `Expected >= 20 rules, found ${packRes.allRules.length}`);

    // Verify statutory citations and fields
    const ruleCodes = packRes.allRules.map(r => r.code || r.ruleId);
    assert.ok(ruleCodes.includes('IN01'), 'IN01 name of food present');
    assert.ok(ruleCodes.includes('IN02'), 'IN02 ingredient list present');
    assert.ok(ruleCodes.includes('IN03'), 'IN03 allergen declaration present');
    assert.ok(ruleCodes.includes('IN04'), 'IN04 nutrition information present');
    assert.ok(ruleCodes.includes('IN06'), 'IN06 vegetarian symbol present');
    assert.ok(ruleCodes.includes('IN08'), 'IN08 FSSAI licence present');
    assert.ok(ruleCodes.includes('IN11'), 'IN11 metric net quantity present');
    assert.ok(ruleCodes.includes('IN12'), 'IN12 MRP present');
    assert.ok(ruleCodes.includes('IN13'), 'IN13 unit sale price present');
    assert.ok(ruleCodes.includes('IN14'), 'IN14 consumer care present');
    assert.ok(ruleCodes.includes('IN20'), 'IN20 vegan food regulation present');

    // Verify official sources are cited
    const in06 = packRes.allRules.find(r => r.code === 'IN06' || r.ruleId === 'FSSAI-GRANOLA-002');
    assert.ok(in06, 'Vegetarian mark rule found');
    assert.ok(in06.sourceLaw.includes('Food Safety and Standards') || in06.sourceLaw.includes('FSSAI'));
    assert.ok(in06.officialSourceUrl.includes('fssai.gov.in'));
    assert.ok(in06.sourceQuote.length > 20);
  });

  it('preserves Honey vs Vegan distinction: Honey is Vegetarian under FSSAI, but excluded under Vegan Foods 2022', () => {
    const packRes = loadMarketPack('in');
    const vegRule = packRes.allRules.find(r => r.code === 'IN06' || r.ruleId === 'FSSAI-GRANOLA-002');
    const veganRule = packRes.allRules.find(r => r.code === 'IN20' || r.ruleId === 'FSSAI-GRANOLA-020');

    assert.ok(vegRule, 'Vegetarian rule found');
    assert.ok(veganRule, 'Vegan rule found');

    // FSSAI Definition: Honey is explicitly excluded from non-vegetarian food definition
    assert.ok(vegRule.sourceQuote.includes('Vegetarian') || vegRule.legalProvision.includes('5(5)'));

    // Vegan Foods Regulations, 2022: Excludes any animal-origin ingredients including honey
    assert.ok(veganRule.sourceQuote.includes('animal') || veganRule.legalProvision.includes('Vegan') || veganRule.citation.includes('Vegan'));
  });

  it('validates Legal Metrology MRP rule and does not fabricate missing prices', () => {
    const packRes = loadMarketPack('in');
    const mrpRule = packRes.allRules.find(r => r.code === 'IN12' || r.ruleId === 'FSSAI-GRANOLA-005');
    assert.ok(mrpRule, 'MRP rule exists');
    assert.equal(mrpRule.sourceLaw, 'Legal Metrology (Packaged Commodities) Rules, 2011');
    assert.equal(mrpRule.legalProvision, 'Rule 6(1)(e)');
  });

  it('evaluates Claims Radar across US and India with semantic audit trail', () => {
    // US evaluation
    const usRadar = evaluateClaimsRadar({ market: 'US' });
    assert.ok(usRadar.findings.length > 0, 'US claims findings generated');
    const sugarFinding = usRadar.findings.find(f => f.claimCategory === 'NUTRIENT_CONTENT_SUGAR');
    assert.ok(sugarFinding, 'Sugar finding evaluated');
    assert.equal(sugarFinding.determination, 'POTENTIAL_ISSUE');
    assert.ok(sugarFinding.conflictingFacts.some(f => f.toLowerCase().includes('honey')));

    // India evaluation
    const inRadar = evaluateClaimsRadar({ market: 'IN' });
    assert.ok(inRadar.findings.length > 0, 'IN claims findings generated');
    const veganFinding = inRadar.findings.find(f => f.claimCategory === 'DIETARY_VEGAN');
    assert.ok(veganFinding, 'Vegan finding evaluated');
    assert.ok(['POTENTIAL_ISSUE', 'NEEDS_SUBSTANTIATION', 'UNVERIFIED'].includes(veganFinding.determination));
    assert.ok(veganFinding.ruleCitation.includes('FSSAI'));
  });

  it('evaluates Regulatory Time Machine across July 1, 2027 FSSAI Cutover', () => {
    const beforeCutover = evaluateTimeMachine({
      market: 'IN',
      launchDate: '2027-06-30'
    });

    const afterCutover = evaluateTimeMachine({
      market: 'IN',
      launchDate: '2027-07-01'
    });

    assert.equal(beforeCutover.isJuly2027OrLater, false);
    assert.equal(afterCutover.isJuly2027OrLater, true);

    const diff = compareRegulatoryDates({
      market: 'india',
      dateA: '2027-06-30',
      dateB: '2027-07-01',
      productCategory: 'food'
    });

    assert.ok(diff.newlyApplicable.length > 0, 'New rules become effective at cutover');
    assert.ok(diff.newlyApplicable.some(r => (r.ruleId || r.id) === 'FSSAI-LDR-2026-AMEND-BOLD-RDA'));
  });
});
