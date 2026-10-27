/**
 * PackSignal Phase 2 — Unit Normalization & Quantity Engine Unit Tests
 * (tests/fact-normalization.test.mjs)
 * 
 * Verifies:
 * - 480 g vs 16.9 oz commercial equivalence under display rounding.
 * - oz vs fl oz distinguished.
 * - Mass vs volume guardrails (cannot convert without density).
 * - Per-serving vs per-100g basis incompatibility.
 * - Exact conversion constants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNormalizedQuantity,
  areQuantitiesEquivalent,
  MASS_CONVERSIONS,
  VOLUME_CONVERSIONS
} from '../lib/facts/fact-normalization.mjs';

describe('Phase 2 — Deterministic Unit Normalization & Quantity Engine', () => {

  it('1. 480 g and 16.9 oz are equivalent within commercial packaging display rounding', () => {
    // 1 oz = 28.349523125 g
    // 16.9 oz = 479.1069 g. Diff from 480 g is 0.89 g (~0.19% diff <= 1.0% tolerance).
    const equiv = areQuantitiesEquivalent('480g', '16.9 oz', { tolerancePct: 1.0 });

    assert.equal(equiv.equivalent, true, '480 g and 16.9 oz must be commercially equivalent');
    assert.ok(equiv.relDiffPct < 0.5, 'Relative difference must be under 0.5%');
    assert.equal(equiv.dimension, 'mass');
  });

  it('2. 15 g and 66 g are NOT equivalent (diff > 70%)', () => {
    const equiv = areQuantitiesEquivalent('15g', '66g');
    assert.equal(equiv.equivalent, false, '15g and 66g must not be equivalent');
    assert.ok(equiv.relDiffPct > 70.0);
  });

  it('3. Distinguishes avoirdupois ounce (oz) from fluid ounce (fl oz)', () => {
    const qMass = parseNormalizedQuantity('16.9 oz');
    const qVol = parseNormalizedQuantity('16.9 fl oz');

    assert.equal(qMass.dimension, 'mass');
    assert.equal(qVol.dimension, 'volume');
    assert.notEqual(qMass.dimension, qVol.dimension);

    // Comparing mass oz to fluid oz must fail without density
    const equiv = areQuantitiesEquivalent('16.9 oz', '16.9 fl oz');
    assert.equal(equiv.equivalent, false);
    assert.ok(equiv.reason.includes('Dimension mismatch') || equiv.reason.includes('Incompatible dimensions'));
  });

  it('4. Rejects mass to volume conversion without density information', () => {
    const equiv = areQuantitiesEquivalent('480 g', '480 mL');
    assert.equal(equiv.equivalent, false);
    assert.ok(equiv.reason.includes('density'));
  });

  it('5. Rejects direct comparison of per-serving vs per-100g nutrients without basis conversion', () => {
    const qServing = parseNormalizedQuantity('66g', 'per_serving');
    const q100g = parseNormalizedQuantity('65g', 'per_100g');

    const equiv = areQuantitiesEquivalent(qServing, q100g, { requireMatchingBasis: true });
    assert.equal(equiv.equivalent, false);
    assert.ok(equiv.reason.includes('Basis mismatch'));
  });

  it('6. Parses percentage units accurately and detects 1% vs 9%', () => {
    const q1 = parseNormalizedQuantity('1%');
    const q2 = parseNormalizedQuantity('9%');

    assert.equal(q1.dimension, 'percentage');
    assert.equal(q1.amount, 1);
    assert.equal(q2.amount, 9);

    const equiv = areQuantitiesEquivalent(q1, q2);
    assert.equal(equiv.equivalent, false, '1% and 9% must not be equivalent');
  });

  it('7. Precision constants conform strictly to statutory standards', () => {
    assert.equal(MASS_CONVERSIONS.oz, 28.349523125, 'Standard avoirdupois ounce exact constant');
    assert.equal(MASS_CONVERSIONS.lb, 453.59237, 'Standard avoirdupois pound exact constant');
    assert.equal(VOLUME_CONVERSIONS['fl oz'], 29.5735295625, 'Standard US fluid ounce exact constant');
  });
});
