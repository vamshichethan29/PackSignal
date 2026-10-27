/**
 * PackSignal Remediation Proposal Store & Lifecycle Engine (lib/remediation/proposal-store.mjs)
 * Manages proposal lifecycle, reviewer decisions, designer tickets, and audit records.
 */

import { createHash } from 'node:crypto';

export const PROPOSAL_LIFECYCLE = {
  DRAFT: 'DRAFT',
  GENERATED: 'GENERATED',
  VALIDATED_FOR_REVIEW: 'VALIDATED_FOR_REVIEW',
  NEEDS_EVIDENCE: 'NEEDS_EVIDENCE',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED_FOR_DESIGN_HANDOFF: 'APPROVED_FOR_DESIGN_HANDOFF',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
  // Backward compatibility alias
  VALIDATED: 'VALIDATED_FOR_REVIEW',
  PENDING_REVIEW: 'PENDING_APPROVAL',
};

export function hashString(str) {
  return createHash('sha256').update(String(str || '')).digest('hex').slice(0, 16);
}

/**
 * Computes source document state hashes to detect stale proposals when sources change.
 */
export function computeSourceHash(review = {}) {
  const docSignatures = (review.documents || [])
    .map(d => `${d.id}:${d.hash || d.sha256 || d.text?.length || 0}`)
    .join('|');
  return hashString(docSignatures || 'no-sources');
}

/**
 * Checks whether a proposal has become stale due to source document modifications.
 */
export function checkProposalStaleness(proposal, review = {}) {
  if (!proposal.sourceHash) return false;
  const currentHash = computeSourceHash(review);
  return proposal.sourceHash !== currentHash;
}

/**
 * Creates a structured designer ticket when design/prepress geometry issues occur.
 */
export function buildDesignerCorrectionTicket(finding, review = {}) {
  const artworkDoc = (review.documents || []).find(d => d.role === 'artwork') || { name: 'Packaging Artwork' };
  const page = finding.page || finding.evidence?.[0]?.page || 1;
  const panel = finding.panel || finding.evidence?.[0]?.face || 'Main Panel';
  const box = finding.box || finding.evidence?.[0]?.box || null;

  return {
    ticketId: `TICKET-${finding.id || 'GEN'}-${Date.now().toString(36)}`,
    findingId: finding.id,
    type: 'DESIGNER_PREPRESS_TICKET',
    artworkFile: artworkDoc.name,
    page,
    panel,
    box,
    title: finding.title || 'Prepress / Layout Geometry Correction',
    issueDescription: finding.explanation || finding.observed || 'Prepress geometry requirement unmet.',
    prepressInstruction: generatePrepressInstruction(finding),
    targetTools: ['Adobe Illustrator', 'Esko ArtPro+', 'Esko PackEdge'],
    createdAt: new Date().toISOString(),
    status: 'READY_FOR_STUDIO_ASSIGNMENT',
  };
}

function generatePrepressInstruction(finding) {
  const title = (finding.title || '').toLowerCase();
  if (title.includes('barcode') || title.includes('quiet zone')) {
    return 'Open artwork in Illustrator or ArtPro+. Inspect barcode quiet zone margins. Ensure minimum 3.63mm (10x module width) uninterrupted clear margin on both leading and trailing edges of the EAN/UPC symbol. Clear graphic elements, bleed, and typography from the quiet zone bounding box.';
  }
  if (title.includes('bleed')) {
    return 'Check BleedBox against TrimBox. Artwork extends less than the required minimum 3.175mm (1/8") beyond die-cut trim. Pull background colors, patterns, and images to the outer bleed guide.';
  }
  if (title.includes('font') || title.includes('point size') || title.includes('typography')) {
    return 'Inspect text frame font size. Increase x-height / point size to meet the mandatory statutory minimum (e.g., >= 6pt or 1.2mm x-height for mandatory declarations under applicable labeling standards).';
  }
  if (title.includes('color separation') || title.includes('separation')) {
    return 'Inspect ink channels in Separation Preview. Verify spot color naming matches customer ink book (e.g. PANTONE formula guide) and knockout/overprint settings comply with technical prepress specifications.';
  }
  return 'Review packaging dieline and panel boundaries in Illustrator/ArtPro+. Adjust layout elements to satisfy prepress design requirements.';
}

/**
 * Updates a proposal with a human reviewer decision.
 */
export function recordReviewerDecision(proposal, decision, actor = {}, reason = '', editedText = null) {
  const timestamp = new Date().toISOString();
  const actorName = actor.displayName || actor.id || 'Reviewer';

  if (decision === 'EDITED') {
    proposal.originalProposalText ||= proposal.proposedText;
    proposal.proposedText = editedText;
    proposal.hasUserEdits = true;
    proposal.userEditedAt = timestamp;
    proposal.status = PROPOSAL_LIFECYCLE.PENDING_APPROVAL;
    proposal.lastDecisionReason = reason || 'Reviewer adjusted wording';
  } else if (decision === 'APPROVED_FOR_DESIGN_HANDOFF') {
    proposal.status = PROPOSAL_LIFECYCLE.APPROVED_FOR_DESIGN_HANDOFF;
    proposal.approvedAt = timestamp;
    proposal.approvedBy = actorName;
    proposal.reviewerComments = reason;
  } else if (decision === 'REJECTED') {
    proposal.status = PROPOSAL_LIFECYCLE.REJECTED;
    proposal.rejectedAt = timestamp;
    proposal.rejectedBy = actorName;
    proposal.reviewerComments = reason;
  }

  proposal.updatedAt = timestamp;
  return proposal;
}
