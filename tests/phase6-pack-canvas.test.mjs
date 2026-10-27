import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACK_PANELS,
  LOCKED_BRAND_ZONES,
  REGULATORY_MINIMUMS,
  estimateBlockDimensions,
  getCorrectedUSPackBlocks,
  EXTRA_REQUIRED_ITEMS,
  calculateSpaceMeters,
  generateSuggestedFixes,
  applySuggestedFix,
  packBlocksOntoPanels,
  evaluateDielineLayerAvailability,
  getPackCanvasState
} from '../lib/pack-canvas.mjs';

test('1. Panel sizes extracted from dieline Cut, Crease, and Artwork layers match Berry Crunch carton', () => {
  assert.equal(PACK_PANELS.length, 6, 'Carton dieline must provide 6 panels');
  
  const back = PACK_PANELS.find(p => p.id === 'panel-back');
  const right = PACK_PANELS.find(p => p.id === 'panel-right');
  const front = PACK_PANELS.find(p => p.id === 'panel-front');
  const left = PACK_PANELS.find(p => p.id === 'panel-left');
  
  assert.ok(back && right && front && left, 'Must have Back, Right, Front PDP, and Left panels');
  assert.equal(back.widthMm, 139.35);
  assert.equal(back.heightMm, 160.16);
  assert.equal(front.widthMm, 142.88);
  assert.equal(left.widthMm, 78.32);
  assert.equal(right.widthMm, 77.61);

  // Check layers assignment
  assert.ok(back.layers.includes('Cut'));
  assert.ok(back.layers.includes('Crease'));
  assert.ok(back.layers.includes('Artwork-Back'));
});

test('2. Locked zones protect existing brand art from obstruction', () => {
  assert.ok(LOCKED_BRAND_ZONES.length >= 4, 'Must have at least 4 locked brand zones');

  const logoLock = LOCKED_BRAND_ZONES.find(z => z.id === 'lock-pdp-logo');
  const heroLock = LOCKED_BRAND_ZONES.find(z => z.id === 'lock-pdp-hero-photo');
  const storyLock = LOCKED_BRAND_ZONES.find(z => z.id === 'lock-back-story-art');
  const veganLock = LOCKED_BRAND_ZONES.find(z => z.id === 'lock-right-vegan-mark');

  assert.ok(logoLock, 'Brand logo must be locked');
  assert.equal(logoLock.panelId, 'panel-front');
  assert.ok(heroLock, 'Granola bowl hero art must be locked on PDP');
  assert.ok(storyLock, 'Illustrated story header must be locked on Back panel');
  assert.ok(veganLock, 'Certified Vegan mark must be locked on Right panel');
  assert.ok(veganLock.widthMm >= 18.0, 'Vegan mark must respect 18mm minimum');
});

test('3. Dynamic block dimensions calculate from market regulatory minimums and text length', () => {
  const longText = 'Whole grain rolled oats, Pacific Northwest clover honey (9%), expeller-pressed sunflower oil, dried Washington cranberries, dried wild blueberries, California almonds, sea salt.';
  const blockDim = estimateBlockDimensions(longText, 125.0, 8.0);

  assert.ok(blockDim.heightMm >= 12.0, `Calculated block height (${blockDim.heightMm}mm) should be >= 12mm`);
  assert.ok(blockDim.lineCount >= 2, 'Should wrap into at least 2 lines');
  assert.equal(blockDim.widthMm, 125.0);

  // Regulatory minimum assertions
  assert.equal(REGULATORY_MINIMUMS.ingredientList.minFontPt, 6.0, 'FDA minimum x-height requires 6pt');
  assert.ok(REGULATORY_MINIMUMS.netQuantity.minFontPt >= 13.5, 'PDP net quantity requires min 13.5pt for 25-100 sq in');
});

test('4. Corrected US content places on real Berry Crunch panels with space meters (No Overflow)', () => {
  const state = getPackCanvasState({ overflowScenario: false });

  assert.equal(state.status, 'SUCCESS');
  assert.equal(state.hasOverflow, false, 'Standard corrected pack must not overflow');
  assert.equal(state.overflowPanelId, null);

  // Check space meters on all panels
  const backMeter = state.spaceMeters.find(m => m.panelId === 'panel-back');
  const frontMeter = state.spaceMeters.find(m => m.panelId === 'panel-front');
  const leftMeter = state.spaceMeters.find(m => m.panelId === 'panel-left');
  const rightMeter = state.spaceMeters.find(m => m.panelId === 'panel-right');

  assert.ok(backMeter.utilizationPercent <= 100, `Back panel utilization (${backMeter.utilizationPercent}%) must be <= 100%`);
  assert.ok(frontMeter.utilizationPercent <= 100, `Front panel utilization (${frontMeter.utilizationPercent}%) must be <= 100%`);
  assert.ok(leftMeter.utilizationPercent <= 100, `Left panel utilization (${leftMeter.utilizationPercent}%) must be <= 100%`);
  assert.ok(rightMeter.utilizationPercent <= 100, `Right panel utilization (${rightMeter.utilizationPercent}%) must be <= 100%`);

  assert.equal(backMeter.status, 'OPTIMAL');
  assert.ok(backMeter.freeAreaMm2 > 0, 'Back panel must have free area');
});

