/**
 * PackSignal 3D Packaging Studio — PBR Materials & Finish Previews
 * (public/package-materials.js)
 *
 * Implements Phase 6 & Phase 7 of Upgrade #48:
 * - Kraft Paper
 * - SBS White Card
 * - Metallic Gold Foil (preview vs verified plate)
 * - Spot UV Gloss (preview vs verified plate)
 * - Aluminium
 * - Glass (physical transmission & refraction)
 * - Foil Laminate
 *
 * Truthfully separates verified production separation plates from
 * illustrative visual previews.
 */

export const FINISH_AUTHORITY = Object.freeze({
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  ILLUSTRATIVE_PREVIEW: 'ILLUSTRATIVE_PREVIEW',
  UNMAPPED: 'UNMAPPED',
});

export const PBR_MATERIALS = Object.freeze({
  KRAFT_PAPER: {
    id: 'KRAFT_PAPER',
    name: 'Unbleached Kraft Paperboard',
    category: 'paperboard',
    color: 0xb88854,
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    transmission: 0.0,
    ior: 1.5,
    isIllustrative: false,
    provenance: 'Substrate standard preset',
    disclaimer: 'Warm natural brown matte finish with subtle fiber reflectance. Substrate approximation only.',
  },
  SBS_WHITE_CARD: {
    id: 'SBS_WHITE_CARD',
    name: 'Solid Bleached Sulfate (SBS) White Card',
    category: 'paperboard',
    color: 0xf8f9fa,
    roughness: 0.35,
    metalness: 0.04,
    clearcoat: 0.15,
    transmission: 0.0,
    ior: 1.5,
    isIllustrative: false,
    provenance: 'Substrate standard preset',
    disclaimer: 'Bright white coated paperboard with smooth specular response.',
  },
  METALLIC_GOLD_FOIL: {
    id: 'METALLIC_GOLD_FOIL',
    name: 'Metallic Gold Foil',
    category: 'finish',
    color: 0xdfac38,
    roughness: 0.18,
    metalness: 0.95,
    clearcoat: 0.4,
    transmission: 0.0,
    ior: 0.25,
    isIllustrative: true,
    provenance: 'Illustrative Finish Preview',
    disclaimer: 'Visual preview only — not verified from production PDF foil separation.',
  },
  SPOT_UV_GLOSS: {
    id: 'SPOT_UV_GLOSS',
    name: 'Spot UV Gloss Varnish',
    category: 'finish',
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transmission: 0.0,
    ior: 1.52,
    isIllustrative: true,
    provenance: 'Illustrative Finish Preview',
    disclaimer: 'Visual preview only — not verified from production PDF varnish plate.',
  },
  ALUMINIUM: {
    id: 'ALUMINIUM',
    name: 'Brushed Aluminium',
    category: 'metal',
    color: 0xd8dcde,
    roughness: 0.22,
    metalness: 0.92,
    clearcoat: 0.1,
    transmission: 0.0,
    ior: 1.35,
    isIllustrative: false,
    provenance: 'Substrate standard preset',
    disclaimer: 'Metallic alloy surface with directional anisotropic brushed highlights.',
  },
  GLASS: {
    id: 'GLASS',
    name: 'Flint Glass (Transparent)',
    category: 'glass',
    color: 0xe6f0e8,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 0.8,
    transmission: 0.92,
    ior: 1.52,
    thickness: 2.2,
    isIllustrative: false,
    provenance: 'Container physical substrate',
    disclaimer: 'Transparent body approximation with specular reflection and refractive transmission.',
  },
  FOIL_LAMINATE: {
    id: 'FOIL_LAMINATE',
    name: 'Flexible Barrier Foil Laminate',
    category: 'laminate',
    color: 0xe2e5e8,
    roughness: 0.20,
    metalness: 0.85,
    clearcoat: 0.2,
    transmission: 0.0,
    ior: 1.48,
    isIllustrative: false,
    provenance: 'Flexible packaging substrate',
    disclaimer: 'Reflective metallized polyethylene (MET-PET) laminate exterior surface.',
  },
});

// Alias for backwards compatibility
export const PBR_MATERIAL_PRESETS = Object.freeze({
  ...PBR_MATERIALS,
  ALUMINIUM_METAL: PBR_MATERIALS.ALUMINIUM,
  CLEAR_GLASS: PBR_MATERIALS.GLASS,
  METALLIZED_FOIL_POUCH: PBR_MATERIALS.FOIL_LAMINATE,
  MATTE_FILM: {
    id: 'MATTE_FILM',
    name: 'Matte Laminated Barrier Film',
    category: 'film',
    color: 0xf2f2f2,
    roughness: 0.50,
    metalness: 0.02,
    clearcoat: 0.0,
    transmission: 0.0,
    isIllustrative: false,
    provenance: 'Substrate preset',
    disclaimer: 'Diffuse flexible barrier film.',
  },
});

