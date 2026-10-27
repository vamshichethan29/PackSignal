/**
 * @file tests/ar-market-switch.test.mjs
 * 
 * Verifies Phase 33: Multi-Market AR Switching (US FDA vs. India FSSAI).
 * - Precomputes market-specific review manifests and overlays.
 * - Switches market state without network AI calls.
 * - Prevents cross-contamination: India vegetarian mark does not appear in US review.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArManifest } from '../lib/ar/ar-manifest.mjs';

test('1. US manifest contains FDA statutory rules and US-specific findings', () => {
  const manifest = buildArManifest({ market: 'us' });
  assert.equal(manifest.market, 'us');

  const front = manifest.panels.find(p => p.panelId === 'front');
  assert.ok(front.findingIds.includes('f-honey-claim'));
  assert.ok(front.findingIds.includes('f-missing-net-fl-oz'));

  const fdaRulePresent = front.hotspots.some(h => h.ruleId.includes('US_FDA'));
  assert.ok(fdaRulePresent, 'Must cite US FDA regulations');

  const fssaiRulePresent = front.hotspots.some(h => h.ruleId.includes('FSSAI'));
  assert.equal(fssaiRulePresent, false, 'Must not cite FSSAI in US manifest');
});

test('2. India manifest contains FSSAI statutory rules and India-specific findings', () => {
  const manifest = buildArManifest({ market: 'india' });
  assert.equal(manifest.market, 'india');

  const front = manifest.panels.find(p => p.panelId === 'front');
  assert.ok(front.findingIds.includes('f-fssai-veg-logo'));

  const fssaiRulePresent = front.hotspots.some(h => h.ruleId.includes('FSSAI'));
  assert.ok(fssaiRulePresent, 'Must cite FSSAI regulations in India manifest');

  const missingNetFlOzPresent = front.findingIds.includes('f-missing-net-fl-oz');
  assert.equal(missingNetFlOzPresent, false, 'US-specific fl oz defect must not appear in India metric manifest');
});

test('3. Market switching maintains identical physical carton targets (140x210x60mm)', () => {
  const usManifest = buildArManifest({ market: 'us' });
  const inManifest = buildArManifest({ market: 'india' });

  // Physical target descriptor remains identical because the physical carton geometry is unchanged
  assert.equal(usManifest.targetFile, inManifest.targetFile);
  assert.equal(usManifest.targetFileSha256, inManifest.targetFileSha256);

  const usFront = usManifest.panels.find(p => p.panelId === 'front');
  const inFront = inManifest.panels.find(p => p.panelId === 'front');

  assert.equal(usFront.panelDimensionsMm.width, inFront.panelDimensionsMm.width);
  assert.equal(usFront.panelDimensionsMm.height, inFront.panelDimensionsMm.height);
});
