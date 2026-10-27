/**
 * PackSignal — Smart Sticky Notes & Multi-Stakeholder Annotations
 * public/sticky-notes.js
 *
 * Implements evidence-linked departmental sticky notes for 2D proof annotations,
 * threaded replies, collaboration statuses, and review finding linkage.
 */

import { DEPT_CONFIGS } from './department-filters.js';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const NOTE_STATUSES = [
  'OPEN',
  'AWAITING_RESPONSE',
  'RESPONSE_RECEIVED',
  'ACTION_REQUESTED',
  'READY_FOR_RECHECK',
  'CLOSED'
];

export const NOTE_STATUS_LABELS = {
  OPEN: 'Open Note',
  AWAITING_RESPONSE: 'Awaiting Response',
  RESPONSE_RECEIVED: 'Response Received',
  ACTION_REQUESTED: 'Action Requested',
  READY_FOR_RECHECK: 'Ready for Recheck',
  CLOSED: 'Resolved / Closed'
};

/**
 * Render the list of sticky notes attached to a finding.
 */
export function renderFindingStickyNotes(finding, review, currentUser = null) {
  const allNotes = review?.team?.stickyNotes || [];
  const findingNotes = allNotes.filter(n => n.findingId === finding.id);

  const canContribute = review?.teamAccess?.canContribute !== false;
  const primaryDept = finding?.primaryDepartment || 'unassigned';
  const deptCfg = DEPT_CONFIGS[primaryDept] || DEPT_CONFIGS.unassigned;

  return `
    <section class="panel sticky-notes-panel" data-sticky-notes-panel data-finding-id="${esc(finding.id)}">
      <div class="sticky-notes-header">
        <div class="sticky-notes-title">
          <span aria-hidden="true">📌</span>
          <b>EVIDENCE STICKY NOTES</b>
          <span class="notes-count-badge">${findingNotes.length}</span>
        </div>
        ${canContribute ? `
          <button type="button" class="btn-add-sticky-note" data-action="toggle-new-note-form" data-finding-id="${esc(finding.id)}">
            + Add Sticky Note
          </button>
        ` : ''}
      </div>

      <div class="new-sticky-note-form-wrapper" style="display:none;" data-new-note-wrapper>
        <form class="new-sticky-note-form" data-form="create-sticky-note" data-finding-id="${esc(finding.id)}">
          <div class="form-row">
            <label>
              <span>Responsible Team:</span>
              <select name="departmentId">
                <option value="legal" ${primaryDept==='legal'?'selected':''}>⚖️ Legal &amp; Regulatory</option>
                <option value="rd" ${primaryDept==='rd'?'selected':''}>🧪 R&amp;D &amp; Formulation</option>
                <option value="brand" ${primaryDept==='brand'?'selected':''}>🎨 Brand &amp; Marketing</option>
                <option value="prepress" ${primaryDept==='prepress'?'selected':''}>🖨️ Prepress &amp; Print</option>
                <option value="unassigned" ${primaryDept==='unassigned'?'selected':''}>❓ Unassigned</option>
              </select>
            </label>
            <label>
              <span>Initial Status:</span>
              <select name="noteStatus">
                <option value="OPEN" selected>Open</option>
                <option value="AWAITING_RESPONSE">Awaiting Response</option>
                <option value="ACTION_REQUESTED">Action Requested</option>
              </select>
            </label>
          </div>
          <div class="form-row">
            <label>
              <span>Attach to Evidence:</span>
              <select name="evidenceIndex">
                <option value="">Finding-level (No specific region)</option>
                ${(finding.evidence || []).map((ev, i) => `
                  <option value="${i}">${esc(ev.role || 'source')} · ${esc(ev.name || '')} · ${esc(ev.location || '')}${ev.page ? ` (Page ${ev.page})` : ''}</option>
                `).join('')}
              </select>
            </label>
          </div>
          <div class="form-row">
            <textarea name="noteText" placeholder="Write departmental clarification or verification note (2–2,000 characters)..." required minlength="2" maxlength="2000"></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-save-note">Post Sticky Note</button>
            <button type="button" class="btn-cancel-note" data-action="cancel-new-note">Cancel</button>
          </div>
        </form>
      </div>

      <div class="sticky-notes-list">
        ${findingNotes.length > 0 ? findingNotes.map(n => renderStickyNoteCard(n, canContribute)).join('') : `
          <p class="empty-notes-hint">No sticky notes attached to this finding yet. Use notes to coordinate with Legal, Formulation, Brand, or Prepress teams.</p>
        `}
      </div>
    </section>
  `;
}

/**
 * Render an individual departmental sticky note card.
 */
