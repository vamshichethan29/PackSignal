/**
 * PackSignal Premium Finishing Effects & Materials System (public/three/materials/finishes.js)
 * Physically-based substrate and finish simulation using Three.js MeshPhysicalMaterial.
 * Supports:
 * - Substrates: Matte paperboard, Gloss paperboard, White plastic, Clear plastic, Aluminum
 * - Finishes: None, Spot UV gloss, Gold foil, Silver foil, Rose gold, Emboss preview, Deboss preview
 * - Selective region masks (reviewer-defined, uploaded mask, source separation)
 * - Studio lighting presets (Softbox, Neutral daylight, Rotating highlight sweep)
 * - Compare with original toggle & Mask visualization overlay
 */

import {
  createRasterMaskTexture,
  createReliefHeightTexture,
  MASK_PROVENANCE,
} from './finish-mask.js';
import {
  FOIL_PRESETS,
  createFoilCompositeMap,
  configureFoilMaterial,
} from './metallic-foil.js';
import {
  configureSpotUvMaterial,
} from './spot-uv.js';
import {
  RELIEF_PRESETS,
  configureReliefMaterial,
} from './relief-effects.js';

export const SUBSTRATES = {
  matte_paperboard: {
    id: 'matte_paperboard',
    label: 'Matte Paperboard',
    roughness: 0.82,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.0,
  },
  gloss_paperboard: {
    id: 'gloss_paperboard',
    label: 'Gloss-Coated Paperboard',
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
  },
  white_plastic: {
    id: 'white_plastic',
    label: 'White Plastic (HDPE/PP)',
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
  },
  clear_plastic: {
    id: 'clear_plastic',
    label: 'Clear Plastic (PET)',
    roughness: 0.12,
    metalness: 0.05,
    transmission: 0.88,
    transparent: true,
    opacity: 0.9,
    ior: 1.5,
  },
  aluminum: {
    id: 'aluminum',
    label: 'Brushed Aluminum',
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.1,
  },
};

export const FINISHES = {
  none: {
    id: 'none',
    label: 'No Premium Finish',
  },
  spot_uv: {
    id: 'spot_uv',
    label: 'Spot UV Gloss Varnish',
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    disclaimer: 'Visual finish approximation — final print appearance depends on varnish weight, anilox volume, and curing.',
  },
  gold_foil: {
    id: 'gold_foil',
    label: 'Hot Stamp Gold Foil',
    foilColor: 0xd4af37,
    roughness: 0.18,
    metalness: 0.96,
    disclaimer: 'Visual finish approximation — hot foil stamping reflectivity depends on die temperature, pressure, and substrate.',
  },
  silver_foil: {
    id: 'silver_foil',
    label: 'Hot Stamp Silver Foil',
    foilColor: 0xdcdcdc,
    roughness: 0.18,
    metalness: 0.96,
    disclaimer: 'Visual finish approximation — silver foil reflectivity depends on foil grade and release layer formulation.',
  },
  emboss_preview: {
    id: 'emboss_preview',
    label: 'Embossing Preview (Raised)',
    bumpScale: 1.2,
    disclaimer: 'Visual finish approximation — actual embossing depth depends on paper caliper, grain direction, and counter-die.',
  },
  deboss_preview: {
    id: 'deboss_preview',
    label: 'Debossing Preview (Recessed)',
    bumpScale: -1.2,
    disclaimer: 'Visual finish approximation — actual debossing depth depends on board density and die pressure.',
  },
};

export class FinishingEffectsManager {
  constructor(THREE) {
    this.THREE = THREE;
    this.activeSubstrate = 'matte_paperboard';
    this.activeFinish = 'none';
    this.activeMaskType = MASK_PROVENANCE.REVIEWER_DEFINED;
    this.spotUvIntensity = 1.0;
    this.foilRoughness = 0.18;
    this.maskTexture = null;
    this.maskCanvas = null;
    this.bumpTexture = null;
    this.compositeArtworkTexture = null;
    this.maskOrigin = MASK_PROVENANCE.REVIEWER_DEFINED;
    this.lightingPreset = 'studio_softbox';
    this.lights = [];
    this.orbitLight = null;
    this.orbitAngle = 0;

    // Comparison & debugging states
    this.showOriginalOnly = false;
    this.showMaskOverlay = false;

    // Serializable finish layer stack
    this.finishStack = [];
  }

