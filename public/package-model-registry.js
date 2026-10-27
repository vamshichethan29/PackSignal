/**
 * PackSignal Unified Package Model Registry
 * (public/package-model-registry.js)
 *
 * Implements Upgrade #48 Phase 1:
 * Exposes canonical package model descriptors for:
 * 1. CARTON (Folding Carton)
 * 2. CAN (Aluminium Soda Can)
 * 3. BOTTLE (Glass Bottle)
 * 4. POUCH (Stand-Up Flexible Foil Pouch)
 *
 * Each model exposes:
 * {
 *   packageType,
 *   geometry,
 *   dimensions,
 *   surfaceRegions,
 *   uvMapping,
 *   materialSlots,
 *   artworkMapping,
 *   mappingAuthority,
 *   cameraTargets,
 *   findingAnchors
 * }
 */

export const PACKAGE_TYPES = Object.freeze({
  CARTON: 'CARTON',
  CAN: 'CAN',
  BOTTLE: 'BOTTLE',
  POUCH: 'POUCH',
});

export const MAPPING_AUTHORITY = Object.freeze({
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  ILLUSTRATIVE: 'ILLUSTRATIVE',
  UNMAPPED: 'UNMAPPED',
});

/**
 * Normalizes input package type strings or aliases to standard enum.
 */
export function normalizePackageType(type) {
  const t = String(type || '').toUpperCase().trim();
  if (t.includes('CAN') || t.includes('CYLINDER') || t.includes('BEVERAGE')) return PACKAGE_TYPES.CAN;
  if (t.includes('BOTTLE') || t.includes('JAR') || t.includes('GLASS')) return PACKAGE_TYPES.BOTTLE;
  if (t.includes('POUCH') || t.includes('BAG') || t.includes('SACHET') || t.includes('STANDUP')) return PACKAGE_TYPES.POUCH;
  return PACKAGE_TYPES.CARTON;
}

/**
 * Builds the canonical model definition for a given package type.
 */
