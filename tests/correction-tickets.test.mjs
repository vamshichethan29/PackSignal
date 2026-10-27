import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCorrectionTicket,
  updateCorrectionTicket,
  verifyCorrectionTicket,
  TICKET_STATUS
} from '../lib/review-intelligence/correction-tickets.mjs';

test('Correction Ticket Engine: creates bounded tickets and verifies them via rechecks', () => {
  const mockReview = {
    id: 'rev-001',
    revisionId: 'rev-001-v1',
    documents: [
      { id: 'art-001', role: 'artwork', name: 'Packaging_v1.pdf' },
      { id: 'spec-001', role: 'spec', name: 'Approved_Spec.pdf', status: 'approved' }
    ]
  };

  const mockFinding = {
    id: 'finding-qty-01',
    check: 'check-net-quantity',
    title: 'Net Quantity Mismatch',
    status: 'issue',
    observed: '750 mL',
    expected: '1000 mL',
    evidence: [
      { page: 1, location: 'Front Panel', quote: '750 mL', box: [0.8, 0.2, 0.9, 0.4] }
    ],
    sources: [
      { id: 'spec-001', quote: '1000 mL', location: 'Section 4.1' }
    ]
  };

  // 1. Create ticket
  const ticket = createCorrectionTicket(mockReview, mockFinding, {
    reviewerNote: 'Please update to approved 1000 mL volume'
  });

  assert.equal(ticket.reviewId, 'rev-001');
  assert.equal(ticket.findingId, 'finding-qty-01');
  assert.equal(ticket.observedArtworkContent, '750 mL');
  assert.equal(ticket.expectedSourceContent, '1000 mL');
  assert.equal(ticket.ticketStatus, TICKET_STATUS.OPEN);
  assert.ok(ticket.suggestedAction.includes('1000 mL'));

  // 2. Assign designer
  const assigned = updateCorrectionTicket(ticket, {
    assignedDesigner: 'designer@packsignal.io',
    ticketStatus: TICKET_STATUS.ASSIGNED
  });
  assert.equal(assigned.assignedDesigner, 'designer@packsignal.io');
  assert.equal(assigned.ticketStatus, TICKET_STATUS.ASSIGNED);

  // 3. Recheck against new revision where finding is now matching
  const v2Review = { id: 'rev-002', revisionId: 'rev-002-v2' };
  const v2FindingMatch = {
    id: 'finding-qty-01',
    status: 'match',
    observed: '1000 mL',
    expected: '1000 mL'
  };

  const verified = verifyCorrectionTicket(assigned, v2Review, v2FindingMatch);
  assert.equal(verified.ticketStatus, TICKET_STATUS.VERIFIED_RESOLVED);
  assert.equal(verified.recheckHistory.length, 1);
  assert.equal(verified.recheckHistory[0].outcome, 'VERIFIED_RESOLVED');

  // 4. Test recheck where issue remains
  const v2FindingIssue = {
    id: 'finding-qty-01',
    status: 'issue',
    observed: '750 mL',
    expected: '1000 mL'
  };

  const stillUnresolved = verifyCorrectionTicket(assigned, v2Review, v2FindingIssue);
  assert.equal(stillUnresolved.ticketStatus, TICKET_STATUS.IN_PROGRESS);
  assert.equal(stillUnresolved.recheckHistory[0].outcome, 'STILL_PRESENT');
});
