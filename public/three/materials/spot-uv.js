/**
 * PackSignal Spot UV Gloss Material Engine (public/three/materials/spot-uv.js)
 * Implements physically based Spot UV gloss varnish using MeshPhysicalMaterial clearcoat.
 *
 * Requirements:
 * - Outside mask: Default matte printed surface (roughness ~0.8, metalness 0.0, clearcoat 0.0).
 * - Inside mask: High-specular reflective clear varnish (clearcoat 1.0, clearcoatRoughness ~0.04).
 * - Preserves original printed artwork color intact without yellowing or bleaching.
 */

export const SPOT_UV_DEFAULTS = {
  clearcoat: 1.0,
  clearcoatRoughness: 0.04,
  disclaimer: 'Visual finish approximation — final print appearance depends on varnish weight, anilox volume, and curing.',
};

/**
 * Configures MeshPhysicalMaterial for Spot UV varnish.
 *
 * @param {THREE.MeshPhysicalMaterial} material
 * @param {THREE.Texture} maskTexture
 * @param {number} [intensity=1.0] - Clearcoat intensity slider [0.0 - 1.0]
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function configureSpotUvMaterial(material, maskTexture, intensity = 1.0) {
  material.clearcoat = Math.max(0, Math.min(1, Number(intensity) || 1.0));
  material.clearcoatRoughness = SPOT_UV_DEFAULTS.clearcoatRoughness;

  if (maskTexture) {
    material.clearcoatMap = maskTexture;
    material.clearcoatRoughnessMap = maskTexture;
  }

  // Base material remains non-metallic
  material.metalness = 0.0;
  material.needsUpdate = true;

  return material;
}
