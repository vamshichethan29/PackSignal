/**
 * PackSignal Revision Intelligence & Visual Diff Studio (public/revision-studio.js)
 * Dual-viewport side-by-side inspection, synchronized zoom/pan, 4 comparison modes
 * (Side-by-Side, Transparent Overlay, Swipe comparison, Difference Heatmap),
 * semantic change classification, click-to-zoom focus, and reviewer acknowledgment.
 */

import { mountViewport, focusBox } from './artwork-viewport.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function revisionStudioView(current, previous, state = {}) {
  const intel = current.revision?.intelligence || {};
  const changes = intel.changes || current.revision?.changes?.map(c => ({
    id: c.id,
    title: c.title,
    classification: c.change === 'resolved' ? 'RESOLVED' : c.change === 'new_issue' ? 'NEW_ISSUE' : 'UNCHANGED',
    statusColor: c.change === 'resolved' ? 'green' : c.change === 'new_issue' ? 'red' : 'gray',
    previousStatus: c.before,
    currentStatus: c.after,
    observedV1: c.before,
    observedV2: c.after,
    evidenceV1: null,
    evidenceV2: null,
  })) || [];

  const counts = intel.counts || {
    totalChanges: changes.length,
    resolvedCount: changes.filter(c => c.classification === 'RESOLVED').length,
    regressionCount: changes.filter(c => c.classification === 'REGRESSION').length,
    newIssueCount: changes.filter(c => c.classification === 'NEW_ISSUE').length,
    unchangedCount: changes.filter(c => c.classification === 'UNCHANGED').length,
    unverifiedCount: 0,
  };

  const dimension = state.dimension || '3d';
  const activeMode = state.mode || 'side-by-side';
  const activeFilter = state.filter || 'all';
  const selectedChangeId = state.selectedChangeId || changes[0]?.id || null;
  const selectedChange = changes.find(c => c.id === selectedChangeId) || changes[0] || null;

  const prevDoc = previous?.documents?.find(d => d.role === 'artwork') || previous?.documents?.[0];
  const currDoc = current?.documents?.find(d => d.role === 'artwork') || current?.documents?.[0];

  const prevPageNum = state.prevPage || 1;
  const currPageNum = state.currPage || 1;

  const prevPage = prevDoc?.pages?.find(p => p.number === prevPageNum) || prevDoc?.pages?.[0];
  const currPage = currDoc?.pages?.find(p => p.number === currPageNum) || currDoc?.pages?.[0];

  const prevImgUrl = prevPage ? `/api/reviews/${previous.id}/images/${encodeURIComponent(prevPage.image)}` : '';
  const currImgUrl = currPage ? `/api/reviews/${current.id}/images/${encodeURIComponent(currPage.image)}` : '';

  const activeDept = state.dept || 'all';

  const filteredChanges = changes.filter(c => {
    // 1. Department Filter (Legal, R&D, Brand, Prepress)
    if (activeDept !== 'all') {
      const chgDept = c.department || c.rule?.department || (c.ruleId?.includes('fda') || c.ruleId?.includes('cfr') || c.title?.toLowerCase().includes('quantity') ? 'legal' : c.title?.toLowerCase().includes('storage') || c.title?.toLowerCase().includes('nutrition') || c.title?.toLowerCase().includes('allergen') ? 'rd' : c.title?.toLowerCase().includes('claim') || c.title?.toLowerCase().includes('brand') ? 'brand' : 'prepress');
      if (chgDept !== activeDept) return false;
    }

    // 2. Change Type Filter
    if (activeFilter === 'all') return true;
    if (activeFilter === 'resolved') return c.classification === 'RESOLVED' || c.classification === 'VERIFIED_RESOLVED';
    if (activeFilter === 'regressions') return c.classification === 'REGRESSION';
    if (activeFilter === 'new_issues') return c.classification === 'NEW_ISSUE';
    if (activeFilter === 'persistent_review') return c.classification === 'PERSISTENT_REVIEW' || c.currentStatus === 'review' || c.previousStatus === 'review';
    if (activeFilter === 'visual') return c.classification === 'VISUAL_CHANGE';
    if (activeFilter === 'removed') return c.classification === 'REMOVED_CONTENT';
    if (activeFilter === 'unverified') return c.classification === 'UNVERIFIED_CHANGE';
    return true;
  });

  const caseBadge = intel.caseClassification ? `
    <div class="rev-case-banner">
      <span class="badge ${intel.caseClassification.includes('MISMATCH') ? 'issue' : 'info'}">${esc(intel.caseClassification)}</span>
      <p class="subtle">${esc(intel.caseExplanation || 'Artwork revision compared against verified references.')}</p>
    </div>
  ` : '';

  const timelineHtml = `
    <div class="rev-timeline-bar" role="navigation" aria-label="Revision timeline">
      <div class="rev-timeline-node ${previous?.id === current.parentId ? 'active' : ''}">
        <span class="rev-node-dot"></span>
        <b>V1 (Base)</b>
        <small>${esc(previous?.name || 'Previous Review')}</small>
      </div>
      <div class="rev-timeline-arrow">⟶</div>
      <div class="rev-timeline-node current">
        <span class="rev-node-dot current"></span>
        <b>V2 (Current)</b>
        <small>${esc(current?.name || 'Revised Artwork')}</small>
      </div>
    </div>
  `;

  return `
    <section class="revision-studio panel" data-revision-studio>
      <div class="rev-studio-header">
        <div>
          <div class="eyebrow">REVISION INTELLIGENCE &amp; 3D DIFF STUDIO</div>
          <h2>Artwork Change Control &amp; 3D Regression Detection</h2>
          <p class="subtle">Physical 3D packaging comparison, synchronized camera rotation/zoom, WebGL swipe slider, automated visual difference extraction, and source-backed finding verification.</p>
        </div>
        <div class="rev-studio-actions">
          <button class="primary" data-action="open-revision-compare">🔀 Compare Artwork Revisions</button>
          <button class="secondary" data-rev-action="fit-both">Fit to Page</button>
          <button class="secondary" data-rev-action="toggle-fullscreen">⛶ Fullscreen</button>
        </div>
      </div>

      ${timelineHtml}
      ${caseBadge}

      <!-- Dimension Switcher (3D Packaging vs 2D Artwork) -->
      <div class="rev-dimension-switcher" role="group" aria-label="Studio mode">
        <button type="button" class="${dimension === '3d' ? 'active' : ''}" data-rev-dimension="3d">📦 3D Packaging Comparison</button>
        <button type="button" class="${dimension === '2d' ? 'active' : ''}" data-rev-dimension="2d">🔍 2D Artwork Proof</button>
      </div>

      ${dimension === '3d' ? `
        <!-- 3D Packaging Mount Container -->
        <div id="rev-3d-mount" style="min-height:580px; width:100%;">
          <div class="notice info" style="margin:20px;">Initializing 3D Revision Packaging Studio…</div>
        </div>
      ` : `
        <!-- 2D Comparison Controls & Mode Switcher -->
        <div class="rev-controls-bar">
          <div class="segmented-control" role="group" aria-label="Visual comparison mode">
            <button type="button" class="${activeMode === 'side-by-side' ? 'active' : ''}" data-rev-mode="side-by-side">1. Side-by-Side</button>
            <button type="button" class="${activeMode === 'overlay' ? 'active' : ''}" data-rev-mode="overlay">2. Transparent Overlay</button>
            <button type="button" class="${activeMode === 'swipe' ? 'active' : ''}" data-rev-mode="swipe">3. Swipe Comparison</button>
            <button type="button" class="${activeMode === 'heatmap' ? 'active' : ''}" data-rev-mode="heatmap">4. Difference Heatmap</button>
          </div>

          <div class="rev-sync-toggle">
            <label class="hud-layer">
              <input type="checkbox" id="rev-sync-checkbox" ${state.sync !== false ? 'checked' : ''}>
              <span>Synchronize Zoom &amp; Pan</span>
            </label>
          </div>

          <div class="rev-page-selectors">
            <label>V1 Page:
              <select id="rev-v1-page-select">
                ${(prevDoc?.pages || []).map(p => `<option value="${p.number}" ${p.number === prevPageNum ? 'selected' : ''}>Page ${p.number}</option>`).join('')}
              </select>
            </label>
            <label>V2 Page:
              <select id="rev-v2-page-select">
                ${(currDoc?.pages || []).map(p => `<option value="${p.number}" ${p.number === currPageNum ? 'selected' : ''}>Page ${p.number}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>

        <!-- 2D Workspace Surface -->
        <div class="rev-stage-container mode-${activeMode}" id="rev-stage-container">
          ${renderActiveModeSurface({
            activeMode,
            prevImgUrl,
            currImgUrl,
            prevPage,
            currPage,
            selectedChange,
            state,
          })}
        </div>
      `}

      <!-- Detail Card for Selected Change -->
      ${renderSelectedChangeCard(selectedChange, current)}

      <!-- Change Navigator & Filter Tabs -->
      <div class="rev-findings-section">
        <div class="rev-section-head">
          <div>
            <h3>Detected Artwork &amp; Finding Changes (${changes.length})</h3>
            <p class="subtle">${esc(intel.summaryText || `${counts.resolvedCount} resolved · ${counts.regressionCount} regressions · ${counts.newIssueCount} new issues`)}</p>
          </div>
          <div class="rev-filter-chips">
            <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}" data-rev-filter="all">All (${changes.length})</button>
            <button class="filter-chip green ${activeFilter === 'resolved' ? 'active' : ''}" data-rev-filter="resolved">✓ Resolved (${counts.resolvedCount})</button>
            <button class="filter-chip red ${activeFilter === 'regressions' ? 'active' : ''}" data-rev-filter="regressions">⚠ Regressions (${counts.regressionCount})</button>
            <button class="filter-chip orange ${activeFilter === 'new_issues' ? 'active' : ''}" data-rev-filter="new_issues">+ New Issues (${counts.newIssueCount})</button>
            <button class="filter-chip amber ${activeFilter === 'persistent_review' ? 'active' : ''}" data-rev-filter="persistent_review">? Needs Review (${changes.filter(c => c.currentStatus === 'review' || c.previousStatus === 'review').length})</button>
            <button class="filter-chip blue ${activeFilter === 'visual' ? 'active' : ''}" data-rev-filter="visual">Visual (${changes.filter(c => c.classification === 'VISUAL_CHANGE').length})</button>
            <button class="filter-chip ${activeFilter === 'removed' ? 'active' : ''}" data-rev-filter="removed">Removed (${changes.filter(c => c.classification === 'REMOVED_CONTENT').length})</button>
            
            <div style="display:inline-flex;align-items:center;gap:4px;margin-left:auto;">
              <span style="font-size:11px;font-weight:700;color:#64748b;">Dept:</span>
              <select id="rev-dept-filter" style="padding:2px 8px;border-radius:4px;border:1px solid #cbd5e1;font-size:11px;font-weight:600;background:#fff;cursor:pointer;">
                <option value="all" ${activeDept === 'all' ? 'selected' : ''}>All Departments</option>
                <option value="legal" ${activeDept === 'legal' ? 'selected' : ''}>⚖️ Legal / Regulatory</option>
                <option value="rd" ${activeDept === 'rd' ? 'selected' : ''}>🔬 R&amp;D / Food Science</option>
                <option value="brand" ${activeDept === 'brand' ? 'selected' : ''}>🎨 Brand / Marketing</option>
                <option value="prepress" ${activeDept === 'prepress' ? 'selected' : ''}>🖨️ Prepress / Print</option>
              </select>
            </div>
          </div>
        </div>

        <div class="rev-changes-grid">
          ${filteredChanges.map((chg, idx) => `
            <article class="rev-change-card ${chg.id === selectedChangeId ? 'selected' : ''} ${chg.statusColor || 'gray'}" data-rev-change-id="${esc(chg.id)}">
              <div class="rev-card-head">
                <span class="rev-card-idx">#${String(idx + 1).padStart(2, '0')}</span>
                <span class="badge ${chg.statusColor || 'gray'}">${esc(chg.classification.replaceAll('_', ' '))}</span>
                <span class="rev-card-status">${esc(chg.previousStatus || 'new')} ⟶ ${esc(chg.currentStatus || 'none')}</span>
              </div>
              <h4 class="rev-card-title">${esc(chg.title)}</h4>
              <p class="rev-card-desc">${esc(chg.reason || chg.explanation || 'Packaging verification comparison.')}</p>
              <div class="rev-card-diff-mini">
                <div class="mini-before"><small>V1:</small> <span>${esc(chg.observedV1 || '—')}</span></div>
                <div class="mini-after"><small>V2:</small> <span>${esc(chg.observedV2 || '—')}</span></div>
              </div>
              ${chg.acknowledgment ? `<div class="rev-ack-badge">Reviewer: ${esc(chg.acknowledgment.decision)} (${esc(chg.acknowledgment.reviewerName)})</div>` : ''}
              <button class="textbutton rev-focus-btn" type="button" data-rev-focus-id="${esc(chg.id)}">Zoom to change ↗</button>
            </article>
          `).join('') || '<div class="queue-empty">No changes match this filter.</div>'}
        </div>
      </div>
    </section>
  `;
}

function renderActiveModeSurface({ activeMode, prevImgUrl, currImgUrl, prevPage, currPage, selectedChange, state }) {
  if (activeMode === 'side-by-side') {
    return `
      <div class="rev-dual-pane">
        <!-- V1 Pane (Left) -->
        <div class="rev-pane rev-pane-v1">
          <div class="rev-pane-header">
            <b>VERSION 1 — BEFORE</b>
            <span class="rev-pane-meta">Page ${prevPage?.number || 1} · ${prevPage?.width || 0}×${prevPage?.height || 0}pt</span>
          </div>
          <div class="workbench-art-frame" id="rev-frame-v1" tabindex="0">
            <div class="workbench-art-content" id="rev-content-v1">
              <img src="${prevImgUrl}" alt="V1 artwork">
              ${renderHighlightBox(selectedChange?.evidenceV1, 'v1-highlight')}
            </div>
          </div>
        </div>

        <!-- V2 Pane (Right) -->
        <div class="rev-pane rev-pane-v2">
          <div class="rev-pane-header">
            <b>VERSION 2 — AFTER</b>
            <span class="rev-pane-meta">Page ${currPage?.number || 1} · ${currPage?.width || 0}×${currPage?.height || 0}pt</span>
          </div>
          <div class="workbench-art-frame" id="rev-frame-v2" tabindex="0">
            <div class="workbench-art-content" id="rev-content-v2">
              <img src="${currImgUrl}" alt="V2 artwork">
              ${renderHighlightBox(selectedChange?.evidenceV2, 'v2-highlight')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (activeMode === 'overlay') {
    const opacity = state.overlayOpacity ?? 50;
    return `
      <div class="rev-overlay-surface">
        <div class="rev-overlay-slider-bar">
          <label>V1 (0%)</label>
          <input type="range" id="rev-opacity-slider" min="0" max="100" value="${opacity}">
          <label>V2 (100%)</label>
          <output id="rev-opacity-output">${opacity}%</output>
        </div>
        <div class="rev-overlay-container">
          <div class="rev-overlay-layer layer-v1">
            <img src="${prevImgUrl}" alt="V1 base layer">
          </div>
          <div class="rev-overlay-layer layer-v2" id="rev-overlay-v2" style="opacity: ${opacity / 100}">
            <img src="${currImgUrl}" alt="V2 overlay layer">
          </div>
        </div>
      </div>
    `;
  }

  if (activeMode === 'swipe') {
    const split = state.swipeSplit ?? 50;
    return `
      <div class="rev-swipe-surface">
        <div class="rev-swipe-container" id="rev-swipe-container">
          <div class="rev-swipe-layer layer-v1">
            <img src="${prevImgUrl}" alt="V1 left side">
            <span class="rev-swipe-label left">V1 BEFORE</span>
          </div>
          <div class="rev-swipe-layer layer-v2" id="rev-swipe-v2" style="clip-path: inset(0 0 0 ${split}%)">
            <img src="${currImgUrl}" alt="V2 right side">
            <span class="rev-swipe-label right">V2 AFTER</span>
          </div>
          <div class="rev-swipe-divider" id="rev-swipe-divider" style="left: ${split}%">
            <div class="rev-swipe-handle">❮ ❯</div>
          </div>
        </div>
        <div class="rev-swipe-slider-bar">
          <input type="range" id="rev-swipe-slider" min="0" max="100" value="${split}">
        </div>
      </div>
    `;
  }

  if (activeMode === 'heatmap') {
    return `
      <div class="rev-heatmap-surface" id="rev-heatmap-surface">
        <div class="rev-heatmap-info">
          <b>Visual Difference Heatmap</b>
          <span id="rev-diff-stats">Computing pixel delta...</span>
        </div>
        <div class="rev-heatmap-viewport" id="rev-heatmap-viewport">
          <div class="rev-heatmap-canvas" id="rev-heatmap-canvas">
            <img class="heatmap-base" src="${currImgUrl}" alt="V2 Base">
            <img class="heatmap-overlay" id="rev-diff-img" src="" alt="Pixel Difference Overlay" style="display:none">
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

function renderHighlightBox(evidence, className) {
  if (!evidence || !evidence.box) return '';
  const [x0, y0, x1, y1] = evidence.box;
  const left = (x0 * 100).toFixed(2);
  const top = (y0 * 100).toFixed(2);
  const width = ((x1 - x0) * 100).toFixed(2);
  const height = ((y1 - y0) * 100).toFixed(2);

  return `
    <div class="rev-highlight-box ${className}" style="left:${left}%; top:${top}%; width:${width}%; height:${height}%">
      <span class="rev-highlight-tag">${className.includes('v1') ? 'V1 EVIDENCE' : 'V2 EVIDENCE'}</span>
    </div>
  `;
}

function renderSelectedChangeCard(chg, current) {
  if (!chg) return '';
  const existingAck = current.revisionAcknowledgements?.[chg.id];

  return `
    <div class="rev-detail-card ${chg.statusColor || 'gray'}">
      <div class="rev-detail-header">
        <div>
          <span class="badge ${chg.statusColor || 'gray'}">${esc(chg.classification)}</span>
          <h3>${esc(chg.title)}</h3>
        </div>
        <div class="rev-detail-status-pill">
          Status: <b>${esc(chg.previousStatus || '—')}</b> ⟶ <b>${esc(chg.currentStatus || '—')}</b>
        </div>
      </div>

      <div class="rev-detail-body">
        <div class="rev-detail-values">
          <div class="rev-val-box before">
            <small>V1 PREVIOUS OBSERVED</small>
            <b>${esc(chg.observedV1 || 'Not detected')}</b>
            ${chg.evidenceV1?.location ? `<small class="location">${esc(chg.evidenceV1.location)}</small>` : ''}
          </div>
          <div class="rev-val-box after">
            <small>V2 REVISED OBSERVED</small>
            <b>${esc(chg.observedV2 || 'Not detected')}</b>
            ${chg.evidenceV2?.location ? `<small class="location">${esc(chg.evidenceV2.location)}</small>` : ''}
          </div>
          <div class="rev-val-box expected">
            <small>SOURCE-BACKED EXPECTED BASIS</small>
            <b>${esc(chg.expected || 'Supplied specification')}</b>
            ${chg.ruleSource ? `<small class="location">${esc(chg.ruleSource)}</small>` : ''}
          </div>
        </div>

        <p class="rev-detail-explanation">
          <b>Verification Assessment:</b> ${esc(chg.reason || chg.explanation || 'Verified comparison between artwork revisions.')}
        </p>

        <!-- Reviewer Acknowledgment Bar -->
        <div class="rev-ack-section">
          <div class="rev-ack-title">Reviewer Change Acknowledgment</div>
          <div class="rev-ack-controls">
            <select id="rev-ack-decision-${esc(chg.id)}" aria-label="Reviewer change decision">
              <option value="expected_change" ${existingAck?.decision === 'expected_change' ? 'selected' : ''}>Expected change (Design update)</option>
              <option value="unexpected_change" ${existingAck?.decision === 'unexpected_change' ? 'selected' : ''}>Unexpected change (Needs review)</option>
              <option value="needs_investigation" ${existingAck?.decision === 'needs_investigation' ? 'selected' : ''}>Needs investigation (Source conflict)</option>
              <option value="accepted_after_review" ${existingAck?.decision === 'accepted_after_review' ? 'selected' : ''}>Accepted after review</option>
              <option value="request_correction" ${existingAck?.decision === 'request_correction' ? 'selected' : ''}>Request correction from designer</option>
            </select>
            <input type="text" id="rev-ack-note-${esc(chg.id)}" placeholder="Add reviewer annotation or rationale..." value="${esc(existingAck?.note || '')}">
            <button class="primary" type="button" data-rev-action="save-acknowledgment" data-change-id="${esc(chg.id)}">Save Acknowledgment</button>
          </div>
          ${existingAck ? `
            <div class="rev-ack-history">
              Recorded by <b>${esc(existingAck.actorName)}</b> on ${new Date(existingAck.timestamp).toLocaleString()} · Decision: <span class="badge info">${esc(existingAck.decision)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Mounts interactive controllers to the Revision Studio container
 */
export function mountRevisionStudio(container, { current, previous, onStateChange, state: passedState } = {}) {
  if (!container) return;

  const state = passedState || {
    dimension: '3d',
    mode: 'side-by-side',
    filter: 'all',
    sync: true,
    prevPage: 1,
    currPage: 1,
    selectedChangeId: current.revision?.intelligence?.changes?.[0]?.id || null,
    overlayOpacity: 50,
    swipeSplit: 50,
  };

  let active3DController = null;
  let v1Controller = null;
  let v2Controller = null;
  let isSyncing = false;

  // Initialize 3D or 2D based on dimension
  if (state.dimension === '3d') {
    const mountEl = container.querySelector('#rev-3d-mount');
    if (mountEl) {
      import('./three/revision-3d-controller.js').then(({ Revision3DViewerController }) => {
        if (active3DController) {
          active3DController.dispose();
          active3DController = null;
        }
        active3DController = new Revision3DViewerController({
          container: mountEl,
          reviewV1: previous,
          reviewV2: current,
          intelligence: current.revision?.intelligence,
          onSelectChange: (chgId) => {
            selectAndFocusChange(chgId, true);
          },
        });
        active3DController.init().then(() => {
          if (state.selectedChangeId) {
            active3DController.focusChange(state.selectedChangeId);
          }
        }).catch(err => {
          console.error('[RevisionStudio] 3D initialization error:', err);
          mountEl.innerHTML = `<div class="notice error">Failed to initialize 3D Revision Studio: ${esc(err.message)}</div>`;
        });
      }).catch(err => {
        console.error('[RevisionStudio] Failed to load 3D module:', err);
        mountEl.innerHTML = `<div class="notice error">Failed to load 3D viewer engine: ${esc(err.message)}</div>`;
      });
    }
  } else {
    initViewports();
  }

  function initViewports() {
    const frameV1 = container.querySelector('#rev-frame-v1');
    const contentV1 = container.querySelector('#rev-content-v1');
    const frameV2 = container.querySelector('#rev-frame-v2');
    const contentV2 = container.querySelector('#rev-content-v2');

    if (frameV1 && contentV1) {
      v1Controller = mountViewport({
        frame: frameV1,
        content: contentV1,
        onChange: view => {
          if (!state.sync || isSyncing || !v2Controller) return;
          isSyncing = true;
          v2Controller.setView(view);
          isSyncing = false;
        },
      });
    }

    if (frameV2 && contentV2) {
      v2Controller = mountViewport({
        frame: frameV2,
        content: contentV2,
        onChange: view => {
          if (!state.sync || isSyncing || !v1Controller) return;
          isSyncing = true;
          v1Controller.setView(view);
          isSyncing = false;
        },
      });
    }
  }

  // Dimension Switcher (3D Packaging vs 2D Artwork)
  container.querySelectorAll('[data-rev-dimension]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dim = btn.dataset.revDimension;
      if (dim === state.dimension) return;
      state.dimension = dim;
      rerender();
    });
  });

  // Mode switcher (2D)
  container.querySelectorAll('[data-rev-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.revMode;
      rerender();
      if (state.mode === 'heatmap') loadHeatmap();
    });
  });

  // Filter chips
  container.querySelectorAll('[data-rev-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.revFilter;
      rerender();
    });
  });

  // Department dropdown
  const deptSelect = container.querySelector('#rev-dept-filter');
  if (deptSelect) {
    deptSelect.addEventListener('change', () => {
      state.dept = deptSelect.value;
      rerender();
    });
  }

  // Sync checkbox (2D)
  const syncBox = container.querySelector('#rev-sync-checkbox');
  if (syncBox) {
    syncBox.addEventListener('change', () => {
      state.sync = syncBox.checked;
    });
  }

  // Page selectors (2D)
  const p1Select = container.querySelector('#rev-v1-page-select');
  if (p1Select) {
    p1Select.addEventListener('change', () => {
      state.prevPage = Number(p1Select.value);
      rerender();
    });
  }

  const p2Select = container.querySelector('#rev-v2-page-select');
  if (p2Select) {
    p2Select.addEventListener('change', () => {
      state.currPage = Number(p2Select.value);
      rerender();
    });
  }

  // Change card selection and zoom focus
  container.querySelectorAll('[data-rev-change-id]').forEach(card => {
    card.addEventListener('click', () => {
      const changeId = card.dataset.revChangeId;
      selectAndFocusChange(changeId, false);
    });
  });

  container.querySelectorAll('[data-rev-focus-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const changeId = btn.dataset.revFocusId;
      selectAndFocusChange(changeId, false);
    });
  });

  function selectAndFocusChange(changeId, from3D = false) {
    state.selectedChangeId = changeId;
    const changes = current.revision?.intelligence?.changes || [];
    const change = changes.find(c => c.id === changeId);
    if (!change) return;

    // Highlight active change card
    container.querySelectorAll('.rev-change-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.revChangeId === changeId);
    });

    if (state.dimension === '3d') {
      // In 3D mode, update the detail card without tearing down WebGL canvas
      const detailCard = container.querySelector('.rev-detail-card');
      if (detailCard) {
        const dummy = document.createElement('div');
        dummy.innerHTML = renderSelectedChangeCard(change, current);
        if (dummy.firstElementChild) {
          detailCard.replaceWith(dummy.firstElementChild);
          bindAckButtons();
        }
      }
      if (!from3D && active3DController) {
        active3DController.focusChange(changeId);
      }
    } else {
      rerender();
      if (v1Controller && change.evidenceV1?.box) {
        v1Controller.focusOnBox(change.evidenceV1.box);
      }
      if (v2Controller && change.evidenceV2?.box) {
        v2Controller.focusOnBox(change.evidenceV2.box);
      }
    }
  }

  // Opacity slider for Overlay Mode (2D)
  const opacitySlider = container.querySelector('#rev-opacity-slider');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      const val = opacitySlider.value;
      state.overlayOpacity = Number(val);
      const layerV2 = container.querySelector('#rev-overlay-v2');
      const output = container.querySelector('#rev-opacity-output');
      if (layerV2) layerV2.style.opacity = String(val / 100);
      if (output) output.textContent = `${val}%`;
    });
  }

  // Swipe slider for Swipe Mode (2D)
  const swipeSlider = container.querySelector('#rev-swipe-slider');
  if (swipeSlider) {
    swipeSlider.addEventListener('input', () => {
      const val = swipeSlider.value;
      state.swipeSplit = Number(val);
      const layerV2 = container.querySelector('#rev-swipe-v2');
      const divider = container.querySelector('#rev-swipe-divider');
      if (layerV2) layerV2.style.clipPath = `inset(0 0 0 ${val}%)`;
      if (divider) divider.style.left = `${val}%`;
    });
  }

  // Fit to page action
  const fitBtn = container.querySelector('[data-rev-action="fit-both"]');
  if (fitBtn) {
    fitBtn.addEventListener('click', () => {
      v1Controller?.fit();
      v2Controller?.fit();
    });
  }

  // Fullscreen action
  const fsBtn = container.querySelector('[data-rev-action="toggle-fullscreen"]');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      const stage = container.querySelector('#rev-stage-container') || container.querySelector('#rev-3d-mount');
      if (!stage) return;
      if (!document.fullscreenElement) {
        stage.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });
  }

  // Revision comparison picker entrypoint
  const openCompareBtn = container.querySelector('[data-action="open-revision-compare"]');
  if (openCompareBtn) {
    openCompareBtn.addEventListener('click', async () => {
      try {
        const { openRevisionPickerModal } = await import('./revision-picker.js');
        const res = await fetch('/api/reviews');
        const list = res.ok ? await res.json() : [];
        openRevisionPickerModal({
          reviews: list,
          currentReview: current,
          onSelectComparison: ({ v1Id, v2Id, pkgType }) => {
            window.location.hash = `#review/${v2Id}`;
            window.location.reload();
          },
        });
      } catch (err) {
        console.error('Failed to open revision picker:', err);
      }
    });
  }

  function bindAckButtons() {
    container.querySelectorAll('[data-rev-action="save-acknowledgment"]').forEach(btn => {
      btn.onclick = async () => {
        const changeId = btn.dataset.changeId;
        const decisionSelect = container.querySelector(`#rev-ack-decision-${changeId}`);
        const noteInput = container.querySelector(`#rev-ack-note-${changeId}`);

        if (!decisionSelect) return;
        const decision = decisionSelect.value;
        const note = noteInput?.value || '';

        btn.disabled = true;
        btn.textContent = 'Saving…';

        try {
          const res = await fetch(`/api/reviews/${current.id}/revision/acknowledge`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-packproof-token': document.querySelector('meta[name="csrf-token"]')?.content || '',
            },
            body: JSON.stringify({ changeId, decision, note }),
          });

          if (!res.ok) throw new Error('Failed to save acknowledgment');
          const data = await res.json();
          current.revisionAcknowledgements = data.acknowledgements;
          btn.textContent = 'Saved ✓';
          setTimeout(() => {
            const chg = (current.revision?.intelligence?.changes || []).find(c => c.id === changeId);
            if (chg) chg.acknowledgment = data.acknowledgements[changeId];
            rerender();
          }, 600);
        } catch (err) {
          btn.textContent = 'Save Failed';
          btn.disabled = false;
        }
      };
    });
  }

  bindAckButtons();

  async function loadHeatmap() {
    const statsEl = container.querySelector('#rev-diff-stats');
    const diffImg = container.querySelector('#rev-diff-img');
    if (!statsEl || !diffImg) return;

    statsEl.textContent = 'Analyzing raster differences…';
    try {
      const res = await fetch(`/api/reviews/${current.id}/revision/visual-diff?page=${state.currPage}&prevPage=${state.prevPage}`);
      if (!res.ok) throw new Error('Visual diff unavailable');
      const data = await res.json();

      if (data.status === 'SUCCESS' && data.diffImage) {
        diffImg.src = `/api/reviews/${current.id}/images/${data.diffImage}`;
        diffImg.style.display = 'block';
        statsEl.textContent = `Pixel Delta: ${data.stats.changedPixels.toLocaleString()} px (${data.stats.changePercentage}%) · ${data.stats.regionCount} changed regions detected`;
      } else {
        statsEl.textContent = data.error || 'Alignment requires reviewer confirmation.';
      }
    } catch (err) {
      statsEl.textContent = 'Visual comparison requires manual alignment.';
    }
  }

  function rerender() {
    if (active3DController) {
      active3DController.dispose();
      active3DController = null;
    }
    const newHtml = revisionStudioView(current, previous, state);
    container.innerHTML = newHtml;
    mountRevisionStudio(container, { current, previous, onStateChange, state });
  }
}
