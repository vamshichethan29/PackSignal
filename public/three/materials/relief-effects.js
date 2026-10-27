/**
 * PackSignal Relief Effects Engine (public/three/materials/relief-effects.js)
 * Implements Embossing (raised) and Debossing (recessed) surface relief previews
 * using bump mapping and height fields derived from confirmed finish masks.
 */

export const RELIEF_PRESETS = {
  emboss_preview: {
    id: 'emboss_preview',
    label: 'Embossing Preview (Raised)',
    bumpScale: 1.2,
    invert: false,
    disclaimer: 'Visual finish approximation — actual embossing depth depends on paper caliper, grain direction, and counter-die.',
  },
  deboss_preview: {
    id: 'deboss_preview',
    label: 'Debossing Preview (Recessed)',
    bumpScale: -1.2,
    invert: true,
    disclaimer: 'Visual finish approximation — actual debossing depth depends on board density and die pressure.',
  },
};

/**
 * Configures MeshPhysicalMaterial for Embossing or Debossing.
 *
 * @param {THREE.MeshPhysicalMaterial} material
 * @param {THREE.Texture} heightTexture - Grayscale relief height map
 * @param {string} [presetKey='emboss_preview']
 * @param {number} [scale=1.2]
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function configureReliefMaterial(material, heightTexture, presetKey = 'emboss_preview', scale = null) {
  const preset = RELIEF_PRESETS[presetKey] || RELIEF_PRESETS.emboss_preview;
  const bumpScale = scale !== null ? (preset.invert ? -Math.abs(scale) : Math.abs(scale)) : preset.bumpScale;

  if (heightTexture) {
    material.bumpMap = heightTexture;
    material.bumpScale = bumpScale;
  }

  material.needsUpdate = true;
  return material;
}