export function renderStickyNoteCard(note, canContribute = true) {
  const dept = DEPT_CONFIGS[note.departmentId] || DEPT_CONFIGS.unassigned;
  const isClosed = note.noteStatus === 'CLOSED';
  const replies = Array.isArray(note.replies) ? note.replies : [];

  return `
    <article class="sticky-note-card ${note.departmentId} ${isClosed ? 'status-closed' : ''}"
             data-note-id="${esc(note.noteId || note.id)}"
             style="--note-accent: ${dept.color}; --note-bg: ${dept.bg || '#fef2f2'}; --note-text: ${dept.text || '#991b1b'};">
      <div class="note-top-bar">
        <div class="note-team-badge">
          <span aria-hidden="true">${dept.icon}</span>
          <b>${esc(dept.displayName.toUpperCase())}</b>
        </div>
        <div class="note-status-dropdown-wrapper">
          <select class="note-status-select" data-action="change-note-status" data-note-id="${esc(note.noteId || note.id)}">
            ${NOTE_STATUSES.map(st => `
              <option value="${st}" ${note.noteStatus === st ? 'selected' : ''}>${NOTE_STATUS_LABELS[st]}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="note-meta-row">
        <span class="note-author">By <b>${esc(note.authorDisplayName || 'Reviewer')}</b></span>
        <time class="note-time">${new Date(note.createdAt).toLocaleString()}</time>
        ${note.artworkPage ? `<span class="note-page-tag">Page ${note.artworkPage}</span>` : ''}
      </div>

      <p class="note-content-text">${esc(note.noteText)}</p>

      ${replies.length > 0 ? `
        <div class="note-replies-thread">
          ${replies.map(r => `
            <div class="note-reply-item">
              <div class="reply-header">
                <b>${esc(r.authorDisplayName || 'Reviewer')}</b>
                <time>${new Date(r.at).toLocaleTimeString()}</time>
              </div>
              <p class="reply-text">${esc(r.text)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${canContribute && !isClosed ? `
        <div class="note-reply-composer" data-reply-composer>
          <input type="text" class="input-reply-text" placeholder="Reply to this note..." data-note-id="${esc(note.noteId || note.id)}">
          <button type="button" class="btn-send-reply" data-action="send-note-reply" data-note-id="${esc(note.noteId || note.id)}">Reply</button>
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * Render 2D artwork canvas sticky note markers anchored to PDF coordinates.
 */
export function renderArtworkStickyNoteMarkers(stickyNotes = [], activeFindingId = null, pageNumber = 1) {
  const locatedNotes = stickyNotes.filter(n =>
    (n.artworkLocation || n.boundingBox) &&
    (!n.artworkPage && !n.page || Number(n.artworkPage || n.page) === Number(pageNumber))
  );
  if (locatedNotes.length === 0) return '';

  return `
    <div class="artwork-sticky-notes-layer" data-sticky-notes-canvas-layer>
      ${locatedNotes.map(n => {
        const loc = n.artworkLocation || n.boundingBox;
        let cx = 50, cy = 50;
        let isPx = false;
        if (Array.isArray(loc)) {
          const [x1, y1, x2, y2] = loc;
          const isNorm = x1 <= 1 && (x2 == null || x2 <= 1);
          cx = x2 != null ? ((x1 + x2) / 2) : x1;
          cy = y2 != null ? ((y1 + y2) / 2) : y1;
          if (isNorm) {
            cx = (cx * 100).toFixed(2);
            cy = (cy * 100).toFixed(2);
          } else {
            isPx = true;
            cx = Math.round(Number(cx));
            cy = Math.round(Number(cy));
          }
        } else if (typeof loc === 'object' && loc !== null) {
          const x = Number(loc.x || 0), y = Number(loc.y || 0), w = Number(loc.width || 0), h = Number(loc.height || 0);
          cx = Math.round(x + w / 2);
          cy = Math.round(y + h / 2);
          isPx = Number(cx) > 100 || Number(cy) > 100;
        }

        const dept = DEPT_CONFIGS[n.departmentId] || DEPT_CONFIGS.unassigned;
        const isSelected = n.findingId === activeFindingId;
        const unit = isPx ? 'px' : '%';

        return `
          <button type="button"
                  class="artwork-sticky-marker ${n.departmentId} ${isSelected ? 'selected' : ''}"
                  style="left: ${cx}${unit}; top: ${cy}${unit}; --dept-color: ${dept.color}; --marker-color: ${dept.color};"
                  data-action="focus-sticky-note"
                  data-note-id="${esc(n.noteId || n.id)}"
                  data-sticky-note-id="${esc(n.noteId || n.id)}"
                  data-finding-id="${esc(n.findingId)}"
                  title="${dept.displayName} Note: ${esc((n.noteText || n.text || '').slice(0, 80))}...">
            <span class="marker-icon" aria-hidden="true">${dept.icon}</span>
            <span class="marker-status-dot ${(n.noteStatus || n.status || 'open').toLowerCase()}"></span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}
