/**
 * PackSignal 3D Revision Intelligence Controller (public/three/revision-3d-controller.js)
 * Master orchestrator for comparing Packaging Artwork Revision A & B in interactive 3D.
 *
 * Capabilities:
 * 1. Side-by-Side 3D packaging comparison with synchronized OrbitControls.
 * 2. 3D Swipe slider using WebGL Scissor Test for real-time before/after peel.
 * 3. 3D Opacity blend slider.
 * 4. Multi-format support (Carton, Can, Bottle, Pouch) with real artwork textures.
 * 5. Semantic change pins (Green: Resolved, Red: Regression/New, Amber: Unverified, Blue: Visual).
 * 6. Click change -> Synchronized dual-camera focus on both models.
 * 7. Incompatible geometry detection and honest fallback.
 * 8. Clean resource management and WebGL disposal.
 */

import { CartonGeometryManager } from './carton-geometry.js';
import { TextureMapper } from './texture-mapper.js';
import { buildHingeTree, CARTON_FACES, FACE_TITLES, mapArtworkPointToPanel } from './fold-engine.js';
import { CanGeometryManager } from './geometry/can.js';
import { BottleGeometryManager } from './geometry/bottle.js';
import { PouchGeometryManager } from './geometry/standup-pouch.js';

export const REVISION_PIN_COLORS = {
  RESOLVED: 0x22c55e,        // Green
  REGRESSION: 0xef4444,      // Red
  NEW_ISSUE: 0xf97316,       // Orange / Red
  UNVERIFIED_CHANGE: 0xf59e0b,// Amber
  REMOVED_CONTENT: 0xd97706, // Amber
  VISUAL_CHANGE: 0x38bdf8,   // Blue
  UNCHANGED: 0x64748b,       // Neutral Slate
};

export class Revision3DViewerController {
  constructor({ container, reviewV1, reviewV2, intelligence, onSelectChange }) {
    this.container = container;
    this.reviewV1 = reviewV1;
    this.reviewV2 = reviewV2;
    this.intelligence = intelligence || reviewV2?.revision?.intelligence || {};
    this.onSelectChange = onSelectChange || (() => {});

    this.mode = '3d-side-by-side'; // '3d-side-by-side' | '3d-swipe' | '3d-blend'
    this.overlayMode = 'both';     // 'outcomes' | 'visual' | 'both'
    this.syncCameras = true;
    this.swipeProgress = 0.5;      // 0.0 to 1.0 for 3D Swipe divider
    this.blendProgress = 0.5;      // 0.0 to 1.0 for Opacity blend
    this.selectedChangeId = null;

    this.animId = null;
    this.disposed = false;
    this.isDraggingSwipe = false;

    // Camera animation state
    this.targetCameraA = null;
    this.targetCameraB = null;

    // Incompatible geometry flag
    this.geometryCompatibility = this.checkGeometryCompatibility();
    this.geometryCompatible = this.geometryCompatibility.compatible;
  }

  checkGeometryCompatibility() {
    const type1 = this.reviewV1?.options?.packageType || 'carton';
    const type2 = this.reviewV2?.options?.packageType || 'carton';
    if (type1 !== type2) {
      return { compatible: false, reason: `Different packaging types (${type1} vs ${type2})` };
    }

    // Check carton dimensions
    const d1 = this.resolveDimensions(this.reviewV1);
    const d2 = this.resolveDimensions(this.reviewV2);
    const diffW = Math.abs(d1.width - d2.width);
    const diffH = Math.abs(d1.height - d2.height);
    const diffD = Math.abs(d1.depth - d2.depth);

    if (diffW >= 2 || diffH >= 2 || diffD >= 2) {
      return { compatible: false, reason: `Carton dimensions differ (W:${d1.width} vs ${d2.width}, H:${d1.height} vs ${d2.height}, D:${d1.depth} vs ${d2.depth})` };
    }

    return { compatible: true, reason: 'Identical package geometry supported for 3D swipe' };
  }

