/**
 * tests/revision-finding-markers.test.mjs
 * Unit and integration tests for 3D revision finding markers, semantic colors,
 * Fieldday V1 -> V2 state transitions, and missing text handling.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareArtworkRevisions,
  REVISION_CHANGE_TYPES,
  correlateFindings,
} from '../lib/revision/index.mjs';

test('3D Revision Finding Markers & Semantic Visual States Suite', async t => {
  // Baseline controlled Fieldday V1 review findings
  const fielddayV1 = {
    id: 'rev-fieldday-v1',
    name: 'Fieldday Organic Orange Juice 1L - V1',
    documents: [
      { id: 'doc-v1-art', role: 'artwork', name: 'fieldday-v1.pdf', sha256: 'sha-art-v1' },
      { id: 'doc-spec', role: 'spec', name: 'Fieldday_Product_Spec.pdf', sha256: 'sha-spec' },
    ],
    findings: [
      {
        id: 'find-r03',
        title: 'Net quantity declaration',
        rule: { id: 'R03', field: 'net_quantity' },
        status: 'issue',
        observed: '750 mL',
        expected: '1000 mL (1 L)',
        evidence: [{ documentId: 'doc-v1-art', page: 1, box: [0.35, 0.78, 0.65, 0.85], quote: '750 mL' }],
      },
      {
        id: 'find-r11',
        title: 'After-opening storage instructions',
        rule: { id: 'R11', field: 'storage_instructions' },
        status: 'issue',
        observed: null,
        expected: 'Refrigerate after opening. Consume within 7 days.',
        evidence: [],
      },
      {
        id: 'find-r09',
        title: 'Customer-care contact email/phone',
        rule: { id: 'R09', field: 'customer_care' },
        status: 'match',
        observed: 'help@fieldday.com',
        expected: 'Customer contact details',
        evidence: [{ documentId: 'doc-v1-art', page: 1, box: [0.1, 0.45, 0.28, 0.52], quote: 'Questions? help@fieldday.com' }],
      },
      {
        id: 'find-r12',
        title: 'Marketing claim: 100% Pure Squeezed',
        rule: { id: 'R12', field: 'claim_substantiation' },
        status: 'review',
        observed: '100% Pure Squeezed Orange Juice',
        expected: 'Legal claim clearance documentation',
        evidence: [{ documentId: 'doc-v1-art', page: 1, box: [0.3, 0.25, 0.7, 0.35], quote: '100% Pure Squeezed' }],
      },
    ],
  };

  // Controlled Fieldday V2 review findings
  const fielddayV2 = {
    id: 'rev-fieldday-v2',
    name: 'Fieldday Organic Orange Juice 1L - V2 (Revised)',
    documents: [
      { id: 'doc-v2-art', role: 'artwork', name: 'fieldday-v2.pdf', sha256: 'sha-art-v2' },
      { id: 'doc-spec', role: 'spec', name: 'Fieldday_Product_Spec.pdf', sha256: 'sha-spec' },
    ],
    findings: [
      {
        id: 'find-r03-v2',
        title: 'Net quantity declaration',
        rule: { id: 'R03', field: 'net_quantity' },
        status: 'match', // R03 RESOLVED: 750 mL -> 1000 mL
        observed: '1000 mL (1 L)',
        expected: '1000 mL (1 L)',
        evidence: [{ documentId: 'doc-v2-art', page: 1, box: [0.35, 0.78, 0.65, 0.85], quote: '1000 mL (1 L)' }],
      },
      {
        id: 'find-r11-v2',
        title: 'After-opening storage instructions',
        rule: { id: 'R11', field: 'storage_instructions' },
        status: 'match', // R11 RESOLVED: statement added
        observed: 'Refrigerate after opening. Consume within 7 days.',
        expected: 'Refrigerate after opening. Consume within 7 days.',
        evidence: [{ documentId: 'doc-v2-art', page: 1, box: [0.72, 0.3, 0.95, 0.4], quote: 'Refrigerate after opening. Consume within 7 days.' }],
      },
      {
        id: 'find-r09-v2',
        title: 'Customer-care contact email/phone',
        rule: { id: 'R09', field: 'customer_care' },
        status: 'issue', // R09 REGRESSION: missing in V2
        observed: null,
        expected: 'Customer contact details',
        evidence: [],
      },
      {
        id: 'find-r12-v2',
        title: 'Marketing claim: 100% Pure Squeezed',
        rule: { id: 'R12', field: 'claim_substantiation' },
        status: 'review', // R12 PERSISTENT: still needs review
        observed: '100% Pure Squeezed Orange Juice',
        expected: 'Legal claim clearance documentation',
        evidence: [{ documentId: 'doc-v2-art', page: 1, box: [0.3, 0.25, 0.7, 0.35], quote: '100% Pure Squeezed' }],
      },
    ],
  };

  const comparison = compareArtworkRevisions(fielddayV1, fielddayV2);

  await t.test('1. R03 Net Quantity: classified as VERIFIED_RESOLVED with green status marker', () => {
    const r03 = comparison.changes.find(c => c.ruleId === 'R03');
    assert.ok(r03, 'R03 change entry must exist');
    assert.equal(r03.classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
    assert.equal(r03.statusColor, 'green');
    assert.equal(r03.previousStatus, 'issue');
    assert.equal(r03.currentStatus, 'match');
    assert.equal(r03.observedV1, '750 mL');
    assert.equal(r03.observedV2, '1000 mL (1 L)');
  });

  await t.test('2. R11 Storage Instructions: classified as VERIFIED_RESOLVED with green status marker', () => {
    const r11 = comparison.changes.find(c => c.ruleId === 'R11');
    assert.ok(r11, 'R11 change entry must exist');
    assert.equal(r11.classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
    assert.equal(r11.statusColor, 'green');
    assert.equal(r11.previousStatus, 'issue');
    assert.equal(r11.currentStatus, 'match');
  });

  await t.test('3. R09 Customer Care: classified as REGRESSION with red warning marker', () => {
    const r09 = comparison.changes.find(c => c.ruleId === 'R09');
    assert.ok(r09, 'R09 change entry must exist');
    assert.equal(r09.classification, REVISION_CHANGE_TYPES.REGRESSION);
    assert.equal(r09.statusColor, 'red');
    assert.equal(r09.previousStatus, 'match');
    assert.equal(r09.currentStatus, 'issue');
  });

  await t.test('4. R09 Customer Care: missing copy in V2 does not invent fake coordinates', () => {
    const r09 = comparison.changes.find(c => c.ruleId === 'R09');
    assert.ok(!r09.evidenceV2?.box, 'No fake 3D coordinate boxes in V2 for missing text');
    assert.ok(r09.evidenceV1?.box, 'Former V1 box location is preserved for reviewer navigation');
  });

  await t.test('5. R12 Claim Approval: classified as UNCHANGED with review status', () => {
    const r12 = comparison.changes.find(c => c.ruleId === 'R12');
    assert.ok(r12, 'R12 change entry must exist');
    assert.notEqual(r12.statusColor, 'green');
    assert.equal(r12.currentStatus, 'review');
  });

  await t.test('6. Summary counts: verifiedFixes >= 2, regressions >= 1', () => {
    const summary = comparison.summary;
    assert.ok(summary.verifiedFixes >= 2, 'At least 2 verified fixes (R03, R11)');
    assert.ok(summary.regressions >= 1, 'At least 1 regression (R09)');
  });

  await t.test('7. V2 compliance status: V2 is NOT marked fully cleared when issues remain', () => {
    assert.ok(comparison.summary.regressions > 0, 'V2 has an active regression and cannot be fully cleared');
    assert.notEqual(comparison.summary.totalChanges, comparison.summary.verifiedFixes);
  });
});
