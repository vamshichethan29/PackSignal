/**
 * PackSignal Review Intelligence — Evidence-Backed Correction Tickets
 * (lib/review-intelligence/correction-tickets.mjs)
 *
 * Generates source-bounded designer tickets, tracks assignment and lifecycle,
 * and verifies corrections against newly uploaded revisions through actual reinspection.
 */

import { randomUUID } from 'node:crypto';

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  READY_FOR_RECHECK: 'READY_FOR_RECHECK',
  VERIFIED_RESOLVED: 'VERIFIED_RESOLVED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  CLOSED_WITH_EXCEPTION: 'CLOSED_WITH_EXCEPTION',
  SUPERSEDED: 'SUPERSEDED'
};

/**
 * Creates an evidence-backed correction ticket from a review finding.
 */
export function createCorrectionTicket(review = {}, finding = {}, options = {}) {
  const artDoc = (review.documents || []).find(d => d.role === 'artwork') || {};
  const activeArt = (finding.evidence || []).find(e => e.page !== undefined) || {};
  const sourceEv = (finding.sources || [])[0] || (finding.evidence || []).find(e => e.documentId && e.documentId !== artDoc.id) || {};
  const sourceDoc = (review.documents || []).find(d => d.id === sourceEv.documentId || d.id === sourceEv.id) || {};

  // Formulate source-bounded suggested action
  let suggestedAction = '';
  if (finding.expected && sourceDoc.status !== 'draft') {
    suggestedAction = `Update wording to approved source requirement: "${finding.expected}", subject to reviewer approval.`;
  } else if (sourceDoc.status === 'draft') {
    suggestedAction = `Confirm authoritative specification before modifying artwork; current source is marked draft.`;
  } else if (finding.check?.includes('visibility') || finding.method?.includes('preflight')) {
    suggestedAction = `Inspect rendered PDF text to confirm visibility, contrast, and clearance.`;
  } else {
    suggestedAction = `Inspect and reconcile artwork declaration with approved product specification.`;
  }

  const ticket = {
    ticketId: options.ticketId || `ticket-${randomUUID().slice(0, 8)}`,
    reviewId: review.id,
    revisionId: review.revisionId || review.id,
    findingId: finding.id,
    checkId: finding.check || finding.id,
    ruleId: finding.rule?.id || null,
    ruleVersion: finding.rule?.version || 1,
    title: finding.title || 'Packaging Correction Required',
    severity: finding.status === 'issue' ? 'high' : 'medium',
    findingStatus: finding.status,
    observedArtworkContent: finding.observed || activeArt.quote || '',
    expectedSourceContent: finding.expected || sourceEv.quote || '',
    artworkDocumentId: artDoc.id || null,
    artworkPage: activeArt.page || 1,
    panelId: activeArt.panelId || activeArt.location || 'unlocated',
    artworkBoundingBox: activeArt.boundingBox || activeArt.box || null,
    sourceDocumentId: sourceDoc.id || null,
    sourceQuotation: sourceEv.quote || null,
    sourceLocation: sourceEv.location || null,
    suggestedAction,
    reviewerNote: options.reviewerNote || '',
    assignedDesigner: options.assignedDesigner || null,
    ticketStatus: options.assignedDesigner ? TICKET_STATUS.ASSIGNED : TICKET_STATUS.OPEN,
    // Ghost Bounding Box & Placement Integration (Step 20)
    ghostId: options.ghostRegion?.ghostId || null,
    declarationType: options.ghostRegion?.declarationType || null,
    applicablePanels: options.ghostRegion?.applicablePanels || (activeArt.panelId ? [activeArt.panelId] : []),
    legalRegion: options.ghostRegion?.legalRegion || null,
    suggestedPlacement: options.ghostRegion?.suggestedPlacement || null,
    authorityCitation: options.ghostRegion?.authorityCitation || finding.rule?.citation || finding.rule?.text || null,
    sourceApprovalStatus: sourceDoc.approvalStatus || sourceDoc.status || 'approved',
    verificationState: options.ghostRegion?.verificationState || finding.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recheckHistory: []
  };

  return ticket;
}

/**
 * Updates a ticket with new assignment, designer notes, or status transition.
 */
export function updateCorrectionTicket(ticket = {}, updates = {}, actor = {}) {
  const allowedStatuses = Object.values(TICKET_STATUS);
  if (updates.ticketStatus && !allowedStatuses.includes(updates.ticketStatus)) {
    throw new Error(`Invalid ticket status: "${updates.ticketStatus}"`);
  }

  return {
    ...ticket,
    ...updates,
    updatedAt: new Date().toISOString(),
    lastModifiedBy: actor.id || actor.displayName || 'reviewer'
  };
}

/**
 * Re-verifies a correction ticket against a new revision and its matched finding.
 */
export function verifyCorrectionTicket(ticket = {}, currentReview = {}, currentFinding = null) {
  const historyEntry = {
    timestamp: new Date().toISOString(),
    revisionId: currentReview.revisionId || currentReview.id,
    previousStatus: ticket.ticketStatus
  };

  if (!currentFinding) {
    // If the finding completely disappeared without verifiable evidence, route to review
    historyEntry.outcome = 'FINDING_NOT_LOCATED';
    historyEntry.newTicketStatus = TICKET_STATUS.REQUIRES_REVIEW;
    historyEntry.note = 'Previous finding was not detected in new revision; verify complete panel coverage before closing.';
  } else if (currentFinding.status === 'match') {
    // True verified resolution: the check was re-executed and meets requirement
    historyEntry.outcome = 'VERIFIED_RESOLVED';
    historyEntry.newTicketStatus = TICKET_STATUS.VERIFIED_RESOLVED;
    historyEntry.note = 'Re-inspected: artwork copy now satisfies the confirmed requirement.';
  } else if (currentFinding.status === 'issue') {
    // Still an issue
    historyEntry.outcome = 'STILL_PRESENT';
    historyEntry.newTicketStatus = TICKET_STATUS.IN_PROGRESS;
    historyEntry.note = `Re-inspected: issue remains in new artwork ("${currentFinding.observed}").`;
  } else {
    // Review or unable
    historyEntry.outcome = 'REQUIRES_REVIEW';
    historyEntry.newTicketStatus = TICKET_STATUS.REQUIRES_REVIEW;
    historyEntry.note = 'Re-inspected: check requires human verification or evidence reconfirmation.';
  }

  return {
    ...ticket,
    ticketStatus: historyEntry.newTicketStatus,
    updatedAt: new Date().toISOString(),
    recheckHistory: [...(ticket.recheckHistory || []), historyEntry]
  };
}
