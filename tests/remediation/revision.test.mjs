import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRevisions } from '../../lib/engine.mjs';

test('Remediation Revision: CASE 15 — V2 artwork includes the corrected text -> FIX_VERIFIED recorded in revision comparison', () => {
  const previous = {
    id: 'rev-v1',
    findings: [
      { id: 'f-net-qty', key: 'rule:net-quantity', title: 'Net Quantity', status: 'issue', observed: 'NET 750 mL', expected: 'NET 1000 mL' },
    ],
    remediations: {
      'f-net-qty': {
        proposalId: 'prop-qty-1',
        proposedText: 'NET 1000 mL',
        status: 'APPROVED_FOR_DESIGN_HANDOFF',
      },
    },
    documents: [{ id: 'spec-1', role: 'spec', name: 'Spec.pdf', sha256: 'spec-hash' }],
  };

  // Current (V2) artwork has corrected net quantity to 1000 mL -> status becomes 'match'
  const current = {
    id: 'rev-v2',
    parentId: 'rev-v1',
    findings: [
      { id: 'f-net-qty', key: 'rule:net-quantity', title: 'Net Quantity', status: 'match', observed: 'NET 1000 mL', expected: 'NET 1000 mL' },
    ],
    documents: [{ id: 'spec-1', role: 'spec', name: 'Spec.pdf', sha256: 'spec-hash' }],
  };

  const comparison = compareRevisions(previous, current);

  assert.ok(comparison.remediationVerifications);
  assert.equal(comparison.remediationVerifications.length, 1);

  const verification = comparison.remediationVerifications[0];
  assert.equal(verification.findingId, 'f-net-qty');
  assert.equal(verification.status, 'FIX_VERIFIED');
  assert.ok(verification.details.includes('matches the supported reference'));
  assert.equal(verification.beforeStatus, 'issue');
  assert.equal(verification.afterStatus, 'match');
});

test('Remediation Revision: CASE 16 — V2 artwork removes a separate required declaration -> reports new supported regression', () => {
  const previous = {
    id: 'rev-v1',
    findings: [
      { id: 'f-net-qty', key: 'rule:net-quantity', title: 'Net Quantity', status: 'issue', observed: '750 mL', expected: '1000 mL' },
      { id: 'f-storage', key: 'rule:storage', title: 'Storage Instructions', status: 'match', observed: 'Keep refrigerated', expected: 'Keep refrigerated' },
    ],
    documents: [{ id: 'spec-1', role: 'spec', sha256: 'spec-hash' }],
  };

  // V2 fixed net quantity but removed storage instructions (status becomes 'issue')
  const current = {
    id: 'rev-v2',
    parentId: 'rev-v1',
    findings: [
      { id: 'f-net-qty', key: 'rule:net-quantity', title: 'Net Quantity', status: 'match', observed: '1000 mL', expected: '1000 mL' },
      { id: 'f-storage', key: 'rule:storage', title: 'Storage Instructions', status: 'issue', observed: 'Not detected', expected: 'Keep refrigerated' },
    ],
    documents: [{ id: 'spec-1', role: 'spec', sha256: 'spec-hash' }],
  };

  const comparison = compareRevisions(previous, current);

  const storageChange = comparison.changes.find(c => c.id === 'f-storage');
  assert.ok(storageChange);
  assert.equal(storageChange.change, 'new_issue'); // Regression detected!
  assert.equal(storageChange.before, 'match');
  assert.equal(storageChange.after, 'issue');
});

test('Remediation Revision: Unresolved proposed fix in V2 remains NOT_IMPLEMENTED', () => {
  const previous = {
    id: 'rev-v1',
    findings: [
      { id: 'f-sodium', key: 'rule:sodium', title: 'Sodium %DV', status: 'issue', observed: '15% DV', expected: '10% DV' },
    ],
    remediations: {
      'f-sodium': {
        proposalId: 'prop-sod-1',
        proposedText: 'Sodium 230 mg — 10% DV',
        status: 'APPROVED_FOR_DESIGN_HANDOFF',
      },
    },
    documents: [{ id: 'spec-1', role: 'spec', sha256: 'spec-hash' }],
  };

  // V2 still has 15% DV
  const current = {
    id: 'rev-v2',
    parentId: 'rev-v1',
    findings: [
      { id: 'f-sodium', key: 'rule:sodium', title: 'Sodium %DV', status: 'issue', observed: '15% DV', expected: '10% DV' },
    ],
    documents: [{ id: 'spec-1', role: 'spec', sha256: 'spec-hash' }],
  };

  const comparison = compareRevisions(previous, current);
  const verification = comparison.remediationVerifications[0];
  assert.equal(verification.status, 'NOT_IMPLEMENTED');
});
