import test from 'node:test';
import assert from 'node:assert/strict';
import { runRouteEquivalenceAudit } from '../scripts/verify-scan-vs-pdf.mjs';
import { verifyTwoRoutesSameAnswer } from '../lib/campus/scan-to-brief.mjs';

test('1. Two routes, same answer: Physical scan and Vector PDF detect identical packaging issues', () => {
  const metrics = runRouteEquivalenceAudit();
  assert.equal(metrics.verdict, 'VERIFIED_PARITY');
  assert.equal(metrics.agreementRate, '100.0%');
  assert.equal(metrics.differentConclusions, 0);
  assert.equal(metrics.hiddenEuTableExcluded, true);
});

test('2. Leaked non-printing EU table fails the physical scan route equivalence check', () => {
  const pdfFindings = [
    { title: 'Defect 1', verdict: 'issue' },
  ];
  // Scanned findings erroneously containing leaked EU table from digital layer
  const leakedScannedFindings = [
    { title: 'Defect 1', verdict: 'issue' },
    { title: 'EU Nutrition 1169/2011 Table', verdict: 'issue' },
  ];

  const result = verifyTwoRoutesSameAnswer(pdfFindings, leakedScannedFindings);
  assert.equal(result.hiddenEuTableStatus.excludedCorrectly, false);
  assert.equal(result.hiddenEuTableStatus.presentInScanned, true);
  assert.equal(result.verified, false);
});