  /**
   * Generates a 2D canvas mask texture and heightmap.
   */
  createMaskTexture({
    box = [0.25, 0.15, 0.75, 0.45],
    polygon = null,
    imageMask = null,
    canvasSize = 1024,
    origin = MASK_PROVENANCE.REVIEWER_DEFINED,
  } = {}) {
    this.disposeMasks();
    this.maskOrigin = origin;

    // Generate mask texture via finish-mask module
    const result = createRasterMaskTexture(this.THREE, {
      box,
      polygon,
      imageMask,
      resolution: canvasSize,
      provenance: origin,
    });

    this.maskTexture = result.texture;
    this.maskCanvas = result.canvas;

    // Generate matching relief heightmap for emboss / deboss
    const invert = this.activeFinish === 'deboss_preview';
    this.bumpTexture = createReliefHeightTexture(this.THREE, this.maskCanvas, canvasSize, invert);

    return this.maskTexture;
  }

  /**
   * Applies the active substrate and premium finish to a target mesh material.
   *
   * @param {THREE.Mesh} mesh
   * @param {THREE.Texture} [baseArtworkTexture]
   * @returns {THREE.MeshPhysicalMaterial}
   */
  applyFinishingToMesh(mesh, baseArtworkTexture = null) {
    if (!mesh) return null;

    const sub = SUBSTRATES[this.activeSubstrate] || SUBSTRATES.matte_paperboard;
    const baseMap = baseArtworkTexture || (mesh.material && mesh.material.map) || null;

    // If Mode A: "Show Original Only" is active, return pristine un-finished substrate
    if (this.showOriginalOnly) {
      const origMat = new this.THREE.MeshPhysicalMaterial({
        map: baseMap,
        roughness: sub.roughness,
        metalness: sub.metalness,
        clearcoat: sub.clearcoat || 0.0,
        clearcoatRoughness: sub.clearcoatRoughness || 0.0,
        side: this.THREE.DoubleSide,
      });
      mesh.material = origMat;
      mesh.material.needsUpdate = true;
      return origMat;
    }

    // If "Show Finish Mask Overlay" is active, display high-contrast mask
    if (this.showMaskOverlay && this.maskTexture) {
      const maskMat = new this.THREE.MeshBasicMaterial({
        map: this.maskTexture,
        side: this.THREE.DoubleSide,
      });
      mesh.material = maskMat;
      mesh.material.needsUpdate = true;
      return maskMat;
    }

    const fin = FINISHES[this.activeFinish] || FINISHES.none;

    const matConfig = {
      map: baseMap,
      roughness: sub.roughness,
      metalness: sub.metalness,
      clearcoat: sub.clearcoat || 0.0,
      clearcoatRoughness: sub.clearcoatRoughness || 0.0,
      side: this.THREE.DoubleSide,
    };

    if (sub.transparent) {
      matConfig.transparent = true;
      matConfig.opacity = sub.opacity || 0.9;
      matConfig.transmission = sub.transmission || 0.88;
      matConfig.ior = sub.ior || 1.5;
    }

    const material = new this.THREE.MeshPhysicalMaterial(matConfig);

    // Apply Specific Finishes
    if (fin.id === 'spot_uv') {
      configureSpotUvMaterial(material, this.maskTexture, this.spotUvIntensity);
    } else if (fin.id === 'gold_foil') {
      // Create rich composite foil color texture if artwork is available
      if (this.maskCanvas && baseMap?.image) {
        this.compositeArtworkTexture = createFoilCompositeMap(
          this.THREE,
          baseMap,
          this.maskCanvas,
          '#d4af37'
        );
      }
      configureFoilMaterial(material, 'gold_foil', this.maskTexture, this.compositeArtworkTexture);
      material.roughness = this.foilRoughness;
    } else if (fin.id === 'silver_foil') {
      if (this.maskCanvas && baseMap?.image) {
        this.compositeArtworkTexture = createFoilCompositeMap(
          this.THREE,
          baseMap,
          this.maskCanvas,
          '#dcdcdc'
        );
      }
      configureFoilMaterial(material, 'silver_foil', this.maskTexture, this.compositeArtworkTexture);
      material.roughness = this.foilRoughness;
    } else if (fin.id === 'emboss_preview') {
      configureReliefMaterial(material, this.bumpTexture, 'emboss_preview', 1.2);
    } else if (fin.id === 'deboss_preview') {
      configureReliefMaterial(material, this.bumpTexture, 'deboss_preview', -1.2);
    }

    mesh.material = material;
    mesh.material.needsUpdate = true;
    return material;
  }