export function createPackageModel(packageType, options = {}) {
  const normType = normalizePackageType(packageType);
  const dims = options.dimensions || {};
  const authority = options.mappingAuthority || (options.isVerified ? MAPPING_AUTHORITY.SOURCE_VERIFIED : MAPPING_AUTHORITY.ILLUSTRATIVE);

  switch (normType) {
    case PACKAGE_TYPES.CAN: {
      const radius = Number(dims.radius || 33.0); // 66mm diameter standard 330ml can
      const height = Number(dims.height || 115.0);
      const wrapWidth = Math.PI * 2 * radius;
      return {
        packageType: PACKAGE_TYPES.CAN,
        name: 'Aluminium Soda Can (330ml)',
        geometry: {
          type: 'CYLINDER_CAN',
          radius,
          height,
          chimeHeight: 4.0,
          neckRadius: radius * 0.88,
          baseRadius: radius * 0.92,
          radialSegments: 64,
          heightSegments: 32,
        },
        dimensions: {
          radius,
          diameter: radius * 2,
          height,
          printableWrapWidth: wrapWidth,
          printableWrapHeight: height * 0.85,
          unit: 'mm',
          volumeMl: 330,
        },
        surfaceRegions: [
          { id: 'body', name: 'Printable Cylindrical Body', type: 'CYLINDRICAL_WRAP', isPrintable: true },
          { id: 'lid', name: 'Can Lid & Tab', type: 'METALLIC_END', isPrintable: false },
          { id: 'chime', name: 'Top Rim / Chime', type: 'BEVELED_RIM', isPrintable: false },
          { id: 'base', name: 'Bottom Dome', type: 'CONCAVE_BASE', isPrintable: false },
        ],
        uvMapping: {
          mode: 'CYLINDRICAL_WRAP',
          uOffset: 0.0,
          uScale: 1.0,
          vScale: 1.0,
          frontCenterU: 0.5,
          backCenterU: 0.0,
          preserveSeam: true,
        },
        materialSlots: [
          { slotId: 'body_print', defaultMaterial: 'ALUMINIUM', supportedPresets: ['ALUMINIUM', 'SPOT_UV_GLOSS', 'METALLIC_GOLD_FOIL'] },
          { slotId: 'lid_metal', defaultMaterial: 'ALUMINIUM', supportedPresets: ['ALUMINIUM'] },
        ],
        artworkMapping: options.artworkMapping || {
          status: authority,
          printableAreaMm: [wrapWidth, height * 0.85],
        },
        mappingAuthority: authority,
        cameraTargets: {
          front: { position: [0, 0, 240], lookAt: [0, 0, 0] },
          back: { position: [0, 0, -240], lookAt: [0, 0, 0] },
          left: { position: [-240, 0, 0], lookAt: [0, 0, 0] },
          right: { position: [240, 0, 0], lookAt: [0, 0, 0] },
          top: { position: [0, 260, 0], lookAt: [0, 0, 0] },
          reset: { position: [140, 60, 200], lookAt: [0, 0, 0] },
        },
        findingAnchors: [
          { region: 'body', uv: [0.5, 0.4], label: 'Front Net Quantity Anchor' },
          { region: 'body', uv: [0.15, 0.5], label: 'Side Nutrition Facts Anchor' },
          { region: 'body', uv: [0.85, 0.5], label: 'Side Barcode Anchor' },
        ],
      };
    }

    case PACKAGE_TYPES.BOTTLE: {
      const radius = Number(dims.radius || 35.0); // 70mm diameter 500ml glass bottle
      const height = Number(dims.height || 210.0);
      const neckRadius = radius * 0.38;
      const shoulderHeight = height * 0.65;
      return {
        packageType: PACKAGE_TYPES.BOTTLE,
        name: 'Glass Beverage Bottle (500ml)',
        geometry: {
          type: 'LATHED_BOTTLE',
          radius,
          height,
          neckRadius,
          shoulderHeight,
          labelRadiusOffset: 0.4, // Prevents z-fighting between glass and label
          radialSegments: 64,
        },
        dimensions: {
          radius,
          diameter: radius * 2,
          height,
          neckRadius,
          shoulderHeight,
          labelHeight: height * 0.42,
          unit: 'mm',
          volumeMl: 500,
        },
        surfaceRegions: [
          { id: 'body', name: 'Clear Glass Container Body', type: 'REFRACTIVE_GLASS', isPrintable: false },
          { id: 'label_wrap', name: 'Curved Adhesive Label', type: 'APPLIED_CYLINDER_LABEL', isPrintable: true },
          { id: 'neck', name: 'Bottle Neck', type: 'GLASS_PROFILE', isPrintable: false },
          { id: 'cap', name: 'Crown / Screw Cap', type: 'METALLIC_CLOSURE', isPrintable: false },
        ],
        uvMapping: {
          mode: 'APPLIED_LABEL_WRAP',
          uOffset: 0.0,
          labelSpanRadians: Math.PI * 1.5, // 270 degree wrap
          frontCenterU: 0.5,
          separateFromGlassBody: true,
        },
        materialSlots: [
          { slotId: 'glass_container', defaultMaterial: 'GLASS', supportedPresets: ['GLASS'] },
          { slotId: 'label_surface', defaultMaterial: 'SBS_WHITE_CARD', supportedPresets: ['SBS_WHITE_CARD', 'KRAFT_PAPER', 'METALLIC_GOLD_FOIL', 'SPOT_UV_GLOSS'] },
          { slotId: 'cap_closure', defaultMaterial: 'METALLIC_GOLD_FOIL', supportedPresets: ['ALUMINIUM', 'METALLIC_GOLD_FOIL'] },
        ],
        artworkMapping: options.artworkMapping || {
          status: authority,
          labelDimensionsMm: [radius * 2 * Math.PI * 0.75, height * 0.42],
        },
        mappingAuthority: authority,
        cameraTargets: {
          front: { position: [0, 10, 260], lookAt: [0, 20, 0] },
          back: { position: [0, 10, -260], lookAt: [0, 20, 0] },
          left: { position: [-260, 10, 0], lookAt: [0, 20, 0] },
          right: { position: [260, 10, 0], lookAt: [0, 20, 0] },
          top: { position: [0, 300, 0], lookAt: [0, 0, 0] },
          reset: { position: [150, 70, 220], lookAt: [0, 20, 0] },
        },
        findingAnchors: [
          { region: 'label_wrap', uv: [0.5, 0.45], label: 'Front Label Statement of Identity' },
          { region: 'label_wrap', uv: [0.2, 0.5], label: 'Information Panel Mandatory Copy' },
        ],
      };
    }

    case PACKAGE_TYPES.POUCH: {
      const width = Number(dims.width || 130.0);
      const height = Number(dims.height || 200.0);
      const depth = Number(dims.depth || 60.0);
      return {
        packageType: PACKAGE_TYPES.POUCH,
        name: 'Stand-Up Flexible Foil Pouch (Gusseted)',
        geometry: {
          type: 'CURVED_PILLOW_POUCH',
          width,
          height,
          depth,
          sealBorderMm: 8.0,
          gussetDepth: depth * 0.8,
          surfaceCurvature: 0.25, // Natural product fill bulge
        },
        dimensions: {
          width,
          height,
          depth,
          frontPrintableWidth: width - 16.0,
          frontPrintableHeight: height - 24.0,
          unit: 'mm',
          format: 'STAND_UP_DOYPACK',
        },
        surfaceRegions: [
          { id: 'front', name: 'Curved Front Face', type: 'CURVED_FLEXIBLE_FACE', isPrintable: true },
          { id: 'back', name: 'Curved Back Face', type: 'CURVED_FLEXIBLE_FACE', isPrintable: true },
          { id: 'bottom_gusset', name: 'Bottom Gusset Flange', type: 'OVAL_BASE_GUSSET', isPrintable: false },
          { id: 'top_seal', name: 'Heat Sealed Top Zip Header', type: 'CRIMPED_SEAL', isPrintable: false },
          { id: 'side_seals', name: 'Welded Side Flanges', type: 'HEAT_WELD', isPrintable: false },
        ],
        uvMapping: {
          mode: 'DUAL_SURFACE_FRONT_BACK',
          frontFaceUv: [0.0, 0.0, 0.5, 1.0],
          backFaceUv: [0.5, 0.0, 1.0, 1.0],
          preserveAspect: true,
        },
        materialSlots: [
          { slotId: 'pouch_foil', defaultMaterial: 'FOIL_LAMINATE', supportedPresets: ['FOIL_LAMINATE', 'KRAFT_PAPER', 'SPOT_UV_GLOSS', 'METALLIC_GOLD_FOIL'] },
        ],
        artworkMapping: options.artworkMapping || {
          status: authority,
          panelFaces: ['front', 'back'],
        },
        mappingAuthority: authority,
        cameraTargets: {
          front: { position: [0, 0, 240], lookAt: [0, 0, 0] },
          back: { position: [0, 0, -240], lookAt: [0, 0, 0] },
          left: { position: [-220, 0, 0], lookAt: [0, 0, 0] },
          right: { position: [220, 0, 0], lookAt: [0, 0, 0] },
          top: { position: [0, 260, 0], lookAt: [0, 0, 0] },
          reset: { position: [130, 50, 210], lookAt: [0, 0, 0] },
        },
        findingAnchors: [
          { region: 'front', uv: [0.5, 0.35], label: 'Front Pouch Brand Identity' },
          { region: 'back', uv: [0.5, 0.5], label: 'Back Nutrition Facts & Barcode' },
        ],
      };
    }

    case PACKAGE_TYPES.CARTON:
    default: {
      const width = Number(dims.width || 80.0);
      const height = Number(dims.height || 140.0);
      const depth = Number(dims.depth || 50.0);
      return {
        packageType: PACKAGE_TYPES.CARTON,
        name: 'Rectangular Folding Carton (SBS)',
        geometry: {
          type: 'RECTANGULAR_FOLDING_BOX',
          width,
          height,
          depth,
          paperboardThicknessMm: 0.45,
          faceCount: 6,
          creaseConnectivity: true,
        },
        dimensions: {
          width,
          height,
          depth,
          totalSurfaceAreaSqMm: 2 * (width * height + width * depth + height * depth),
          unit: 'mm',
        },
        surfaceRegions: [
          { id: 'front', name: 'Front Principal Display Panel (PDP)', type: 'PLANAR_FACE', isPrintable: true },
          { id: 'back', name: 'Back Information Panel', type: 'PLANAR_FACE', isPrintable: true },
          { id: 'left', name: 'Left Side Panel', type: 'PLANAR_FACE', isPrintable: true },
          { id: 'right', name: 'Right Side Panel', type: 'PLANAR_FACE', isPrintable: true },
          { id: 'top', name: 'Top Tuck Flap', type: 'PLANAR_FACE', isPrintable: true },
          { id: 'bottom', name: 'Bottom Closure', type: 'PLANAR_FACE', isPrintable: true },
        ],
        uvMapping: {
          mode: 'SIX_FACE_PANEL_ATLAS',
          faces: ['front', 'back', 'left', 'right', 'top', 'bottom'],
          preserveDielineCreases: true,
        },
        materialSlots: [
          { slotId: 'carton_board', defaultMaterial: 'SBS_WHITE_CARD', supportedPresets: ['SBS_WHITE_CARD', 'KRAFT_PAPER', 'SPOT_UV_GLOSS', 'METALLIC_GOLD_FOIL'] },
        ],
        artworkMapping: options.artworkMapping || {
          status: authority,
          mappedFaces: ['front', 'back', 'left', 'right', 'top', 'bottom'],
        },
        mappingAuthority: authority,
        cameraTargets: {
          front: { position: [0, 0, 240], lookAt: [0, 0, 0] },
          back: { position: [0, 0, -240], lookAt: [0, 0, 0] },
          left: { position: [-220, 0, 0], lookAt: [0, 0, 0] },
          right: { position: [220, 0, 0], lookAt: [0, 0, 0] },
          top: { position: [0, 240, 0], lookAt: [0, 0, 0] },
          reset: { position: [140, 60, 200], lookAt: [0, 0, 0] },
        },
        findingAnchors: [
          { region: 'front', uv: [0.5, 0.25], label: 'Carton Net Quantity Anchor' },
          { region: 'back', uv: [0.5, 0.5], label: 'Carton Nutrition & Ingredients Anchor' },
          { region: 'left', uv: [0.5, 0.3], label: 'Carton Storage Statement Anchor' },
          { region: 'right', uv: [0.5, 0.2], label: 'Carton Barcode Symbol Anchor' },
        ],
      };
    }
  }
}

