/**
 * PackSignal 3D Packaging Studio — Canonical Master Studio Interface
 * (public/packaging-3d/package-studio.js)
 *
 * Implements Phase 1 unified interface:
 * createPackagePreview({
 *   packageType,
 *   geometry,
 *   material,
 *   artwork,
 *   findings,
 *   container
 * })
 */

import { PACKAGE_TYPES, normalizePackageType, getPackageTypeMetadata } from './package-types.js';
import { createPackageGeometry } from './package-geometry.js';
import { PBR_MATERIAL_PRESETS, createThreeMaterial } from './package-materials.js';
import { PackagingFindingPinManager } from './finding-pins.js';
import { PackagingCameraController } from './camera-controller.js';
import { TextureMappingEngine } from './texture-mapping.js';

export function createPackagePreview({
  packageType = PACKAGE_TYPES.FOLDING_CARTON,
  geometry = null,
  material = null,
  artwork = null,
  findings = [],
  container = null,
  onSelectFinding = null,
  onViewIn2D = null,
} = {}) {
  let currentType = normalizePackageType(packageType);
  let currentGeometry = geometry || createPackageGeometry({ packageType: currentType });
  let currentMaterial = material || currentGeometry.materialPreset || 'SBS_WHITE_CARD';
  let currentArtwork = artwork;
  let currentFindings = findings || [];
  let selectedFindingId = null;
  let isDisposed = false;

  let THREE = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let cameraController = null;
  let pinManager = null;
  let textureEngine = null;
  let activeModelGroup = null;
  let modelManagers = {};

  let animFrameId = null;

  async function init() {
    if (!container) return;

    // Load Three bundle
    try {
      const bundle = await import('/three-bundle.js');
      THREE = bundle.THREE;
      const OrbitControls = bundle.OrbitControls;

      const width = container.clientWidth || 600;
      const height = container.clientHeight || 450;

      // Create Scene & Camera
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f172a); // Slate-900 neutral dark backdrop

      camera = new THREE.PerspectiveCamera(40, width / height, 1, 3000);
      camera.position.set(0, 15, 300);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping || 4;
      renderer.toneMappingExposure = 1.1;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // Controls & Subsystems
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      cameraController = new PackagingCameraController(THREE, camera, controls, renderer.domElement);
      pinManager = new PackagingFindingPinManager(THREE, { onSelectFinding });
      textureEngine = new TextureMappingEngine(THREE);

      scene.add(pinManager.pinGroup);

      // Studio Lighting
      setupStudioLighting();

      // Build initial package model
      await buildModelForType(currentType);

      // Start render loop
      const animate = () => {
        if (isDisposed) return;
        animFrameId = requestAnimationFrame(animate);
        controls.update();
        cameraController.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      window.addEventListener('resize', handleResize);
    } catch (err) {
      console.error('[PackageStudio] WebGL initialization failed:', err);
      renderFallbackNotice('WebGL 3D packaging studio unavailable in this environment.');
    }
  }

  function setupStudioLighting() {
    // 3-Point Studio Softbox Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(150, 200, 200);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.7); // Cool subtle fill
    fillLight.position.set(-180, 80, -100);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.5); // Warm rim
    rimLight.position.set(0, -100, -200);
    scene.add(rimLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    // Floor Contact Shadow Platform
    const floorGeom = new THREE.PlaneGeometry(800, 800);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x090d16, depthWrite: false });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.y = -110;
    scene.add(floor);
  }

  async function buildModelForType(type) {
    if (!THREE || !scene) return;

    if (activeModelGroup) {
      scene.remove(activeModelGroup);
      activeModelGroup = null;
    }

    currentType = normalizePackageType(type);
    currentGeometry = createPackageGeometry({ packageType: currentType });

    let texture = null;
    if (currentArtwork) {
      texture = await textureEngine.loadArtworkTexture(typeof currentArtwork === 'string' ? currentArtwork : currentArtwork.url);
    }

    if (currentType === 'can') {
      const { CanGeometryManager } = await import('../three/geometry/can.js');
      const canMgr = new CanGeometryManager(THREE);
      canMgr.buildCan({ labelTexture: texture });
      activeModelGroup = canMgr.rootGroup;
      scene.add(activeModelGroup);
      modelManagers.can = canMgr;

      // Project pins onto can cylinder
      pinManager.projectFindings({
        findings: currentFindings,
        mapPointFn: (u, v) => canMgr.mapPointToCylinder(u, v),
        parentMesh: canMgr.bodyMesh,
        selectedFindingId,
      });
    } else if (currentType === 'bottle') {
      const { BottleGeometryManager } = await import('../three/geometry/bottle.js');
      const bottleMgr = new BottleGeometryManager(THREE);
      bottleMgr.buildBottle({ labelTexture: texture, bottleType: 'glass' });
      activeModelGroup = bottleMgr.rootGroup;
      scene.add(activeModelGroup);
      modelManagers.bottle = bottleMgr;

      pinManager.projectFindings({
        findings: currentFindings,
        mapPointFn: (u, v) => bottleMgr.mapPointToBottle(u, v),
        parentMesh: bottleMgr.labelMesh,
        selectedFindingId,
      });
    } else if (currentType === 'pouch') {
      const { PouchGeometryManager } = await import('../three/geometry/pouch.js');
      const pouchMgr = new PouchGeometryManager(THREE);
      pouchMgr.buildPouch({ frontTexture: texture, backTexture: texture, inflation: 0.85 });
      activeModelGroup = pouchMgr.rootGroup;
      scene.add(activeModelGroup);
      modelManagers.pouch = pouchMgr;

      pinManager.projectFindings({
        findings: currentFindings,
        mapPointFn: (u, v) => pouchMgr.mapPointToPouch(u, v, 'front'),
        parentMesh: pouchMgr.frontMesh,
        selectedFindingId,
      });
    } else {
      // Folding Carton
      const { CartonGeometryManager } = await import('../three/carton-geometry.js');
      const cartonMgr = new CartonGeometryManager(THREE);
      const dims = currentGeometry.dimensions || { width: 160, height: 220, depth: 55 };
      const cartonGroup = cartonMgr.buildCartonMesh(dims, {
        front: texture,
        back: texture,
        left: texture,
        right: texture,
        top: texture,
        bottom: texture,
      });
      activeModelGroup = cartonGroup;
      scene.add(activeModelGroup);
      modelManagers.carton = cartonMgr;

      pinManager.projectFindings({
        findings: currentFindings,
        mapPointFn: (u, v) => ({
          point: [(u - 0.5) * dims.width, (0.5 - v) * dims.height, dims.depth / 2 + 0.5],
          normal: [0, 0, 1],
        }),
        parentMesh: cartonGroup,
        selectedFindingId,
      });
    }

    if (cameraController) {
      cameraController.resetCamera(currentGeometry.dimensions);
    }
  }

  function handleResize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 450;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function renderFallbackNotice(msg) {
    if (!container) return;
    container.innerHTML = `
      <div class="package-3d-fallback" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#94a3b8;padding:24px;text-align:center;">
        <span style="font-size:32px;margin-bottom:12px;">📦</span>
        <h3 style="margin:0 0 8px 0;color:#f8fafc;">3D Visualization Unavailable</h3>
        <p style="margin:0 0 16px 0;max-width:380px;">${msg}</p>
        <small class="subtle">All compliance findings remain fully accessible in the 2D Findings Workspace.</small>
      </div>
    `;
  }

  // Trigger async init
  init();

  return {
    async setPackageType(type) {
      currentType = normalizePackageType(type);
      await buildModelForType(currentType);
    },

    async setArtwork(artwork) {
      currentArtwork = artwork;
      await buildModelForType(currentType);
    },

    setGeometry(geom) {
      currentGeometry = geom;
      if (geom.packageType) {
        this.setPackageType(geom.packageType);
      }
    },

    setMaterial(matPreset) {
      currentMaterial = matPreset;
      if (THREE && activeModelGroup) {
        const mat = createThreeMaterial(THREE, matPreset);
        activeModelGroup.traverse((child) => {
          if (child.isMesh && child.name.includes('body')) {
            child.material = mat;
          }
        });
      }
    },

    setFindings(findings) {
      currentFindings = findings || [];
      if (pinManager && modelManagers[currentType]) {
        // Re-project findings
        buildModelForType(currentType);
      }
    },

    selectFinding(findingId) {
      selectedFindingId = findingId;
      pinManager?.highlightFinding(findingId);
    },

    focusFinding(findingId) {
      selectedFindingId = findingId;
      pinManager?.highlightFinding(findingId);
      const pin = pinManager?.activePins?.find(p => p.id === findingId);
      if (pin && cameraController) {
        cameraController.focusSurfacePoint(pin.point, pin.normal);
      }
    },

    setRotation(deg) {
      if (activeModelGroup) {
        activeModelGroup.rotation.y = (deg * Math.PI) / 180;
      }
    },

    resetCamera() {
      cameraController?.resetCamera(currentGeometry.dimensions);
    },

    dispose() {
      isDisposed = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      cameraController?.dispose();
      pinManager?.dispose();
      textureEngine?.dispose();
      controls?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement?.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
      }
    },

    // Getters for inspection
    getPackageType: () => currentType,
    getGeometry: () => currentGeometry,
    getMaterial: () => currentMaterial,
    getFindings: () => currentFindings,
    getSelectedFindingId: () => selectedFindingId,
    getMetadata: () => getPackageTypeMetadata(currentType),
  };
}
