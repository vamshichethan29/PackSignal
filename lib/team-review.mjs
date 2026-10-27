import { randomUUID } from 'node:crypto';
import { normalizeDepartmentId, isValidDepartment, getDepartment } from './finding-departments.mjs';

const safeText = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;

export function canViewReview(review, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const team = review.team || {};
  if (team.createdBy === user.id) return true;
  return Object.values(team.assignments || {}).some((assignment) => assignment.reviewerIds?.includes(user.id));
}

export function canReviewFinding(review, findingId, user) {
  if (!user) return false;
  if (user.role === 'admin' || review.team?.createdBy === user.id) return true;
  return review.team?.assignments?.[findingId]?.reviewerIds?.includes(user.id) === true;
}

export function setFindingAssignment(review, findingId, reviewerIds, actor, members, now = new Date().toISOString()) {
  if (!review.findings?.some((finding) => finding.id === findingId)) {
    throw Object.assign(new Error('Finding not found.'), { status: 404 });
  }
  if (!Array.isArray(reviewerIds) || reviewerIds.length > 8 || reviewerIds.some((id) => typeof id !== 'string')) {
    throw Object.assign(new Error('Choose up to eight reviewers.'), { status: 400 });
  }
  const uniqueIds = [...new Set(reviewerIds)];
  if (uniqueIds.some((id) => !members.some((member) => member.id === id && member.role === 'reviewer'))) {
    throw Object.assign(new Error('Assignments must use configured reviewer accounts.'), { status: 400 });
  }
  review.team ||= { createdBy: actor.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.assignments ||= {};
  review.team.assignmentHistory ||= [];
  const previousIds = review.team.assignments[findingId]?.reviewerIds || [];
  if (previousIds.length === uniqueIds.length && previousIds.every((id, index) => id === uniqueIds[index])) return false;
  const assignment = { reviewerIds: uniqueIds, at: now, assignedBy: actor.id, assignedByName: actor.displayName };
  review.team.assignments[findingId] = assignment;
  review.team.assignmentHistory.push({ findingId, ...structuredClone(assignment) });
  return true;
}

export function addFindingComment(review, finding, actor, input, now = new Date().toISOString()) {
  if (!safeText(input.comment, 2, 2000)) {
    throw Object.assign(new Error('Comments must contain 2–2,000 characters.'), { status: 400 });
  }
  const evidenceIndex = input.evidenceIndex === undefined || input.evidenceIndex === '' ? null : Number(input.evidenceIndex);
  if (evidenceIndex !== null && (!Number.isInteger(evidenceIndex) || evidenceIndex < 0 || evidenceIndex >= finding.evidence.length)) {
    throw Object.assign(new Error('Choose evidence attached to this finding.'), { status: 400 });
  }
  const evidence = evidenceIndex === null ? null : finding.evidence[evidenceIndex];
  review.team ||= { createdBy: actor.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.comments ||= [];
  const comment = {
    id: randomUUID(),
    findingId: finding.id,
    authorId: actor.id,
    authorName: actor.displayName,
    at: now,
    comment: input.comment.trim(),
    evidenceIndex,
    evidence: evidence ? {
      documentId: evidence.documentId || null,
      role: evidence.role || '',
      name: evidence.name || '',
      location: evidence.location || '',
      quote: evidence.quote || '',
    } : null,
  };
  review.team.comments.push(comment);
  return comment;
}

export function addFindingApproval(review, finding, actor, input, dependencyHash, now = new Date().toISOString()) {
  const outcomes = new Set(['approved', 'needs_changes', 'abstain']);
  if (!outcomes.has(input.outcome)) {
    throw Object.assign(new Error('Choose approve, request changes, or abstain.'), { status: 400 });
  }
  if (!safeText(input.note, 3, 2000)) {
    throw Object.assign(new Error('Add a sign-off note (3–2,000 characters).'), { status: 400 });
  }
  review.team ||= { createdBy: actor.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.approvals ||= [];
  const approval = {
    id: randomUUID(),
    findingId: finding.id,
    reviewerId: actor.id,
    reviewerName: actor.displayName,
    outcome: input.outcome,
    note: input.note.trim(),
    at: now,
    dependencyHash,
  };
  review.team.approvals.push(approval);
  return approval;
}

/**
 * Sets or overrides the responsible department for a finding.
 * Preserves full audit history and prevents unauthorized modification.
 */
export function setFindingDepartment(review, findingId, primaryDepartment, collaboratingDepartments = [], reason = '', actor, now = new Date().toISOString()) {
  const finding = review.findings?.find(f => f.id === findingId);
  if (!finding) {
    throw Object.assign(new Error('Finding not found.'), { status: 404 });
  }

  if (!isValidDepartment(primaryDepartment)) {
    throw Object.assign(new Error('Choose a valid department (Legal, R&D, Brand, Prepress, or Unassigned).'), { status: 400 });
  }

  // Enforce reviewer permissions: must be admin or assigned to review finding
  if (actor && actor.role !== 'admin' && !canReviewFinding(review, findingId, actor)) {
    throw Object.assign(new Error('You do not have permission to modify department ownership for this finding.'), { status: 403 });
  }

  const oldPrimary = finding.primaryDepartment || 'unassigned';
  const newPrimary = normalizeDepartmentId(primaryDepartment);

  const cleanCollabs = [...new Set(
    (Array.isArray(collaboratingDepartments) ? collaboratingDepartments : [])
      .map(normalizeDepartmentId)
      .filter(id => id !== newPrimary && id !== 'unassigned')
  )];

  review.departmentOverrides ||= {};
  review.departmentHistory ||= [];

  const overrideEntry = {
    findingId,
    oldDepartment: oldPrimary,
    newDepartment: newPrimary,
    primaryDepartment: newPrimary,
    collaboratingDepartments: cleanCollabs,
    reason: String(reason || '').trim(),
    changedBy: actor?.id || 'unknown',
    changedByName: actor?.displayName || 'Reviewer',
    changedAt: now,
    reviewVersion: review.revision?.version || 1
  };

  review.departmentOverrides[findingId] = overrideEntry;
  review.departmentHistory.push(overrideEntry);

  // Apply to finding directly
  finding.primaryDepartment = newPrimary;
  finding.collaboratingDepartments = cleanCollabs;
  finding.classificationMethod = 'REVIEWER_OVERRIDE';
  finding.classificationState = 'OVERRIDDEN';
  finding.classificationReason = overrideEntry.reason || 'Manually routed by reviewer';
  finding.departmentOverride = overrideEntry;

  return overrideEntry;
}

/**
 * Adds an evidence-linked or finding-level Smart Sticky Note.
 */
export function addStickyNote(review, finding, actor, input = {}, now = new Date().toISOString()) {
  const text = (input.noteText || input.comment || '').trim();
  if (!safeText(text, 2, 2000)) {
    throw Object.assign(new Error('Sticky note must contain 2–2,000 characters.'), { status: 400 });
  }

  // Check permissions: authorized contributor or admin
  if (actor && actor.role !== 'admin' && !canViewReview(review, actor)) {
    throw Object.assign(new Error('You do not have permission to annotate this review.'), { status: 403 });
  }

  const departmentId = normalizeDepartmentId(input.departmentId || finding.primaryDepartment || 'unassigned');
  const noteStatus = ['OPEN', 'AWAITING_RESPONSE', 'RESPONSE_RECEIVED', 'ACTION_REQUESTED', 'READY_FOR_RECHECK', 'CLOSED']
    .includes(input.noteStatus) ? input.noteStatus : 'OPEN';

  const evidenceIndex = input.evidenceIndex === undefined || input.evidenceIndex === '' ? null : Number(input.evidenceIndex);
  let evidence = null;
  if (evidenceIndex !== null && Number.isInteger(evidenceIndex) && finding.evidence?.[evidenceIndex]) {
    evidence = finding.evidence[evidenceIndex];
  }

  const artworkPage = Number.isInteger(input.artworkPage)
    ? input.artworkPage
    : (evidence?.page || finding.evidence?.find(e => e.role === 'artwork')?.page || 1);

  // Canonical artwork coordinates/box if provided
  let artworkLocation = null;
  if (Array.isArray(input.artworkLocation) && input.artworkLocation.length === 4) {
    artworkLocation = input.artworkLocation.map(Number);
  } else if (evidence?.box && Array.isArray(evidence.box)) {
    artworkLocation = evidence.box.map(Number);
  }

  review.team ||= { createdBy: actor?.id, assignments: {}, comments: [], approvals: [], assignmentHistory: [] };
  review.team.stickyNotes ||= [];

  const noteId = randomUUID();
  const note = {
    id: noteId,
    noteId,
    reviewId: review.id,
    findingId: finding.id,
    artworkVersion: review.revision?.version || 1,
    artworkPage,
    artworkLocation, // [x1, y1, x2, y2]
    boundingBox: artworkLocation,
    artworkDocumentId: evidence?.documentId || null,
    evidenceId: evidence?.id || (evidenceIndex !== null ? `ev-${evidenceIndex}` : null),
    departmentId,
    departmentInfo: {
      id: departmentId,
      name: getDepartment(departmentId).displayName,
      color: getDepartment(departmentId).color,
      icon: getDepartment(departmentId).icon
    },
    authorId: actor?.id || 'reviewer',
    authorDisplayName: actor?.displayName || 'Reviewer',
    createdAt: now,
    updatedAt: now,
    text,
    noteText: text,
    status: noteStatus,
    noteStatus,
    replies: [],
    sourceEvidenceIds: evidence?.documentId ? [evidence.documentId] : [],
    evidenceIndex,
    resolvedBy: noteStatus === 'CLOSED' ? (actor?.displayName || actor?.id || 'reviewer') : null,
    resolvedAt: noteStatus === 'CLOSED' ? now : null
  };

  review.team.stickyNotes.push(note);

  // Also bridge into comments array for unified comment history
  review.team.comments ||= [];
  review.team.comments.push({
    id: note.noteId,
    findingId: finding.id,
    authorId: note.authorId,
    authorName: note.authorDisplayName,
    at: now,
    comment: text,
    departmentId,
    isStickyNote: true,
    noteStatus,
    evidenceIndex,
    evidence: evidence ? {
      documentId: evidence.documentId || null,
      role: evidence.role || '',
      name: evidence.name || '',
      location: evidence.location || '',
      quote: evidence.quote || '',
    } : null,
  });

  return note;
}

/**
 * Updates the status of an existing sticky note (e.g. CLOSED, AWAITING_RESPONSE).
 * Note: Closing a note DOES NOT change the underlying finding verdict!
 */
export function updateStickyNoteStatus(review, noteId, nextStatus, actor, now = new Date().toISOString()) {
  const note = (review.team?.stickyNotes || []).find(n => n.noteId === noteId || n.id === noteId);
  if (!note) {
    throw Object.assign(new Error('Sticky note not found.'), { status: 404 });
  }

  const validStatuses = ['OPEN', 'AWAITING_RESPONSE', 'RESPONSE_RECEIVED', 'ACTION_REQUESTED', 'READY_FOR_RECHECK', 'CLOSED'];
  if (!validStatuses.includes(nextStatus)) {
    throw Object.assign(new Error(`Invalid status: ${nextStatus}`), { status: 400 });
  }

  note.noteStatus = nextStatus;
  note.status = nextStatus;
  note.updatedAt = now;
  if (nextStatus === 'CLOSED') {
    note.resolvedAt = now;
    note.resolvedBy = actor?.displayName || actor?.id || 'reviewer';
  } else {
    note.resolvedAt = null;
    note.resolvedBy = null;
  }

  // Update corresponding comment entry if present
  const comment = (review.team?.comments || []).find(c => c.id === noteId);
  if (comment) {
    comment.noteStatus = nextStatus;
  }

  return note;
}

/**
 * Appends a reply to an existing sticky note discussion thread.
 */
export function addStickyNoteReply(review, noteId, replyText, actor, now = new Date().toISOString()) {
  const note = (review.team?.stickyNotes || []).find(n => n.noteId === noteId || n.id === noteId);
  if (!note) {
    throw Object.assign(new Error('Sticky note not found.'), { status: 404 });
  }

  const text = String(replyText || '').trim();
  if (!safeText(text, 2, 2000)) {
    throw Object.assign(new Error('Reply must contain 2–2,000 characters.'), { status: 400 });
  }

  note.replies ||= [];
  const replyId = randomUUID();
  const reply = {
    id: replyId,
    replyId,
    authorId: actor?.id || 'reviewer',
    authorDisplayName: actor?.displayName || 'Reviewer',
    at: now,
    createdAt: now,
    text,
    replyToNoteId: note.noteId
  };

  note.replies.push(reply);
  note.updatedAt = now;
  return reply;
}

export function findStickyNotesForFinding(review, findingId) {
  return (review.team?.stickyNotes || []).filter(n => n.findingId === findingId);
}

