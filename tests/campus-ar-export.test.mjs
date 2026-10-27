import test from 'node:test';
import assert from 'node:assert/strict';
import { getMindArTargetConfig, generatePanelRedPenOverlay } from '../lib/campus/ar-targets.mjs';

test('Campus AR Export — MindAR Geometry Targets & Fallbacks', async () => {
  const config = getMindArTargetConfig('dancing-fish');
  assert.ok(config && typeof config === 'object', 'Must return config object');
  assert.ok(Array.isArray(config.targets), 'Must provide array of target panels');
  assert.ok(config.targets.length >= 4, 'Must define at least 4 carton faces');

  assert.equal(config.physicalCarton.width, 140, 'Width must match 140 mm physical carton geometry');
  assert.equal(config.physicalCarton.height, 210, 'Height must match 210 mm physical carton geometry');
  assert.equal(config.physicalCarton.depth, 60, 'Depth must match 60 mm physical carton geometry');

  const front = config.targets.find(t => t.face === 'front');
  assert.ok(front, 'Must include front target');
  assert.equal(front.widthMm, 140);
  assert.equal(front.heightMm, 210);

  // Verify SVG overlay generation for browser/AR preview
  const sampleFindings = [
    { id: 'f-net-qty', title: 'Net Quantity Dual Unit Omission', panel: 'front', status: 'issue', box: [0.15, 0.70, 0.40, 0.12] },
  ];
  const svgOverlay = generatePanelRedPenOverlay('front', sampleFindings);
  assert.match(svgOverlay, /<svg/, 'Overlay must generate valid SVG markup');
  assert.match(svgOverlay, /Net Quantity Dual Unit Omission/, 'Overlay must annotate offending claim');

  // Verify non-existent panel returns graceful fallback overlay
  const fallbackSvg = generatePanelRedPenOverlay('unknown_face', []);
  assert.match(fallbackSvg, /<svg/, 'Fallback panel must still return valid SVG');
});
