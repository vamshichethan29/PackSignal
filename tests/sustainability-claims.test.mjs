import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEnvironmentalClaim } from '../lib/environmental-remediation.mjs';

test('environmental claim screening requests substantiation and warns against unqualified general claims', () => {
  const claimText = '100% Eco-Friendly Packaging';
  const evidenceItems = [
    { text: 'Paperboard material', quote: 'Paperboard material' },
  ];

  const evaluation = evaluateEnvironmentalClaim(claimText, evidenceItems, { market: 'US' });

  assert.ok(evaluation);
  assert.equal(evaluation.eligibleForRewrite, false);
  // Under FTC Green Guides and Directive (EU) 2024/825, broad generic claims without substantiation are prohibited
  assert.ok(evaluation.reasoning.includes('substantiat') || evaluation.reasoning.includes('Green Guides'));
  assert.ok(evaluation.blockers.length > 0);
});