  /**
   * Toggles "Show Original Only" (bypassing premium finishes for before/after comparison).
   */
  toggleOriginal(show = null) {
    this.showOriginalOnly = show !== null ? Boolean(show) : !this.showOriginalOnly;
    return this.showOriginalOnly;
  }

  /**
   * Toggles "Show Finish Mask Overlay" for spatial alignment verification.
   */
  toggleMaskOverlay(show = null) {
    this.showMaskOverlay = show !== null ? Boolean(show) : !this.showMaskOverlay;
    return this.showMaskOverlay;
  }

  /**
   * Adds or updates a serializable finish layer in the finish stack.
   */
  addFinishLayer({
    id = `finish-${Date.now()}`,
    type = 'spot_uv',
    documentId = 'doc-artwork-01',
    page = 1,
    surfaceId = 'front',
    mask = { type: 'box', coordinates: [0.2, 0.2, 0.8, 0.5], provenance: MASK_PROVENANCE.REVIEWER_DEFINED },
    settings = { roughness: 0.18, metalness: 0.96, intensity: 1.0 },
    enabled = true,
    notes = '',
  } = {}) {
    const existingIdx = this.finishStack.findIndex(f => f.id === id);
    const finishItem = { id, type, documentId, page, surfaceId, mask, settings, enabled, notes, createdAt: new Date().toISOString() };
    if (existingIdx >= 0) {
      this.finishStack[existingIdx] = finishItem;
    } else {
      this.finishStack.push(finishItem);
    }
    return finishItem;
  }

  removeFinishLayer(id) {
    this.finishStack = this.finishStack.filter(f => f.id !== id);
  }

  toggleFinishLayer(id, enabled) {
    const layer = this.finishStack.find(f => f.id === id);
    if (layer) {
      layer.enabled = enabled !== undefined ? Boolean(enabled) : !layer.enabled;
    }
    return layer;
  }

  getFinishStack() {
    return [...this.finishStack];
  }

  /**
   * Sets up lighting presets in the given Three.js scene.
   *
   * @param {THREE.Scene} scene
   * @param {string} preset - 'studio_softbox' | 'neutral_daylight' | 'rotating_highlight'
   */
  setupLighting(scene, preset = 'studio_softbox') {
    this.lightingPreset = preset;

    this.lights.forEach(light => {
      scene.remove(light);
      if (light.dispose) light.dispose();
    });
    this.lights = [];
    this.orbitLight = null;

    if (preset === 'studio_softbox') {
      const amb = new this.THREE.AmbientLight(0xffffff, 0.65);
      scene.add(amb);
      this.lights.push(amb);

      const key = new this.THREE.DirectionalLight(0xfff8ee, 1.2);
      key.position.set(120, 200, 180);
      scene.add(key);
      this.lights.push(key);

      const fill = new this.THREE.DirectionalLight(0xe8f0fe, 0.55);
      fill.position.set(-150, 80, 100);
      scene.add(fill);
      this.lights.push(fill);

      const rim = new this.THREE.DirectionalLight(0xffffff, 0.9);
      rim.position.set(0, -100, -160);
      scene.add(rim);
      this.lights.push(rim);
    } else if (preset === 'neutral_daylight') {
      const amb = new this.THREE.AmbientLight(0xffffff, 0.8);
      scene.add(amb);
      this.lights.push(amb);

      const sun = new this.THREE.DirectionalLight(0xfffdfa, 1.4);
      sun.position.set(180, 250, 150);
      scene.add(sun);
      this.lights.push(sun);
    } else if (preset === 'rotating_highlight') {
      const amb = new this.THREE.AmbientLight(0xffffff, 0.55);
      scene.add(amb);
      this.lights.push(amb);

      const key = new this.THREE.DirectionalLight(0xfff4e0, 0.8);
      key.position.set(100, 150, 120);
      scene.add(key);
      this.lights.push(key);

      this.orbitLight = new this.THREE.PointLight(0xffffff, 2.2, 500);
      this.orbitLight.position.set(0, 50, 200);
      scene.add(this.orbitLight);
      this.lights.push(this.orbitLight);
    }
  }

