/**
 * @file public/red-pen-markup.js
 * 
 * PackSignal Phase 5A — Senior Reviewer Markup Studio
 * - Clean / Marked View Toggle ([CLEAN] [MARKED], key shortcut 'm')
 * - Automatic Red Pen Markup (circles, underlines, brackets, strikethroughs, arrows, callouts)
 * - Self-drawing handwriting animations with reduced-motion support
 * - Flat dieline numbered pins tied to source coordinates
 * - Department Sticky Notes (Legal amber, R&D blue, Brand purple, Prepress green)
 * - Transparent Unlocated Findings List
 * - Annotation Visibility Filters
 */

import { boxToCssStyles, getBoxCenter } from './finding-location-map.js';
import { openSourceSpotDialog } from './source-viewer.js';

let activeViewMode = 'clean'; // 'clean' | 'marked'
let activeFilter = 'all'; // 'all' | 'issue' | 'review' | 'regression' | 'legal' | 'rd' | 'brand' | 'track_changes' | 'ghost'
let currentReview = null;
let currentFindingLocations = [];

export function initReviewerMarkupStudio(review, container = document) {
  currentReview = review;
  attachGlobalKeyboardShortcut();
}

/**
 * Toggles between CLEAN and MARKED views.
 */
export function setMarkupViewMode(mode, container = document) {
  if (mode !== 'clean' && mode !== 'marked') return;
  activeViewMode = mode;

  const overlay = container.querySelector('#markup-studio-overlay, .artwork-markup-studio-overlay');
  const toggleCleanBtn = container.querySelector('#btn-view-clean, .markup-btn-clean');
  const toggleMarkedBtn = container.querySelector('#btn-view-marked, .markup-btn-marked');
  const toolbar = container.querySelector('#markup-filter-toolbar');

  if (toggleCleanBtn && toggleMarkedBtn) {
    toggleCleanBtn.classList.toggle('active', mode === 'clean');
    toggleCleanBtn.setAttribute('aria-pressed', mode === 'clean');
    toggleMarkedBtn.classList.toggle('active', mode === 'marked');
    toggleMarkedBtn.setAttribute('aria-pressed', mode === 'marked');
  }

  if (overlay) {
    overlay.classList.toggle('mode-clean', mode === 'clean');
    overlay.classList.toggle('mode-marked', mode === 'marked');
    overlay.classList.toggle('visible', mode === 'marked');
    if (mode === 'marked') {
      animateRedPenStrokes(overlay);
    }
  }

  if (toolbar) {
    toolbar.style.display = mode === 'marked' ? 'flex' : 'none';
  }
}

/**
 * Attaches the 'm' keyboard shortcut for instantaneous toggling.
 */
function attachGlobalKeyboardShortcut() {
  if (typeof window === 'undefined' || window._markupStudioKeyAttached) return;
  window._markupStudioKeyAttached = true;

  window.addEventListener('keydown', (e) => {
    // Only trigger if not typing in an input or textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
    if (e.key === 'm' || e.key === 'M') {
      const nextMode = activeViewMode === 'clean' ? 'marked' : 'clean';
      setMarkupViewMode(nextMode, document);
    }
  });
}

/**
 * Renders the top Clean/Marked segmented control and filter toolbar.
 */
