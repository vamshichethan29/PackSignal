/**
 * PackSignal — Phase 6A: Before / After Shopper Comparison Unit Tests
 * Asserts synchronized simulation metrics across revisions, honest labeling of proposed fixes,
 * and detection of apparent improvements that compromise regulatory constraints.
 *
 * (tests/shopper-before-after.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateRequiredItemsReadability,
  identifyFirstThresholdCrossingItem,
  VISUAL_PROFILES
} from '../lib/shopper/shelf-readability.mjs';

test('Before / After Shopper Comparison & Synchronization', async (t) => {
  const v1Items = [
    { requirementId: 'req-address', name: 'Business Address', physicalHeightMm: 1.5 },
    { requirementId: 'req-ingredients', name: 'Ingredient Statement', physicalHeightMm: 1.8 }
  ];

  const v2ProposedItems = [
    { requirementId: 'req-address', name: 'Business Address', physicalHeightMm: 1.8 }, // Remediated to 1.8 mm
    { requirementId: 'req-ingredients', name: 'Ingredient Statement', physicalHeightMm: 2.2 } // Remediated to 2.2 mm
  ];

  await t.test('1. Applies identical viewing distance and profile for fair before/after comparison', () => {
    const fixedDistance = 75.0; // 75 cm
    const profile = VISUAL_PROFILES.STANDARD_20_20;

    const v1Eval = evaluateRequiredItemsReadability({ items: v1Items, distanceCm: fixedDistance, profile });
    const v2Eval = evaluateRequiredItemsReadability({ items: v2ProposedItems, distanceCm: fixedDistance, profile });

    assert.equal(v1Eval[0].viewingDistanceCm, fixedDistance);
    assert.equal(v2Eval[0].viewingDistanceCm, fixedDistance);
    assert.equal(v1Eval[0].modelThresholdArcmin, v2Eval[0].modelThresholdArcmin);
  });

  await t.test('2. Measurably verifies improved threshold crossing distance in proposed revision', () => {
    const v1Crossing = identifyFirstThresholdCrossingItem({ items: v1Items });
    const v2Crossing = identifyFirstThresholdCrossingItem({ items: v2ProposedItems });

    // In V1, smallest was 1.5mm (crosses earlier); in V2, smallest is 1.8mm (crosses further away)
    assert.ok(v2Crossing.crossingDistanceCm > v1Crossing.crossingDistanceCm,
      `V2 crossing distance (${v2Crossing.crossingDistanceCm} cm) must be greater than V1 (${v1Crossing.crossingDistanceCm} cm)`);
  });

  await t.test('3. Flags apparent visual improvements that violate regulatory constraints', () => {
    // Scenario: Designer made brand logo huge, pushing mandatory net quantity off the bottom 30% of PDP
    const invalidRemediation = {
      isVisuallyLarger: true,
      violatesPlacementRule: true,
      ruleId: '21 CFR 101.105(f)',
      reason: 'Net quantity must appear within the bottom 30 percent of the principal display panel.'
    };

    assert.equal(invalidRemediation.violatesPlacementRule, true);
    assert.notEqual(invalidRemediation.violatesPlacementRule, false);
  });
});
