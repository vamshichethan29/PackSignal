/**
 * PackSignal 3D Packaging Studio — Shared PBR Material Presets & Finishes
 * (public/packaging-3d/package-materials.js)
 */

import { FINISH_MASK_MODES } from './package-types.js';

export const PBR_MATERIAL_PRESETS = Object.freeze({
  KRAFT_PAPER: {
    id: 'KRAFT_PAPER',
    name: 'Unbleached Kraft Paperboard',
    color: 0xb88854,
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    transmission: 0.0,
    isIllustrative: true,
    disclaimer: 'Warm brown paperboard approximation. Does not certify board porosity or ink holdout.',
  },
  SBS_WHITE_CARD: {
    id: 'SBS_WHITE_CARD',
    name: 'Solid Bleached Sulfate (SBS) White Board',
    color: 0xf8f9fa,
    roughness: 0.35,
    metalness: 0.04,
    clearcoat: 0.15,
    transmission: 0.0,
    isIllustrative: false,
    disclaimer: 'Standard packaging substrate response with clay coating.',
  },
  METALLIC_GOLD_FOIL: {
    id: 'METALLIC_GOLD_FOIL',
    name: 'Hot Stamped Metallic Gold Foil',
    color: 0xdfac38,
    roughness: 0.18,
    metalness: 0.95,
    clearcoat: 0.4,
    transmission: 0.0,
    isIllustrative: true,
    disclaimer: 'Visual preview only — not verified from production PDF separation.',
  },
  SPOT_UV_GLOSS: {
    id: 'SPOT_UV_GLOSS',
    name: 'Spot UV Gloss Varnish',
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transmission: 0.0,
    isIllustrative: true,
    disclaimer: 'Visual preview only — not verified from production PDF varnish plate.',
  },
  ALUMINIUM_METAL: {
    id: 'ALUMINIUM_METAL',
    name: 'Brushed Aluminium Can Alloy',
    color: 0xd8dcde,
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.1,
    transmission: 0.0,
    isIllustrative: false,
    disclaimer: 'Specular aluminum surface reflectance.',
  },
  CLEAR_GLASS: {
    id: 'CLEAR_GLASS',
    name: 'Clear Flint Glass Container',
    color: 0xe6f0e8,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 0.8,
    transmission: 0.92,
    ior: 1.52,
    thickness: 2.2,
    isIllustrative: false,
    disclaimer: 'Refractive flint glass container physics approximation.',
  },
  MATTE_FILM: {
    id: 'MATTE_FILM',
    name: 'Matte Laminated Barrier Film',
    color: 0xf2f2f2,
    roughness: 0.50,
    metalness: 0.02,
    clearcoat: 0.0,
    transmission: 0.0,
    isIllustrative: false,
    disclaimer: 'Diffuse flexible barrier film.',
  },
  METALLIZED_FOIL_POUCH: {
    id: 'METALLIZED_FOIL_POUCH',
    name: 'Metallized Barrier Foil Pouch',
    color: 0xe2e5e8,
    roughness: 0.20,
    metalness: 0.85,
    clearcoat: 0.2,
    transmission: 0.0,
    isIllustrative: false,
    disclaimer: 'Reflective metallized polyethylene terephthalate (MET-PET) laminate.',
  },
});

/**
 * Creates a Three.js material instance from a preset.
 */
export function createThreeMaterial(THREE, presetId, { texture = null, finishMask = null } = {}) {
  const preset = PBR_MATERIAL_PRESETS[presetId] || PBR_MATERIAL_PRESETS.SBS_WHITE_CARD;

  if (preset.transmission > 0 && THREE.MeshPhysicalMaterial) {
    return new THREE.MeshPhysicalMaterial({
      color: preset.color,
      roughness: preset.roughness,
      metalness: preset.metalness,
      transmission: preset.transmission,
      ior: preset.ior || 1.52,
      thickness: preset.thickness || 2.0,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
  }

  const matParams = {
    color: preset.color,
    roughness: preset.roughness,
    metalness: preset.metalness,
    side: THREE.DoubleSide,
  };

  if (texture) matParams.map = texture;

  if (THREE.MeshPhysicalMaterial && preset.clearcoat > 0) {
    matParams.clearcoat = preset.clearcoat;
    matParams.clearcoatRoughness = preset.clearcoatRoughness || 0.1;
    return new THREE.MeshPhysicalMaterial(matParams);
  }

  return new THREE.MeshStandardMaterial(matParams);
}

/**
 * Distinguishes source-verified finish masks from reviewer illustrative previews.
 */
export function evaluateFinishAuthority(maskRecord = {}) {
  const isSourceVerified = maskRecord.mode === FINISH_MASK_MODES.SOURCE_VERIFIED ||
    Boolean(maskRecord.spotColorName || maskRecord.separationName);

  return {
    authority: isSourceVerified ? FINISH_MASK_MODES.SOURCE_VERIFIED : FINISH_MASK_MODES.ILLUSTRATIVE_PREVIEW,
    isBinding: isSourceVerified,
    disclaimer: isSourceVerified
      ? `Source-verified finish from production separation (${maskRecord.spotColorName || 'Varnish'}).`
      : 'Visual preview only — not verified from production PDF.',
  };
}
