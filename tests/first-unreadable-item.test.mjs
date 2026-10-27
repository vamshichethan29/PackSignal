/**
 * PackSignal — Phase 6A: First Threshold Crossing Item Unit Tests
 * Asserts deterministic identification of the first required declaration to become unreadable,
 * tie-breaking, handling of incomplete data, and separation from legal typography.
 *
 * (tests/first-unreadable-item.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  identifyFirstThresholdCrossingItem,
  evaluateRequiredItemsReadability,
  VISUAL_PROFILES
} from '../lib/shopper/shelf-readability.mjs';

test('First Required Item to Cross Threshold Detector', async (t) => {
  const sampleItems = [
    { requirementId: 'req-address', name: 'Business Address', physicalHeightMm: 1.5 },
    { requirementId: 'req-ingredients', name: 'Ingredients', physicalHeightMm: 1.8 },
    { requirementId: 'req-allergen', name: 'Contains Statement', physicalHeightMm: 2.2 },
    { requirementId: 'req-identity', name: 'Statement of Identity', physicalHeightMm: 8.5 }
  ];

  await t.test('1. Identifies smallest text (1.5mm) as first item to cross threshold', () => {
    const result = identifyFirstThresholdCrossingItem({
      items: sampleItems,
      profile: VISUAL_PROFILES.STANDARD_20_20
    });

    assert.equal(result.status, 'FIRST_ITEM_IDENTIFIED');
    assert.equal(result.firstItem.requirementId, 'req-address');
    assert.ok(result.crossingDistanceCm > 0);
    assert.match(result.estimateDisclaimer, /modeled readability estimate/i);
    assert.ok(result.numericalCalculation.formula.includes('tan'));
  });

  await t.test('2. Handles exact ties when two declarations share identical physical heights', () => {
    const tiedItems = [
      { requirementId: 'req-item-a', name: 'Declaration A', physicalHeightMm: 2.0 },
      { requirementId: 'req-item-b', name: 'Declaration B', physicalHeightMm: 2.0 },
      { requirementId: 'req-item-c', name: 'Declaration C', physicalHeightMm: 5.0 }
    ];

    const result = identifyFirstThresholdCrossingItem({
      items: tiedItems,
      profile: VISUAL_PROFILES.STANDARD_20_20
    });

    assert.equal(result.status, 'FIRST_ITEM_IDENTIFIED');
    assert.equal(result.hasTie, true);
    assert.equal(result.tiedItems.length, 2);
  });

  await t.test('3. Returns NO_THRESHOLD_CROSSING_IN_RANGE if all items remain above threshold up to 200 cm', () => {
    const largeItems = [
      { requirementId: 'req-huge-title', name: 'Billboard Brand Header', physicalHeightMm: 60.0 }
    ];

    const result = identifyFirstThresholdCrossingItem({
      items: largeItems,
      profile: VISUAL_PROFILES.STANDARD_20_20,
      minDistanceCm: 30,
      maxDistanceCm: 200
    });

    assert.equal(result.status, 'NO_THRESHOLD_CROSSING_IN_RANGE');
    assert.equal(result.firstItem, null);
  });

  await t.test('4. Returns CANNOT_DETERMINE_RELIABLY if text height measurements are missing', () => {
    const missingItems = [
      { requirementId: 'req-unknown', name: 'Unmeasured Item', physicalHeightMm: null, isMissingContent: false }
    ];

    const result = identifyFirstThresholdCrossingItem({
      items: missingItems,
      profile: VISUAL_PROFILES.STANDARD_20_20
    });

    assert.equal(result.status, 'CANNOT_DETERMINE_RELIABLY');
  });

  await t.test('5. Moving shelf slider does NOT alter original legal typography status', () => {
    const items = [
      {
        requirementId: 'req-legally-compliant-small',
        name: 'Compliant Ingredients',
        physicalHeightMm: 1.6, // Compliant with 21 CFR 101.4 (min 1.5875 mm)
        legalTypographyStatus: 'COMPLIANT_STATUTORY_HEIGHT'
      }
    ];

    const at30 = evaluateRequiredItemsReadability({ items, distanceCm: 30 });
    const at200 = evaluateRequiredItemsReadability({ items, distanceCm: 200 });

    // At 200 cm, text is unreadable (< 5 arcmin) but legally compliant height is preserved!
    assert.equal(at30[0].legalTypographyStatus, 'COMPLIANT_STATUTORY_HEIGHT');
    assert.equal(at200[0].legalTypographyStatus, 'COMPLIANT_STATUTORY_HEIGHT');
    assert.equal(at200[0].readabilityEstimate, 'BELOW_MODELED_THRESHOLD');
  });
});
