import test from 'node:test';
import assert from 'node:assert/strict';

import {
  lookupPlacementRule,
  getAllPlacementRules,
  PLACEMENT_AUTHORITIES,
  LEGAL_STATUSES,
  REGION_TYPES,
  STATUTORY_PLACEMENT_REGISTRY,
} from '../lib/regulatory/placement-rules.mjs';

import {
  isVoluntaryCertification,
  evaluateMissingDeclaration,
  DECLARATION_EVALUATION_STATES,
} from '../lib/regulatory/missing-declarations.mjs';

test('Ghost Regulatory Rules & Placement Registry Suite', async (t) => {

  await t.test('1. Verified statutory rule registry contains authoritative US, IN, CA standards', () => {
    const rules = getAllPlacementRules();
    assert.ok(rules.length >= 7, 'Must have at least 7 statutory placement rules');
    
    const usNetQty = rules.find(r => r.ruleId === 'US-FDA-NET-QTY-01');
    assert.ok(usNetQty);
    assert.equal(usNetQty.placementAuthority, PLACEMENT_AUTHORITIES.VERIFIED_STATUTORY);
    assert.match(usNetQty.regulatorySource, /21 CFR §101\.105/i);
    assert.equal(usNetQty.jurisdiction, 'US');

    const inVeg = rules.find(r => r.ruleId === 'IN-FSSAI-VEG-01');
    assert.ok(inVeg);
    assert.equal(inVeg.jurisdiction, 'IN');
    assert.match(inVeg.regulatorySource, /FSSAI/i);

    const caBilingual = rules.find(r => r.ruleId === 'CA-FDR-BILINGUAL-01');
    assert.ok(caBilingual);
    assert.equal(caBilingual.jurisdiction, 'CA');
    assert.match(caBilingual.regulatorySource, /B\.01\.012/i);
  });

  await t.test('2. Correct market selection routes rules by jurisdiction', () => {
    const usRule = lookupPlacementRule({ declarationType: 'NET_QUANTITY', jurisdiction: 'US' });
    assert.equal(usRule.jurisdiction, 'US');
    assert.equal(usRule.declarationType, 'NET_QUANTITY');

    const inRule = lookupPlacementRule({ declarationType: 'VEG_MARK', jurisdiction: 'IN' });
    assert.equal(inRule.jurisdiction, 'IN');
    assert.equal(inRule.declarationType, 'VEG_MARK');

    const caRule = lookupPlacementRule({ declarationType: 'MULTILINGUAL_REQUIREMENT', jurisdiction: 'CA' });
    assert.equal(caRule.jurisdiction, 'CA');
    assert.equal(caRule.declarationType, 'MULTILINGUAL_REQUIREMENT');
  });

  await t.test('3. Regulatory Time Machine: Future effective date classifies rule as PROPOSED_FUTURE', () => {
    // Lookup with launch date prior to rule effective date
    const futureRule = lookupPlacementRule({
      declarationType: 'NET_QUANTITY',
      jurisdiction: 'US',
      launchDate: '1970-01-01', // Before 1973 FDA effective date
    });

    assert.ok(futureRule);
    assert.equal(futureRule.isProposedFutureRule, true);
    assert.equal(futureRule.activeLegalStatus, LEGAL_STATUSES.PROPOSED_FUTURE);

    // Current launch date
    const currentRule = lookupPlacementRule({
      declarationType: 'NET_QUANTITY',
      jurisdiction: 'US',
      launchDate: '2026-10-26',
    });
    assert.equal(currentRule.isProposedFutureRule, false);
    assert.equal(currentRule.activeLegalStatus, LEGAL_STATUSES.ENFORCEABLE_CURRENT);
  });

  await t.test('4. Future proposed rule is excluded from creating enforceable statutory ghosts', () => {
    const finding = {
      id: 'f-future-mandate',
      field: 'net_quantity',
      title: 'Net Quantity',
      status: 'issue',
      observed: 'Not detected',
      expected: '16.9 oz (480 g)',
    };

    const review = {
      market: 'us',
      launchDate: '1970-01-01',
      options: { completeArtwork: true },
    };

    const evalResult = evaluateMissingDeclaration({
      finding,
      review,
      launchDate: '1970-01-01',
    });

    assert.equal(evalResult.eligible, false);
    assert.equal(evalResult.state, DECLARATION_EVALUATION_STATES.FUTURE_RULE_PENDING);
    assert.match(evalResult.reason, /proposed or becomes effective/i);
  });

  await t.test('5. Statutory rule exceptions are registered and preserved', () => {
    const netQtyRule = lookupPlacementRule({ declarationType: 'NET_QUANTITY', jurisdiction: 'US' });
    assert.ok(Array.isArray(netQtyRule.exceptions));
    const smallPdpEx = netQtyRule.exceptions.find(e => e.id === 'SMALL_PDP_EXCEPTION');
    assert.ok(smallPdpEx);
    assert.equal(smallPdpEx.citation, '21 CFR §101.7(f)');

    // Test condition
    assert.equal(smallPdpEx.condition({ areaSqInches: 4.8 }), true);
    assert.equal(smallPdpEx.condition({ areaSqInches: 5.2 }), false);
  });

  await t.test('6. Voluntary certification marks do NOT generate statutory missing ghosts', () => {
    assert.equal(isVoluntaryCertification('organic_claim', 'Certified Organic USDA Logo'), true);
    assert.equal(isVoluntaryCertification('kosher_symbol', 'OU Kosher Pareve Mark'), true);
    assert.equal(isVoluntaryCertification('halal', 'Halal Certification Seal'), true);
    assert.equal(isVoluntaryCertification('recycling', 'How2Recycle Store Drop-off Icon'), true);
    assert.equal(isVoluntaryCertification('net_quantity', 'Net Quantity of Contents'), false);

    const organicFinding = {
      id: 'f-org-seal',
      field: 'organic_claim',
      title: 'Missing USDA Organic Seal',
      status: 'issue',
      observed: 'Not found',
      expected: 'USDA Organic Seal',
    };

    const evalResult = evaluateMissingDeclaration({
      finding: organicFinding,
      review: { market: 'us', options: { completeArtwork: true } },
    });

    assert.equal(evalResult.eligible, false);
    assert.equal(evalResult.state, DECLARATION_EVALUATION_STATES.VOLUNTARY_CERTIFICATION);
    assert.equal(evalResult.legalStatus, LEGAL_STATUSES.VOLUNTARY_CERTIFICATION);
  });

  await t.test('7. Product type applicability: Shelf-stable ambient food exempt from storage mandate', () => {
    const storageRule = lookupPlacementRule({ declarationType: 'STORAGE_INSTRUCTIONS', jurisdiction: 'US' });
    assert.ok(storageRule);
    const shelfStableEx = storageRule.exceptions.find(e => e.id === 'SHELF_STABLE_EXCEPTION');
    assert.ok(shelfStableEx);

    assert.equal(shelfStableEx.condition({ isShelfStable: true }), true);
    assert.equal(shelfStableEx.condition({ isShelfStable: false }), false);
  });

  await t.test('8. FDA 21 CFR §101.105(h) type size tiers match statutory area brackets', () => {
    const netQtyRule = lookupPlacementRule({ declarationType: 'NET_QUANTITY', jurisdiction: 'US' });
    const tiers = netQtyRule.minimumTypeRequirements;
    assert.ok(Array.isArray(tiers));
    assert.equal(tiers.length, 5);

    // Tier 1: <= 5 sq in -> 1/16 in (1.588 mm, 4.5 pt)
    assert.equal(tiers[0].maxAreaSqIn, 5);
    assert.equal(tiers[0].minHeightPt, 4.5);
    assert.equal(tiers[0].minHeightMm, 1.588);

    // Tier 2: 5 < area <= 25 sq in -> 1/8 in (3.175 mm, 9 pt)
    assert.equal(tiers[1].maxAreaSqIn, 25);
    assert.equal(tiers[1].minHeightPt, 9.0);
    assert.equal(tiers[1].minHeightMm, 3.175);

    // Tier 3: 25 < area <= 100 sq in -> 3/16 in (4.763 mm, 13.5 pt)
    assert.equal(tiers[2].maxAreaSqIn, 100);
    assert.equal(tiers[2].minHeightPt, 13.5);

    // Tier 4: 100 < area <= 400 sq in -> 1/4 in (6.35 mm, 18 pt)
    assert.equal(tiers[3].maxAreaSqIn, 400);
    assert.equal(tiers[3].minHeightPt, 18.0);

    // Tier 5: > 400 sq in -> 1/2 in (12.7 mm, 36 pt)
    assert.equal(tiers[4].maxAreaSqIn, Infinity);
    assert.equal(tiers[4].minHeightPt, 36.0);
  });

  await t.test('9. Manufacturer / Distributor rule permits PDP or Information Panel alternatives', () => {
    const mfrRule = lookupPlacementRule({ declarationType: 'MANUFACTURER_ADDRESS', jurisdiction: 'US' });
    assert.ok(mfrRule);
    assert.deepEqual(mfrRule.permittedPanelRoles, ['principal_display_panel', 'information_panel']);
    assert.equal(mfrRule.placementConstraints.allowsAlternativePanels, true);
    assert.match(mfrRule.sourceQuotation, /information panel or principal display panel/i);
  });
});
