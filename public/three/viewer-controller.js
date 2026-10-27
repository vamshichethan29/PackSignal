/**
 * PackSignal 3D Packaging Viewer Controller
 * Master orchestrator connecting Three.js scene, multi-format 3D packaging
 * (Carton folding kinematics, Beverage Can, Bottle with lathed profile, Stand-up Pouch),
 * premium finishing effects (Matte, Gloss, Spot UV, Gold foil, Silver foil, Emboss),
 * real artwork texture mapping, 3D evidence pins, camera fly-to,
 * fold/inflation slider, play/pause, and bidirectional 2D/3D finding synchronization.
 */

import { buildHingeTree } from './fold-engine.js';
import { CartonScene } from './scene.js';
import { CartonGeometryManager } from './carton-geometry.js';
import { TextureMapper } from './texture-mapper.js';
import { EvidencePinSystem } from './evidence-pins.js';
import { CameraController } from './camera-controller.js';
import { CanGeometryManager } from './geometry/can.js';
import { BottleGeometryManager } from './geometry/bottle.js';
import { PouchGeometryManager } from './geometry/pouch.js';
import { FinishingEffectsManager, SUBSTRATES, FINISHES } from './materials/finishes.js';

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export class PackagingViewerController {
  constructor(container, {
    review,
    selectedFindingId = null,
    onSelectFinding = null,
    onViewIn2D = null,
    onFoldChange = null,
    onPlayStateChange = null,
    autoFold = true,
  } = {}) {
    this.container = container;
    this.review = review;
    this.selectedFindingId = selectedFindingId;
    this.onSelectFinding = onSelectFinding;
    this.onViewIn2D = onViewIn2D;
    this.onFoldChange = onFoldChange;
    this.onPlayStateChange = onPlayStateChange;
    this.autoFold = autoFold;

    this.packageType = 'carton'; // 'carton' | 'can' | 'bottle' | 'pouch'
    this.progress = this.autoFold ? 0.0 : 1.0; // Default flat 0% if auto-folding to 3D on open
    this.playing = false;
    this.playDirection = 1; // fold up to 3D
    this.disposed = false;
    this.frameId = null;
    this.lastTime = null;

    // Subsystem instances
    this.geometryManager = null;
    this.canManager = null;
    this.bottleManager = null;
    this.pouchManager = null;
    this.finishingManager = null;
    this.baseTexture = null;
    this.ghostBoxes = [];
    this.isXRay = false;
  }

  async init() {
    if (!isWebGLAvailable()) {
      this.renderFallback('WebGL is not supported or hardware acceleration is disabled in this browser.');
      return { ok: false, fallback: true };
    }

    try {
      // Lazy load Three.js ESM bundle
      const { THREE, OrbitControls } = await import('/three-bundle.js');
      this.THREE = THREE;

      // 1. Create Scene & Renderer
      this.sceneManager = new CartonScene(THREE, this.container);
      this.scene = this.sceneManager.scene;
      this.camera = this.sceneManager.camera;
      this.renderer = this.sceneManager.renderer;

      // 2. Setup OrbitControls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxDistance = 1200;
      this.controls.minDistance = 30;

      // 3. Camera Controller
      this.cameraController = new CameraController(
        THREE,
        this.camera,
        this.controls,
        this.renderer.domElement
      );

      // 4. Texture Mapper
      this.textureMapper = new TextureMapper(THREE);

      // 5. Finishing Effects Manager & Lighting
      this.finishingManager = new FinishingEffectsManager(THREE);
      this.finishingManager.setupLighting(this.scene, 'studio_softbox');

      // 6. Carton Geometry & Fold Tree
      this.geometryManager = new CartonGeometryManager(THREE);
      this.scene.add(this.geometryManager.rootGroup);

      // Determine panel zones from review
      const panelZones = this.resolvePanelZones();

      // Determine carton dimensions
      const dieline = this.review?.documents?.find(d => d.role === 'dieline');
      const dimensions = this.resolveDimensions(dieline, panelZones);
      this.tree = buildHingeTree({ dimensions });

      // Build 6 panel meshes with real artwork textures
      this.panelMeshes = await this.geometryManager.buildCarton(
        this.tree,
        this.textureMapper,
        this.review,
        panelZones
      );

      // Extract a representative base artwork texture for alternate formats
      const frontMesh = this.panelMeshes?.front;
      this.baseTexture = frontMesh?.material?.map || null;

      // 7. Evidence Pins & Overlays
      this.pinSystem = new EvidencePinSystem(THREE);
      this.locatedPins = this.pinSystem.buildPins({
        review: this.review,
        panelMeshes: this.panelMeshes,
        panelZones,
        tree: this.tree,
        selectedFindingId: this.selectedFindingId,
      });

      // 7b. Build X-Ray Ghost Boxes for missing statutory mandates
      this.buildGhostBoxes();

      // 8. Raycasting for Pin Interaction
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.setupRaycasting();

      // 9. Start fold progress
      const shouldAutoFold = this.autoFold !== false && (this.packageType === 'carton' || this.packageType === 'folding_carton');
      if (shouldAutoFold) {
        this.progress = 0.0;
        this.setFoldProgress(0.0);
        this.cameraController.resetCamera(dimensions);
        this.playDirection = 1;
        setTimeout(() => {
          if (!this.disposed && !this.playing) {
            this.playFoldAnimation();
          }
        }, 150);
      } else {
        this.setFoldProgress(1.0);
        this.cameraController.resetCamera(dimensions);
      }

      // If a finding is already selected, fly to it
      if (this.selectedFindingId) {
        this.focusFinding(this.selectedFindingId);
      }

      // 10. Update format bar visibility and start Main Render Loop
      this.updateFormatBarVisibility();
      this.startLoop();

      return {
        ok: true,
        locatedCount: this.locatedPins.length,
        unlocatedCount: Math.max(0, (this.review?.findings?.length || 0) - this.locatedPins.length),
        dimensions,
      };
    } catch (err) {
      console.error('[PackagingViewerController] Initialization failed:', err);
      this.renderFallback(`3D packaging viewer could not start: ${err.message}`);
      return { ok: false, error: err };
    }
  }

  resolveDimensions(dieline, resolvedZones = null) {
    if (this.review?.options?.cartonDimensions) {
      const cd = this.review.options.cartonDimensions;
      if (Number.isFinite(cd.width) && Number.isFinite(cd.height) && Number.isFinite(cd.depth) &&
          cd.width > 0 && cd.height > 0 && cd.depth > 0) {
        return cd;
      }
    }

    if (dieline?.vectorGeometry?.format === 'DXF') {
      const w = Number(dieline.pages?.[0]?.width) || 120;
      const h = Number(dieline.pages?.[0]?.height) || 180;
      return {
        width: Math.min(100, Math.max(40, w * 0.35)),
        height: Math.min(160, Math.max(60, h * 0.5)),
        depth: 36,
      };
    }

    const isDancingFish = this.review?.sample === 'organizer' ||
      /dancing.*fish/i.test(this.review?.name || '') ||
      this.review?.documents?.some(d => /dancing.*fish/i.test(d.name || ''));

    if (isDancingFish) {
      // True physical packaging dimensions for Dancing Fish cereal carton: 102 x 120 x 59 mm
      return { width: 102, height: 120, depth: 59 };
    }

    const isFieldday = this.review?.sample === 'fieldday' ||
      /fieldday/i.test(this.review?.name || '');

    if (isFieldday) {
      return { width: 75, height: 140, depth: 65 };
    }

    const zones = resolvedZones || this.resolvePanelZones();
    const doc = this.review?.documents?.find(d => d.role === 'artwork');
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

  resolvePanelZones() {
    const customZones = this.review?.options?.panelZones || {};
    const doc = this.review?.documents?.find(d => d.role === 'artwork');
    const pageNum = doc?.pages?.[0]?.number || 1;

    // 1. If Dancing Fish sample or artwork
    const isDancingFish = this.review?.sample === 'organizer' ||
      /dancing.*fish/i.test(this.review?.name || '') ||
      this.review?.documents?.some(d => /dancing.*fish/i.test(d.name || ''));

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

    // 2. If Fieldday sample
    const isFieldday = this.review?.sample === 'fieldday' ||
      /fieldday/i.test(this.review?.name || '');

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

    // 3. User custom mapping with all 6 faces provided
    if (customZones.front && customZones.back && customZones.left && customZones.right && customZones.top && customZones.bottom) {
      return customZones;
    }

    // 4. Inferred or partially mapped packaging layout
    const baseZones = { ...customZones };
    const page = doc?.pages?.[0];
    const pw = Number(page?.width) || 1200;
    const ph = Number(page?.height) || 800;
    const ratio = pw / Math.max(1, ph);

    if (!baseZones.front && !baseZones.back) {
      if (ratio >= 1.35) {
        // Wide dieline: 4 main panels side-by-side
        baseZones.back   = { page: pageNum, box: [0.03, 0.28, 0.32, 0.78] };
        baseZones.left   = { page: pageNum, box: [0.33, 0.28, 0.50, 0.78] };
        baseZones.front  = { page: pageNum, box: [0.51, 0.28, 0.80, 0.78] };
        baseZones.right  = { page: pageNum, box: [0.81, 0.28, 0.98, 0.78] };
      } else {
        // 2-panel presentation proof
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

  /**
   * Switch packaging format: 'carton' | 'can' | 'bottle' | 'pouch'
   */
  async setPackageType(format) {
    if (this.packageType === format) return;
    this.packageType = format;

    // Hide all root groups
    if (this.geometryManager?.rootGroup) this.geometryManager.rootGroup.visible = false;
    if (this.canManager?.rootGroup) this.canManager.rootGroup.visible = false;
    if (this.bottleManager?.rootGroup) this.bottleManager.rootGroup.visible = false;
    if (this.pouchManager?.rootGroup) this.pouchManager.rootGroup.visible = false;

    // Clear active pins
    this.pinSystem.clear();

    if (format === 'carton') {
      this.geometryManager.rootGroup.visible = true;
      const panelZones = this.resolvePanelZones();
      this.locatedPins = this.pinSystem.buildPins({
        review: this.review,
        panelMeshes: this.panelMeshes,
        panelZones,
        tree: this.tree,
        selectedFindingId: this.selectedFindingId,
      });
      this.cameraController.resetCamera(this.tree.dimensions);
    } else if (format === 'can') {
      if (!this.canManager) {
        this.canManager = new CanGeometryManager(this.THREE);
        this.canManager.buildCan({ labelTexture: this.baseTexture });
        this.scene.add(this.canManager.rootGroup);
      }
      this.canManager.rootGroup.visible = true;
      this.locatedPins = this.pinSystem.buildPinsForSurface({
        review: this.review,
        mapPointFn: (u, v) => this.canManager.mapPointToCylinder(u, v),
        parentMesh: this.canManager.bodyMesh,
        selectedFindingId: this.selectedFindingId,
        formatName: 'can',
      });
      this.cameraController.resetCamera({ width: 70, height: 130, depth: 70 });
    } else if (format === 'bottle') {
      if (!this.bottleManager) {
        this.bottleManager = new BottleGeometryManager(this.THREE);
        this.bottleManager.buildBottle({ labelTexture: this.baseTexture, bottleType: 'glass' });
        this.scene.add(this.bottleManager.rootGroup);
      }
      this.bottleManager.rootGroup.visible = true;
      this.locatedPins = this.pinSystem.buildPinsForSurface({
        review: this.review,
        mapPointFn: (u, v) => this.bottleManager.mapPointToBottle(u, v),
        parentMesh: this.bottleManager.labelMesh,
        selectedFindingId: this.selectedFindingId,
        formatName: 'bottle',
      });
      this.cameraController.resetCamera({ width: 80, height: 200, depth: 80 });
    } else if (format === 'pouch') {
      if (!this.pouchManager) {
        this.pouchManager = new PouchGeometryManager(this.THREE);
        this.pouchManager.buildPouch({
          frontTexture: this.baseTexture,
          backTexture: this.baseTexture,
          inflation: 0.85,
        });
        this.scene.add(this.pouchManager.rootGroup);
      }
      this.pouchManager.rootGroup.visible = true;
      this.locatedPins = this.pinSystem.buildPinsForSurface({
        review: this.review,
        mapPointFn: (u, v) => this.pouchManager.mapPointToPouch(u, v, 'front'),
        parentMesh: this.pouchManager.frontMesh,
        selectedFindingId: this.selectedFindingId,
        formatName: 'pouch',
      });
      this.cameraController.resetCamera({ width: 140, height: 200, depth: 70 });
    }

    this.reapplyFinishing();
    this.updateInspectorUI();
    this.updateFormatBarVisibility();
  }

  /**
   * Updates visibility of model-specific control bars (carton fold, can seam, bottle materials, pouch fullness).
   */
  updateFormatBarVisibility() {
    const parent = this.container.closest('.carton-studio') || this.container.parentElement;
    if (!parent) return;

    const cartonBar = parent.querySelector('[data-carton-fold-bar]');
    const canBar = parent.querySelector('[data-can-control-bar]');
    const bottleBar = parent.querySelector('[data-bottle-control-bar]');
    const pouchBar = parent.querySelector('[data-pouch-control-bar]');
    const playBtn = parent.querySelector('[data-carton-fold-play]');

    if (cartonBar) cartonBar.style.display = this.packageType === 'carton' ? '' : 'none';
    if (canBar) canBar.style.display = this.packageType === 'can' ? '' : 'none';
    if (bottleBar) bottleBar.style.display = this.packageType === 'bottle' ? '' : 'none';
    if (pouchBar) pouchBar.style.display = this.packageType === 'pouch' ? '' : 'none';
    if (playBtn) playBtn.style.display = (this.packageType === 'carton' || this.packageType === 'pouch') ? '' : 'none';
  }

  // Model-specific controls for Beverage Can
  setCanSeam(degrees) {
    if (this.canManager) {
      this.canManager.setSeamAngle(degrees);
    }
  }

  toggleCanSeamHighlight(show = null) {
    if (this.canManager) {
      return this.canManager.toggleSeamHighlight(show);
    }
    return false;
  }

  setCanWrapMode(mode = 'full') {
    if (this.canManager) {
      this.canManager.setWrapMode(mode);
    }
  }

  // Model-specific controls for Bottle
  setBottleSubstrate(type = 'glass') {
    if (this.bottleManager) {
      this.bottleManager.setBottleSubstrate(type);
    }
  }

  setBottleLabelPlacement(mode = 'wrap') {
    if (this.bottleManager) {
      this.bottleManager.setLabelPlacement(mode);
    }
  }

  // Model-specific controls for Stand-up Pouch
  setPouchInflation(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
    if (this.pouchManager) {
      this.pouchManager.setInflation(this.progress);
    }
    this.onFoldChange?.(this.progress);
  }

  togglePouchGusset(show = null) {
    if (this.pouchManager) {
      return this.pouchManager.toggleGusset(show);
    }
    return false;
  }

  togglePouchSeals(show = null) {
    if (this.pouchManager) {
      return this.pouchManager.toggleSeals(show);
    }
    return false;
  }

  updateInspectorUI() {
    const parent = this.container.closest('.carton-studio') || this.container.parentElement;
    const insp = parent?.querySelector('[data-geometry-inspector]');
    if (!insp) return;

    const modelEl = insp.querySelector('[data-insp-model]');
    const dimsEl = insp.querySelector('[data-insp-dims]');
    const provEl = insp.querySelector('[data-insp-prov]');
    const findingEl = insp.querySelector('[data-insp-finding]');

    const formatLabels = {
      carton: 'Folding Carton',
      can: 'Beverage Can',
      bottle: 'Glass Bottle',
      pouch: 'Stand-up Pouch',
    };
    if (modelEl) modelEl.textContent = formatLabels[this.packageType] || this.packageType;

    if (dimsEl) {
      if (this.packageType === 'carton') {
        const d = this.tree?.dimensions || { width: 56, height: 110, depth: 36 };
        dimsEl.textContent = `${Math.round(d.width)} × ${Math.round(d.height)} × ${Math.round(d.depth)} mm`;
      } else if (this.packageType === 'can') {
        const d = this.canManager?.dimensions || { radius: 33, height: 122 };
        dimsEl.textContent = `Ø ${d.radius * 2} × ${d.height} mm`;
      } else if (this.packageType === 'bottle') {
        const d = this.bottleManager?.dimensions || { radius: 36, height: 190 };
        dimsEl.textContent = `Ø ${d.radius * 2} × ${d.height} mm`;
      } else if (this.packageType === 'pouch') {
        const d = this.pouchManager?.dimensions || { width: 140, height: 200, depth: 65 };
        dimsEl.textContent = `${d.width} × ${d.height} × ${d.depth} mm (expanded)`;
      }
    }

    if (provEl) {
      provEl.textContent = this.packageType === 'carton' && this.review?.documents?.some(d => d.role === 'dieline')
        ? 'DXF-dimensioned dieline'
        : 'Reviewer-configured illustrative';
    }

    if (findingEl) {
      const activeF = this.review?.findings?.find(f => f.id === this.selectedFindingId);
      findingEl.textContent = activeF ? activeF.title : 'None selected';
    }
  }

  /**
   * Set active substrate and reapply to active package meshes.
   */
  setSubstrate(subId) {
    if (!this.finishingManager) return;
    this.finishingManager.activeSubstrate = subId;
    this.reapplyFinishing();
  }

  /**
   * Set active premium finish (none, spot_uv, gold_foil, silver_foil, emboss_preview).
   */
  setFinish(finishId, { box = [0.2, 0.2, 0.8, 0.5], shape = 'rect', origin = 'reviewer_defined' } = {}) {
    if (!this.finishingManager) return;
    this.finishingManager.activeFinish = finishId;
    if (finishId !== 'none') {
      this.finishingManager.createMaskTexture({ box, shape, origin });
    }
    this.reapplyFinishing();
  }

  /**
   * Set Spot UV gloss intensity slider value [0.0 - 1.0].
   */
  setSpotUvIntensity(val) {
    if (!this.finishingManager) return;
    this.finishingManager.spotUvIntensity = Math.max(0, Math.min(1, Number(val) || 0));
    this.reapplyFinishing();
  }

  /**
   * Set lighting preset: 'studio_softbox' | 'neutral_daylight' | 'rotating_highlight'
   */
  setLighting(preset) {
    if (!this.finishingManager || !this.scene) return;
    this.finishingManager.setupLighting(this.scene, preset);
  }

  /**
   * Re-applies active substrate and finishes to the active package geometry.
   */
  reapplyFinishing() {
    if (!this.finishingManager) return;

    if (this.packageType === 'carton' && this.panelMeshes) {
      for (const mesh of Object.values(this.panelMeshes)) {
        if (mesh && mesh.material) {
          const map = mesh.material.map;
          this.finishingManager.applyFinishingToMesh(mesh, map);
        }
      }
    } else if (this.packageType === 'can' && this.canManager?.bodyMesh) {
      const map = this.canManager.bodyMesh.material?.map || this.baseTexture;
      this.finishingManager.applyFinishingToMesh(this.canManager.bodyMesh, map);
    } else if (this.packageType === 'bottle' && this.bottleManager?.labelMesh) {
      const map = this.bottleManager.labelMesh.material?.map || this.baseTexture;
      this.finishingManager.applyFinishingToMesh(this.bottleManager.labelMesh, map);
    } else if (this.packageType === 'pouch' && this.pouchManager?.frontMesh) {
      const map = this.pouchManager.frontMesh.material?.map || this.baseTexture;
      this.finishingManager.applyFinishingToMesh(this.pouchManager.frontMesh, map);
    }
  }

  /**
   * Toggle comparison between pristine original artwork and premium finish.
   */
  toggleOriginalView(show = null) {
    if (!this.finishingManager) return false;
    const res = this.finishingManager.toggleOriginal(show);
    this.reapplyFinishing();
    return res;
  }

  /**
   * Toggle finish mask visualizer overlay.
   */
  toggleShowMask(show = null) {
    if (!this.finishingManager) return false;
    const res = this.finishingManager.toggleMaskOverlay(show);
    this.reapplyFinishing();
    return res;
  }

  /**
   * Applies custom rectangular mask drawn on 2D artwork.
   */
  setCustomMaskBox(box) {
    if (!this.finishingManager) return;
    this.finishingManager.createMaskTexture({ box, origin: 'reviewer_defined' });
    this.reapplyFinishing();
  }

  /**
   * Applies custom polygon mask drawn on 2D artwork.
   */
  setCustomPolygon(polygon) {
    if (!this.finishingManager) return;
    this.finishingManager.createMaskTexture({ polygon, origin: 'reviewer_defined' });
    this.reapplyFinishing();
  }

  /**
   * Applies uploaded PNG mask image.
   */
  setUploadedMaskImage(imageElement) {
    if (!this.finishingManager) return;
    this.finishingManager.createMaskTexture({ imageMask: imageElement, origin: 'uploaded_mask' });
    this.reapplyFinishing();
  }

  startLightSweep() {
    this.finishingManager?.startLightSweep();
  }

  pauseLightSweep() {
    this.finishingManager?.pauseLightSweep();
  }

  resetLightSweep() {
    this.finishingManager?.resetLightSweep();
  }

  /**
   * Resets finishes back to default matte substrate with no finishes.
   */
  resetFinishes() {
    if (!this.finishingManager) return;
    this.finishingManager.activeFinish = 'none';
    this.finishingManager.activeSubstrate = 'matte_paperboard';
    this.finishingManager.showOriginalOnly = false;
    this.finishingManager.showMaskOverlay = false;
    this.reapplyFinishing();
  }

  /**
   * Exports high-res finish preview with metadata and prepress disclaimer.
   */
  exportFinishPreview() {
    if (!this.finishingManager || !this.renderer) return null;
    const formatLabels = {
      carton: 'Folding Carton',
      can: 'Beverage Can',
      bottle: 'Glass Bottle',
      pouch: 'Stand-up Pouch',
    };
    const geometrySource = this.packageType === 'carton' && this.review?.documents?.some(d => d.role === 'dieline')
      ? 'DXF-dimensioned dieline'
      : 'Reviewer-configured illustrative';

    return this.finishingManager.exportFinishPreview(this.renderer, {
      modelName: formatLabels[this.packageType] || this.packageType,
      reviewId: this.review?.id || '',
      provenance: this.finishingManager.maskOrigin || 'Reviewer-defined visual finish mask',
      geometrySource,
    });
  }

  setupRaycasting() {
    const dom = this.renderer.domElement;

    this.onPointerDown = (event) => {
      if (event.button !== 0) return;
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const clickedPin = this.pinSystem.intersectPins(this.raycaster);

      if (clickedPin) {
        event.stopPropagation();
        this.selectFinding(clickedPin.findingId, clickedPin.evidenceIndex);
        return;
      }

      // Check Ghost Box Raycasting in X-Ray mode (Step 13: 2D and 3D Synchronization)
      if (this.isXRay && Array.isArray(this.ghostBoxes) && this.ghostBoxes.length > 0) {
        const hits = this.raycaster.intersectObjects(this.ghostBoxes, true);
        if (hits.length > 0) {
          let top = hits[0].object;
          while (top && !top.userData?.isGhostBox && top.parent && top.parent !== this.scene) {
            top = top.parent;
          }
          if (top && top.userData?.isGhostBox) {
            event.stopPropagation();
            const findingId = top.userData.findingId;
            if (top.userData.faceName) {
              this.focusPanel(top.userData.faceName);
            }
            if (findingId) {
              this.selectFinding(findingId);
              this.onViewIn2D?.(findingId, 1, 0);
            }
            return;
          }
        }
      }
    };

    dom.addEventListener('pointerdown', this.onPointerDown);
  }

  selectFinding(findingId, evidenceIndex = 0) {
    this.selectedFindingId = findingId;
    this.pinSystem.setSelectedFinding(findingId);
    this.focusFinding(findingId);
    this.updateInspectorUI();
    this.onSelectFinding?.(findingId, evidenceIndex);
  }

  focusFinding(findingId) {
    const pin = this.locatedPins.find(p => p.findingId === findingId);
    if (pin) {
      const panelDims = this.tree?.panels?.[pin.faceName] || { width: 60, height: 110 };
      this.cameraController.flyToPin(pin, panelDims);
    }
  }

  focusPanel(faceName) {
    if (this.packageType !== 'carton') return;
    const mesh = this.panelMeshes?.[faceName];
    if (mesh && this.tree?.panels?.[faceName]) {
      const dims = this.tree.panels[faceName];
      this.cameraController.flyToPanel(mesh, { panelWidth: dims.width, panelHeight: dims.height });
    }
  }

  setFoldProgress(progress) {
    this.progress = Math.max(0, Math.min(1, Number(progress) || 0));
    if (this.packageType === 'carton' && this.geometryManager) {
      this.geometryManager.updateFoldProgress(this.progress);
    } else if (this.packageType === 'pouch' && this.pouchManager) {
      this.pouchManager.setInflation(this.progress);
    }
    this.onFoldChange?.(this.progress);
  }

  playFoldAnimation() {
    this.playing = true;
    this.lastTime = performance.now();
    this.onPlayStateChange?.(true);
  }

  pauseFoldAnimation() {
    this.playing = false;
    this.lastTime = null;
    this.onPlayStateChange?.(false);
  }

  toggleFoldPlayback() {
    if (this.playing) {
      this.pauseFoldAnimation();
    } else {
      if (this.progress >= 0.99) this.playDirection = -1;
      else if (this.progress <= 0.01) this.playDirection = 1;
      this.playFoldAnimation();
    }
    return this.playing;
  }

  buildGhostBoxes() {
    if (!this.panelMeshes || !this.THREE) return;
    if (Array.isArray(this.ghostBoxes)) {
      for (const box of this.ghostBoxes) {
        if (box.parent) box.parent.remove(box);
      }
    }
    this.ghostBoxes = [];

    const createDashedBox = (w, h, labelText, color = 0xf59e0b) => {
      const group = new this.THREE.Group();

      const hw = w / 2;
      const hh = h / 2;
      const pts = [
        new this.THREE.Vector3(-hw, -hh, 0.4),
        new this.THREE.Vector3(hw, -hh, 0.4),
        new this.THREE.Vector3(hw, hh, 0.4),
        new this.THREE.Vector3(-hw, hh, 0.4),
        new this.THREE.Vector3(-hw, -hh, 0.4),
      ];
      const geom = new this.THREE.BufferGeometry().setFromPoints(pts);
      const mat = new this.THREE.LineDashedMaterial({
        color,
        dashSize: 3,
        gapSize: 2,
      });
      const line = new this.THREE.Line(geom, mat);
      line.computeLineDistances();
      group.add(line);

      const planeGeom = new this.THREE.PlaneGeometry(w, h);
      const planeMat = new this.THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.15,
        side: this.THREE.DoubleSide,
      });
      const planeMesh = new this.THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.z = 0.3;
      group.add(planeMesh);

      // Label sprite
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      if (ctx.roundRect) ctx.roundRect(4, 4, 504, 120, 16);
      else ctx.fillRect(4, 4, 504, 120);
      ctx.fill();
      ctx.strokeStyle = color === 0x15803d ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 256, 64);

      const tex = new this.THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const spriteMat = new this.THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new this.THREE.Sprite(spriteMat);
      sprite.scale.set(w * 0.9, (w * 0.9) * (128 / 512), 1);
      sprite.position.set(0, 0, 1.0);
      group.add(sprite);

      group.visible = Boolean(this.isXRay);
      group.userData = { isGhostBox: true, label: labelText, market: isIndia ? 'india' : 'us' };
      return group;
    };

    const isIndia = /india|fssai/i.test(this.review?.market || '') || this.review?.options?.marketPreset === 'in';
    const findings = this.review?.findings || [];
    const netQtyFinding = findings.find(f => {
      const fld = (f.rule?.field || f.field || '').toLowerCase();
      const t = (f.title || '').toLowerCase();
      return fld === 'net_quantity' || /net\s*quantity|volume|weight/i.test(t);
    });
    const addressFinding = findings.find(f => {
      const fld = (f.rule?.field || f.field || '').toLowerCase();
      const t = (f.title || '').toLowerCase();
      return fld === 'business_details' || fld === 'manufacturer' || /address|manufacturer|distributor/i.test(t);
    });

    // 1. Ghost box for Missing Net Quantity in oz (PDP Front Panel, bottom 30%)
    const frontMesh = this.panelMeshes.front;
    if (frontMesh && !isIndia) {
      const fw = frontMesh.geometry.parameters?.width || 102;
      const fh = frontMesh.geometry.parameters?.height || 120;
      const box = createDashedBox(fw * 0.75, Math.min(24, fh * 0.2), 'MISSING: Net Qty in oz (21 CFR §101.7)', 0xf59e0b);
      box.position.set(0, -fh * 0.35, 0.2);
      box.userData = {
        isGhostBox: true,
        findingId: netQtyFinding?.id || 'finding-net-qty',
        label: 'MISSING: Net Qty in oz (21 CFR §101.7)',
        market: 'us',
        faceName: 'front',
        declarationType: 'NET_QUANTITY'
      };
      frontMesh.add(box);
      this.ghostBoxes.push(box);
    }

    // 2. Ghost box for Missing Manufacturer Address (Back Panel, bottom)
    const backMesh = this.panelMeshes.back;
    if (backMesh && !isIndia) {
      const bw = backMesh.geometry.parameters?.width || 102;
      const bh = backMesh.geometry.parameters?.height || 120;
      const box = createDashedBox(bw * 0.8, Math.min(24, bh * 0.2), 'MISSING: Legal Address (21 CFR §101.5)', 0xf59e0b);
      box.position.set(0, -bh * 0.35, 0.2);
      box.userData = {
        isGhostBox: true,
        findingId: addressFinding?.id || 'finding-address',
        label: 'MISSING: Legal Address (21 CFR §101.5)',
        market: 'us',
        faceName: 'back',
        declarationType: 'MANUFACTURER_ADDRESS'
      };
      backMesh.add(box);
      this.ghostBoxes.push(box);
    }

    // 3. If India Market: Green Veg Logo on Front & MRP on Back
    if (frontMesh && isIndia) {
      const fw = frontMesh.geometry.parameters?.width || 102;
      const fh = frontMesh.geometry.parameters?.height || 120;
      const box = createDashedBox(24, 24, 'MANDATORY: Veg Mark (FSSAI)', 0x15803d);
      box.position.set(-fw * 0.3, fh * 0.3, 0.2);
      frontMesh.add(box);
      this.ghostBoxes.push(box);
    }

    if (backMesh && isIndia) {
      const bw = backMesh.geometry.parameters?.width || 102;
      const bh = backMesh.geometry.parameters?.height || 120;
      const box = createDashedBox(bw * 0.8, Math.min(24, bh * 0.2), 'MANDATORY: MRP & FSSAI Licence No.', 0x15803d);
      box.position.set(0, -bh * 0.35, 0.2);
      backMesh.add(box);
      this.ghostBoxes.push(box);
    }
  }

  setXRay(enabled) {
    this.isXRay = Boolean(enabled);
    if (this.geometryManager) {
      this.geometryManager.setXRay(enabled);
    }
    if (Array.isArray(this.ghostBoxes)) {
      for (const box of this.ghostBoxes) {
        box.visible = this.isXRay;
      }
    }
  }

  getGhostBoxes() {
    return this.ghostBoxes || [];
  }

  setMarket(market) {
    if (this.review) {
      this.review.market = market;
    }
    this.buildGhostBoxes();
  }

  takeSnapshot() {
    if (!this.renderer || !this.scene || !this.camera || this.disposed) return null;
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    window.__packsignalLast3dSnapshot = dataUrl;

    const link = document.createElement('a');
    link.download = `packsignal-3d-${this.packageType || 'pack'}-snapshot.png`;
    link.href = dataUrl;
    link.click();
    return dataUrl;
  }

  setShowLabels(enabled) {
    if (this.geometryManager) {
      this.geometryManager.setShowLabels(enabled);
    }
  }

  filterPins(mode) {
    this.pinSystem.filterPins(mode);
  }

  resetCamera() {
    if (this.packageType === 'carton' && this.progress < 0.1) {
      this.cameraController.focusFlatDieline(180, 140);
    } else {
      const dims = this.packageType === 'can' ? { width: 70, height: 130, depth: 70 }
        : this.packageType === 'bottle' ? { width: 80, height: 200, depth: 80 }
        : this.packageType === 'pouch' ? { width: 140, height: 200, depth: 70 }
        : (this.tree?.dimensions || { width: 56, height: 110, depth: 36 });
      this.cameraController.resetCamera(dims);
    }
  }

  capturePreview() {
    if (this.renderer?.domElement) {
      return this.renderer.domElement.toDataURL('image/png');
    }
    return null;
  }

  async captureReportPreview({
    reviewId = null,
    artworkHash = null,
    packageType = null,
    width = 2000,
    height = 1500,
    cameraPreset = 'three_quarter',
  } = {}) {
    if (!this.renderer || !this.scene || !this.camera || this.disposed) return null;

    try {
      const targetW = Math.min(Math.max(width || 2000, 800), 2048);
      const targetH = Math.min(Math.max(height || 1500, 600), 2048);

      const origRenderTarget = this.renderer.getRenderTarget();
      const origSize = new this.THREE.Vector2();
      this.renderer.getSize(origSize);
      const origPos = this.camera.position.clone();
      const origQuat = this.camera.quaternion.clone();
      const origAspect = this.camera.aspect;

      // Position camera for pristine three-quarter studio hero angle
      if (cameraPreset === 'three_quarter') {
        const pkg = packageType || this.packageType || 'carton';
        if (pkg === 'can') {
          this.camera.position.set(-50, 30, 240);
        } else if (pkg === 'bottle') {
          this.camera.position.set(-45, 40, 260);
        } else if (pkg === 'pouch') {
          this.camera.position.set(-40, 30, 250);
        } else {
          // folding carton: front, side, and top visible
          this.camera.position.set(-65, 55, 260);
        }
        this.camera.lookAt(0, 0, 0);
      }

      this.camera.aspect = targetW / targetH;
      this.camera.updateProjectionMatrix();

      // Render offscreen target
      const renderTarget = new this.THREE.WebGLRenderTarget(targetW, targetH, {
        minFilter: this.THREE.LinearFilter,
        magFilter: this.THREE.LinearFilter,
        format: this.THREE.RGBAFormat,
        colorSpace: this.THREE.SRGBColorSpace || this.renderer.outputColorSpace,
      });

      this.renderer.setRenderTarget(renderTarget);
      this.renderer.render(this.scene, this.camera);

      // Read pixels back
      const pixels = new Uint8Array(targetW * targetH * 4);
      this.renderer.readRenderTargetPixels(renderTarget, 0, 0, targetW, targetH, pixels);
      this.renderer.setRenderTarget(origRenderTarget);
      renderTarget.dispose();

      // Restore camera & renderer
      this.camera.position.copy(origPos);
      this.camera.quaternion.copy(origQuat);
      this.camera.aspect = origAspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(origSize.x, origSize.y, false);

      // Validate pixels: check non-black count
      let nonZeroCount = 0;
      for (let i = 0; i < pixels.length; i += 32) {
        if (pixels[i] > 15 || pixels[i + 1] > 15 || pixels[i + 2] > 15) {
          nonZeroCount++;
        }
      }

      if (nonZeroCount < 20) {
        // Fallback to live domElement capture
        const fallbackData = this.renderer.domElement.toDataURL('image/png');
        return {
          dataUrl: fallbackData,
          width: origSize.x,
          height: origSize.y,
          packageType: packageType || this.packageType || 'folding_carton',
          geometrySource: 'Reviewer-confirmed carton panel mapping',
          provenance: '3D visualization generated from uploaded artwork and reviewer-confirmed carton panel mapping.',
          cameraPreset,
          rendererVersion: 'Three.js WebGLRenderer',
        };
      }

      // Flip rows to match standard image orientation
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(targetW, targetH);
      for (let y = 0; y < targetH; y++) {
        const srcOffset = (targetH - 1 - y) * targetW * 4;
        const dstOffset = y * targetW * 4;
        imgData.data.set(pixels.subarray(srcOffset, srcOffset + targetW * 4), dstOffset);
      }
      ctx.putImageData(imgData, 0, 0);

      const pkgType = packageType || this.packageType || 'folding_carton';
      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: targetW,
        height: targetH,
        packageType: pkgType,
        geometrySource: 'Reviewer-confirmed carton panel mapping',
        provenance: `3D visualization generated from uploaded artwork and reviewer-confirmed carton panel mapping.`,
        cameraPreset,
        rendererVersion: 'Three.js WebGLRenderer r169',
      };
    } catch (err) {
      console.warn('captureReportPreview offscreen render target failed, falling back to domElement:', err);
      if (this.renderer?.domElement) {
        return {
          dataUrl: this.renderer.domElement.toDataURL('image/png'),
          width: this.renderer.domElement.width,
          height: this.renderer.domElement.height,
          packageType: packageType || this.packageType || 'folding_carton',
          geometrySource: 'Reviewer-confirmed carton panel mapping',
          provenance: '3D visualization generated from uploaded artwork and reviewer-confirmed carton panel mapping.',
          cameraPreset,
          rendererVersion: 'Three.js WebGLRenderer',
        };
      }
      return null;
    }
  }

  startLoop() {
    const tick = (now) => {
      if (this.disposed) return;

      if (this.playing) {
        if (!this.lastTime) this.lastTime = now;
        const deltaSec = (now - this.lastTime) / 1000;
        this.lastTime = now;

        const speed = 1.0 / 2.2;
        let nextProgress = this.progress + this.playDirection * speed * deltaSec;

        if (nextProgress >= 1.0) {
          nextProgress = 1.0;
          this.playing = false;
          this.onPlayStateChange?.(false);
        } else if (nextProgress <= 0.0) {
          nextProgress = 0.0;
          this.playing = false;
          this.onPlayStateChange?.(false);
        }

        this.setFoldProgress(nextProgress);
      }

      // Update rotating highlight preset if active
      if (this.finishingManager) {
        this.finishingManager.updateLightAnimation(0.016);
      }

      this.controls.update();
      this.sceneManager.render();

      this.frameId = requestAnimationFrame(tick);
    };

    this.frameId = requestAnimationFrame(tick);
  }

  renderFallback(message) {
    this.container.innerHTML = `
      <div class="carton-empty" style="min-height:360px;">
        <div class="carton-empty-box"><span>3D</span></div>
        <p><strong>WebGL Fallback</strong></p>
        <p style="max-width:320px;font-size:11px;color:#8fa394;">${message}</p>
        <p style="font-size:10px;color:#6b8271;">2D proof and inspection findings remain fully available.</p>
      </div>
    `;
  }

  dispose() {
    this.disposed = true;
    this.playing = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);

    if (this.renderer?.domElement && this.onPointerDown) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    }

    if (this.controls) this.controls.dispose();
    if (this.pinSystem) this.pinSystem.dispose();
    if (this.geometryManager) this.geometryManager.dispose();
    if (this.canManager) this.canManager.clear();
    if (this.bottleManager) this.bottleManager.clear();
    if (this.pouchManager) this.pouchManager.clear();
    if (this.finishingManager) this.finishingManager.dispose();
    if (this.textureMapper) this.textureMapper.dispose();
    if (this.sceneManager) this.sceneManager.dispose();
  }
}
