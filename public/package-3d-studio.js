/**
 * PackSignal Unified Multi-Packaging 3D Geometry Studio
 * (public/package-3d-studio.js)
 *
 * Implements Phase 1, 9, 10, 11, 12:
 * - Unified 3D Studio Toolbar (Package Type, Material, Views, Toggles)
 * - Shared Camera System (Orbit, Fly-to, View Presets, Auto-rotate)
 * - 4 Real 3D Geometries (Folding Carton, Aluminium Can, Glass Bottle, Stand-Up Pouch)
 * - 2D / 3D Synchronization
 * - Honest Abstraction & Prepress / Ghost Box Integration
 */

import { PACKAGE_MODELS, getPackageModel } from './package-model-registry.js';
import { PBR_MATERIALS, getMaterialPresetInfo, evaluateFinishAuthority } from './package-materials.js';
import { resolveFindingAnchor, mapGhostBoxToSurface, DEFAULT_DIMENSIONS } from './package-surface-mapping.js';

export class Package3DStudio {
  constructor({
    container,
    review = null,
    initialPackageType = 'CARTON',
    initialMaterial = 'SBS_WHITE_CARD',
    onSelectFinding = null,
    onViewIn2D = null,
  } = {}) {
    this.container = container;
    this.review = review;
    this.packageType = initialPackageType.toUpperCase();
    this.material = initialMaterial;
    this.onSelectFinding = onSelectFinding;
    this.onViewIn2D = onViewIn2D;

    this.viewer = null;
    this.isAutoRotating = false;
    this.showFindings = true;
    this.showXRay = false;
    this.showDieline = false;
    this.showMaterialFinish = true;
    this.isComparingRevisions = false;

    this.toolbarEl = null;
    this.viewportEl = null;
  }

  /**
   * Initializes studio DOM and mounts underlying WebGL viewer.
   */
  async init() {
    if (!this.container) return;

    this.container.classList.add('packsignal-multi-packaging-studio');
    this.container.innerHTML = `
      <div class="studio-toolbar" role="toolbar" aria-label="3D Packaging Studio Controls">
        <div class="toolbar-group">
          <label for="studio-pkg-type" class="toolbar-label">PACKAGE TYPE</label>
          <select id="studio-pkg-type" class="studio-select" data-studio-pkg-select>
            <option value="CARTON">Folding Carton</option>
            <option value="CAN">Aluminium Soda Can</option>
            <option value="BOTTLE">Glass Bottle</option>
            <option value="POUCH">Stand-Up Foil Pouch</option>
          </select>
        </div>

        <div class="toolbar-group">
          <label for="studio-mat-select" class="toolbar-label">MATERIAL</label>
          <select id="studio-mat-select" class="studio-select" data-studio-mat-select>
            <option value="SBS_WHITE_CARD">SBS White Card</option>
            <option value="KRAFT_PAPER">Kraft Paper</option>
            <option value="METALLIC_GOLD_FOIL">Metallic Gold Foil</option>
            <option value="SPOT_UV_GLOSS">Spot UV Gloss</option>
            <option value="ALUMINIUM">Aluminium</option>
            <option value="GLASS">Glass</option>
            <option value="FOIL_LAMINATE">Foil Laminate</option>
          </select>
        </div>

        <div class="toolbar-group view-presets">
          <span class="toolbar-label">VIEW</span>
          <button type="button" class="studio-btn" data-view="front">Front</button>
          <button type="button" class="studio-btn" data-view="back">Back</button>
          <button type="button" class="studio-btn" data-view="left">Left</button>
          <button type="button" class="studio-btn" data-view="right">Right</button>
          <button type="button" class="studio-btn" data-view="top">Top</button>
          <button type="button" class="studio-btn" data-view="reset">Reset</button>
          <button type="button" class="studio-btn" data-action="autorotate" aria-pressed="false">Auto Rotate</button>
          <button type="button" class="studio-btn" data-action="fullscreen">Fullscreen</button>
        </div>

        <div class="toolbar-group toggles-group">
          <button type="button" class="studio-btn active" data-toggle="findings" aria-pressed="true">Show Findings</button>
          <button type="button" class="studio-btn" data-toggle="xray" aria-pressed="false">Show X-Ray</button>
          <button type="button" class="studio-btn" data-toggle="dieline" aria-pressed="false">Show Dieline</button>
          <button type="button" class="studio-btn active" data-toggle="finish" aria-pressed="true">Show Material Finish</button>
          <button type="button" class="studio-btn" data-toggle="revisions" aria-pressed="false">Compare Revisions</button>
        </div>
      </div>

      <div class="studio-viewport-container" data-studio-viewport>
        <div class="carton-webgl-viewport" data-carton-webgl style="width: 100%; height: 100%;"></div>
      </div>

      <div class="studio-provenance-banner" data-studio-provenance>
        <span class="badge" data-prov-badge>SOURCE-DIMENSIONED</span>
        <span class="prov-desc" data-prov-desc>Verified 3D physical geometry</span>
      </div>
    `;

    this.toolbarEl = this.container.querySelector('.studio-toolbar');
    this.viewportEl = this.container.querySelector('[data-studio-viewport]');

    this.bindEvents();
    await this.mountViewer();
    this.syncToolbarUI();
  }

