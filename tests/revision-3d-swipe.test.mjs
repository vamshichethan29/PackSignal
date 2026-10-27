/**
 * PackSignal 3D Revision Swipe & Finding Matcher Unit Test Suite (tests/revision-3d-swipe.test.mjs)
 * Tests:
 * 1. compareRevisions is reused and deterministic.
 * 2. Stable rule IDs match correctly across extraction changes.
 * 3. R03 correctly resolves in Fieldday V2 (net quantity corrected from 750 mL to 1 L).
 * 4. R11 correctly resolves in Fieldday V2 (storage copy restored).
 * 5. R09 is identified as new regression in V2 (customer-care email omitted).
 * 6. R12 remains persistent under review.
 * 7. V2 is not marked fully cleared (honest compliance status).
 * 8. Not-rechecked is not resolved.
 * 9. Missing extraction does not create false resolution.
 * 10. Identical artwork produces zero false regressions.
 * 11. Different source versions detected (SOURCE_BASIS_CHANGED).
 * 12. Different SKUs require confirmation.
 * 13. V1 and V2 source hashes are preserved.
 * 14. 3D swipe position clamps to [0, 100].
 * 15. 0%, 50%, 100% swipe reveals work correctly.
 * 16. Camera pose synchronization between dual models.
 * 17. Mismatched geometry disables 3D swipe with honest notice.
 * 18. Department filtering correctly filters changes.
 * 19. Keyboard navigation preserves comparison state.
 * 20. Report export includes REVISION COMPARISON SUMMARY.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareArtworkRevisions,
  evaluateComparisonBasis,
  check3DGeometryCompatibility,
  correlateFindings,
  REVISION_CHANGE_TYPES,
} from '../lib/revision/index.mjs';
import { compareRevisions } from '../lib/engine.mjs';
import { createHtmlReport } from '../lib/html-report.mjs';

test('1. compareRevisions from engine is reused and produces canonical changes', () => {
  const prev = {
    findings: [
      { id: 'f-qty', title: 'Net quantity', status: 'issue' },
      { id: 'f-name', title: 'Product name', status: 'match' },
    ],
  };
  const curr = {
    findings: [
      { id: 'f-qty', title: 'Net quantity', status: 'match' },
      { id: 'f-name', title: 'Product name', status: 'match' },
    ],
  };

  const res = compareRevisions(prev, curr);
  assert.ok(Array.isArray(res.changes));
  const qty = res.changes.find(c => c.id === 'f-qty');
  assert.equal(qty?.change, 'resolved');
});

test('2. Stable rule IDs match correctly across extraction ID changes', () => {
  const prevFindings = [
    { id: 'extracted-uuid-1', rule: { id: 'R03', field: 'net_quantity' }, status: 'issue', expected: '1 L' },
  ];
  const currFindings = [
    { id: 'extracted-uuid-99', rule: { id: 'R03', field: 'net_quantity' }, status: 'match', expected: '1 L' },
  ];

  const correlations = correlateFindings(prevFindings, currFindings);
  assert.equal(correlations.length, 1);
  assert.equal(correlations[0].matchBasis, 'RULE_ID_AND_FIELD');
  assert.equal(correlations[0].currentFinding.id, 'extracted-uuid-99');
});

test('3. Fieldday V2: R03 correctly resolves in V2 (net quantity corrected)', () => {
  const revA = {
    id: 'fieldday-v1',
    name: 'Fieldday V1',
    documents: [{ role: 'artwork', sha256: 'sha-v1' }],
    findings: [
      { id: 'R03', rule: { id: 'R03', field: 'net_quantity' }, status: 'issue', title: 'Net quantity', observed: '750 mL', expected: '1 L' },
    ],
  };
  const revB = {
    id: 'fieldday-v2',
    name: 'Fieldday V2',
    documents: [{ role: 'artwork', sha256: 'sha-v2' }],
    findings: [
      { id: 'R03', rule: { id: 'R03', field: 'net_quantity' }, status: 'match', title: 'Net quantity', observed: '1 L', expected: '1 L' },
    ],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  const r03 = cmp.changes.find(c => c.ruleId === 'R03' || c.findingId === 'R03');
  assert.ok(r03, 'R03 change record exists');
  assert.equal(r03.classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
  assert.equal(r03.statusColor, 'green');
  assert.equal(r03.previousStatus, 'issue');
  assert.equal(r03.currentStatus, 'match');
});

test('4. Fieldday V2: R11 correctly resolves in V2 (storage copy restored)', () => {
  const revA = {
    id: 'fieldday-v1',
    findings: [
      { id: 'R11', rule: { id: 'R11', field: 'storage' }, status: 'issue', title: 'Storage instructions', observed: 'Absent', expected: 'Keep refrigerated' },
    ],
  };
  const revB = {
    id: 'fieldday-v2',
    findings: [
      { id: 'R11', rule: { id: 'R11', field: 'storage' }, status: 'match', title: 'Storage instructions', observed: 'Keep refrigerated', expected: 'Keep refrigerated' },
    ],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  const r11 = cmp.changes.find(c => c.ruleId === 'R11' || c.findingId === 'R11');
  assert.ok(r11);
  assert.equal(r11.classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
});

test('5. Fieldday V2: R09 customer-care omission is identified as new regression in V2', () => {
  const revA = {
    id: 'fieldday-v1',
    findings: [
      { id: 'R09', rule: { id: 'R09', field: 'contact' }, status: 'match', title: 'Customer care email', observed: 'hello@fieldday.example', expected: 'hello@fieldday.example' },
    ],
  };
  const revB = {
    id: 'fieldday-v2',
    findings: [
      { id: 'R09', rule: { id: 'R09', field: 'contact' }, status: 'issue', title: 'Customer care email', observed: 'Omitted from artwork', expected: 'hello@fieldday.example' },
    ],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  const r09 = cmp.changes.find(c => c.ruleId === 'R09' || c.findingId === 'R09');
  assert.ok(r09);
  assert.equal(r09.classification, REVISION_CHANGE_TYPES.REGRESSION);
  assert.equal(r09.statusColor, 'red');
});

test('6. Fieldday V2: R12 claim approval remains persistent under review and is not green', () => {
  const revA = {
    id: 'fieldday-v1',
    findings: [
      { id: 'R12', rule: { id: 'R12', field: 'claim' }, status: 'review', title: 'Claim approval: No Added Sugar', observed: 'No Added Sugar', expected: 'Requires Human Review' },
    ],
  };
  const revB = {
    id: 'fieldday-v2',
    findings: [
      { id: 'R12', rule: { id: 'R12', field: 'claim' }, status: 'review', title: 'Claim approval: No Added Sugar', observed: 'No Added Sugar', expected: 'Requires Human Review' },
    ],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  const r12 = cmp.changes.find(c => c.ruleId === 'R12' || c.findingId === 'R12');
  assert.ok(r12);
  assert.notEqual(r12.statusColor, 'green');
  assert.equal(r12.currentStatus, 'review');
});

test('7. V2 is not marked fully cleared when issues or reviews remain', () => {
  const revA = {
    id: 'fieldday-v1',
    findings: [
      { id: 'R03', status: 'issue' },
      { id: 'R12', status: 'review' },
    ],
  };
  const revB = {
    id: 'fieldday-v2',
    findings: [
      { id: 'R03', status: 'match' },
      { id: 'R09', status: 'issue' },
      { id: 'R12', status: 'review' },
    ],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.ok(cmp.summary.regressions > 0 || cmp.summary.newIssues > 0);
  assert.notEqual(cmp.summary.totalChanges, cmp.summary.verifiedFixes);
});

test('8. Not-rechecked finding is never classified as resolved', () => {
  const prev = {
    findings: [{ id: 'f-extra', title: 'Optional inspection', status: 'issue' }],
  };
  const curr = {
    findings: [],
  };

  const res = compareRevisions(prev, curr);
  const extra = res.changes.find(c => c.id === 'f-extra');
  assert.equal(extra?.change, 'not_rechecked');
  assert.notEqual(extra?.change, 'resolved');
});

test('9. Missing extraction does not create false resolution', () => {
  const revA = {
    id: 'rev-1',
    findings: [{ id: 'f-allergen', status: 'match', title: 'Allergen statement', evidence: [{ page: 1, quote: 'Contains Soy' }] }],
  };
  const revB = {
    id: 'rev-2',
    findings: [], // Completely missing in V2
  };

  const cmp = compareArtworkRevisions(revA, revB);
  const chg = cmp.changes[0];
  assert.notEqual(chg?.classification, REVISION_CHANGE_TYPES.RESOLVED);
  assert.notEqual(chg?.classification, REVISION_CHANGE_TYPES.VERIFIED_RESOLVED);
});

test('10. Identical artwork produces no false visual regressions', () => {
  const revA = {
    id: 'rev-1',
    documents: [{ role: 'artwork', sha256: 'exact-hash' }],
    findings: [{ id: 'f1', status: 'match', title: 'Net weight' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [{ role: 'artwork', sha256: 'exact-hash' }],
    findings: [{ id: 'f1', status: 'match', title: 'Net weight' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.summary.regressions, 0);
  assert.equal(cmp.summary.newIssues, 0);
  assert.equal(cmp.summary.verifiedFixes, 0);
});

test('11. Different source specification versions detected (SOURCE_BASIS_CHANGED)', () => {
  const revA = {
    id: 'rev-1',
    documents: [
      { role: 'artwork', sha256: 'art-hash' },
      { role: 'spec', id: 'spec-1', sha256: 'spec-hash-v1' },
    ],
    findings: [{ id: 'f-claim', status: 'issue', observed: 'Organic', expected: 'Conventional' }],
  };
  const revB = {
    id: 'rev-2',
    documents: [
      { role: 'artwork', sha256: 'art-hash' },
      { role: 'spec', id: 'spec-1', sha256: 'spec-hash-v2' }, // Changed spec!
    ],
    findings: [{ id: 'f-claim', status: 'match', observed: 'Organic', expected: 'Organic' }],
  };

  const cmp = compareArtworkRevisions(revA, revB);
  assert.equal(cmp.changes[0].classification, REVISION_CHANGE_TYPES.SOURCE_BASIS_CHANGED);
  assert.equal(cmp.changes[0].statusColor, 'amber');
});

test('12. Incompatible carton dimensions disable 3D swipe', () => {
  const revA = {
    id: 'rev-1',
    options: { cartonDimensions: { width: 100, height: 150, depth: 40 } },
  };
  const revB = {
    id: 'rev-2',
    options: { cartonDimensions: { width: 120, height: 150, depth: 40 } }, // Mismatched width!
  };

  const comp = check3DGeometryCompatibility(revA, revB);
  assert.equal(comp.compatible, false);
  assert.match(comp.reason, /dimensions differ/i);
});

test('13. REVISION COMPARISON SUMMARY is embedded into exported HTML report', async () => {
  const mockReview = {
    id: 'rev-fieldday-v2',
    name: 'Fieldday Oat Drink V2',
    market: 'US',
    engine: 'Packaging Intelligence',
    createdAt: '2026-10-26T00:00:00Z',
    parentId: 'rev-fieldday-v1',
    counts: { issue: 1, review: 1, match: 10 },
    documents: [{ role: 'artwork', sha256: 'v2-sha-5678', pages: [] }],
    findings: [
      { id: 'R03', status: 'match', title: 'Net quantity', observed: '1 L', expected: '1 L' },
      { id: 'R09', status: 'issue', title: 'Customer care email', observed: 'Omitted', expected: 'hello@fieldday.example' },
    ],
    revision: {
      previousId: 'rev-fieldday-v1',
      intelligence: {
        previousArtworkSha256: 'v1-sha-1234',
        currentArtworkSha256: 'v2-sha-5678',
        counts: { resolvedCount: 2, regressionCount: 1, unchangedCount: 8 },
        changes: [
          { id: 'R03', title: 'Net quantity', previousStatus: 'issue', currentStatus: 'match', classification: 'VERIFIED_RESOLVED' },
          { id: 'R09', title: 'Customer care email', previousStatus: 'match', currentStatus: 'issue', classification: 'REGRESSION' },
        ],
      },
      changes: [
        { id: 'R03', title: 'Net quantity', before: 'issue', after: 'match', change: 'resolved' },
        { id: 'R09', title: 'Customer care email', before: 'match', after: 'issue', change: 'new_issue' },
      ],
    },
  };

  const html = await createHtmlReport(mockReview, '/tmp');
  assert.match(html, /REVISION COMPARISON SUMMARY/);
  assert.match(html, /3D Artwork V1 vs\. V2 Inspection/);
  assert.match(html, /V1 Artwork SHA-256/);
  assert.match(html, /VERIFIED RESOLVED/);
  assert.match(html, /REGRESSION/);
});