test('5. Test pack with extra required items causes back panel overflow', () => {
  const overflowState = getPackCanvasState({ overflowScenario: true });

  assert.equal(overflowState.hasOverflow, true, 'Test pack with extra items must trigger overflow');
  assert.equal(overflowState.overflowPanelId, 'panel-back', 'Overflow must occur on Back panel');

  const backMeter = overflowState.spaceMeters.find(m => m.panelId === 'panel-back');
  assert.equal(backMeter.status, 'OVERFLOW');
  assert.ok(backMeter.utilizationPercent > 100, `Utilization (${backMeter.utilizationPercent}%) must exceed 100%`);
  assert.ok(backMeter.freeAreaMm2 < 0 || backMeter.verticalOverflowMm > 0, 'Must record negative free space or vertical spill');
});

test('6. Overflow generates actionable suggested fixes with regulatory rationales', () => {
  const overflowState = getPackCanvasState({ overflowScenario: true });
  assert.ok(overflowState.suggestedFixes.length >= 2, 'Must generate at least 2 suggested fixes');

  const multiColFix = overflowState.suggestedFixes.find(f => f.action === 'split-columns');
  const condenseFix = overflowState.suggestedFixes.find(f => f.action === 'condense-font');
  const relocateFix = overflowState.suggestedFixes.find(f => f.action === 'relocate-block');

  assert.ok(multiColFix, 'Must suggest multi-column layout');
  assert.ok(condenseFix, 'Must suggest typography condensing');
  assert.ok(multiColFix.estimatedAreaSavedMm2 > 0, 'Must state estimated area saved in mm²');
  assert.ok(multiColFix.regulatoryImpact.includes('21 CFR'), 'Must state regulatory impact');
});

test('7. Applying suggested fix clears the overflow and brings back panel into compliance', () => {
  // Test Fix A: Condense typography
  const fixedWithCondense = getPackCanvasState({
    overflowScenario: true,
    activeFix: 'fix-condense-typography'
  });
  const backMeterCondense = fixedWithCondense.spaceMeters.find(m => m.panelId === 'panel-back');
  assert.ok(backMeterCondense.utilizationPercent < 100, `Condense fix should bring utilization below 100%, got ${backMeterCondense.utilizationPercent}%`);

  // Test Fix B: Relocate block to Right panel
  const fixedWithRelocate = getPackCanvasState({
    overflowScenario: true,
    activeFix: 'fix-relocate-panel'
  });
  const backMeterRelocate = fixedWithRelocate.spaceMeters.find(m => m.panelId === 'panel-back');
  assert.ok(backMeterRelocate.utilizationPercent < 100, `Relocate fix should bring utilization below 100%, got ${backMeterRelocate.utilizationPercent}%`);
});

test('8. Pack size becomes a question for files without dieline layers', () => {
  // Case A: File has Cut and Crease layers
  const withLayers = evaluateDielineLayerAvailability(['Cut', 'Crease', 'Artwork']);
  assert.equal(withLayers.hasDielineLayers, true);
  assert.equal(withLayers.packSizeQuestion, null);

  // Case B: File is a flat PDF or scan without dieline layers
  const withoutLayers = evaluateDielineLayerAvailability(['Page 1', 'Text', 'Background']);
  assert.equal(withoutLayers.hasDielineLayers, false);
  assert.ok(withoutLayers.missingLayers.includes('Cut'));
  assert.ok(withoutLayers.missingLayers.includes('Crease'));

  assert.ok(withoutLayers.packSizeQuestion, 'Must generate guided question for pack size');
  assert.equal(withoutLayers.packSizeQuestion.id, 'Q-PACK-DIMENSIONS');
  assert.ok(withoutLayers.packSizeQuestion.question.includes('dimensions'));
  assert.ok(withoutLayers.packSizeQuestion.options.length >= 3, 'Must provide dimension presets');
  assert.ok(withoutLayers.packSizeQuestion.options[0].lengthMm > 0);
});
