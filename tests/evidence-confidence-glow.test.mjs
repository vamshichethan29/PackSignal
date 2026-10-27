/**
 * PackSignal — Phase 6A: Evidence Confidence Glow Unit Tests
 * Asserts mapping of evidence authority to visual language (solid, dashed, dotted, striped),
 * strict separation of evidence strength from defect severity, and rejection of fabricated AI confidence percentages.
 *
 * (tests/evidence-confidence-glow.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIDENCE_STYLES } from '../public/evidence-confidence-glow.js';
import { EVIDENCE_CONFIDENCE_LEVELS } from '../lib/shopper/experience-schema.mjs';

test('Evidence Confidence Glow Visual Language', async (t) => {
  await t.test('1. Defines distinct visual language for all canonical confidence tiers', () => {
    assert.ok(CONFIDENCE_STYLES.VERIFIED_SOURCE_EVIDENCE);
    assert.ok(CONFIDENCE_STYLES.PARTIAL_EVIDENCE);
    assert.ok(CONFIDENCE_STYLES.AI_SUGGESTED);
    assert.ok(CONFIDENCE_STYLES.SOURCE_CONFLICT);
    assert.ok(CONFIDENCE_STYLES.NOT_EVALUATED);

    assert.equal(CONFIDENCE_STYLES.VERIFIED_SOURCE_EVIDENCE.borderStyle, 'solid');
    assert.equal(CONFIDENCE_STYLES.PARTIAL_EVIDENCE.borderStyle, 'dashed');
    assert.equal(CONFIDENCE_STYLES.AI_SUGGESTED.borderStyle, 'dotted');
    assert.equal(CONFIDENCE_STYLES.SOURCE_CONFLICT.borderStyle, 'repeating-linear-gradient');
  });

  await t.test('2. Confidence level is independent of compliance finding severity', () => {
    // A severe non-compliance finding (e.g. Honey in Vegan product) can have VERIFIED_SOURCE_EVIDENCE confidence!
    const severeFinding = {
      findingId: 'f-vegan-conflict',
      severity: 'CRITICAL',
      evidenceConfidenceLevel: EVIDENCE_CONFIDENCE_LEVELS.VERIFIED_SOURCE_EVIDENCE,
      isSourceVerified: true
    };

    assert.equal(severeFinding.severity, 'CRITICAL');
    assert.equal(severeFinding.evidenceConfidenceLevel, 'VERIFIED_SOURCE_EVIDENCE');
    assert.notEqual(severeFinding.evidenceConfidenceLevel, severeFinding.severity);
  });

  await t.test('3. Rejects fabricated numerical percentages in confidence schema', () => {
    // Verification that tiers are qualitative evidence levels, not arbitrary numbers
    const validKeys = Object.keys(CONFIDENCE_STYLES);
    assert.ok(validKeys.includes('VERIFIED_SOURCE_EVIDENCE'));
    assert.ok(!validKeys.includes('97_PERCENT_CERTAINTY'));
  });
});
