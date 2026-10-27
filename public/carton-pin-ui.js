/**
 * PackSignal — Carton Pin UI Manager
 * Orchestrates 20 px circular badges, count clusters, spiderfy expansion,
 * hover preview cards, previous/next finding navigation, and status filtering.
 */

import { extractCartonFindingPins, STATUS_LABELS } from './carton-finding-pins.js';
import { projectFindingPins } from './carton-pin-projection.js';
import {
  clusterProjectedPins,
  calculateSpiderfyPositions,
  resolveClusterExpansionMode,
} from './carton-pin-clustering.js';

export class CartonPinUIManager {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.sceneElement - The .carton-scene DOM node
   * @param {Object} options.review - The active review object
   * @param {Object} [options.panelZones] - Resolved face panel zones
   * @param {Function} [options.onSelectFinding] - Callback when finding is selected
   * @param {Function} [options.onViewIn2D] - Callback to view finding in 2D proof
   * @param {Object} [options.cameraController] - CartonCameraController instance
   * @param {string} [options.selectedFindingId] - Initially selected finding ID
   */
  constructor(options) {
    this.scene = options.sceneElement;
    this.review = options.review;
    this.panelZones = options.panelZones;
    this.onSelectFinding = options.onSelectFinding;
    this.onViewIn2D = options.onViewIn2D;
    this.cameraController = options.cameraController;
    this.selectedFindingId = options.selectedFindingId || null;

    // Filter modes: 'all' | 'issues' | 'review' | 'matches' | 'priority' (issues + review)
    this.filterMode = options.filterMode || 'priority';

    // Internal state
    this.extracted = extractCartonFindingPins(this.review, { panelZones: this.panelZones });
    this.allPins = this.extracted.pins;
    this.unlocatedFindings = this.extracted.unlocatedFindings;

    this.expandedClusterId = null;
    this.previewCard = null;
    this.popoverEl = null;

    this.departmentFilter = 'all';
    this.includeCollaboratingDepartments = false;

    this.overlayLayer = null;
    this.spiderfySvg = null;

    this.cartonPose = {
      angle: Number(this.scene?.dataset?.angle) || 0,
      tilt: Number(this.scene?.dataset?.tilt) || -8,
    };

    this.cartonDims = {
      width: Number(this.scene?.dataset?.cartonWidth) || 214,
      height: Number(this.scene?.dataset?.cartonHeight) || 282,
      depth: Number(this.scene?.dataset?.cartonDepth) || 64,
    };

    this.boundOnPointerDown = this.handlePointerDownOutside.bind(this);
    this.boundOnKeyDown = this.handleKeyDown.bind(this);
  }

