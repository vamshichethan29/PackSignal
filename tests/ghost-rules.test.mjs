import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACEMENT_RULES, getPlacementRule } from '../lib/placement-rules.mjs';
import { calculatePanelArea } from '../lib/placement-geometry.mjs';

test('1. US Net Quantity placement rule references 21 CFR §101.7', () => {
  const rule = getPlacementRule('NET_QUANTITY', 'US');
  assert.ok(rule);
  assert.equal(rule.jurisdiction, 'US');
  assert.equal(rule.regionConstraint, 'bottom_30_percent');
  assert.deepEqual(rule.requiredPanelRoles, ['principal_display_panel']);
  assert.match(rule.sourceCitation, /21 CFR §101\.7/);
  assert.ok(rule.sourceURL.includes('ecfr.gov'));
});

test('2. US Net Quantity defines small-PDP exception for area <= 5.0 sq in', () => {
  const rule = getPlacementRule('NET_QUANTITY', 'US');
  const exception = (rule.exceptions || []).find(e => e.id === 'SMALL_PDP_EXCEPTION');
  assert.ok(exception, 'Small PDP exception must be declared');
  assert.equal(exception.alternateConstraint, 'anywhere_on_panel');

  // Verify condition function
  assert.equal(exception.condition({ areaSqInches: 4.8 }), true);
  assert.equal(exception.condition({ areaSqInches: 5.0 }), true);
  assert.equal(exception.condition({ areaSqInches: 5.2 }), false);
});

test('3. US Manufacturer Address allows both PDP and Information Panel under 21 CFR §101.5', () => {
  const rule = getPlacementRule('MANUFACTURER_ADDRESS', 'US');
  assert.ok(rule);
  assert.ok(rule.allowedPanelRoles.includes('principal_display_panel'));
  assert.ok(rule.allowedPanelRoles.includes('information_panel'));
  assert.equal(rule.preferredPanelRole, 'information_panel');
  assert.match(rule.sourceCitation, /21 CFR §101\.5/);
});

test('4. India FSSAI Vegetarian logo requires PDP top corner placement', () => {
  const rule = getPlacementRule('VEG_MARK', 'IN');
  assert.ok(rule);
  assert.equal(rule.jurisdiction, 'IN');
  assert.equal(rule.regionConstraint, 'top_corner_region');
  assert.deepEqual(rule.requiredPanelRoles, ['principal_display_panel']);
  assert.match(rule.authority, /FSS/i);
});

test('5. India FSSAI MRP & License declaration requires Information Panel lower region', () => {
  const rule = getPlacementRule('MRP_AND_LICENSE', 'IN');
  assert.ok(rule);
  assert.equal(rule.jurisdiction, 'IN');
  assert.equal(rule.regionConstraint, 'panel_lower_region');
});

test('6. Type size guidance tiers are defined based on physical panel area', () => {
  const rule = getPlacementRule('NET_QUANTITY', 'US');
  assert.ok(Array.isArray(rule.typeSizeTiers));
  assert.ok(rule.typeSizeTiers.length >= 4);

  // 1/16 in for <= 5 sq in
  assert.equal(rule.typeSizeTiers[0].minHeightPt, 4.5);
  // 1/8 in for 5 to 25 sq in
  assert.equal(rule.typeSizeTiers[1].minHeightPt, 9.0);
});

test('7. Physical panel area calculator accurately identifies small PDP threshold', () => {
  const letterPage = { width: 612, height: 792 }; // 8.5 x 11 in
  // Very small panel: 1.5 in x 2 in = 3.0 sq in
  // 1.5 / 8.5 = ~0.1765 width, 2 / 11 = ~0.1818 height
  const smallBox = [0.1, 0.1, 0.2765, 0.2818];
  const areaSmall = calculatePanelArea(smallBox, letterPage);
  assert.ok(areaSmall.areaSqInches <= 5.0);
  assert.equal(areaSmall.isSmallPdp, true);

  // Standard PDP: 4.25 in x 5.5 in = 23.375 sq in
  const mediumBox = [0.25, 0.25, 0.75, 0.75];
  const areaMed = calculatePanelArea(mediumBox, letterPage);
  assert.ok(areaMed.areaSqInches > 5.0);
  assert.equal(areaMed.isSmallPdp, false);
});
