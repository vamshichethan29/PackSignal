import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheckBackVerification } from '../lib/campus/check-back.mjs';

test('Check-Back Review Loop — Re-evaluation Across Revisions', () => {
  const previousReview = {
    tickets: [
      {
        id: 'TICKET-1',
        title: 'Net Quantity Specification Mismatch',
        approvedReplacement: 'Net Qty 1000 mL',
        originalText: 'Net Qty 750 mL',
      },
      {
        id: 'TICKET-2',
        title: 'Storage Instruction Negation',
        approvedReplacement: 'Keep refrigerated after opening',
        originalText: 'Do not keep refrigerated',
      },
    ],
  };

  // V2 reprint where Ticket 1 was corrected to 1000 mL, but Ticket 2 is still using old negated copy
  const freshScanData = {
    text: 'Dancing Fish Berry Crunch Granola Net Qty 1000 mL. Do not keep refrigerated.',
  };

  const checkBackResult = runCheckBackVerification(previousReview, freshScanData);

  assert.equal(checkBackResult.totalTicketsChecked, 2);
  assert.equal(checkBackResult.fixedCount, 1, 'Ticket 1 must be marked VERIFIED_FIXED');
  assert.equal(checkBackResult.unresolvedCount, 1, 'Ticket 2 must be UNRESOLVED');
  assert.equal(checkBackResult.allDefectsEradicated, false);

  const t1 = checkBackResult.results.find(r => r.ticketId === 'TICKET-1');
  assert.equal(t1.status, 'VERIFIED_FIXED');

  const t2 = checkBackResult.results.find(r => r.ticketId === 'TICKET-2');
  assert.equal(t2.status, 'UNRESOLVED');
});
