/**
 * PackSignal — Departmental Sticky Notes & Multi-Stakeholder Annotations
 * public/department-sticky-notes.js
 *
 * Re-exports and extends the canonical sticky notes and departmental review
 * interface for Legal, R&D, Brand, and Prepress packaging workflows.
 */

export {
  DEPT_CONFIGS,
  filterFindingsByDepartment,
  calculateDepartmentCounts,
  renderDepartmentFilterBar,
  renderDepartmentSummaryCard,
  renderDepartmentBadge
} from './department-filters.js';

export {
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  renderFindingStickyNotes,
  renderStickyNoteCard,
  renderArtworkStickyNoteMarkers
} from './sticky-notes.js';
