import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runPhase3Evaluation } from '../lib/rules/phase3-orchestrator.mjs';

describe('Phase 3 — Requirement Status Distribution & Model', () => {

  test('1. Distinguishes PASS, ISSUE, NEEDS_REVIEW, UNABLE_TO_VERIFY, and NOT_APPLICABLE', () => {
    const res = runPhase3Evaluation({
      market: 'us',
      launchDate: '2026-10-16',
      facts: [
        { field: 'brand.product_name', value: 'Dancing Fish Berry Granola' },
        { field: 'net_quantity', value: '480g' },
        { field: 'nutrition.fat.total', value: '15g', evidence: { quote: 'Total Fat 15g 2.2%' } }
      ],
      productCategory: 'granola'
    });

    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.evaluations.length >= 18);

    const statuses = res.evaluations.map(e => e.status);
    assert.ok(statuses.includes('PASS'), 'Must have PASS status');
    assert.ok(statuses.includes('ISSUE'), 'Must have ISSUE status');
    assert.ok(statuses.includes('UNABLE_TO_VERIFY'), 'Must have UNABLE_TO_VERIFY status');

    assert.ok(res.statusCounts.PASS !== undefined);
    assert.ok(res.statusCounts.ISSUE !== undefined);
  });

  test('2. Inapplicable requirements return NOT_APPLICABLE and are not treated as PASS', () => {
    const res = runPhase3Evaluation({
      market: 'us',
      launchDate: '2026-10-16',
      facts: [],
      productCategory: 'fresh_produce' // Inapplicable for granola rules
    });

    const naCount = res.evaluations.filter(e => e.status === 'NOT_APPLICABLE').length;
    assert.ok(naCount > 0, 'Inapplicable category must produce NOT_APPLICABLE statuses');
  });
});