/**
 * Normalizes material identifier to a valid preset key.
 */
export function normalizeMaterialId(id) {
  if (!id || typeof id !== 'string') return 'SBS_WHITE_CARD';
  const clean = id.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (PBR_MATERIALS[clean]) return clean;
  if (PBR_MATERIAL_PRESETS[clean]) return PBR_MATERIAL_PRESETS[clean].id;
  if (clean.includes('KRAFT')) return 'KRAFT_PAPER';
  if (clean.includes('SBS') || clean.includes('CARD') || clean.includes('PAPERBOARD')) return 'SBS_WHITE_CARD';
  if (clean.includes('GOLD')) return 'METALLIC_GOLD_FOIL';
  if (clean.includes('UV') || clean.includes('VARNISH')) return 'SPOT_UV_GLOSS';
  if (clean.includes('ALUMIN')) return 'ALUMINIUM';
  if (clean.includes('GLASS')) return 'GLASS';
  if (clean.includes('FOIL') || clean.includes('POUCH') || clean.includes('LAMINATE')) return 'FOIL_LAMINATE';
  return 'SBS_WHITE_CARD';
}

/**
 * Retrieves material metadata and truth-in-reporting disclaimer.
 */
export function getMaterialPresetInfo(id) {
  const norm = normalizeMaterialId(id);
  return PBR_MATERIALS[norm] || PBR_MATERIALS.SBS_WHITE_CARD;
}

/**
 * Evaluates whether a finish layer is a verified PDF separation plate or an illustrative reviewer preview.
 */
export function evaluateFinishAuthority(maskRecord = {}) {
  const isSourceVerified = maskRecord.mode === 'SOURCE_VERIFIED' ||
    maskRecord.authority === 'SOURCE_VERIFIED' ||
    Boolean(maskRecord.spotColorName || maskRecord.separationName || maskRecord.isSourceSeparation);

  return {
    authority: isSourceVerified ? FINISH_AUTHORITY.SOURCE_VERIFIED : FINISH_AUTHORITY.ILLUSTRATIVE_PREVIEW,
    isBinding: isSourceVerified,
    isIllustrative: !isSourceVerified,
    spotColorName: maskRecord.spotColorName || null,
    separationName: maskRecord.separationName || null,
    disclaimer: isSourceVerified
      ? `Source-verified finish plate (${maskRecord.spotColorName || maskRecord.separationName || 'PDF Spot Separation'}).`
      : 'Visual preview only — not verified from production PDF varnish/foil plate. Final print requires production dieline separations.',
  };
}

/**
 * Creates a physical Three.js material instance matching the requested PBR preset.
 */
export function createThreeMaterial(THREE, presetId, { texture = null, finishMask = null, wireframe = false } = {}) {
  if (!THREE) return null;

  const info = getMaterialPresetInfo(presetId);

  // Flint Glass Container body (Transmission + Refraction)
  if (info.transmission > 0 && THREE.MeshPhysicalMaterial) {
    return new THREE.MeshPhysicalMaterial({
      color: info.color,
      roughness: info.roughness,
      metalness: info.metalness,
      transmission: info.transmission,
      ior: info.ior || 1.52,
      thickness: info.thickness || 2.2,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      wireframe,
    });
  }

  const matParams = {
    color: info.color,
    roughness: info.roughness,
    metalness: info.metalness,
    side: THREE.DoubleSide,
    wireframe,
  };

  if (texture) {
    matParams.map = texture;
    // With printed artwork texture, adjust base color to near-white to prevent tinting
    if (info.id === 'SBS_WHITE_CARD' || info.id === 'FOIL_LAMINATE') {
      matParams.color = 0xffffff;
    }
  }

  // Clearcoat (Spot UV, Gold Foil, Coated SBS)
  if (THREE.MeshPhysicalMaterial && info.clearcoat > 0) {
    matParams.clearcoat = info.clearcoat;
    matParams.clearcoatRoughness = info.clearcoatRoughness || 0.08;
    return new THREE.MeshPhysicalMaterial(matParams);
  }

  return new THREE.MeshStandardMaterial(matParams);
}

/**
 * Applies a material preset to an existing Three.js mesh, preserving its diffuse texture.
 */
export function applyMaterialPreset(mesh, presetId, THREE, options = {}) {
  if (!mesh) return null;
  const existingMap = mesh.material?.map || options.texture || null;
  const newMaterial = createThreeMaterial(THREE, presetId, { ...options, texture: existingMap });
  if (newMaterial) {
    if (mesh.material && typeof mesh.material.dispose === 'function') {
      mesh.material.dispose();
    }
    mesh.material = newMaterial;
  }
  return newMaterial;
}
