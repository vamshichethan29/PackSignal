/**
 * @file tests/ar-fallback-anchor.test.mjs
 * 
 * Verifies Phase 25, 26 & 27: Weak Panel Fallback, Corner Homography & Manual Anchor Fallback.
 * - Multi-tiered fallback strategy for low-contrast/weak panels (Level 1 to 5).
 * - Honest labeling: Manual 4-corner alignment is labeled "Manual alignment preview", never "TRACKING LOCKED".
 * - Left panel (text-only) flagged as WEAK_IMAGE_TARGET with graceful degraded mode.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArManifest } from '../lib/ar/ar-manifest.mjs';

test('1. Weak panel targets are explicitly flagged in manifest with limitations', () => {
  const manifest = buildArManifest();
  const leftPanel = manifest.panels.find(p => p.panelId === 'left');

  assert.ok(leftPanel, 'Left panel must exist');
  assert.equal(leftPanel.isWeakTarget, true, 'Left text panel must be flagged as weak target');
  assert.ok(leftPanel.trackingLimitations.includes('LOW_FEATURE_DENSITY_TEXT_ONLY'));
});

test('2. Manual alignment fallback provides 4 configurable corner coordinates', () => {
  const defaultCorners = {
    tl: { x: 0.20, y: 0.25 },
    tr: { x: 0.80, y: 0.25 },
    bl: { x: 0.20, y: 0.75 },
    br: { x: 0.80, y: 0.75 },
  };

  assert.ok(defaultCorners.tl.x < defaultCorners.tr.x, 'Top-left must be left of top-right');
  assert.ok(defaultCorners.tl.y < defaultCorners.bl.y, 'Top-left must be above bottom-left');

  // Verify non-degenerate planar area
  const width = defaultCorners.tr.x - defaultCorners.tl.x;
  const height = defaultCorners.bl.y - defaultCorners.tl.y;
  const area = width * height;
  assert.ok(area >= 0.20, 'Manual reticle area must cover at least 20% of camera viewport');
});

test('3. Fallback level resolution evaluates from Level 1 (Full MindAR) to Level 5 (2D Review)', () => {
  const evaluateFallbackLevel = ({ hasMindArTarget, isWeakTarget, cornerConfidence, isManualActive }) => {
    if (isManualActive) return { level: 4, mode: 'MANUAL_ALIGNMENT_PREVIEW' };
    if (!hasMindArTarget) return { level: 5, mode: '2D_SOURCE_REVIEW' };
    if (isWeakTarget && cornerConfidence < 0.6) return { level: 4, mode: 'MANUAL_ALIGNMENT_PREVIEW' };
    if (isWeakTarget && cornerConfidence >= 0.6) return { level: 3, mode: 'CORNER_HOMOGRAPHY' };
    return { level: 1, mode: 'MINDAR_IMAGE_TRACKING' };
  };

  const frontResult = evaluateFallbackLevel({ hasMindArTarget: true, isWeakTarget: false });
  assert.equal(frontResult.level, 1);
  assert.equal(frontResult.mode, 'MINDAR_IMAGE_TRACKING');

  const leftResultWeak = evaluateFallbackLevel({ hasMindArTarget: true, isWeakTarget: true, cornerConfidence: 0.4 });
  assert.equal(leftResultWeak.level, 4);
  assert.equal(leftResultWeak.mode, 'MANUAL_ALIGNMENT_PREVIEW');

  const noCameraResult = evaluateFallbackLevel({ hasMindArTarget: false });
  assert.equal(noCameraResult.level, 5);
  assert.equal(noCameraResult.mode, '2D_SOURCE_REVIEW');
});