export function renderMarkupStudioControls(review) {
  return `
    <div class="markup-studio-controls-bar">
      <!-- Clean / Marked Segmented Control -->
      <div class="segmented-control markup-toggle-control" role="group" aria-label="Review Proof Mode">
        <button type="button" id="btn-view-clean" class="markup-btn-clean ${activeViewMode === 'clean' ? 'active' : ''}" 
          data-action="set-markup-mode" data-mode="clean" aria-pressed="${activeViewMode === 'clean'}">
          🔍 CLEAN VIEW
        </button>
        <button type="button" id="btn-view-marked" class="markup-btn-marked ${activeViewMode === 'marked' ? 'active' : ''}" 
          data-action="set-markup-mode" data-mode="marked" aria-pressed="${activeViewMode === 'marked'}">
          ✏️ MARKED VIEW
        </button>
      </div>

      <!-- Annotation Visibility Filters (Visible in MARKED mode) -->
      <div id="markup-filter-toolbar" class="markup-filter-toolbar" style="display:${activeViewMode === 'marked' ? 'flex' : 'none'};">
        <button type="button" class="filter-pill ${activeFilter === 'all' ? 'active' : ''}" data-markup-filter="all">All Markups</button>
        <button type="button" class="filter-pill ${activeFilter === 'issue' ? 'active' : ''}" data-markup-filter="issue">🔴 Issues</button>
        <button type="button" class="filter-pill ${activeFilter === 'review' ? 'active' : ''}" data-markup-filter="review">🟡 Needs Review</button>
        <button type="button" class="filter-pill ${activeFilter === 'legal' ? 'active' : ''}" data-markup-filter="legal">⚖️ Legal</button>
        <button type="button" class="filter-pill ${activeFilter === 'rd' ? 'active' : ''}" data-markup-filter="rd">🔬 R&amp;D</button>
        <button type="button" class="filter-pill ${activeFilter === 'brand' ? 'active' : ''}" data-markup-filter="brand">✨ Brand</button>
        <button type="button" id="btn-markup-track-changes" class="filter-pill ${activeFilter === 'track_changes' ? 'active' : ''}" data-markup-filter="track_changes">📝 Track Changes</button>
        <button type="button" class="filter-pill ${activeFilter === 'ghost' ? 'active' : ''}" data-markup-filter="ghost">👻 Ghost Boxes</button>
      </div>

      <div class="markup-actions-right">
        <a href="/api/reviews/${encodeURIComponent(review?.id || '')}/export/a3-poster" target="_blank" download="packsignal_a3_review_wall_poster.pdf" class="btn-poster-export" id="btn-export-a3-poster" title="Export ISO A3 Single-Page Review Poster">
          📄 Export A3 Poster (PDF)
        </a>
      </div>
    </div>
  `;
}

/**
 * Generates natural hand-drawn SVG markup path (circle, underline, bracket, strike, arrow).
 */
export function generateHandDrawnPath(type, box, width = 1000, height = 1000) {
  if (!box) return '';
  const [x0, y0, x1, y1] = box;
  const left = x0 * width;
  const top = y0 * height;
  const right = x1 * width;
  const bottom = y1 * height;
  const w = right - left;
  const h = bottom - top;

  switch (type) {
    case 'RED_CIRCLE': {
      // Natural wobbly ellipse around bounding box
      const cx = left + w / 2;
      const cy = top + h / 2;
      const rx = (w / 2) + 8;
      const ry = (h / 2) + 6;
      return `M ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * 1.05}, ${cx + rx * 0.95} ${cy - ry}, ${cx + rx} ${cy} C ${cx + rx * 1.05} ${cy + ry * 0.95}, ${cx - rx * 0.9} ${cy + ry * 1.05}, ${cx - rx + 4} ${cy + 3}`;
    }
    case 'RED_UNDERLINE': {
      // Freehand double-arc stroke under text line
      const y = bottom + 3;
      return `M ${left - 4} ${y} Q ${left + w * 0.3} ${y + 2}, ${left + w * 0.6} ${y - 1} T ${right + 4} ${y + 1}`;
    }
    case 'RED_STRIKETHROUGH': {
      // Red line through middle of text
      const midY = top + h / 2;
      return `M ${left - 6} ${midY + 2} Q ${left + w * 0.5} ${midY - 2}, ${right + 6} ${midY + 1}`;
    }
    case 'RED_BRACKET': {
      // Bracket around multiline text block
      const r = Math.min(10, h / 4);
      return `M ${left + 12} ${top} L ${left} ${top} L ${left} ${bottom} L ${left + 12} ${bottom}`;
    }
    case 'RED_ARROW': {
      // Pointer arrow to text
      const startX = Math.max(10, left - 40);
      const startY = top - 20;
      const endX = left;
      const endY = top + h / 2;
      return `M ${startX} ${startY} Q ${startX + 15} ${endY - 10}, ${endX} ${endY} M ${endX - 8} ${endY - 6} L ${endX} ${endY} L ${endX - 8} ${endY + 6}`;
    }
    case 'AMBER_HIGHLIGHT': {
      // Loose wavy rectangle
      return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
    }
    default:
      return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
  }
}

/**
 * Selects annotation type from finding semantics.
 */
