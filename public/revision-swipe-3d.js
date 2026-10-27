/**
 * PackSignal 3D Artwork Revision Swipe (public/revision-swipe-3d.js)
 *
 * Implements Upgrade #49 Part A:
 * - Synchronized 3D V1/V2 Artwork Revision Swipe
 * - Scissor Test / Split-view divider [Show V1] [50/50 Swipe] [Show V2] [Side-by-Side] [Overlay Differences]
 * - Dual-model camera pose synchronization & physical scale preservation
 * - Semantic change resolution markers:
 *   - Green Check: Verified resolved issue (R03, R11)
 *   - Red Warning: Verified new regression (R09)
 *   - Amber Marker: Persistent issue or review item (R12)
 *   - Neutral Marker: Not rechecked or unchanged
 * - Honest spatial registration: Fallback notice when dieline dimensions differ
 * - Revision summary panel and data-driven filters
 */

import { Revision3DViewerController, REVISION_PIN_COLORS } from './three/revision-3d-controller.js';

export const REVISION_CATEGORIES = Object.freeze({
  ALL: 'all',
  RESOLVED: 'resolved',
  NEW_REGRESSION: 'regression',
  PERSISTENT: 'persistent',
  NEEDS_REVIEW: 'review',
  NOT_RECHECKED: 'not_rechecked',
});

export class RevisionSwipe3D {
  constructor({
    container,
    reviewV1,
    reviewV2,
    onSelectFinding = null,
    onViewIn2D = null,
  }) {
    this.container = container;
    this.reviewV1 = reviewV1;
    this.reviewV2 = reviewV2;
    this.onSelectFinding = onSelectFinding;
    this.onViewIn2D = onViewIn2D;

    this.activeFilter = REVISION_CATEGORIES.ALL;
    this.controller = null;
    this.selectedFindingId = null;
    this.isDisposed = false;
  }

  /**
   * Initializes the 3D swipe DOM structure and underlying WebGL scenes.
   */
  async init() {
    if (!this.container) return;

    this.container.classList.add('packsignal-revision-swipe-studio');
    this.container.innerHTML = `
      <div class="rev-swipe-header-toolbar" role="toolbar" aria-label="3D Artwork Revision Swipe Controls">
        <div class="rev-toolbar-left">
          <span class="rev-toolbar-title">3D REVISION SWIPE</span>
          <div class="rev-quick-buttons" role="group" aria-label="Swipe View Modes">
            <button type="button" class="rev-btn" data-swipe-action="show-v1">[Show V1]</button>
            <button type="button" class="rev-btn active" data-swipe-action="swipe-50">[50/50 Swipe]</button>
            <button type="button" class="rev-btn" data-swipe-action="show-v2">[Show V2]</button>
            <button type="button" class="rev-btn" data-swipe-action="side-by-side">[Side-by-Side]</button>
            <button type="button" class="rev-btn" data-swipe-action="overlay-diff">[Overlay Differences]</button>
          </div>
        </div>

        <div class="rev-toolbar-right">
          <div class="rev-slider-group">
            <span class="slider-label">V2</span>
            <input type="range" class="rev-swipe-slider" data-swipe-slider min="0" max="100" value="50" aria-label="Draggable 3D revision swipe divider">
            <span class="slider-label">V1</span>
            <output class="slider-value" data-swipe-val>50%</output>
          </div>
        </div>
      </div>

      <div class="rev-summary-banner" data-rev-summary-banner>
        <!-- Populated dynamically by renderSummary() -->
      </div>

      <div class="rev-viewport-stage" data-rev-stage>
        <div class="rev-3d-mount" data-rev-mount style="width: 100%; height: 500px; position: relative;"></div>
      </div>

      <div class="rev-changes-drawer" data-rev-drawer>
        <div class="rev-drawer-tabs" role="tablist">
          <button type="button" class="rev-tab active" data-filter="all">All Changes (<span data-count-all>0</span>)</button>
          <button type="button" class="rev-tab" data-filter="resolved">✓ Resolved (<span data-count-resolved>0</span>)</button>
          <button type="button" class="rev-tab" data-filter="regression">⚠ New Regressions (<span data-count-regression>0</span>)</button>
          <button type="button" class="rev-tab" data-filter="persistent">Persistent (<span data-count-persistent>0</span>)</button>
          <button type="button" class="rev-tab" data-filter="review">? Needs Review (<span data-count-review>0</span>)</button>
          <button type="button" class="rev-tab" data-filter="not_rechecked">Not Rechecked (<span data-count-not-rechecked>0</span>)</button>
        </div>
        <div class="rev-changes-list" data-rev-changes-list>
          <!-- List items rendered here -->
        </div>
      </div>
    `;

    this.bindEvents();
    await this.mountViewer();
    this.renderSummary();
    this.renderChangesList();
  }