  /**
   * Binds UI toolbar listeners.
   */
  bindEvents() {
    const pkgSelect = this.container.querySelector('[data-studio-pkg-select]');
    pkgSelect?.addEventListener('change', (e) => {
      this.setPackageType(e.target.value);
    });

    const matSelect = this.container.querySelector('[data-studio-mat-select]');
    matSelect?.addEventListener('change', (e) => {
      this.setMaterial(e.target.value);
    });

    // View presets
    this.container.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.setViewPreset(view);
      });
    });

    // Action buttons
    const autoBtn = this.container.querySelector('[data-action="autorotate"]');
    autoBtn?.addEventListener('click', () => {
      this.toggleAutoRotate();
    });

    const fsBtn = this.container.querySelector('[data-action="fullscreen"]');
    fsBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Feature Toggles
    this.container.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const toggle = btn.dataset.toggle;
        this.handleToggle(toggle, btn);
      });
    });
  }

  /**
   * Mounts the WebGL PackagingViewerController inside the viewport.
   */
  async mountViewer() {
    const webglEl = this.container.querySelector('[data-carton-webgl]');
    if (!webglEl) return;

    try {
      const { PackagingViewerController, isWebGLAvailable } = await import('/three/viewer-controller.js');
      if (!isWebGLAvailable()) {
        this.renderFallback('WebGL hardware acceleration is unavailable in this browser session.');
        return;
      }

      this.viewer = new PackagingViewerController(webglEl, {
        review: this.review,
        onSelectFinding: (id, idx) => {
          this.onSelectFinding?.(id, idx);
        },
        onViewIn2D: (id, page, idx) => {
          this.onViewIn2D?.(id, page, idx);
        },
      });

      await this.viewer.init();
      // Apply initial package type
      await this.viewer.setPackageType(this.packageType.toLowerCase());
      this.updateMaterialOptions();
    } catch (err) {
      console.warn('[Package3DStudio] Fallback mounting viewer:', err);
      this.renderFallback('Unable to initialize WebGL 3D Studio renderer.');
    }
  }

  /**
   * Switches package type: 'CARTON' | 'CAN' | 'BOTTLE' | 'POUCH'.
   */
  async setPackageType(type) {
    this.packageType = type.toUpperCase();
    if (this.viewer) {
      await this.viewer.setPackageType(this.packageType.toLowerCase());
    }
    this.updateMaterialOptions();
    this.syncToolbarUI();
  }

  /**
   * Switches material preset.
   */
  setMaterial(matId) {
    this.material = matId;
    const info = getMaterialPresetInfo(matId);
    if (this.viewer && this.viewer.setSubstrate) {
      const substrateKey = matId === 'KRAFT_PAPER' ? 'matte_paperboard'
        : matId === 'ALUMINIUM' ? 'aluminum'
        : matId === 'GLASS' ? 'clear_plastic'
        : 'matte_paperboard';
      this.viewer.setSubstrate(substrateKey);

      if (matId === 'METALLIC_GOLD_FOIL' && this.viewer.setFinish) {
        this.viewer.setFinish('gold_foil');
      } else if (matId === 'SPOT_UV_GLOSS' && this.viewer.setFinish) {
        this.viewer.setFinish('spot_uv');
      }
    }
    this.updateProvenanceBanner(info);
  }

  /**
   * Sets camera to preset angle: front, back, left, right, top, reset.
   */
  setViewPreset(view) {
    if (!this.viewer?.cameraController) return;
    const cc = this.viewer.cameraController;
    if (view === 'front') cc.focusView?.(0, 0);
    else if (view === 'back') cc.focusView?.(Math.PI, 0);
    else if (view === 'left') cc.focusView?.(-Math.PI / 2, 0);
    else if (view === 'right') cc.focusView?.(Math.PI / 2, 0);
    else if (view === 'top') cc.focusView?.(0, Math.PI / 2 - 0.05);
    else if (view === 'reset') {
      const dims = DEFAULT_DIMENSIONS[this.packageType.toLowerCase()] || DEFAULT_DIMENSIONS.carton;
      cc.resetCamera?.(dims);
    }
  }

  /**
   * Toggles auto-turntable rotation.
   */
  toggleAutoRotate() {
    this.isAutoRotating = !this.isAutoRotating;
    const btn = this.container.querySelector('[data-action="autorotate"]');
    if (btn) {
      btn.setAttribute('aria-pressed', String(this.isAutoRotating));
      btn.classList.toggle('active', this.isAutoRotating);
    }
    if (this.viewer?.controls) {
      this.viewer.controls.autoRotate = this.isAutoRotating;
      this.viewer.controls.autoRotateSpeed = 2.0;
    }
  }

  /**
   * Toggles fullscreen presentation.
   */
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  /**
   * Handles feature toggle button states.
   */
  handleToggle(toggle, btn) {
    const isActive = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(isActive));
    btn.classList.toggle('active', isActive);

    if (toggle === 'findings') {
      this.showFindings = isActive;
      if (this.viewer?.pinSystem?.pinGroup) {
        this.viewer.pinSystem.pinGroup.visible = isActive;
      }
    } else if (toggle === 'xray') {
      this.showXRay = isActive;
      this.viewer?.setXRay?.(isActive);
    } else if (toggle === 'dieline') {
      this.showDieline = isActive;
      if (this.viewer?.setFoldProgress) {
        this.viewer.setFoldProgress(isActive ? 0 : 1.0);
      }
    } else if (toggle === 'finish') {
      this.showMaterialFinish = isActive;
      this.viewer?.toggleOriginalView?.(!isActive);
    } else if (toggle === 'revisions') {
      this.isComparingRevisions = isActive;
      // Triggers 3D revision swipe mode if available
      const swipeToggle = document.querySelector('[data-rev-toggle-split]');
      swipeToggle?.click();
    }
  }

  /**
   * Synchronizes select elements to current active state.
   */
  syncToolbarUI() {
    const pkgSelect = this.container.querySelector('[data-studio-pkg-select]');
    if (pkgSelect) pkgSelect.value = this.packageType;

    const model = getPackageModel(this.packageType);
    this.updateProvenanceBanner(model);
  }

  /**
   * Filters material dropdown to options suitable for the selected package format.
   */
  updateMaterialOptions() {
    const matSelect = this.container.querySelector('[data-studio-mat-select]');
    if (!matSelect) return;

    const model = getPackageModel(this.packageType);
    const slots = model.materialSlots || [];

    // Prioritize context-relevant default
    if (this.packageType === 'CAN') matSelect.value = 'ALUMINIUM';
    else if (this.packageType === 'BOTTLE') matSelect.value = 'GLASS';
    else if (this.packageType === 'POUCH') matSelect.value = 'FOIL_LAMINATE';
    else matSelect.value = 'SBS_WHITE_CARD';

    this.material = matSelect.value;
  }

  /**
   * Updates provenance indicator with truthful attribution.
   */
  updateProvenanceBanner(info = {}) {
    const banner = this.container.querySelector('[data-studio-provenance]');
    const badge = this.container.querySelector('[data-prov-badge]');
    const desc = this.container.querySelector('[data-prov-desc]');
    if (!banner || !badge || !desc) return;

    const isIllustrative = info.isIllustrative ?? (this.packageType !== 'CARTON');
    badge.textContent = isIllustrative ? 'ILLUSTRATIVE PREVIEW' : 'SOURCE-DIMENSIONED';
    badge.className = `badge ${isIllustrative ? 'illustrative' : 'source-dimensioned'}`;
    desc.textContent = info.disclaimer || (isIllustrative
      ? 'Visual preview model. Does not represent certified CAD construction.'
      : 'Real 3D physical package geometry.');
  }

  /**
   * Fallback UI when WebGL is unsupported.
   */
  renderFallback(msg) {
    if (!this.viewportEl) return;
    this.viewportEl.innerHTML = `
      <div class="package-3d-fallback" style="padding: 32px; text-align: center; color: #94a3b8;">
        <span style="font-size: 36px; display: block; margin-bottom: 8px;">📦</span>
        <h3 style="color: #f8fafc; margin-bottom: 8px;">3D Packaging Geometry Fallback</h3>
        <p style="max-width: 420px; margin: 0 auto 16px auto;">${msg}</p>
        <small class="subtle">All compliance findings, separations, and evidence remain active in the 2D Workbench.</small>
      </div>
    `;
  }

  dispose() {
    if (this.viewer && typeof this.viewer.dispose === 'function') {
      this.viewer.dispose();
      this.viewer = null;
    }
  }
}

/**
 * Factory helper to mount Package3DStudio onto a container element.
 */
export function createPackage3DStudio(options = {}) {
  const studio = new Package3DStudio(options);
  studio.init();
  return studio;
}
