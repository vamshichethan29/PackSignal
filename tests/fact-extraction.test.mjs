/**
 * PackSignal Phase 2 — Fact Extraction Pipeline Unit Tests
 * (tests/fact-extraction.test.mjs)
 * 
 * Verifies:
 * - Conversion of Phase 1 source pieces to verified fact candidates.
 * - Sourced provenance on both PDF and Excel.
 * - Artwork observations stay separate from specification facts.
 * - Three headline states (VERIFIED, AI_SUGGESTED, CONFLICTED).
 * - Full analytics counts.
 * - No unsupported fact marked VERIFIED.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUnifiedFactSheet } from '../lib/facts/fact-extraction.mjs';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');
const samplesDir = join(root, 'samples', 'organizer');
const pdfPath = join(samplesDir, 'DancingFish_Granola_Berry_US_Carton.pdf');
const xlsxPath = join(samplesDir, 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');

describe('Phase 2 — Fact Extraction Engine & Orchestration', () => {

  it('1. Extracts complete Unified Fact Sheet from real sample files', () => {
    const res = buildUnifiedFactSheet(pdfPath, xlsxPath, { noCache: true });

    assert.equal(res.schemaVersion, 'packsignal-fact/v1');
    assert.ok(res.facts.length >= 30, 'Should extract comprehensive fact catalog');
    assert.ok(res.fileFingerprint.includes(':'));

    // Check presence of key facts
    const hasHoney = res.facts.some(f => f.field === 'ingredient.honey.percentage');
    const hasCarb = res.facts.some(f => f.field === 'nutrition.carbohydrate.total');
    const hasNetQty = res.facts.some(f => f.field === 'net_quantity');
    const hasVegan = res.facts.some(f => f.field.includes('vegan'));

    assert.ok(hasHoney, 'Must extract honey percentage fact');
    assert.ok(hasCarb, 'Must extract total carbohydrate fact');
    assert.ok(hasNetQty, 'Must extract net quantity fact');
    assert.ok(hasVegan, 'Must extract vegan claim fact');
  });

  it('2. Keeps artwork observations strictly separate from specification facts', () => {
    const res = buildUnifiedFactSheet(pdfPath, xlsxPath, { noCache: true });

    const artFacts = res.facts.filter(f => f.source?.documentRole === 'artwork');
    const specFacts = res.facts.filter(f => f.source?.documentRole === 'specification');

    assert.ok(artFacts.length >= 5, 'Should extract facts from artwork');
    assert.ok(specFacts.length >= 20, 'Should extract facts from specification');

    for (const f of artFacts) {
      assert.equal(f.source.documentRole, 'artwork');
      assert.ok(f.source.panelId || f.source.page);
      assert.equal(f.source.cell, null, 'Artwork fact must not have cell coordinate');
    }

    for (const f of specFacts) {
      assert.equal(f.source.documentRole, 'specification');
      assert.ok(f.source.cell, 'Specification fact must carry cell coordinate');
      assert.equal(f.source.panelId, null, 'Specification fact must not have panel coordinate');
    }
  });

  it('3. Computes the three primary presentation states: VERIFIED, AI_SUGGESTED, CONFLICTED', () => {
    const res = buildUnifiedFactSheet(pdfPath, xlsxPath, { noCache: true });

    const verified = res.facts.filter(f => f.verificationState === 'VERIFIED');
    const suggested = res.facts.filter(f => f.verificationState === 'AI_SUGGESTED');
    const conflicted = res.facts.filter(f => f.verificationState === 'CONFLICTED');

    assert.ok(verified.length > 0, 'Must have verified facts');
    assert.ok(suggested.length > 0, 'Must have AI suggested facts (e.g. unverified mark or provisional notes)');
    assert.ok(conflicted.length > 0, 'Must have conflicted facts');

    assert.equal(
      verified.length + suggested.length + conflicted.length,
      res.facts.length,
      'Every fact must belong to exactly one of the three headline states'
    );
  });

  it('4. NEVER marks an unsupported fact as VERIFIED', () => {
    const res = buildUnifiedFactSheet(pdfPath, xlsxPath, { noCache: true });

    for (const f of res.facts) {
      if (f.verificationState === 'VERIFIED') {
        assert.ok(f.evidence.quoteMatch !== 'NOT_FOUND', `Fact ${f.factId} marked VERIFIED but quote was NOT_FOUND`);
        assert.ok(f.source.documentSha256, `Fact ${f.factId} marked VERIFIED without documentSha256`);
        assert.ok(f.source.sourcePieceIds.length > 0, `Fact ${f.factId} marked VERIFIED without sourcePieceIds`);
      }
    }
  });

  it('5. Fact Sheet analytics match actual fact state counts', () => {
    const res = buildUnifiedFactSheet(pdfPath, xlsxPath, { noCache: true });

    assert.equal(res.analytics.totalFacts, res.facts.length);
    assert.equal(res.analytics.verifiedFacts, res.facts.filter(f => f.verificationState === 'VERIFIED').length);
    assert.equal(res.analytics.aiSuggestedFacts, res.facts.filter(f => f.verificationState === 'AI_SUGGESTED').length);
    assert.equal(res.analytics.conflictedFacts, res.facts.filter(f => f.verificationState === 'CONFLICTED').length);
    assert.equal(res.analytics.conflictedFactGroups, res.conflicts.length);
  });
});
