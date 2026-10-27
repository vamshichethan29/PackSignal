/**
 * PackSignal Metallic Foil Material Engine (public/three/materials/metallic-foil.js)
 * Implements physically based metallic foil stamping previews (Gold, Silver, Rose Gold, Holographic).
 * Generates composite base color maps and metalness/roughness maps ensuring printed packaging
 * remains intact outside masked foil boundaries.
 */

export const FOIL_PRESETS = {
  gold_foil: {
    id: 'gold_foil',
    label: 'Hot Stamp Gold Foil',
    foilColorHex: '#d4af37',
    metalness: 0.96,
    roughness: 0.18,
    disclaimer: 'Visual finish approximation — hot foil stamping reflectivity depends on die temperature, pressure, and substrate.',
  },
  silver_foil: {
    id: 'silver_foil',
    label: 'Hot Stamp Silver Foil',
    foilColorHex: '#dcdcdc',
    metalness: 0.96,
    roughness: 0.18,
    disclaimer: 'Visual finish approximation — silver foil reflectivity depends on foil grade and release layer formulation.',
  },
  rose_gold: {
    id: 'rose_gold',
    label: 'Rose Gold Foil',
    foilColorHex: '#b76e79',
    metalness: 0.95,
    roughness: 0.20,
    disclaimer: 'Visual finish approximation — rose gold appearance depends on pigment layer thickness.',
  },
};

/**
 * Composites the base artwork image with a metallic foil tint inside the mask region.
 * Outside the mask, the original printed artwork is 100% preserved.
 *
 * @param {Object} THREE
 * @param {HTMLImageElement|HTMLCanvasElement|THREE.Texture} baseTextureOrImage
 * @param {HTMLCanvasElement} maskCanvas
 * @param {string} [foilColorHex='#d4af37']
 * @param {number} [resolution=1024]
 * @returns {THREE.CanvasTexture}
 */
export function createFoilCompositeMap(THREE, baseTextureOrImage, maskCanvas, foilColorHex = '#d4af37', resolution = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');

  // Draw base artwork
  const baseImg = baseTextureOrImage?.image || baseTextureOrImage;
  if (baseImg && baseImg.width > 0) {
    ctx.drawImage(baseImg, 0, 0, resolution, resolution);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, resolution, resolution);
  }

  // Draw metallic foil color over mask region
  if (maskCanvas) {
    // Create temporary foil canvas
    const foilCanvas = document.createElement('canvas');
    foilCanvas.width = resolution;
    foilCanvas.height = resolution;
    const fCtx = foilCanvas.getContext('2d');

    // Fill with foil metallic color
    fCtx.fillStyle = foilColorHex;
    fCtx.fillRect(0, 0, resolution, resolution);

    // Mask the foil color using destination-in
    fCtx.globalCompositeOperation = 'destination-in';
    fCtx.drawImage(maskCanvas, 0, 0, resolution, resolution);

    // Composite masked foil onto base artwork (source-over)
    ctx.drawImage(foilCanvas, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Configures MeshPhysicalMaterial properties for metallic foil.
 */
export function configureFoilMaterial(material, presetKey, maskTexture, compositeMap = null) {
  const preset = FOIL_PRESETS[presetKey] || FOIL_PRESETS.gold_foil;

  if (compositeMap) {
    material.map = compositeMap;
  }

  if (maskTexture) {
    material.metalness = preset.metalness;
    material.roughness = preset.roughness;
    material.metalnessMap = maskTexture;
    material.roughnessMap = maskTexture;
  } else {
    material.metalness = preset.metalness;
    material.roughness = preset.roughness;
  }

  material.clearcoat = 0.2;
  material.clearcoatRoughness = 0.1;
  material.needsUpdate = true;
  return material;
}
