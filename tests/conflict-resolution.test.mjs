import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDeskSession, resolveDeskConflict } from '../lib/evidence-desk.mjs';
import { renderConflictCard, renderConflictCards } from '../public/conflict-cards.js';

describe('Phase 4 — Conflict Cards & Auditable Resolution', () => {
  it('renders side-by-side candidate sources with real quotations', () => {
    const session = getDeskSession('conflict-test-session');
    const honeyConflict = session.conflicts.find(c => c.id === 'CONFLICT-HONEY-CONTENT');
    assert.ok(honeyConflict);

    const cardHtml = renderConflictCard(honeyConflict);
    assert.ok(cardHtml.includes('SOURCE A'));
    assert.ok(cardHtml.includes('SOURCE B'));
    assert.ok(cardHtml.includes('WHY THIS MATTERS:'));
    assert.ok(cardHtml.includes('Honey (9%)'));
    assert.ok(cardHtml.includes('Honey (1%)'));
  });

  it('rejects conflict resolution by unauthorized reviewers (Phase 21 & Check 26)', () => {
    assert.throws(() => {
      resolveDeskConflict('conflict-test-auth', {
        conflictId: 'CONFLICT-HONEY-CONTENT',
        chosenValue: 'Honey (9%)',
        chosenSource: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
        reviewer: 'Unauthenticated User',
        role: 'UNAUTHORIZED'
      });
    }, /Unauthorized/);
  });

  it('persists authorized source selection with full audit trail (Phase 21 & Check 25)', () => {
    const updated = resolveDeskConflict('conflict-test-auth', {
      conflictId: 'CONFLICT-HONEY-CONTENT',
      chosenValue: 'Honey (9%)',
      chosenSource: 'DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx',
      reviewer: 'Dr. Jane Smith',
      role: 'REGULATORY_LEAD',
      note: 'Formula revision 14 confirmed 9% natural clover honey in batch production.'
    });

    const resolved = updated.conflicts.find(c => c.id === 'CONFLICT-HONEY-CONTENT');
    assert.equal(resolved.status, 'RESOLVED');
    assert.equal(resolved.resolvedValue, 'Honey (9%)');
    assert.equal(resolved.reviewer, 'Dr. Jane Smith');
    assert.equal(resolved.reviewerRole, 'REGULATORY_LEAD');
    assert.ok(resolved.resolvedAt);

    // Verify original conflicting candidates are preserved
    assert.ok(resolved.originalCandidates);

    // Verify Fact Sheet projection updated live (Phase 22)
    const honeyFact = updated.facts.find(f => f.field === 'honey_percentage');
    assert.equal(honeyFact.state, 'PROVEN');
    assert.equal(honeyFact.value, 'Honey (9%)');
    assert.equal(honeyFact.resolution.reviewer, 'Dr. Jane Smith');
  });

  it('refreshes summary count of open conflicts after resolution', () => {
    const session = getDeskSession('conflict-test-auth');
    assert.equal(session.summary.conflictsCount, session.conflicts.filter(c => c.status === 'OPEN').length);
  });
});
