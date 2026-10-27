/**
 * PackSignal — Phase 6A: Low-Vision Profile Unit Tests
 * Asserts honest simulation boundaries, explicit labeling of computational estimates,
 * and integration with physical typography measurements.
 *
 * (tests/low-vision-profile.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateLowVisionPersona,
  OFFICIAL_SAMPLE_REQUIRED_ITEMS
} from '../lib/shopper/experience-engine.mjs';

import {
  VISUAL_PROFILES,
  calculateAngularSize,
  evaluateReadabilityCategory
} from '../lib/shopper/shelf-readability.mjs';

test('Low-Vision Profile — Simulation & Accessibility Model', async (t) => {
  const lowVisionPersona = evaluateLowVisionPersona({
    requiredItems: OFFICIAL_SAMPLE_REQUIRED_ITEMS,
    distanceCm: 60
  });

  await t.test('1. Strictly labels output as illustrative simulation', () => {
    assert.ok(lowVisionPersona.limitations.some((l) => l.toLowerCase().includes('illustrative')));
    assert.ok(lowVisionPersona.limitations.some((l) => l.toLowerCase().includes('does not represent all visual impairments')));
  });

  await t.test('2. Disclaims clinical diagnosis and medical validation', () => {
    assert.ok(lowVisionPersona.limitations.some((l) => l.toLowerCase().includes('clinical diagnosis')));
  });

  await t.test('3. Applies elevated angular threshold for reduced visual acuity', () => {
    const stdProfile = VISUAL_PROFILES.STANDARD_20_20;
    const lvProfile = VISUAL_PROFILES.LOW_VISION_ILLUSTRATIVE;

    assert.equal(stdProfile.thresholdArcmin, 5.0);
    assert.equal(lvProfile.thresholdArcmin, 8.5);
    assert.ok(lvProfile.thresholdArcmin > stdProfile.thresholdArcmin, 'Low vision threshold is higher');
  });

  await t.test('4. Required declaration (1.8mm at 60cm) is near/below threshold under low-vision profile', () => {
    const angular = calculateAngularSize(1.8, 60); // ~10.3 arcmin
    const cat = evaluateReadabilityCategory(angular.arcminutes, VISUAL_PROFILES.LOW_VISION_ILLUSTRATIVE);
    // At 10.3 arcmin, threshold is 8.5, comfortable is 12.0 -> NEAR_MODELED_THRESHOLD
    assert.equal(cat, 'NEAR_MODELED_THRESHOLD');
  });
});