/**
 * Registry of all supported package models.
 */
export const PACKAGE_MODEL_REGISTRY = Object.freeze({
  [PACKAGE_TYPES.CARTON]: createPackageModel(PACKAGE_TYPES.CARTON),
  [PACKAGE_TYPES.CAN]: createPackageModel(PACKAGE_TYPES.CAN),
  [PACKAGE_TYPES.BOTTLE]: createPackageModel(PACKAGE_TYPES.BOTTLE),
  [PACKAGE_TYPES.POUCH]: createPackageModel(PACKAGE_TYPES.POUCH),
});

export const PACKAGE_MODELS = PACKAGE_MODEL_REGISTRY;

export function getAllPackageTypes() {
  return [
    PACKAGE_TYPES.CARTON,
    PACKAGE_TYPES.CAN,
    PACKAGE_TYPES.BOTTLE,
    PACKAGE_TYPES.POUCH,
  ];
}

export function validatePackageModelSchema(model) {
  if (!model || typeof model !== 'object') {
    return { valid: false, missing: ['model'] };
  }
  const requiredKeys = [
    'packageType',
    'geometry',
    'dimensions',
    'surfaceRegions',
    'uvMapping',
    'materialSlots',
    'artworkMapping',
    'mappingAuthority',
    'cameraTargets',
    'findingAnchors',
  ];
  const missing = requiredKeys.filter((k) => !(k in model));
  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getPackageModel(packageType, options = {}) {
  const norm = normalizePackageType(packageType);
  if (options && (options.dimensions || options.artworkMapping || options.isVerified)) {
    return createPackageModel(norm, options);
  }
  return PACKAGE_MODEL_REGISTRY[norm] || PACKAGE_MODEL_REGISTRY[PACKAGE_TYPES.CARTON];
}