  mount() {
    if (!this.scene || typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    this.unmount();

    // Create screen-space overlay layer
    this.overlayLayer = document.createElement('div');
    this.overlayLayer.className = 'carton-pin-overlay-layer';
    this.overlayLayer.setAttribute('aria-label', 'Packaging Finding Pins');

    // Create SVG layer for spiderfy connector lines
    this.spiderfySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.spiderfySvg.setAttribute('class', 'spiderfy-svg');
    this.overlayLayer.appendChild(this.spiderfySvg);

    this.scene.appendChild(this.overlayLayer);

    // Global listeners for dismiss
    window.addEventListener('pointerdown', this.boundOnPointerDown, true);
    window.addEventListener('keydown', this.boundOnKeyDown, true);

    this.update();
  }

  unmount() {
    this.hidePreview();
    this.closePopover();
    if (this.overlayLayer && this.overlayLayer.parentNode) {
      this.overlayLayer.parentNode.removeChild(this.overlayLayer);
    }
    this.overlayLayer = null;
    this.spiderfySvg = null;

    window.removeEventListener('pointerdown', this.boundOnPointerDown, true);
    window.removeEventListener('keydown', this.boundOnKeyDown, true);
  }

  setFilter(filterMode) {
    this.filterMode = filterMode;
    this.collapseCluster();
    this.update();
  }

  setDepartmentFilter(dept = 'all', includeCollaborating = false) {
    this.departmentFilter = dept;
    this.includeCollaboratingDepartments = includeCollaborating;
    this.collapseCluster();
    this.update();
  }

  setSelectedFinding(findingId) {
    this.selectedFindingId = findingId;
    this.updateSelectedState();
  }

  updatePose(angle, tilt) {
    this.cartonPose.angle = angle;
    this.cartonPose.tilt = tilt;
    this.update();
  }

  getFilteredPins() {
    if (!this.allPins || this.allPins.length === 0) return [];

    let list = this.allPins;

    // 1. Department filter
    if (this.departmentFilter && this.departmentFilter !== 'all') {
      const target = this.departmentFilter.toLowerCase();
      list = list.filter(p => {
        const primary = String(p.primaryDepartment || 'unassigned').toLowerCase();
        if (primary === target) return true;
        if (this.includeCollaboratingDepartments && Array.isArray(p.collaboratingDepartments)) {
          return p.collaboratingDepartments.some(c => String(c).toLowerCase() === target);
        }
        return false;
      });
    }

    // 2. Status filter
    switch (this.filterMode) {
      case 'issues':
        return list.filter(p => p.status === 'issue');
      case 'review':
        return list.filter(p => p.status === 'review');
      case 'matches':
        return list.filter(p => p.status === 'match');
      case 'priority':
        // Default: Issues + Need Review
        return list.filter(p => p.status === 'issue' || p.status === 'review');
      case 'all':
      default:
        return list;
    }
  }

  update() {
    if (!this.overlayLayer || !this.scene) return;

    const bounds = {
      width: this.scene.clientWidth || 500,
      height: this.scene.clientHeight || 385,
    };

    const filtered = this.getFilteredPins();

    // 1. Project pins to screen-space
    const projected = projectFindingPins(filtered, {
      cartonDims: this.cartonDims,
      cartonPose: this.cartonPose,
      sceneBounds: bounds,
    });

    // 2. Perform screen-space proximity clustering
    const { clusters, standalonePins } = clusterProjectedPins(projected, {
      distanceThreshold: 30,
      filterInvisible: true,
    });

    // Clear existing pin elements except the SVG layer
    const elementsToRemove = this.overlayLayer.querySelectorAll(
      '.carton-smart-pin, .carton-smart-cluster'
    );
    elementsToRemove.forEach(el => el.remove());

    // Clear SVG connector lines
    while (this.spiderfySvg?.firstChild) {
      this.spiderfySvg.removeChild(this.spiderfySvg.firstChild);
    }

    // 3. Render Standalone Pins (strictly 20 px)
    for (const item of standalonePins) {
      const pin = item.pin;
      const isSelected = pin.findingId === this.selectedFindingId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `carton-smart-pin ${pin.status} ${isSelected ? 'selected' : ''}`;
      btn.style.transform = `translate3d(${Math.round(item.screenX)}px, ${Math.round(item.screenY)}px, 0) translate(-50%, -50%)`;
      btn.dataset.pinId = pin.pinId;
      btn.dataset.findingId = pin.findingId;
      btn.setAttribute(
        'aria-label',
        `${STATUS_LABELS[pin.status] || 'Finding'}: ${pin.title} on ${pin.panelId} panel`
      );
      btn.setAttribute('aria-pressed', String(isSelected));
      btn.innerHTML = pin.statusSymbol;

      // Event handlers
      btn.addEventListener('mouseenter', e => this.showPinPreview(pin, e.target));
      btn.addEventListener('mouseleave', () => this.hidePreview());
      btn.addEventListener('focus', e => this.showPinPreview(pin, e.target));
      btn.addEventListener('blur', () => this.hidePreview());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.selectFindingAction(pin);
      });

      this.overlayLayer.appendChild(btn);
    }