  /**
   * Mounts the WebGL Revision3DViewerController into the viewport mount element.
   */
  async mountViewer() {
    const mountEl = this.container.querySelector('[data-rev-mount]');
    if (!mountEl) return;

    this.controller = new Revision3DViewerController({
      container: mountEl,
      reviewV1: this.reviewV1,
      reviewV2: this.reviewV2,
      intelligence: this.reviewV2?.revision?.intelligence,
      onSelectChange: (changeId) => {
        this.focusChange(changeId);
      },
    });

    await this.controller.init();
    // Default to 3D swipe mode if geometries are compatible
    if (this.controller.geometryCompatible) {
      this.controller.setMode('3d-swipe');
    } else {
      this.controller.setMode('3d-side-by-side');
    }
  }

  /**
   * Binds UI toolbar and slider events.
   */
  bindEvents() {
    const slider = this.container.querySelector('[data-swipe-slider]');
    const output = this.container.querySelector('[data-swipe-val]');

    slider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (output) output.textContent = `${val}%`;
      this.setSwipeProgress(val / 100);
    });

    this.container.querySelectorAll('[data-swipe-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('[data-swipe-action]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const act = btn.dataset.swipeAction;
        if (act === 'show-v1') this.showV1();
        else if (act === 'swipe-50') this.setSwipe50();
        else if (act === 'show-v2') this.showV2();
        else if (act === 'side-by-side') this.setSideBySide();
        else if (act === 'overlay-diff') this.setOverlayDifferences();
      });
    });

    this.container.querySelectorAll('[data-filter]').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.container.querySelectorAll('[data-filter]').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeFilter = tab.dataset.filter;
        this.renderChangesList();
      });
    });
  }

  /**
   * Swipe presets: Show V1 (100% V1), 50/50 split, Show V2 (100% V2).
   */
  showV1() {
    this.updateSliderUI(100);
    if (this.controller) {
      this.controller.setMode('3d-swipe');
      this.controller.setSwipeProgress(1.0);
    }
  }

  setSwipe50() {
    this.updateSliderUI(50);
    if (this.controller) {
      this.controller.setMode('3d-swipe');
      this.controller.setSwipeProgress(0.5);
    }
  }

  showV2() {
    this.updateSliderUI(0);
    if (this.controller) {
      this.controller.setMode('3d-swipe');
      this.controller.setSwipeProgress(0.0);
    }
  }

  setSideBySide() {
    if (this.controller) {
      this.controller.setMode('3d-side-by-side');
    }
  }

  setOverlayDifferences() {
    if (this.controller) {
      this.controller.setMode('3d-blend');
      this.controller.setBlendProgress(0.5);
    }
  }

  setSwipeProgress(p) {
    if (this.controller && this.controller.setSwipeProgress) {
      this.controller.setSwipeProgress(p);
    }
  }

  updateSliderUI(val) {
    const slider = this.container.querySelector('[data-swipe-slider]');
    const output = this.container.querySelector('[data-swipe-val]');
    if (slider) slider.value = String(val);
    if (output) output.textContent = `${val}%`;
  }

  /**
   * One-click camera fly-to and evidence navigation for specific findings.
   * Handles:
   * - R03 Net Quantity (corrected to 1000 mL) -> focuses front PDP
   * - R11 Storage statement (restored) -> focuses information panel
   * - R09 Customer-care contact (new regression in V2) -> shows former V1 location with explanation
   * - R12 Claim approval -> shows claim wording and review status
   */
  focusChange(changeId) {
    this.selectedFindingId = changeId;
    if (this.controller) {
      this.controller.focusChange(changeId);
    }

    // Highlight in changes list
    const items = this.container.querySelectorAll('.rev-change-row');
    items.forEach((item) => {
      const match = item.dataset.changeId === changeId || item.dataset.findingId === changeId;
      item.classList.toggle('selected', match);
    });

    // Notify listeners for 2D sync
    const change = this.getChangeById(changeId);
    if (change) {
      this.onSelectFinding?.(change.findingId || change.id, change);
      if (this.onViewIn2D && change.evidenceV2?.page) {
        this.onViewIn2D(change.findingId || change.id, change.evidenceV2.page, 0);
      } else if (this.onViewIn2D && change.evidenceV1?.page) {
        this.onViewIn2D(change.findingId || change.id, change.evidenceV1.page, 0);
      }
    }
  }

  getChangeById(id) {
    const changes = this.getAllChanges();
    return changes.find((c) => c.id === id || c.findingId === id || c.ruleId === id);
  }

  getAllChanges() {
    return this.reviewV2?.revision?.intelligence?.changes ||
      this.reviewV2?.revision?.changes ||
      [];
  }

  /**
   * Computes counts for revision summary.
   */
  getSummary() {
    const changes = this.getAllChanges();
    const resolved = changes.filter((c) => c.classification === 'VERIFIED_RESOLVED' || c.change === 'resolved').length;
    const regressions = changes.filter((c) => c.classification === 'REGRESSION' || c.change === 'new_issue').length;
    const persistent = changes.filter((c) => c.currentStatus === 'issue' || c.classification === 'PERSISTENT_DEFECT').length;
    const review = changes.filter((c) => c.currentStatus === 'review' || c.classification === 'STILL_NEEDS_REVIEW').length;
    const notRechecked = changes.filter((c) => c.change === 'not_rechecked' || c.classification === 'NOT_RECHECKED').length;

    return {
      previousReviewId: this.reviewV1?.id || 'V1-Baseline',
      currentReviewId: this.reviewV2?.id || 'V2-Current',
      resolvedCount: resolved,
      regressionCount: regressions,
      persistentCount: persistent,
      needsReviewCount: review,
      notRecheckedCount: notRechecked,
      totalChanges: changes.length,
      geometryCompatible: this.controller ? this.controller.geometryCompatible : true,
    };
  }

  renderSummary() {
    const summary = this.getSummary();
    const banner = this.container.querySelector('[data-rev-summary-banner]');
    if (!banner) return;

    banner.innerHTML = `
      <div class="rev-summary-meta">
        <span><b>REVISION COMPARISON:</b> Previous: <code>${summary.previousReviewId}</code> → Current: <code>${summary.currentReviewId}</code></span>
        ${!summary.geometryCompatible ? `<span class="badge warning">Exact spatial registration unavailable (Side-by-side active)</span>` : `<span class="badge success">3D Spatial Registration Active</span>`}
      </div>
      <div class="rev-summary-counts">
        <span class="count-pill resolved">✓ Resolved: <b>${summary.resolvedCount}</b></span>
        <span class="count-pill regression">⚠ New Regressions: <b>${summary.regressionCount}</b></span>
        <span class="count-pill persistent">Persistent Issues: <b>${summary.persistentCount}</b></span>
        <span class="count-pill review">? Still Needs Review: <b>${summary.needsReviewCount}</b></span>
        <span class="count-pill not-rechecked">Not Rechecked: <b>${summary.notRecheckedCount}</b></span>
      </div>
    `;

    // Update tab counts
    const countAll = this.container.querySelector('[data-count-all]');
    if (countAll) countAll.textContent = summary.totalChanges;
    const countRes = this.container.querySelector('[data-count-resolved]');
    if (countRes) countRes.textContent = summary.resolvedCount;
    const countReg = this.container.querySelector('[data-count-regression]');
    if (countReg) countReg.textContent = summary.regressionCount;
    const countPers = this.container.querySelector('[data-count-persistent]');
    if (countPers) countPers.textContent = summary.persistentCount;
    const countRev = this.container.querySelector('[data-count-review]');
    if (countRev) countRev.textContent = summary.needsReviewCount;
    const countNot = this.container.querySelector('[data-count-not-rechecked]');
    if (countNot) countNot.textContent = summary.notRecheckedCount;
  }

  renderChangesList() {
    const listEl = this.container.querySelector('[data-rev-changes-list]');
    if (!listEl) return;

    const allChanges = this.getAllChanges();
    const filtered = allChanges.filter((c) => {
      if (this.activeFilter === REVISION_CATEGORIES.ALL) return true;
      if (this.activeFilter === REVISION_CATEGORIES.RESOLVED) {
        return c.classification === 'VERIFIED_RESOLVED' || c.change === 'resolved';
      }
      if (this.activeFilter === REVISION_CATEGORIES.NEW_REGRESSION) {
        return c.classification === 'REGRESSION' || c.change === 'new_issue';
      }
      if (this.activeFilter === REVISION_CATEGORIES.PERSISTENT) {
        return c.currentStatus === 'issue' || c.classification === 'PERSISTENT_DEFECT';
      }
      if (this.activeFilter === REVISION_CATEGORIES.NEEDS_REVIEW) {
        return c.currentStatus === 'review' || c.classification === 'STILL_NEEDS_REVIEW';
      }
      if (this.activeFilter === REVISION_CATEGORIES.NOT_RECHECKED) {
        return c.change === 'not_rechecked' || c.classification === 'NOT_RECHECKED';
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="rev-empty-state">No changes in this category.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((c) => {
      const isResolved = c.classification === 'VERIFIED_RESOLVED' || c.change === 'resolved';
      const isRegression = c.classification === 'REGRESSION' || c.change === 'new_issue';
      const isReview = c.currentStatus === 'review';

      let markerIcon = '●';
      let markerClass = 'neutral';
      if (isResolved) {
        markerIcon = '✓';
        markerClass = 'resolved';
      } else if (isRegression) {
        markerIcon = '⚠';
        markerClass = 'regression';
      } else if (isReview) {
        markerIcon = '?';
        markerClass = 'review';
      }

      const isSelected = c.id === this.selectedFindingId || c.findingId === this.selectedFindingId;

      return `
        <div class="rev-change-row ${markerClass} ${isSelected ? 'selected' : ''}" data-change-id="${c.id}" data-finding-id="${c.findingId || ''}" tabindex="0" role="button" aria-label="Focus change ${c.title}">
          <div class="row-marker ${markerClass}">${markerIcon}</div>
          <div class="row-content">
            <div class="row-header">
              <span class="row-title">${c.title || c.id}</span>
              <span class="row-badge ${markerClass}">${c.classification || c.change}</span>
            </div>
            <div class="row-diff">
              <span class="diff-v1">V1: <s>${c.observedV1 || c.before || '—'}</s></span>
              <span class="diff-arrow">→</span>
              <span class="diff-v2">V2: <b>${c.observedV2 || c.after || '—'}</b></span>
            </div>
            ${c.reason ? `<div class="row-reason">${c.reason}</div>` : ''}
            ${isRegression && !c.evidenceV2 ? `<div class="row-absence-note">⚠️ Content missing in V2. Camera focuses former V1 placement without fabricating coordinates.</div>` : ''}
          </div>
          <button type="button" class="row-focus-btn" title="Focus 3D surface">🎯 Focus</button>
        </div>
      `;
    }).join('');

    // Bind row click handlers
    listEl.querySelectorAll('.rev-change-row').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.changeId;
        this.focusChange(id);
      });
    });
  }

  dispose() {
    this.isDisposed = true;
    if (this.controller && typeof this.controller.dispose === 'function') {
      this.controller.dispose();
      this.controller = null;
    }
  }
}

/**
 * Factory helper to mount RevisionSwipe3D.
 */
export function createRevisionSwipe3D(options = {}) {
  const swipe = new RevisionSwipe3D(options);
  swipe.init();
  return swipe;
}