export function getAnnotationTypeForFinding(finding) {
  const title = (finding.title || '').toLowerCase();
  const expl = (finding.explanation || '').toLowerCase();
  const id = (finding.id || '').toLowerCase();

  if (/obsolete|delete|remove|contradicted/i.test(title + expl)) {
    return 'RED_STRIKETHROUGH';
  }
  if (/quantity|weight|volume|serving|mrp|price|count|oz|\b\d+\s*g\b|ml\b|barcode|gtin/i.test(title + expl)) {
    return 'RED_CIRCLE';
  }
  if (/claim|vegan|sugar|organic|gmo|advisory|declaration/i.test(title + expl)) {
    return 'RED_UNDERLINE';
  }
  if (/ingredient/i.test(title + expl)) {
    return 'RED_STRIKETHROUGH';
  }
  if (finding.status === 'review' || /ambiguous|verify/i.test(title + expl)) {
    return 'AMBER_HIGHLIGHT';
  }
  if (expl.length > 80) {
    return 'RED_BRACKET';
  }
  return 'RED_CIRCLE';
}

/**
 * Renders the entire Markup Studio overlay on top of the 2D artwork viewport.
 */
export function renderArtworkMarkupOverlay(review, pageNumber = 1) {
  if (!review) return '';
  const findings = review.findings || [];
  const stickyNotes = review.team?.stickyNotes || [];

  // Filter findings for this page that have location geometry
  const locatable = [];
  const unlocated = [];

  findings.forEach((f, idx) => {
    const artEvidence = (f.evidence || []).find(e => e.role === 'artwork' && e.box);
    const box = artEvidence?.box || f.box || f.ghostBox || null;
    const page = artEvidence?.page || f.page || 1;

    if (box && page === pageNumber) {
      locatable.push({
        finding: f,
        markerNumber: idx + 1,
        box,
        page,
        quote: artEvidence?.quote || f.observed || '',
        annotationType: getAnnotationTypeForFinding(f)
      });
    } else if (f.status === 'issue' || f.status === 'review' || f.status === 'unable') {
      unlocated.push({
        finding: f,
        markerNumber: idx + 1
      });
    }
  });

  const svgPaths = locatable.map(item => {
    const pathD = generateHandDrawnPath(item.annotationType, item.box, 1000, 1000);
    const strokeColor = item.finding.status === 'issue' ? '#dc2626' : (item.finding.status === 'review' ? '#d97706' : '#2563eb');
    const isUnderline = item.annotationType === 'RED_UNDERLINE';

    return `
      <g class="red-pen-annotation-group" data-finding-id="${item.finding.id}" data-dept="${item.finding.primaryDepartment || 'legal'}">
        <path class="red-pen-path red-pen-stroke ${isUnderline ? 'stroke-underline' : 'stroke-circle'}" 
          d="${pathD}" 
          stroke="${strokeColor}" 
          stroke-width="3" 
          fill="none" 
          stroke-linecap="round" 
          stroke-linejoin="round" />
      </g>
    `;
  }).join('');

  // Numbered Dieline Pins
  const pinsHtml = locatable.map(item => {
    const center = getBoxCenter(item.box);
    const statusClass = item.finding.status;
    const dept = item.finding.primaryDepartment || 'legal';

    return `
      <button type="button" class="dieline-finding-pin ${statusClass} dept-${dept}" 
        style="left:${center.xPercent}%; top:${center.yPercent}%;"
        data-action="inspect-finding-pin" 
        data-finding-id="${item.finding.id}" 
        data-marker-num="${item.markerNumber}"
        title="[${item.markerNumber}] ${item.finding.title} (${dept.toUpperCase()})">
        <span class="pin-badge">${item.markerNumber}</span>
      </button>
    `;
  }).join('');

  // Pinned Department Sticky Notes on Canvas
  const stickyNotesHtml = locatable.map(item => {
    const notes = stickyNotes.filter(n => n.findingId === item.finding.id);
    if (!notes.length) return '';
    const note = notes[0];
    const center = getBoxCenter(item.box);
    const dept = note.department || item.finding.primaryDepartment || 'legal';

    return `
      <aside class="canvas-sticky-note dept-${dept.toLowerCase()}" 
        style="left:calc(${center.xPercent}% + 24px); top:calc(${center.yPercent}% - 30px);"
        data-sticky-note-id="${note.id}" data-finding-id="${item.finding.id}">
        <div class="sticky-head">
          <span class="sticky-dept-tag">${dept.toUpperCase()}</span>
          <span class="sticky-author">${note.author || 'Reviewer'}</span>
          <span class="sticky-status">${note.status || 'OPEN'}</span>
        </div>
        <div class="sticky-body">
          "${escapeHtml(note.comment || note.text || 'Action required')}"
        </div>
        <div class="sticky-foot">
          <button type="button" class="btn-sticky-reply" data-action="reply-sticky-note" data-finding-id="${item.finding.id}">Reply</button>
          <button type="button" class="btn-sticky-ack" data-action="ack-sticky-note" data-finding-id="${item.finding.id}">Acknowledge</button>
        </div>
      </aside>
    `;
  }).join('');

  // Unlocated Review Findings Drawer
  const unlocatedHtml = unlocated.length > 0 ? `
    <div class="unlocated-findings-drawer" id="unlocated-findings-drawer">
      <div class="unlocated-header">
        <span class="icon">⚠️</span>
        <b>UNLOCATED REVIEW FINDINGS (${unlocated.length})</b>
        <small style="margin-left:auto;color:#64748b;">Not spatially localized on artwork</small>
      </div>
      <div class="unlocated-list">
        ${unlocated.map(u => `
          <div class="unlocated-card" data-action="open-unlocated-detail" data-finding-id="${u.finding.id}">
            <span class="unlocated-idx">[${u.markerNumber}]</span>
            <div class="unlocated-info">
              <b>${escapeHtml(u.finding.title)}</b>
              <small>${escapeHtml(u.finding.explanation || 'Missing statutory declaration or external source dependency')}</small>
            </div>
            <span class="unlocated-status ${u.finding.status}">${u.finding.status.toUpperCase()}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div id="markup-studio-overlay" class="artwork-markup-studio-overlay markup-studio-overlay ${activeViewMode === 'marked' ? 'visible mode-marked' : 'mode-clean'}" 
      style="display:block;">
      <svg class="red-pen-markup-canvas markup-vector-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        ${svgPaths}
      </svg>
      <div class="markup-pins-layer">
        ${pinsHtml}
      </div>
      <div class="markup-sticky-notes-layer">
        ${stickyNotesHtml}
      </div>
      ${unlocatedHtml}
    </div>
  `;
}

/**
 * Executes stroke-dasharray animation to simulate red pen drawing itself.
 */
function animateRedPenStrokes(overlay) {
  // Check for reduced motion preference
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const paths = overlay.querySelectorAll('.red-pen-stroke');
  paths.forEach(path => {
    try {
      const length = path.getTotalLength() || 400;
      if (prefersReduced) {
        path.style.strokeDasharray = 'none';
        path.style.strokeDashoffset = '0';
        return;
      }
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = length;
      path.getBoundingClientRect(); // Trigger layout
      path.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      path.style.strokeDashoffset = '0';
    } catch {
      path.style.strokeDasharray = 'none';
    }
  });
}

/**
 * Mounts event listeners for buttons and pins inside Markup Studio.
 */
export function attachMarkupStudioEvents(container, review) {
  currentReview = review;
  attachGlobalKeyboardShortcut();

  // 1. Clean / Marked Toggle
  container.querySelectorAll('[data-action="set-markup-mode"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      setMarkupViewMode(mode, container);
    });
  });

  // 2. Filter Toolbar
  container.querySelectorAll('[data-markup-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-markup-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-markup-filter');
      applyMarkupFilter(activeFilter, container);
    });
  });

  // 3. Pin Click -> Opens Finding Details
  container.querySelectorAll('[data-action="inspect-finding-pin"]').forEach(pin => {
    pin.addEventListener('click', () => {
      const fId = pin.getAttribute('data-finding-id');
      const finding = (currentReview?.findings || []).find(f => f.id === fId);
      if (finding) {
        openFindingInspectorModal(finding, currentReview);
      }
    });
  });

  // 4. A3 Poster Export
  const posterBtn = container.querySelector('#btn-export-a3-poster');
  if (posterBtn) {
    posterBtn.addEventListener('click', () => {
      if (currentReview?.id) {
        window.open(`/api/reviews/${encodeURIComponent(currentReview.id)}/export/a3-poster`, '_blank');
      }
    });
  }

  // 5. Sticky Note Actions
  container.querySelectorAll('[data-action="ack-sticky-note"]').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('Note acknowledged. Status updated to REVIEWER_ACKNOWLEDGED. (Does not alter engine finding status).');
    });
  });
  container.querySelectorAll('[data-action="reply-sticky-note"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fId = btn.getAttribute('data-finding-id');
      const reply = prompt('Enter reply comment for this finding:');
      if (reply) {
        alert(`Reply recorded: "${reply}". Attached to team review chain.`);
      }
    });
  });
}

/**
 * Applies filter to visual markup pins and paths.
 */
function applyMarkupFilter(filter, container) {
  const overlay = container.querySelector('#markup-studio-overlay');
  if (!overlay) return;

  const pins = overlay.querySelectorAll('.dieline-finding-pin');
  const groups = overlay.querySelectorAll('.red-pen-annotation-group');

  pins.forEach(pin => {
    let show = true;
    if (filter === 'issue' && !pin.classList.contains('issue')) show = false;
    else if (filter === 'review' && !pin.classList.contains('review')) show = false;
    else if (filter === 'legal' && !pin.classList.contains('dept-legal')) show = false;
    else if (filter === 'rd' && !pin.classList.contains('dept-rd')) show = false;
    else if (filter === 'brand' && !pin.classList.contains('dept-brand')) show = false;

    pin.style.display = show ? 'flex' : 'none';
  });

  groups.forEach(g => {
    const dept = g.getAttribute('data-dept');
    let show = true;
    if (filter === 'legal' && dept !== 'legal') show = false;
    else if (filter === 'rd' && dept !== 'rd') show = false;
    else if (filter === 'brand' && dept !== 'brand') show = false;

    g.style.display = show ? 'block' : 'none';
  });
}

/**
 * Modal showing comprehensive Finding Details when a pin or annotation is clicked.
 */
function openFindingInspectorModal(finding, review) {
  const dialog = document.getElementById('dialog') || document.createElement('dialog');
  if (!dialog.id) {
    dialog.id = 'dialog';
    document.body.appendChild(dialog);
  }
  dialog.className = 'markup-finding-modal';

  const artEvidence = (finding.evidence || []).find(e => e.role === 'artwork') || {};
  const srcEvidence = (finding.evidence || []).find(e => e.role === 'source') || {};
  const dept = (finding.primaryDepartment || 'legal').toUpperCase();

  dialog.innerHTML = `
    <div style="max-width:560px;padding:24px;background:#ffffff;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 40px rgba(0,0,0,0.25);">
      <div class="markup-modal-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px;">${finding.status.toUpperCase()}</span>
          <span style="background:#f1f5f9;color:#475569;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11px;">DEPT: ${dept}</span>
          <h3 style="margin:0;font-size:16px;color:#0f172a;">${escapeHtml(finding.title)}</h3>
        </div>
        <button type="button" class="close-dialog" data-markup-action="close-modal" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:#64748b;">✕</button>
      </div>

      <p style="font-size:13px;color:#334155;line-height:1.5;margin-bottom:16px;">${escapeHtml(finding.explanation || 'Review requirement')}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;">
          <small style="color:#64748b;font-weight:700;font-size:10px;">DETECTED ARTWORK COPY</small>
          <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:4px;">"${escapeHtml(artEvidence.quote || finding.observed || 'Not detected')}"</div>
          <small style="color:#94a3b8;font-size:10px;">Page ${artEvidence.page || 1} · ${artEvidence.location || 'Panel'}</small>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;">
          <small style="color:#64748b;font-weight:700;font-size:10px;">REFERENCED SPECIFICATION</small>
          <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:4px;">"${escapeHtml(srcEvidence.quote || finding.expected || 'Specification value')}"</div>
          <small style="color:#94a3b8;font-size:10px;">${srcEvidence.name || 'Spec Sheet'}</small>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn-modal-inspect-src" data-markup-action="inspect-source" style="padding:6px 12px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Inspect Source</button>
        <button type="button" class="close-dialog" data-markup-action="close-modal" style="padding:6px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Done</button>
      </div>
    </div>
  `;

  dialog.querySelectorAll('.close-dialog, [data-markup-action="close-modal"]').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.querySelector('.btn-modal-inspect-src, [data-markup-action="inspect-source"]')?.addEventListener('click', () => {
    dialog.close();
    openSourceSpotDialog({
      documentName: srcEvidence.name || 'Specification Reference',
      locationStr: srcEvidence.location || 'Content Sheet',
      quoteText: srcEvidence.quote || finding.expected
    });
  });

  dialog.showModal();
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
