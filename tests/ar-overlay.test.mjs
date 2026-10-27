/**
 * @file tests/ar-overlay.test.mjs
 * 
 * Verifies Phase 10B Red-Pen Overlay Generation:
 * - Transparent alpha channel SVG generation per panel
 * - Distinct styling for confirmed findings (red wobble) vs. missing declarations (amber Ghost Box)
 * - Source evidence details retrieval for interactive hotspots
 * - Viewport bounds and registration transform preservation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePanelOverlaySvg,
  getFindingDetailsForHotspot,
} from '../lib/ar/red-pen-assets.mjs';

test('1. Transparent SVG overlay generated per panel with correct dimensions and alpha channel', () => {
  const frontSvg = generatePanelOverlaySvg('front', { width: 1000, height: 1500 });
  assert.ok(frontSvg.startsWith('<svg'), 'Must produce SVG markup');
  assert.ok(frontSvg.includes('viewBox="0 0 1000 1500"'));
  assert.ok(!frontSvg.includes('<rect width="1000" height="1500" fill="white"'), 'Must have transparent background (no opaque fill)');
  assert.ok(frontSvg.includes('class="ar-hotspot'), 'Must contain clickable hotspot hit areas');
});

test('2. Front panel overlay includes Honey Prominence finding with red wobble brackets', () => {
  const frontSvg = generatePanelOverlaySvg('front');
  assert.ok(frontSvg.includes('f-honey-claim'), 'Contains f-honey-claim');
  assert.ok(frontSvg.includes('Honey Prominence Claim vs Formulation'), 'Contains label');
  assert.ok(frontSvg.includes('stroke="#ef4444"'), 'Red stroke for open issue');
  assert.ok(frontSvg.includes('stroke-dasharray="10 5"'), 'Hand-drawn wobble dashed stroke');
});

test('3. Missing net quantity declaration rendered as dashed amber Ghost Box', () => {
  const frontSvg = generatePanelOverlaySvg('front');
  assert.ok(frontSvg.includes('f-missing-net-fl-oz'), 'Contains f-missing-net-fl-oz');
  assert.ok(frontSvg.includes('stroke="#f59e0b"'), 'Amber stroke for proposed placement ghost box');
  assert.ok(frontSvg.includes('stroke-dasharray="8 4"'), 'Dashed bounding box');
  assert.ok(frontSvg.includes('Proposed placement / missing item'), 'Explicitly labeled as proposed placement');
});

test('4. Right nutrition panel overlay highlights Sodium Daily Value math defect', () => {
  const rightSvg = generatePanelOverlaySvg('right');
  assert.ok(rightSvg.includes('f-nutrition-facts-sugar'), 'Contains nutrition issue ID');
  assert.ok(rightSvg.includes('Added Sugar &amp; Sodium DV Math Error'));
});

test('5. Back and left panel overlays contain correct canonical annotations', () => {
  const backSvg = generatePanelOverlaySvg('back');
  assert.ok(backSvg.includes('f-cooling-storage'));
  assert.ok(backSvg.includes('f-allergen-contains-wheat'));

  const leftSvg = generatePanelOverlaySvg('left');
  assert.ok(leftSvg.includes('f-manufacturer-address'));
  assert.ok(leftSvg.includes('Manufacturer City/State Missing Street Address'));
});

test('6. Finding hotspot details API returns comprehensive source-backed evidence', () => {
  const honeyDetails = getFindingDetailsForHotspot('f-honey-claim');
  assert.ok(honeyDetails, 'Must return finding details');
  assert.equal(honeyDetails.findingId, 'f-honey-claim');
  assert.equal(honeyDetails.status, 'ISSUE');
  assert.equal(honeyDetails.panel, 'front');
  assert.ok(honeyDetails.observedText.includes('Dancing Fish Honey Berry Crunch'));
  assert.ok(honeyDetails.expectedValue.includes('1% formulation ratio'));
  assert.ok(honeyDetails.ruleId.startsWith('US_FDA_21CFR102_5'));
  assert.ok(honeyDetails.evidenceRef.includes('DancingFish_Granola_Berry_US_Carton.pdf'));
  assert.equal(honeyDetails.reviewerDepartment, 'Legal & Regulatory');
});

test('7. Unknown finding ID returns null safely without throwing', () => {
  const missing = getFindingDetailsForHotspot('f-nonexistent-999');
  assert.equal(missing, null);
});
