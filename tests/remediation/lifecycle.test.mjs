import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSourceHash,
  checkProposalStaleness,
  recordReviewerDecision,
  buildDesignerCorrectionTicket,
  PROPOSAL_LIFECYCLE,
} from '../../lib/remediation/proposal-store.mjs';

test('Remediation Lifecycle: CASE 14 — Designer approves correction, source document later changes -> proposal marked stale/superseded', () => {
  const reviewV1 = {
    documents: [{ id: 'doc-spec', hash: 'hash-version-1' }],
  };
  const sourceHashV1 = computeSourceHash(reviewV1);

  const proposal = {
    proposalId: 'prop-101',
    findingId: 'f-1',
    proposedText: 'NET 1000 mL',
    sourceHash: sourceHashV1,
    status: PROPOSAL_LIFECYCLE.APPROVED_FOR_DESIGN_HANDOFF,
  };

  // Source document modified in V2
  const reviewV2 = {
    documents: [{ id: 'doc-spec', hash: 'hash-version-2-modified' }],
  };

  const isStale = checkProposalStaleness(proposal, reviewV2);
  assert.equal(isStale, true);

  if (isStale) {
    proposal.stale = true;
    proposal.status = PROPOSAL_LIFECYCLE.SUPERSEDED;
    proposal.stalenessReason = 'Source specification modified after approval.';
  }

  assert.equal(proposal.stale, true);
  assert.equal(proposal.status, 'SUPERSEDED');
});

test('Remediation Lifecycle: Reviewer approval, rejection, and edit transitions', () => {
  const proposal = {
    proposalId: 'prop-201',
    findingId: 'f-qty',
    proposedText: 'NET 1000 mL',
    status: PROPOSAL_LIFECYCLE.VALIDATED_FOR_REVIEW,
  };

  const actor = { id: 'usr-1', displayName: 'Jane Doe QA' };

  // 1. Edit proposal
  recordReviewerDecision(proposal, 'EDITED', actor, 'Adjusted to official format', 'NET 1000 mL (1 L)');
  assert.equal(proposal.proposedText, 'NET 1000 mL (1 L)');
  assert.equal(proposal.hasUserEdits, true);
  assert.equal(proposal.status, PROPOSAL_LIFECYCLE.PENDING_APPROVAL);

  // 2. Approve for design handoff
  recordReviewerDecision(proposal, 'APPROVED_FOR_DESIGN_HANDOFF', actor, 'Approved for packaging studio handoff');
  assert.equal(proposal.status, PROPOSAL_LIFECYCLE.APPROVED_FOR_DESIGN_HANDOFF);
  assert.equal(proposal.approvedBy, 'Jane Doe QA');
  assert.ok(proposal.approvedAt);

  // 3. Reject proposal
  recordReviewerDecision(proposal, 'REJECTED', actor, 'Specification superseded');
  assert.equal(proposal.status, PROPOSAL_LIFECYCLE.REJECTED);
  assert.equal(proposal.rejectedBy, 'Jane Doe QA');
});

test('Remediation Lifecycle: Designer prepress ticket creation for Adobe Illustrator / ArtPro+', () => {
  const finding = {
    id: 'f-quiet-zone',
    title: 'Barcode Quiet Zone Failure',
    explanation: '3.63mm required quiet zone is obstructed by graphic element.',
    observed: 'Margin obstructed',
    page: 1,
    box: [100, 200, 300, 400],
  };

  const review = {
    documents: [{ role: 'artwork', name: 'PackagingArtwork_RevA.pdf' }],
  };

  const ticket = buildDesignerCorrectionTicket(finding, review);
  assert.ok(ticket.ticketId.startsWith('TICKET-f-quiet-zone'));
  assert.equal(ticket.artworkFile, 'PackagingArtwork_RevA.pdf');
  assert.equal(ticket.type, 'DESIGNER_PREPRESS_TICKET');
  assert.ok(ticket.targetTools.includes('Adobe Illustrator'));
  assert.ok(ticket.targetTools.includes('Esko ArtPro+'));
  assert.ok(ticket.prepressInstruction.includes('quiet zone'));
});
