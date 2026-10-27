/**
 * PackSignal 3D Multi-Format Packaging Geometry Interface
 * (public/package-geometry.js)
 *
 * Implements E2.1, E2.7, E2.8:
 * Unified contract for the four supported 3D packaging geometries:
 * 1. FOLDING_CARTON
 * 2. BEVERAGE_CAN
 * 3. GLASS_BOTTLE
 * 4. STANDUP_POUCH
 *
 * Explicitly distinguishes SOURCE_DERIVED_GEOMETRY, REVIEWER_CONFIRMED_GEOMETRY,
 * and PARAMETRIC_ILLUSTRATION so decorative models are not mistaken for CAD dielines.
 */

export const PACKAGE_TYPES = {
  FOLDING_CARTON: 'FOLDING_CARTON',
  BEVERAGE_CAN: 'BEVERAGE_CAN',
  GLASS_BOTTLE: 'GLASS_BOTTLE',
  STANDUP_POUCH: 'STANDUP_POUCH',
};

export const GEOMETRY_SOURCE_MODES = {
  SOURCE_DERIVED_GEOMETRY: 'SOURCE_DERIVED_GEOMETRY',
  REVIEWER_CONFIRMED_GEOMETRY: 'REVIEWER_CONFIRMED_GEOMETRY',
  PARAMETRIC_ILLUSTRATION: 'PARAMETRIC_ILLUSTRATION',
  UNSUPPORTED_GEOMETRY: 'UNSUPPORTED_GEOMETRY',
};

export const MATERIAL_PRESETS = {
  WHITE_SBS_BOARD: {
    id: 'WHITE_SBS_BOARD',
    name: 'White Solid Bleached Sulfate (SBS) Board',
    roughness: 0.38,
    metalness: 0.05,
    clearcoat: 0.1,
    transmission: 0.0,
    isIllustrative: false,
    disclaimer: 'Standard packaging substrate response.',
  },
  KRAFT_PAPER: {
    id: 'KRAFT_PAPER',
    name: 'Unbleached Kraft Paperboard',
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.0,
    transmission: 0.0,
    isIllustrative: true,
    disclaimer: 'Illustrative visual material preset. Does not certify board porosity or ink holdout.',
  },
  METALLIC_CAN: {
    id: 'METALLIC_CAN',
    name: 'Brushed Aluminum Can Alloy',
    roughness: 0.20,
    metalness: 0.92,
    clearcoat: 0.05,
    transmission: 0.0,
    isIllustrative: false,
    disclaimer: 'Specular aluminum surface reflectance.',
  },
  GLASS: {
    id: 'GLASS',
    name: 'Flint Glass Container',
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    transmission: 0.90, // Transparent glass refraction
    ior: 1.52,
    isIllustrative: true,
    disclaimer: 'Parametric glass refraction shader. Does not certify container wall thickness or anneal strength.',
  },
  METALLIC_GOLD_FOIL: {
    id: 'METALLIC_GOLD_FOIL',
    name: 'Hot Stamped Gold Foil Finish',
    roughness: 0.15,
    metalness: 0.95,
    clearcoat: 0.2,
    tint: 0xd4af37,
    isIllustrative: true,
    disclaimer: 'Illustrative foil shader. Real foil requires verified separation plate or spot finish metadata.',
  },
  SPOT_UV_GLOSS: {
    id: 'SPOT_UV_GLOSS',
    name: 'Spot UV Gloss Varnish',
    roughness: 0.10,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    isIllustrative: true,
    disclaimer: 'Illustrative high-gloss coating overlay.',
  },
  MATTE_FINISH: {
    id: 'MATTE_FINISH',
    name: 'Soft-Touch Matte Lamination',
    roughness: 0.75,
    metalness: 0.0,
    clearcoat: 0.0,
    isIllustrative: true,
    disclaimer: 'Illustrative tactile matte simulation.',
  },
};

/**
 * Creates a standard PackageGeometry descriptor conforming to E2.1.
 */
