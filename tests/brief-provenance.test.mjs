/**
 * @file tests/brief-provenance.test.mjs
 * 
 * Unit tests for Phase 5 Clause-Level and Grounded Evidence Provenance.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetDeskSession } from '../lib/evidence-desk.mjs';
import { buildBriefFromSession } from '../lib/brief/brief-builder.mjs';
import { extractClaimSpans, verifyClaimSpan } from '../lib/brief/claim-verifier.mjs';

describe('Phase 5 — Grounded Evidence & Clause-Level Provenance', () => {

  test('1. Extracts multiple distinct claim spans within a single sentence', () => {
    const multiClaimText = 'The carton net weight is 480 g, contains 166 kcal energy, and bears certified vegan logo.';
    const spans = extractClaimSpans(multiClaimText);

    assert.ok(spans.length >= 3, 'Must extract 480 g, 166 kcal, and certified vegan');
    assert.ok(spans.some(s => s.kind === 'NUMBER' && s.value === 480));
    assert.ok(spans.some(s => s.kind === 'NUMBER' && s.value === 166));
    assert.ok(spans.some(s => s.kind === 'CERTIFICATION_OR_CLAIM' && s.phrase.includes('certified vegan')));
  });

  test('2. Fails verification when a non-existent or hallucinated fact ID is cited', () => {
    const span = { kind: 'NUMBER', rawText: '480 g', value: 480, unit: 'g' };
    const res = verifyClaimSpan(span, {
      referencedFacts: [] // No facts provided
    });

    assert.strictEqual(res.supported, false);
    assert.match(res.reason, /not supported by any referenced fact/i);
  });

  test('3. Verifies claim span when grounded in a genuine referenced fact', () => {
    const session = resetDeskSession('test-prov-grounded');
    const netFact = session.facts.find(f => f.field === 'net_quantity');

    const span = { kind: 'NUMBER', rawText: '480 g', value: 480, unit: 'g' };
    const res = verifyClaimSpan(span, {
      referencedFacts: [netFact]
    });

    assert.strictEqual(res.supported, true);
    assert.strictEqual(res.supportingSource, netFact.id);
  });

});