    // 4. Render Clusters
    for (const cluster of clusters) {
      const isExpanded = this.expandedClusterId === cluster.clusterId;

      const clusterBtn = document.createElement('button');
      clusterBtn.type = 'button';
      clusterBtn.className = `carton-smart-cluster ${cluster.status} ${isExpanded ? 'expanded' : ''}`;
      clusterBtn.style.transform = `translate3d(${Math.round(cluster.screenX)}px, ${Math.round(cluster.screenY)}px, 0) translate(-50%, -50%)`;
      clusterBtn.dataset.clusterId = cluster.clusterId;
      clusterBtn.setAttribute(
        'aria-label',
        `${cluster.count} findings on ${cluster.panelId} panel: ${cluster.breakdown.issue} issues, ${cluster.breakdown.review} review, ${cluster.breakdown.match} matches`
      );
      clusterBtn.textContent = String(cluster.count);

      clusterBtn.addEventListener('mouseenter', e => this.showClusterBreakdown(cluster, e.target));
      clusterBtn.addEventListener('mouseleave', () => this.hidePreview());
      clusterBtn.addEventListener('focus', e => this.showClusterBreakdown(cluster, e.target));
      clusterBtn.addEventListener('blur', () => this.hidePreview());
      clusterBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleCluster(cluster, bounds);
      });

      this.overlayLayer.appendChild(clusterBtn);

      // If cluster is expanded, render its spiderfy pins and connector lines
      if (isExpanded) {
        this.renderSpiderfyExpansion(cluster, bounds);
      }
    }
  }

  renderSpiderfyExpansion(cluster, viewport) {
    const mode = resolveClusterExpansionMode(cluster.pins.length, viewport);

    if (mode === 'popover') {
      this.openPopoverList(cluster);
      return;
    }

    const expandedPositions = calculateSpiderfyPositions(cluster, viewport);

    for (const item of expandedPositions) {
      const pin = item.pin;
      const isSelected = pin.findingId === this.selectedFindingId;

      // Draw SVG connector line
      if (this.spiderfySvg) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(item.lineFrom.x));
        line.setAttribute('y1', String(item.lineFrom.y));
        line.setAttribute('x2', String(item.x));
        line.setAttribute('y2', String(item.y));
        line.setAttribute('class', 'spiderfy-connector');
        this.spiderfySvg.appendChild(line);
      }

      // Draw 20 px individual badge
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `carton-smart-pin ${pin.status} ${isSelected ? 'selected' : ''}`;
      btn.style.transform = `translate3d(${Math.round(item.x)}px, ${Math.round(item.y)}px, 0) translate(-50%, -50%)`;
      btn.dataset.pinId = pin.pinId;
      btn.dataset.findingId = pin.findingId;
      btn.setAttribute(
        'aria-label',
        `${STATUS_LABELS[pin.status] || 'Finding'}: ${pin.title} on ${pin.panelId} panel`
      );
      btn.setAttribute('aria-pressed', String(isSelected));
      btn.innerHTML = pin.statusSymbol;

      btn.addEventListener('mouseenter', e => this.showPinPreview(pin, e.target));
      btn.addEventListener('mouseleave', () => this.hidePreview());
      btn.addEventListener('focus', e => this.showPinPreview(pin, e.target));
      btn.addEventListener('blur', () => this.hidePreview());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.selectFindingAction(pin);
      });

      this.overlayLayer.appendChild(btn);
    }
  }

  toggleCluster(cluster, viewport) {
    if (this.expandedClusterId === cluster.clusterId) {
      this.collapseCluster();
    } else {
      this.expandedClusterId = cluster.clusterId;
      this.hidePreview();
      const mode = resolveClusterExpansionMode(cluster.pins.length, viewport);
      if (mode === 'popover') {
        this.openPopoverList(cluster);
      } else {
        this.closePopover();
      }
      this.update();
    }
  }

  collapseCluster() {
    this.expandedClusterId = null;
    this.closePopover();
    this.update();
  }

  selectFindingAction(pin) {
    this.selectedFindingId = pin.findingId;
    this.updateSelectedState();

    // 1. Notify listeners of finding selection
    this.onSelectFinding?.(pin.findingId, pin.evidenceIndex);

    // 2. Perform smooth camera fly-to to face panel perpendicular
    if (this.cameraController) {
      this.cameraController.flyToFinding(pin);
    }
  }

  updateSelectedState() {
    if (!this.overlayLayer) return;
    const pins = this.overlayLayer.querySelectorAll('.carton-smart-pin');
    pins.forEach(el => {
      const match = el.dataset.findingId === this.selectedFindingId;
      el.classList.toggle('selected', match);
      el.setAttribute('aria-pressed', String(match));
    });
  }

  showPinPreview(pin, anchorEl) {
    this.hidePreview();
    if (!anchorEl || !this.scene) return;

    const card = document.createElement('div');
    card.className = 'carton-pin-preview-card';
    card.setAttribute('role', 'tooltip');

    const statusClass = pin.status || 'review';
    const statusLabel = STATUS_LABELS[statusClass] || 'REVIEW';
    const panelName = ({ front: 'Front Face', back: 'Back Face', left: 'Left Face', right: 'Right Face', top: 'Top Face', bottom: 'Bottom Face' }[pin.panelId] || pin.panelId);

    let evidenceHtml = '';
    if (pin.expected || pin.observed) {
      evidenceHtml = `
        <div class="preview-evidence">
          ${pin.expected ? `<div><small style="color:#9eb2a3;">Expected:</small> <b>${escHtml(pin.expected)}</b></div>` : ''}
          ${pin.observed ? `<div><small style="color:#9eb2a3;">Observed:</small> <b>${escHtml(pin.observed)}</b></div>` : ''}
        </div>
      `;
    } else if (pin.quote) {
      evidenceHtml = `<div class="preview-evidence"><b>${escHtml(pin.quote)}</b></div>`;
    }

    card.innerHTML = `
      <div class="preview-head">
        <span class="preview-badge ${statusClass}">${statusLabel}</span>
        <span class="preview-panel-name">${panelName}</span>
      </div>
      <div class="preview-title">${escHtml(pin.title)}</div>
      ${evidenceHtml}
      <div class="preview-actions">
        <button type="button" class="preview-btn" data-action="view-2d">Show in 2D Proof →</button>
      </div>
    `;

    card.querySelector('[data-action="view-2d"]')?.addEventListener('click', e => {
      e.stopPropagation();
      this.onViewIn2D?.(pin.findingId, pin.artworkPage, pin.evidenceIndex);
    });

    this.positionFloatingCard(card, anchorEl);
    this.scene.appendChild(card);
    this.previewCard = card;
  }

  showClusterBreakdown(cluster, anchorEl) {
    this.hidePreview();
    if (!anchorEl || !this.scene) return;

    const card = document.createElement('div');
    card.className = 'carton-cluster-breakdown-card';
    card.setAttribute('role', 'tooltip');

    const panelName = ({ front: 'Front', back: 'Back', left: 'Left side', right: 'Right side', top: 'Top', bottom: 'Bottom' }[cluster.panelId] || cluster.panelId);

    card.innerHTML = `
      <div class="breakdown-title">
        <span>${panelName} Panel</span>
        <span style="color:#f0cb77;">${cluster.count} Findings</span>
      </div>
      <div class="breakdown-chips">
        ${cluster.breakdown.issue > 0 ? `<span class="chip issues">${cluster.breakdown.issue} Issues</span>` : ''}
        ${cluster.breakdown.review > 0 ? `<span class="chip reviews">${cluster.breakdown.review} Need Review</span>` : ''}
        ${cluster.breakdown.match > 0 ? `<span class="chip matches">${cluster.breakdown.match} Matches</span>` : ''}
      </div>
      <p class="breakdown-hint">Click badge to expand individual findings</p>
    `;

    this.positionFloatingCard(card, anchorEl);
    this.scene.appendChild(card);
    this.previewCard = card;
  }

  positionFloatingCard(card, anchorEl) {
    const sceneRect = this.scene.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();

    let left = anchorRect.left - sceneRect.left + anchorRect.width + 10;
    let top = anchorRect.top - sceneRect.top - 10;

    // Viewport clamping
    if (left + 260 > sceneRect.width) {
      left = anchorRect.left - sceneRect.left - 270;
    }
    if (top + 160 > sceneRect.height) {
      top = Math.max(10, sceneRect.height - 170);
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  hidePreview() {
    if (this.previewCard && this.previewCard.parentNode) {
      this.previewCard.parentNode.removeChild(this.previewCard);
    }
    this.previewCard = null;
  }

  openPopoverList(cluster) {
    this.closePopover();
    if (!this.scene) return;

    const popover = document.createElement('div');
    popover.className = 'carton-cluster-popover';

    const panelName = ({ front: 'Front', back: 'Back', left: 'Left side', right: 'Right side', top: 'Top', bottom: 'Bottom' }[cluster.panelId] || cluster.panelId);

    popover.innerHTML = `
      <div class="carton-cluster-popover-head">
        <b>${panelName} Panel — ${cluster.count} Findings</b>
        <button type="button" class="carton-cluster-popover-close" aria-label="Close findings list">✕</button>
      </div>
      <div class="carton-cluster-popover-list">
        ${cluster.pins.map(p => `
          <button type="button" class="carton-cluster-popover-item ${p.findingId === this.selectedFindingId ? 'selected' : ''}" data-finding-id="${p.findingId}">
            <span class="item-badge ${p.status}">${p.statusSymbol}</span>
            <span class="item-title">${escHtml(p.title)}</span>
          </button>
        `).join('')}
      </div>
    `;

    popover.querySelector('.carton-cluster-popover-close')?.addEventListener('click', () => {
      this.collapseCluster();
    });

    popover.querySelectorAll('.carton-cluster-popover-item').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const fid = btn.dataset.findingId;
        const pin = cluster.pins.find(p => p.findingId === fid);
        if (pin) {
          this.selectFindingAction(pin);
        }
      });
    });

    // Position popover
    let left = cluster.screenX + 20;
    let top = cluster.screenY - 20;
    const sceneW = this.scene.clientWidth || 500;
    const sceneH = this.scene.clientHeight || 385;

    if (left + 260 > sceneW) left = Math.max(10, cluster.screenX - 280);
    if (top + 280 > sceneH) top = Math.max(10, sceneH - 290);

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;

    this.scene.appendChild(popover);
    this.popoverEl = popover;
  }

  closePopover() {
    if (this.popoverEl && this.popoverEl.parentNode) {
      this.popoverEl.parentNode.removeChild(this.popoverEl);
    }
    this.popoverEl = null;
  }

  handlePointerDownOutside(event) {
    if (this.previewCard && !this.previewCard.contains(event.target)) {
      this.hidePreview();
    }
    if (this.popoverEl && !this.popoverEl.contains(event.target) && !event.target.closest('.carton-smart-cluster')) {
      this.collapseCluster();
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      if (this.expandedClusterId) {
        event.stopPropagation();
        this.collapseCluster();
      }
      this.hidePreview();
    }
  }

  /**
   * Navigate to the next finding across the current package or face.
   */
  nextFinding() {
    const list = this.getFilteredPins();
    if (list.length === 0) return;

    let currentIndex = list.findIndex(p => p.findingId === this.selectedFindingId);
    let nextIndex = (currentIndex + 1) % list.length;
    this.selectFindingAction(list[nextIndex]);
  }

  /**
   * Navigate to the previous finding.
   */
  prevFinding() {
    const list = this.getFilteredPins();
    if (list.length === 0) return;

    let currentIndex = list.findIndex(p => p.findingId === this.selectedFindingId);
    let prevIndex = currentIndex <= 0 ? list.length - 1 : currentIndex - 1;
    this.selectFindingAction(list[prevIndex]);
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