  startLightSweep() {
    this.lightSweepActive = true;
  }

  pauseLightSweep() {
    this.lightSweepActive = false;
  }

  resetLightSweep() {
    this.orbitAngle = 0;
    if (this.orbitLight) {
      this.orbitLight.position.set(0, 50, 220);
    }
  }

  updateLightAnimation(deltaSeconds = 0.016) {
    if (this.lightingPreset === 'rotating_highlight' && this.orbitLight && this.lightSweepActive !== false) {
      this.orbitAngle += deltaSeconds * 1.5;
      const radius = 220;
      this.orbitLight.position.x = radius * Math.sin(this.orbitAngle);
      this.orbitLight.position.z = radius * Math.cos(this.orbitAngle);
    }
  }

  /**
   * Generates a high-resolution export preview screenshot with metadata banner and honesty disclaimer.
   *
   * @param {THREE.WebGLRenderer} renderer
   * @param {Object} metadata
   * @returns {string} DataURL of the composite PNG
   */
  exportFinishPreview(renderer, {
    modelName = 'Packaging',
    reviewId = '',
    provenance = 'Reviewer-defined visual finish mask',
    geometrySource = 'DXF-dimensioned dieline',
  } = {}) {
    if (!renderer?.domElement) return null;

    const webglCanvas = renderer.domElement;
    const exportCanvas = document.createElement('canvas');
    const width = webglCanvas.width;
    const bannerHeight = 90;
    const height = webglCanvas.height + bannerHeight;

    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');

    // 1. Draw 3D scene capture
    ctx.drawImage(webglCanvas, 0, 0);

    // 2. Draw luxury dark metadata banner at bottom
    ctx.fillStyle = '#0a1611';
    ctx.fillRect(0, webglCanvas.height, width, bannerHeight);

    // Top border on banner
    ctx.strokeStyle = '#284d3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, webglCanvas.height);
    ctx.lineTo(width, webglCanvas.height);
    ctx.stroke();

    // 3. Typography
    ctx.fillStyle = '#9cf5bd';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('PackSignal Materials & Finishes Studio', 20, webglCanvas.height + 26);

    ctx.fillStyle = '#d4e5d8';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const finLabel = FINISHES[this.activeFinish]?.label || this.activeFinish;
    const subLabel = SUBSTRATES[this.activeSubstrate]?.label || this.activeSubstrate;
    ctx.fillText(`Model: ${modelName}  ·  Substrate: ${subLabel}  ·  Finish: ${finLabel}`, 20, webglCanvas.height + 48);

    ctx.fillStyle = '#83a591';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Geometry: ${geometrySource}  ·  Mask: ${provenance}`, 20, webglCanvas.height + 66);

    // Mandatory Prepress Disclaimer
    ctx.fillStyle = '#f0c674';
    ctx.font = 'italic 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const disclaimer = 'Visual finishing approximation. Final appearance must be validated through the production prepress and print-proofing workflow.';
    ctx.fillText(disclaimer, 20, webglCanvas.height + 82);

    // Right-aligned timestamp & watermark
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    ctx.fillStyle = '#7a9686';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(now, width - 20, webglCanvas.height + 30);
    ctx.fillText(reviewId ? `Review: ${reviewId.slice(0, 16)}` : 'PackSignal 2.0', width - 20, webglCanvas.height + 50);

    const dataUrl = exportCanvas.toDataURL('image/png');

    // Trigger download if in browser
    if (typeof document !== 'undefined' && document.createElement) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `packsignal-finish-preview-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    return dataUrl;
  }

  disposeMasks() {
    if (this.maskTexture) {
      this.maskTexture.dispose();
      this.maskTexture = null;
    }
    if (this.bumpTexture) {
      this.bumpTexture.dispose();
      this.bumpTexture = null;
    }
    if (this.compositeArtworkTexture) {
      this.compositeArtworkTexture.dispose();
      this.compositeArtworkTexture = null;
    }
    this.maskCanvas = null;
  }

  dispose() {
    this.disposeMasks();
    this.lights.forEach(l => {
      if (l.dispose) l.dispose();
    });
    this.lights = [];
    this.orbitLight = null;
  }
}