export function createPackageGeometry({
  packageType = PACKAGE_TYPES.FOLDING_CARTON,
  geometryMode = '3D_VIEW',
  dimensions = null,
  geometrySource = GEOMETRY_SOURCE_MODES.PARAMETRIC_ILLUSTRATION,
  geometryVerified = false,
  faces = [],
  surfaces = [],
  materialPreset = 'WHITE_SBS_BOARD',
  artworkMappings = {},
  modelLimitations = '',
} = {}) {
  // Default dimensions per package type if unspecified
  const defaultDims = {
    [PACKAGE_TYPES.FOLDING_CARTON]: { width: 100, height: 160, depth: 60, units: 'mm' },
    [PACKAGE_TYPES.BEVERAGE_CAN]: { diameter: 66, radius: 33, height: 122, bodyHeight: 104, units: 'mm' },
    [PACKAGE_TYPES.GLASS_BOTTLE]: { diameter: 72, radius: 36, height: 190, bodyHeight: 105, neckRadius: 14, units: 'mm' },
    [PACKAGE_TYPES.STANDUP_POUCH]: { width: 140, height: 200, depth: 65, sealWidth: 8, units: 'mm' },
  }[packageType] || { width: 100, height: 160, depth: 60, units: 'mm' };

  const finalDims = dimensions || defaultDims;
  const isIllustrative = geometrySource === GEOMETRY_SOURCE_MODES.PARAMETRIC_ILLUSTRATION;

  let limitations = modelLimitations;
  if (!limitations) {
    if (isIllustrative) {
      limitations = `Parametric 3D illustration based on standard ${packageType.replace('_', ' ')} proportions. Dimensions and surface curvature are illustrative previews, not production CAD dielines.`;
    } else if (geometrySource === GEOMETRY_SOURCE_MODES.REVIEWER_CONFIRMED_GEOMETRY) {
      limitations = `Reviewer-confirmed package dimensions (${finalDims.width || finalDims.diameter}x${finalDims.height}${finalDims.depth ? `x${finalDims.depth}` : ''} ${finalDims.units || 'mm'}).`;
    } else {
      limitations = 'Constructed from verified source CAD/DXF dieline entities.';
    }
  }

  return {
    packageType,
    geometryMode,
    dimensions: finalDims,
    geometrySource,
    geometryVerified: Boolean(geometryVerified),
    faces: faces.length > 0 ? faces : getDefaultFacesForType(packageType),
    surfaces: surfaces.length > 0 ? surfaces : getDefaultSurfacesForType(packageType),
    materialPreset: MATERIAL_PRESETS[materialPreset] ? materialPreset : 'WHITE_SBS_BOARD',
    materialDetails: MATERIAL_PRESETS[materialPreset] || MATERIAL_PRESETS.WHITE_SBS_BOARD,
    artworkMappings,
    modelLimitations: limitations,
  };
}

function getDefaultFacesForType(packageType) {
  switch (packageType) {
    case PACKAGE_TYPES.FOLDING_CARTON:
      return ['front', 'back', 'left', 'right', 'top', 'bottom'];
    case PACKAGE_TYPES.BEVERAGE_CAN:
      return ['body_wrap', 'top_lid', 'bottom_dome'];
    case PACKAGE_TYPES.GLASS_BOTTLE:
      return ['front_label', 'back_label', 'glass_body', 'cap'];
    case PACKAGE_TYPES.STANDUP_POUCH:
      return ['front_panel', 'back_panel', 'bottom_gusset', 'left_seal', 'right_seal', 'top_seal'];
    default:
      return ['front'];
  }
}

function getDefaultSurfacesForType(packageType) {
  switch (packageType) {
    case PACKAGE_TYPES.FOLDING_CARTON:
      return [{ id: 'carton_shell', type: 'FLAT_PANELS', topology: 'MANIFOLD_BOX' }];
    case PACKAGE_TYPES.BEVERAGE_CAN:
      return [{ id: 'can_sidewall', type: 'CYLINDRICAL_SURFACE', wrapAngleDeg: 360, uvSeamless: true }];
    case PACKAGE_TYPES.GLASS_BOTTLE:
      return [
        { id: 'bottle_body', type: 'REVOLUTION_SURFACE', transparent: true },
        { id: 'body_label', type: 'CYLINDRICAL_PARTIAL_WRAP', wrapAngleDeg: 240 },
      ];
    case PACKAGE_TYPES.STANDUP_POUCH:
      return [
        { id: 'front_film', type: 'PARAMETRIC_CURVED_MESH', flexible: true },
        { id: 'back_film', type: 'PARAMETRIC_CURVED_MESH', flexible: true },
        { id: 'bottom_gusset', type: 'EXPANDING_GUSSET_TRIANGLE', flexible: true },
      ];
    default:
      return [{ id: 'planar_surface', type: 'PLANAR' }];
  }
}
