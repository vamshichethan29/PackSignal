/**
 * PackSignal — Phase 6A: 3-Second Glance Saliency Unit Tests
 * Asserts feature-based attention proxy calculations, spatial intersection with mandatory items,
 * and enforcement of scientific disclaimers rejecting fabricated scanpath claims.
 *
 * (tests/glance-saliency.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateBoxOverlap,
  computeVisualSaliencyAnalysis,
  DEFAULT_PACKAGING_SALIENT_REGIONS
} from '../lib/shopper/visual-saliency.mjs';

test('3-Second Glance Visual Saliency Model', async (t) => {
  await t.test('1. calculateBoxOverlap accurately computes 2D intersection over area', () => {
    const boxA = { x: 0.1, y: 0.1, width: 0.4, height: 0.4 }; // Area = 0.16
    const boxB = { x: 0.3, y: 0.1, width: 0.4, height: 0.4 }; // Intersects x: [0.3, 0.5], y: [0.1, 0.5] -> Area = 0.2 * 0.4 = 0.08
    const overlap = calculateBoxOverlap(boxA, boxB);
    assert.equal(overlap, 0.5); // 0.08 / 0.16 = 0.50
  });

  await t.test('2. Non-intersecting boxes return exactly 0.0 overlap', () => {
    const boxA = { x: 0.0, y: 0.0, width: 0.2, height: 0.2 };
    const boxB = { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };
    assert.equal(calculateBoxOverlap(boxA, boxB), 0.0);
  });

  await t.test('3. Computes spatial overlap between mandatory items and salient regions', () => {
    const mandatory = [
      {
        requirementId: 'req-brand-hero',
        name: 'Brand Identity',
        actualTextGeometry: { x: 0.15, y: 0.10, width: 0.70, height: 0.20 }
      },
      {
        requirementId: 'req-quiet-body',
        name: 'Ingredients Footnote',
        actualTextGeometry: { x: 0.08, y: 0.60, width: 0.84, height: 0.20 }
      }
    ];

    const result = computeVisualSaliencyAnalysis({
      mandatoryItems: mandatory,
      salientRegions: DEFAULT_PACKAGING_SALIENT_REGIONS
    });

    assert.equal(result.isAttentionProxy, true);
    assert.equal(result.mandatoryItemOverlaps.length, 2);

    const hero = result.mandatoryItemOverlaps.find((m) => m.requirementId === 'req-brand-hero');
    const body = result.mandatoryItemOverlaps.find((m) => m.requirementId === 'req-quiet-body');

    assert.equal(hero.attentionCategory, 'HIGH_PREDICTED_ATTENTION');
    assert.ok(hero.predictedSaliencyScore >= 0.8);
    assert.equal(body.attentionCategory, 'QUIET_ZONE');
  });

  await t.test('4. Enforces prominent disclaimers rejecting actual eye-tracking claims', () => {
    const result = computeVisualSaliencyAnalysis();
    assert.ok(result.disclaimer.includes('attention proxy'));
    assert.ok(result.disclaimer.includes('Does not measure actual human eye movements'));
    assert.ok(result.limitations.some((l) => l.includes('not represent empirical human eye-tracking')));
  });
});