  determineChangePanelFace(change) {
    if (change?.evidenceV2?.face) return change.evidenceV2.face;
    if (change?.evidenceV1?.face) return change.evidenceV1.face;

    const box = change?.evidenceV2?.box || change?.evidenceV1?.box;
    if (!box) return 'front';

    const panelZones = this.reviewV2?.options?.panelZones || this.reviewV1?.options?.panelZones;
    if (panelZones) {
      const cx = (box[0] + box[2]) / 2;
      const cy = (box[1] + box[3]) / 2;
      for (const [face, zone] of Object.entries(panelZones)) {
        if (zone?.box) {
          const [x0, y0, x1, y1] = zone.box;
          if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
            return face;
          }
        }
      }
    }
    return 'front';
  }

  resolveDimensions(review, resolvedZones = null) {
    if (review?.options?.cartonDimensions) {
      const cd = review.options.cartonDimensions;
      if (Number.isFinite(cd.width) && Number.isFinite(cd.height) && Number.isFinite(cd.depth) &&
          cd.width > 0 && cd.height > 0 && cd.depth > 0) {
        return cd;
      }
    }

    const dieline = review?.documents?.find(d => d.role === 'dieline');
    if (dieline?.vectorGeometry?.format === 'DXF') {
      const w = Number(dieline.pages?.[0]?.width) || 120;
      const h = Number(dieline.pages?.[0]?.height) || 180;
      return {
        width: Math.min(100, Math.max(40, w * 0.35)),
        height: Math.min(160, Math.max(60, h * 0.5)),
        depth: 36,
      };
    }

    const isDancingFish = review?.sample === 'organizer' ||
      /dancing.*fish/i.test(review?.name || '') ||
      review?.documents?.some(d => /dancing.*fish/i.test(d.name || ''));

    if (isDancingFish) {
      return { width: 102, height: 120, depth: 59 };
    }

    const isFieldday = review?.sample === 'fieldday' ||
      /fieldday/i.test(review?.name || '');

    if (isFieldday) {
      return { width: 75, height: 140, depth: 65 };
    }

    const zones = resolvedZones || this.resolvePanelZones(review);
    const doc = review?.documents?.find(d => d.role === 'artwork');
    const page = doc?.pages?.[0];
    const pw = Number(page?.width) || 1200;
    const ph = Number(page?.height) || 800;

    const fBox = zones?.front?.box || [0, 0, 0.5, 1];
    const sBox = zones?.left?.box || zones?.right?.box;

    const fw = Math.max(0.05, fBox[2] - fBox[0]) * pw;
    const fh = Math.max(0.05, fBox[3] - fBox[1]) * ph;
    const sWidth = sBox ? Math.max(0.02, sBox[2] - sBox[0]) * pw : (fw * 0.55);

    const targetH = 130;
    const scale = targetH / Math.max(1, fh);
    const width = Math.round(Math.max(35, Math.min(180, fw * scale)));
    const height = targetH;
    const depth = Math.round(Math.max(25, Math.min(140, sWidth * scale)));

    return { width, height, depth };
  }

  resolvePanelZones(review) {
    const customZones = review?.options?.panelZones || {};
    const doc = review?.documents?.find(d => d.role === 'artwork');
    const pageNum = doc?.pages?.[0]?.number || 1;

    const isDancingFish = review?.sample === 'organizer' ||
      /dancing.*fish/i.test(review?.name || '') ||
      review?.documents?.some(d => /dancing.*fish/i.test(d.name || ''));

    if (isDancingFish) {
      return {
        front:  customZones.front  || { page: pageNum, box: [0.528, 0.375, 0.820, 0.786] },
        back:   customZones.back   || { page: pageNum, box: [0.040, 0.375, 0.335, 0.786] },
        left:   customZones.left   || { page: pageNum, box: [0.346, 0.375, 0.514, 0.786] },
        right:  customZones.right  || { page: pageNum, box: [0.834, 0.375, 0.993, 0.786] },
        top:    customZones.top    || { page: pageNum, box: [0.528, 0.140, 0.820, 0.375] },
        bottom: customZones.bottom || { page: pageNum, box: [0.528, 0.786, 0.820, 0.960] },
      };
    }

    const isFieldday = review?.sample === 'fieldday' ||
      /fieldday/i.test(review?.name || '');

    if (isFieldday) {
      return {
        front:  customZones.front  || { page: pageNum, box: [0.033, 0.060, 0.440, 0.880] },
        back:   customZones.back   || { page: pageNum, box: [0.460, 0.060, 0.950, 0.880] },
        left:   customZones.left   || { page: pageNum, box: [0.440, 0.060, 0.460, 0.880] },
        right:  customZones.right  || { page: pageNum, box: [0.950, 0.060, 0.990, 0.880] },
        top:    customZones.top    || { page: pageNum, box: [0.033, 0.020, 0.440, 0.060] },
        bottom: customZones.bottom || { page: pageNum, box: [0.033, 0.880, 0.440, 0.960] },
      };
    }

    if (customZones.front && customZones.back && customZones.left && customZones.right && customZones.top && customZones.bottom) {
      return customZones;
    }

    const baseZones = { ...customZones };
    const page = doc?.pages?.[0];
    const pw = Number(page?.width) || 1200;
    const ph = Number(page?.height) || 800;
    const ratio = pw / Math.max(1, ph);

    if (!baseZones.front && !baseZones.back) {
      if (ratio >= 1.35) {
        baseZones.back   = { page: pageNum, box: [0.03, 0.28, 0.32, 0.78] };
        baseZones.left   = { page: pageNum, box: [0.33, 0.28, 0.50, 0.78] };
        baseZones.front  = { page: pageNum, box: [0.51, 0.28, 0.80, 0.78] };
        baseZones.right  = { page: pageNum, box: [0.81, 0.28, 0.98, 0.78] };
      } else {
        baseZones.front  = { page: pageNum, box: [0.04, 0.06, 0.48, 0.92] };
        baseZones.back   = { page: pageNum, box: [0.52, 0.06, 0.96, 0.92] };
      }
    }

    if (baseZones.front) {
      const [fx0, fy0, fx1, fy1] = baseZones.front.box;
      const fHeight = fy1 - fy0;
      const flapH = Math.min(0.22, fHeight * 0.48);

      if (!baseZones.top) {
        baseZones.top = { page: baseZones.front.page, box: [fx0, Math.max(0, fy0 - flapH), fx1, fy0] };
      }
      if (!baseZones.bottom) {
        baseZones.bottom = { page: baseZones.front.page, box: [fx0, fy1, fx1, Math.min(1, fy1 + flapH)] };
      }
      if (!baseZones.left) {
        if (baseZones.back && baseZones.back.box[2] <= fx0) {
          baseZones.left = { page: baseZones.front.page, box: [baseZones.back.box[2], fy0, fx0, fy1] };
        } else {
          baseZones.left = { page: baseZones.front.page, box: [Math.max(0, fx0 - 0.2), fy0, fx0, fy1] };
        }
      }
      if (!baseZones.right) {
        baseZones.right = { page: baseZones.front.page, box: [fx1, fy0, Math.min(1, fx1 + 0.2), fy1] };
      }
    }

    return baseZones;
  }

  async init() {
    // 1. Lazy load Three.js ESM bundle
    const { THREE, OrbitControls } = await import('/three-bundle.js');
    this.THREE = THREE;
    this.OrbitControls = OrbitControls;

    // 2. Build DOM layout
    this.buildDomStructure();

    // 3. Initialize Renderers and Scenes
    await this.initScenes();

    // 4. Start Render Loop
    this.startLoop();

    return { ok: true, compatible: this.geometryCompatible };
  }

  buildDomStructure() {
    this.container.innerHTML = `
      <div class="rev-3d-root" data-rev-3d-root>
        <!-- Top Toolbar for 3D Revision Studio -->
        <div class="rev-3d-toolbar">
          <div class="rev-3d-mode-group">
            <span class="rev-3d-label">3D VIEW MODE:</span>
            <button type="button" class="btn-3d-mode ${this.mode === '3d-side-by-side' ? 'active' : ''}" data-3d-mode="3d-side-by-side" title="Side-by-side independent/synced 3D packaging">
              1. Side-by-Side 3D
            </button>
            <button type="button" class="btn-3d-mode ${this.mode === '3d-swipe' ? 'active' : ''} ${!this.geometryCompatible ? 'disabled' : ''}" data-3d-mode="3d-swipe" title="${this.geometryCompatible ? 'Split viewport 3D swipe slider' : 'Disabled: Geometry differs between revisions'}" ${!this.geometryCompatible ? 'disabled' : ''}>
              2. 3D Swipe Slider ↔
            </button>
            <button type="button" class="btn-3d-mode ${this.mode === '3d-blend' ? 'active' : ''} ${!this.geometryCompatible ? 'disabled' : ''}" data-3d-mode="3d-blend" title="3D Opacity Blend" ${!this.geometryCompatible ? 'disabled' : ''}>
              3. 3D Opacity Blend
            </button>
          </div>

          <div class="rev-3d-overlay-group">
            <span class="rev-3d-label">OVERLAYS:</span>
            <button type="button" class="btn-3d-ovl ${this.overlayMode === 'outcomes' ? 'active' : ''}" data-3d-ovl="outcomes">Verified Outcomes</button>
            <button type="button" class="btn-3d-ovl ${this.overlayMode === 'visual' ? 'active' : ''}" data-3d-ovl="visual">Visual Diff</button>
            <button type="button" class="btn-3d-ovl ${this.overlayMode === 'both' ? 'active' : ''}" data-3d-ovl="both">Both</button>
          </div>

          <div class="rev-3d-cam-group">
            <label class="hud-layer" title="Keep left and right model angles synchronized">
              <input type="checkbox" id="rev-3d-sync-cam" ${this.syncCameras ? 'checked' : ''}>
              <span>Sync Cameras</span>
            </label>
            <button type="button" class="btn-cam-preset" data-cam="front">Front</button>
            <button type="button" class="btn-cam-preset" data-cam="back">Back</button>
            <button type="button" class="btn-cam-preset" data-cam="reset">Reset</button>
          </div>
        </div>

        ${!this.geometryCompatible ? `
          <div class="notice info" style="margin: 8px 14px; font-size: 11px;">
            ⚠️ <strong>Dieline Dimensions Differ:</strong> Revision A and B have different physical dimensions. 3D Swipe is disabled to avoid false distortion; Side-by-Side 3D comparison is active.
          </div>
        ` : ''}

        <!-- 3D Canvas Viewport Stage -->
        <div class="rev-3d-stage ${this.mode}" id="rev-3d-stage">
          <!-- Side-by-Side Viewport Containers -->
          <div class="rev-3d-subpane pane-v1" id="rev-3d-pane-v1">
            <div class="rev-3d-tag tag-v1">V1 — BEFORE (${this.reviewV1?.name || 'Base Artwork'})</div>
            <div class="rev-3d-canvas-wrap" id="rev-3d-wrap-v1"></div>
          </div>
          <div class="rev-3d-subpane pane-v2" id="rev-3d-pane-v2">
            <div class="rev-3d-tag tag-v2">V2 — AFTER (${this.reviewV2?.name || 'Revised Artwork'})</div>
            <div class="rev-3d-canvas-wrap" id="rev-3d-wrap-v2"></div>
          </div>

          <!-- Single Viewport Container for 3D Swipe & Opacity Blend -->
          <div class="rev-3d-single-wrap" id="rev-3d-single-wrap" style="display: none;">
            <div class="rev-3d-swipe-divider" id="rev-3d-swipe-divider" style="left: 50%;" tabindex="0" role="slider" aria-label="Compare artwork versions V1 and V2. Swipe position 50 percent." aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">
              <div class="divider-line"></div>
              <div class="divider-handle">
                <span>◀ 3D SWIPE ▶</span>
              </div>
            </div>
            <!-- Swipe Labels -->
            <div class="rev-swipe-label label-left">◀ V1 BEFORE</div>
            <div class="rev-swipe-label label-right">V2 AFTER ▶</div>
          </div>
        </div>

        <!-- Accessible Swipe Quick-Buttons & Range Slider Bar (Phase 23) -->
        <div class="rev-3d-swipe-controls-bar" id="rev-3d-swipe-controls-bar" style="display: none; padding: 10px 14px; background: #162c21; border-top: 1px solid #234233; align-items: center; justify-content: space-between; gap: 14px;">
          <div style="display: flex; gap: 6px; align-items: center;">
            <span style="font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px;">SWIPE PRESET:</span>
            <button type="button" class="secondary btn-swipe-preset" data-swipe-target="100" style="padding: 3px 10px; font-size: 11px;">[Show V1 (100%)]</button>
            <button type="button" class="secondary btn-swipe-preset" data-swipe-target="50" style="padding: 3px 10px; font-size: 11px;">[50/50 Split]</button>
            <button type="button" class="secondary btn-swipe-preset" data-swipe-target="0" style="padding: 3px 10px; font-size: 11px;">[Show V2 (100%)]</button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex: 1; max-width: 320px;">
            <small style="color: #94a3b8; font-size: 11px;">V2</small>
            <input type="range" id="rev-3d-swipe-range" min="0" max="100" value="50" style="flex: 1;" aria-label="3D swipe comparison position slider">
            <small style="color: #94a3b8; font-size: 11px;">V1</small>
            <output id="rev-3d-swipe-val" style="font-size: 11px; font-weight: 700; color: #38bdf8; min-width: 45px;">50%</output>
          </div>
        </div>

        <!-- Opacity Slider Bar (Visible in 3d-blend mode) -->
        <div class="rev-3d-blend-bar" id="rev-3d-blend-bar" style="display: none;">
          <span>V1 (0%)</span>
          <input type="range" id="rev-3d-blend-slider" min="0" max="100" value="50">
          <span>V2 (100%)</span>
          <output id="rev-3d-blend-val">50% Blend</output>
        </div>
      </div>
    `;

    this.bindToolbarEvents();
  }

  bindToolbarEvents() {
    const root = this.container.querySelector('[data-rev-3d-root]');
    if (!root) return;

    // Mode buttons
    root.querySelectorAll('[data-3d-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newMode = btn.dataset['3dMode'];
        this.setMode(newMode);
      });
    });

    // Overlay buttons
    root.querySelectorAll('[data-3d-ovl]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setOverlayMode(btn.dataset['3dOvl']);
      });
    });

    // Sync camera checkbox
    const syncCb = root.querySelector('#rev-3d-sync-cam');
    if (syncCb) {
      syncCb.addEventListener('change', () => {
        this.syncCameras = syncCb.checked;
        if (this.syncCameras && this.cameraA && this.cameraB) {
          this.syncCameraPose(this.cameraA, this.controlsA, this.cameraB, this.controlsB);
        }
      });
    }

    // Camera presets
    root.querySelectorAll('[data-cam]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.cam;
        this.applyCameraPreset(preset);
      });
    });

    // 3D Swipe divider drag
    const divider = root.querySelector('#rev-3d-swipe-divider');
    const singleWrap = root.querySelector('#rev-3d-single-wrap');
    if (divider && singleWrap) {
      const updateSwipePos = (prog) => {
        this.swipeProgress = Math.max(0, Math.min(1, prog));
        const pct = (this.swipeProgress * 100).toFixed(1);
        divider.style.left = `${pct}%`;
        divider.setAttribute('aria-valuenow', Math.round(this.swipeProgress * 100));
        divider.setAttribute('aria-label', `Compare artwork versions V1 and V2. Swipe position ${Math.round(this.swipeProgress * 100)} percent.`);
        const range = root.querySelector('#rev-3d-swipe-range');
        const valOut = root.querySelector('#rev-3d-swipe-val');
        if (range) range.value = Math.round(this.swipeProgress * 100);
        if (valOut) valOut.textContent = `${Math.round(this.swipeProgress * 100)}%`;
      };

      const onMove = (e) => {
        if (!this.isDraggingSwipe) return;
        const rect = singleWrap.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        updateSwipePos(x / rect.width);
      };

      const onStop = () => {
        this.isDraggingSwipe = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onStop);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onStop);
      };

      divider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.isDraggingSwipe = true;
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onStop);
      });

      divider.addEventListener('touchstart', (e) => {
        this.isDraggingSwipe = true;
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onStop);
      });

      // Keyboard navigation on divider (Left/Right/Home/End)
      divider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          updateSwipePos(this.swipeProgress - 0.05);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          updateSwipePos(this.swipeProgress + 0.05);
        } else if (e.key === 'Home') {
          e.preventDefault();
          updateSwipePos(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          updateSwipePos(1);
        }
      });

      // Swipe preset buttons
      root.querySelectorAll('.btn-swipe-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = Number(btn.dataset.swipeTarget) / 100;
          updateSwipePos(target);
        });
      });

      // Swipe range slider input
      const swipeRange = root.querySelector('#rev-3d-swipe-range');
      if (swipeRange) {
        swipeRange.addEventListener('input', (e) => {
          updateSwipePos(Number(e.target.value) / 100);
        });
      }
    }

    // Blend slider
    const blendSlider = root.querySelector('#rev-3d-blend-slider');
    const blendVal = root.querySelector('#rev-3d-blend-val');
    if (blendSlider) {
      blendSlider.addEventListener('input', (e) => {
        this.blendProgress = Number(e.target.value) / 100;
        if (blendVal) blendVal.textContent = `${e.target.value}% Blend`;
        this.updateBlendMaterials();
      });
    }
  }

  async initScenes() {
    const wrapV1 = this.container.querySelector('#rev-3d-wrap-v1');
    const wrapV2 = this.container.querySelector('#rev-3d-wrap-v2');
    const singleWrap = this.container.querySelector('#rev-3d-single-wrap');

    // --- Side-by-Side Viewport A (V1) ---
    this.sceneA = new this.THREE.Scene();
    this.sceneA.background = new this.THREE.Color(0x10231b);
    this.cameraA = new this.THREE.PerspectiveCamera(42, 1, 1, 3000);
    this.cameraA.position.set(-60, 50, 260);

    this.rendererA = new this.THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.rendererA.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.rendererA.outputColorSpace = this.THREE.SRGBColorSpace;
    this.rendererA.toneMapping = this.THREE.ACESFilmicToneMapping;
    wrapV1.appendChild(this.rendererA.domElement);

    this.controlsA = new this.OrbitControls(this.cameraA, this.rendererA.domElement);
    this.controlsA.enableDamping = true;
    this.controlsA.dampingFactor = 0.08;
    this.setupLighting(this.sceneA);

    // --- Side-by-Side Viewport B (V2) ---
    this.sceneB = new this.THREE.Scene();
    this.sceneB.background = new this.THREE.Color(0x10231b);
    this.cameraB = new this.THREE.PerspectiveCamera(42, 1, 1, 3000);
    this.cameraB.position.set(-60, 50, 260);

    this.rendererB = new this.THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.rendererB.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.rendererB.outputColorSpace = this.THREE.SRGBColorSpace;
    this.rendererB.toneMapping = this.THREE.ACESFilmicToneMapping;
    wrapV2.appendChild(this.rendererB.domElement);

    this.controlsB = new this.OrbitControls(this.cameraB, this.rendererB.domElement);
    this.controlsB.enableDamping = true;
    this.controlsB.dampingFactor = 0.08;
    this.setupLighting(this.sceneB);

    // Camera sync hooks
    this.controlsA.addEventListener('change', () => {
      if (this.syncCameras && !this.isUpdatingFromB) {
        this.isUpdatingFromA = true;
        this.syncCameraPose(this.cameraA, this.controlsA, this.cameraB, this.controlsB);
        this.isUpdatingFromA = false;
      }
    });

    this.controlsB.addEventListener('change', () => {
      if (this.syncCameras && !this.isUpdatingFromA) {
        this.isUpdatingFromB = true;
        this.syncCameraPose(this.cameraB, this.controlsB, this.cameraA, this.controlsA);
        this.isUpdatingFromB = false;
      }
    });

    // --- Single Shared Renderer (for 3D Swipe & 3D Blend) ---
    this.rendererSingle = new this.THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.rendererSingle.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.rendererSingle.outputColorSpace = this.THREE.SRGBColorSpace;
    this.rendererSingle.toneMapping = this.THREE.ACESFilmicToneMapping;
    this.rendererSingle.autoClear = false;
    singleWrap.appendChild(this.rendererSingle.domElement);

    this.cameraShared = new this.THREE.PerspectiveCamera(42, 1, 1, 3000);
    this.cameraShared.position.set(-60, 50, 260);

    this.controlsShared = new this.OrbitControls(this.cameraShared, this.rendererSingle.domElement);
    this.controlsShared.enableDamping = true;
    this.controlsShared.dampingFactor = 0.08;

    // 4. Build Packaging Models A & B with real artwork textures
    this.textureMapperA = new TextureMapper(this.THREE);
    this.textureMapperB = new TextureMapper(this.THREE);

    await Promise.all([
      this.buildModel(this.reviewV1, this.sceneA, this.textureMapperA, 'v1'),
      this.buildModel(this.reviewV2, this.sceneB, this.textureMapperB, 'v2'),
    ]);

    // 5. Add Semantic Overlays (Pins & Highlight Outlines)
    this.buildSemanticOverlays();

    // 6. Handle initial resizing
    this.onResize();
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  setupLighting(scene) {
    const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new this.THREE.DirectionalLight(0xfff8ee, 1.4);
    keyLight.position.set(150, 200, 200);
    scene.add(keyLight);

    const fillLight = new this.THREE.DirectionalLight(0xedf4f8, 0.7);
    fillLight.position.set(-150, -50, 100);
    scene.add(fillLight);

    const rimLight = new this.THREE.DirectionalLight(0xdcf0dc, 0.9);
    rimLight.position.set(0, 150, -200);
    scene.add(rimLight);

    const grid = new this.THREE.GridHelper(500, 25, 0x2e493a, 0x183024);
    grid.position.y = -100;
    scene.add(grid);
  }

  async buildModel(review, scene, textureMapper, versionKey) {
    const packageType = review?.options?.packageType || 'carton';
    const panelZones = this.resolvePanelZones(review);
    const dimensions = this.resolveDimensions(review, panelZones);

    if (packageType === 'can') {
      const canMgr = new CanGeometryManager(this.THREE);
      const artDoc = review?.documents?.find(d => d.role === 'artwork');
      const p1 = artDoc?.pages?.[0];
      const texUrl = p1 ? `/api/reviews/${review.id}/images/${encodeURIComponent(p1.image)}` : '';
      const tex = texUrl ? await textureMapper.loadImage(texUrl).then(img => new this.THREE.CanvasTexture(img)) : null;
      if (tex) tex.colorSpace = this.THREE.SRGBColorSpace;
      const mesh = canMgr.createCan(tex);
      scene.add(mesh);
      if (versionKey === 'v1') this.modelA = mesh;
      else this.modelB = mesh;
      return;
    }

    if (packageType === 'bottle') {
      const bottleMgr = new BottleGeometryManager(this.THREE);
      const artDoc = review?.documents?.find(d => d.role === 'artwork');
      const p1 = artDoc?.pages?.[0];
      const texUrl = p1 ? `/api/reviews/${review.id}/images/${encodeURIComponent(p1.image)}` : '';
      const tex = texUrl ? await textureMapper.loadImage(texUrl).then(img => new this.THREE.CanvasTexture(img)) : null;
      if (tex) tex.colorSpace = this.THREE.SRGBColorSpace;
      const mesh = bottleMgr.createBottle(tex);
      scene.add(mesh);
      if (versionKey === 'v1') this.modelA = mesh;
      else this.modelB = mesh;
      return;
    }

    if (packageType === 'pouch') {
      const pouchMgr = new PouchGeometryManager(this.THREE);
      const artDoc = review?.documents?.find(d => d.role === 'artwork');
      const p1 = artDoc?.pages?.[0];
      const texUrl = p1 ? `/api/reviews/${review.id}/images/${encodeURIComponent(p1.image)}` : '';
      const tex = texUrl ? await textureMapper.loadImage(texUrl).then(img => new this.THREE.CanvasTexture(img)) : null;
      if (tex) tex.colorSpace = this.THREE.SRGBColorSpace;
      const mesh = pouchMgr.createPouch(tex);
      scene.add(mesh);
      if (versionKey === 'v1') this.modelA = mesh;
      else this.modelB = mesh;
      return;
    }

    // Default: Folding Carton
    const geomMgr = new CartonGeometryManager(this.THREE);
    scene.add(geomMgr.rootGroup);

    const tree = buildHingeTree({ dimensions });
    const panelMeshes = await geomMgr.buildCarton(tree, textureMapper, review, panelZones);

    // Fold carton to 100% closed box
    geomMgr.applyFold(1.0);

    if (versionKey === 'v1') {
      this.geomMgrA = geomMgr;
      this.panelMeshesA = panelMeshes;
      this.treeA = tree;
      this.modelA = geomMgr.rootGroup;
    } else {
      this.geomMgrB = geomMgr;
      this.panelMeshesB = panelMeshes;
      this.treeB = tree;
      this.modelB = geomMgr.rootGroup;
    }
  }

  buildSemanticOverlays() {
    this.pinsA = [];
    this.pinsB = [];

    const changes = this.intelligence?.changes || [];
    const panelZonesA = this.reviewV1?.options?.panelZones || {};
    const panelZonesB = this.reviewV2?.options?.panelZones || {};

    for (const chg of changes) {
      const colorHex = REVISION_PIN_COLORS[chg.classification] || REVISION_PIN_COLORS.UNCHANGED;

      // Pin for Revision A
      if (chg.evidenceV1?.box && this.panelMeshesA && this.treeA) {
        const pinA = this.createPinMesh(chg, colorHex, 'A');
        const pos = this.locatePinOnCarton(chg.evidenceV1, panelZonesA, this.treeA);
        if (pos) {
          pinA.position.copy(pos.localPos);
          const parentMesh = this.panelMeshesA[pos.faceName];
          if (parentMesh) {
            parentMesh.add(pinA);
            this.pinsA.push({ changeId: chg.id, pinMesh: pinA, faceName: pos.faceName });
          }
        }
      }

      // Pin for Revision B
      if (chg.evidenceV2?.box && this.panelMeshesB && this.treeB) {
        const pinB = this.createPinMesh(chg, colorHex, 'B');
        const pos = this.locatePinOnCarton(chg.evidenceV2, panelZonesB, this.treeB);
        if (pos) {
          pinB.position.copy(pos.localPos);
          const parentMesh = this.panelMeshesB[pos.faceName];
          if (parentMesh) {
            parentMesh.add(pinB);
            this.pinsB.push({ changeId: chg.id, pinMesh: pinB, faceName: pos.faceName });
          }
        }
      }
    }
  }

  createPinMesh(change, colorHex, side) {
    const group = new this.THREE.Group();
    group.name = `pin_${change.id}_${side}`;
    group.userData = { changeId: change.id, change, side };

    // Outer ring
    const ringGeom = new this.THREE.RingGeometry(2.0, 2.7, 24);
    const ringMat = new this.THREE.MeshBasicMaterial({ color: colorHex, side: this.THREE.DoubleSide });
    const ringMesh = new this.THREE.Mesh(ringGeom, ringMat);
    group.add(ringMesh);

    // Inner disc
    const discGeom = new this.THREE.CircleGeometry(1.6, 24);
    const discMat = new this.THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.3,
      metalness: 0.2,
      side: this.THREE.DoubleSide,
    });
    const discMesh = new this.THREE.Mesh(discGeom, discMat);
    discMesh.position.z = 0.1;
    group.add(discMesh);

    // Hover/Selection highlight ring (hidden by default)
    const hlGeom = new this.THREE.RingGeometry(3.0, 3.8, 24);
    const hlMat = new this.THREE.MeshBasicMaterial({ color: 0xffffff, side: this.THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const hlMesh = new this.THREE.Mesh(hlGeom, hlMat);
    hlMesh.name = 'highlight_ring';
    hlMesh.visible = false;
    group.add(hlMesh);

    return group;
  }

  locatePinOnCarton(evidence, panelZones, tree) {
    if (!evidence?.box) return null;
    const faceName = evidence.face || evidence.panel || 'front';
    const zone = panelZones[faceName] || { page: evidence.page || 1, box: [0, 0, 1, 1] };
    const pDef = tree.panels[faceName];
    if (!pDef) return null;

    const [uMin, vMin, uMax, vMax] = evidence.box;
    const centerNorm = [(uMin + uMax) / 2, (vMin + vMax) / 2];

    const localPt = mapArtworkPointToPanel(centerNorm, zone, pDef.width, pDef.height);
    return {
      faceName,
      localPos: new this.THREE.Vector3(localPt.x, localPt.y, 0.4),
    };
  }

  syncCameraPose(sourceCam, sourceControls, targetCam, targetControls) {
    targetCam.position.copy(sourceCam.position);
    targetCam.rotation.copy(sourceCam.rotation);
    targetCam.zoom = sourceCam.zoom;
    targetCam.updateProjectionMatrix();

    if (sourceControls && targetControls) {
      targetControls.target.copy(sourceControls.target);
      targetControls.update();
    }
  }

  setMode(mode) {
    if (mode === '3d-swipe' && !this.geometryCompatible) {
      console.warn('3D Swipe disabled due to differing dieline dimensions.');
      return;
    }

    this.mode = mode;
    const root = this.container.querySelector('[data-rev-3d-root]');
    if (!root) return;

    // Update active button
    root.querySelectorAll('[data-3d-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset['3dMode'] === mode);
    });

    const stage = root.querySelector('#rev-3d-stage');
    const paneV1 = root.querySelector('#rev-3d-pane-v1');
    const paneV2 = root.querySelector('#rev-3d-pane-v2');
    const singleWrap = root.querySelector('#rev-3d-single-wrap');
    const swipeControlsBar = root.querySelector('#rev-3d-swipe-controls-bar');
    const blendBar = root.querySelector('#rev-3d-blend-bar');

    if (mode === '3d-side-by-side') {
      paneV1.style.display = 'flex';
      paneV2.style.display = 'flex';
      singleWrap.style.display = 'none';
      if (swipeControlsBar) swipeControlsBar.style.display = 'none';
      if (blendBar) blendBar.style.display = 'none';
      // Sync cameras
      if (this.cameraA && this.cameraB) {
        this.syncCameraPose(this.cameraA, this.controlsA, this.cameraB, this.controlsB);
      }
    } else if (mode === '3d-swipe') {
      paneV1.style.display = 'none';
      paneV2.style.display = 'none';
      singleWrap.style.display = 'block';
      if (swipeControlsBar) swipeControlsBar.style.display = 'flex';
      if (blendBar) blendBar.style.display = 'none';
      // Sync shared camera to current A pose
      if (this.cameraA && this.cameraShared) {
        this.syncCameraPose(this.cameraA, this.controlsA, this.cameraShared, this.controlsShared);
      }
    } else if (mode === '3d-blend') {
      paneV1.style.display = 'none';
      paneV2.style.display = 'none';
      singleWrap.style.display = 'block';
      if (swipeControlsBar) swipeControlsBar.style.display = 'none';
      if (blendBar) blendBar.style.display = 'flex';
      if (this.cameraA && this.cameraShared) {
        this.syncCameraPose(this.cameraA, this.controlsA, this.cameraShared, this.controlsShared);
      }
      this.updateBlendMaterials();
    }

    this.onResize();
  }

  setOverlayMode(mode) {
    this.overlayMode = mode;
    const root = this.container.querySelector('[data-rev-3d-root]');
    if (root) {
      root.querySelectorAll('[data-3d-ovl]').forEach(b => {
        b.classList.toggle('active', b.dataset['3dOvl'] === mode);
      });
    }

    const allPins = [...this.pinsA, ...this.pinsB];
    for (const { pinMesh } of allPins) {
      const chg = pinMesh.userData?.change;
      if (!chg) continue;
      const isVisual = chg.classification === 'VISUAL_CHANGE';
      if (mode === 'outcomes') {
        pinMesh.visible = !isVisual;
      } else if (mode === 'visual') {
        pinMesh.visible = isVisual;
      } else {
        pinMesh.visible = true;
      }
    }
  }

  updateBlendMaterials() {
    if (!this.panelMeshesA || !this.panelMeshesB) return;
    const alphaB = this.blendProgress;
    for (const face of CARTON_FACES) {
      const mA = this.panelMeshesA[face];
      const mB = this.panelMeshesB[face];
      if (mA && mB) {
        mA.material.transparent = true;
        mA.material.opacity = 1.0 - (alphaB * 0.8);
        mB.material.transparent = true;
        mB.material.opacity = alphaB;
      }
    }
  }

  applyCameraPreset(preset) {
    const cam = this.mode === '3d-side-by-side' ? this.cameraA : this.cameraShared;
    const controls = this.mode === '3d-side-by-side' ? this.controlsA : this.controlsShared;
    if (!cam || !controls) return;

    const dist = 260;
    controls.target.set(0, 0, 0);

    if (preset === 'front') {
      cam.position.set(0, 0, dist);
    } else if (preset === 'back') {
      cam.position.set(0, 0, -dist);
    } else if (preset === 'reset') {
      cam.position.set(-60, 50, dist);
    }

    controls.update();
    if (this.mode === '3d-side-by-side' && this.syncCameras && this.cameraB) {
      this.syncCameraPose(this.cameraA, this.controlsA, this.cameraB, this.controlsB);
    }
  }

  /**
   * Focuses on a selected change in both 3D packaging models (Phase 18).
   */
  focusChange(changeId) {
    this.selectedChangeId = changeId;

    // 1. Highlight corresponding 3D pins
    const allPins = [...this.pinsA, ...this.pinsB];
    for (const { changeId: cId, pinMesh } of allPins) {
      const hl = pinMesh.getObjectByName('highlight_ring');
      if (hl) hl.visible = (cId === changeId);
    }

    // 2. Find target panel face from evidence
    const change = this.intelligence?.changes?.find(c => c.id === changeId);
    const faceName = this.determineChangePanelFace(change);

    // 3. Smooth camera focus toward the face
    this.orientCameraToFace(faceName);
  }

  orientCameraToFace(faceName) {
    const dist = 240;
    const targets = {
      front: new this.THREE.Vector3(0, 0, dist),
      back: new this.THREE.Vector3(0, 0, -dist),
      left: new this.THREE.Vector3(-dist, 0, 0),
      right: new this.THREE.Vector3(dist, 0, 0),
      top: new this.THREE.Vector3(0, dist, 0),
      bottom: new this.THREE.Vector3(0, -dist, 0),
    };

    const targetPos = targets[faceName] || targets.front;

    if (this.mode === '3d-side-by-side') {
      this.targetCameraA = targetPos.clone();
      this.targetCameraB = targetPos.clone();
    } else {
      this.targetCameraShared = targetPos.clone();
    }
  }

  startLoop() {
    const render = () => {
      if (this.disposed) return;
      this.animId = requestAnimationFrame(render);

      // Handle smooth camera interpolation towards target
      if (this.targetCameraA && this.cameraA) {
        this.cameraA.position.lerp(this.targetCameraA, 0.08);
        this.controlsA.target.lerp(new this.THREE.Vector3(0, 0, 0), 0.08);
        this.controlsA.update();
        if (this.cameraA.position.distanceTo(this.targetCameraA) < 1.0) this.targetCameraA = null;
      }
      if (this.targetCameraB && this.cameraB) {
        this.cameraB.position.lerp(this.targetCameraB, 0.08);
        this.controlsB.target.lerp(new this.THREE.Vector3(0, 0, 0), 0.08);
        this.controlsB.update();
        if (this.cameraB.position.distanceTo(this.targetCameraB) < 1.0) this.targetCameraB = null;
      }
      if (this.targetCameraShared && this.cameraShared) {
        this.cameraShared.position.lerp(this.targetCameraShared, 0.08);
        this.controlsShared.target.lerp(new this.THREE.Vector3(0, 0, 0), 0.08);
        this.controlsShared.update();
        if (this.cameraShared.position.distanceTo(this.targetCameraShared) < 1.0) this.targetCameraShared = null;
      }

      // --- Mode Rendering ---
      if (this.mode === '3d-side-by-side') {
        this.controlsA.update();
        this.controlsB.update();
        this.rendererA.render(this.sceneA, this.cameraA);
        this.rendererB.render(this.sceneB, this.cameraB);
      } else if (this.mode === '3d-swipe') {
        // WebGL Scissor Test for seamless before/after peel
        this.controlsShared.update();
        const rw = this.rendererSingle.domElement.width;
        const rh = this.rendererSingle.domElement.height;
        const splitPixel = Math.floor(rw * this.swipeProgress);

        this.rendererSingle.setScissorTest(true);

        // Render Left: Revision A
        this.rendererSingle.setScissor(0, 0, splitPixel, rh);
        this.rendererSingle.setViewport(0, 0, rw, rh);
        this.rendererSingle.clear();
        this.rendererSingle.render(this.sceneA, this.cameraShared);

        // Render Right: Revision B
        this.rendererSingle.setScissor(splitPixel, 0, rw - splitPixel, rh);
        this.rendererSingle.setViewport(0, 0, rw, rh);
        this.rendererSingle.clearDepth();
        this.rendererSingle.render(this.sceneB, this.cameraShared);

        this.rendererSingle.setScissorTest(false);
      } else if (this.mode === '3d-blend') {
        // Render blended dual scene
        this.controlsShared.update();
        const rw = this.rendererSingle.domElement.width;
        const rh = this.rendererSingle.domElement.height;
        this.rendererSingle.setViewport(0, 0, rw, rh);
        this.rendererSingle.clear();
        this.rendererSingle.render(this.sceneA, this.cameraShared);
        this.rendererSingle.render(this.sceneB, this.cameraShared);
      }
    };

    render();
  }

  onResize() {
    if (this.disposed) return;
    const stage = this.container.querySelector('#rev-3d-stage');
    if (!stage) return;

    const wrapV1 = this.container.querySelector('#rev-3d-wrap-v1');
    const wrapV2 = this.container.querySelector('#rev-3d-wrap-v2');
    const singleWrap = this.container.querySelector('#rev-3d-single-wrap');

    // Side-by-side subpanes
    if (wrapV1 && wrapV2 && this.rendererA && this.rendererB) {
      const wA = wrapV1.clientWidth || 300;
      const hA = wrapV1.clientHeight || 450;
      this.rendererA.setSize(wA, hA);
      this.cameraA.aspect = wA / hA;
      this.cameraA.updateProjectionMatrix();

      const wB = wrapV2.clientWidth || 300;
      const hB = wrapV2.clientHeight || 450;
      this.rendererB.setSize(wB, hB);
      this.cameraB.aspect = wB / hB;
      this.cameraB.updateProjectionMatrix();
    }

    // Single wrap (3d-swipe & 3d-blend)
    if (singleWrap && this.rendererSingle && this.cameraShared) {
      const wS = singleWrap.clientWidth || 600;
      const hS = singleWrap.clientHeight || 450;
      this.rendererSingle.setSize(wS, hS);
      this.cameraShared.aspect = wS / hS;
      this.cameraShared.updateProjectionMatrix();
    }
  }

  dispose() {
    this.disposed = true;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.resizeObserver) this.resizeObserver.disconnect();

    this.rendererA?.dispose();
    this.rendererB?.dispose();
    this.rendererSingle?.dispose();

    this.controlsA?.dispose();
    this.controlsB?.dispose();
    this.controlsShared?.dispose();

    this.container.innerHTML = '';
  }
}
