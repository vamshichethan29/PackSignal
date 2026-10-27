/**
 * PackSignal 3D Packaging Studio — Canonical Package Types & Statuses
 * (public/packaging-3d/package-types.js)
 */

export const PACKAGE_TYPES = Object.freeze({
  FOLDING_CARTON: 'carton',
  BEVERAGE_CAN: 'can',
  GLASS_BOTTLE: 'bottle',
  STANDUP_POUCH: 'pouch',
});

export const PACKAGE_TYPE_ALIASES = Object.freeze({
  carton: 'carton',
  folding_carton: 'carton',
  box: 'carton',
  cereal_box: 'carton',
  can: 'can',
  soda_can: 'can',
  beverage_can: 'can',
  aluminium_can: 'can',
  aluminum_can: 'can',
  bottle: 'bottle',
  glass_bottle: 'bottle',
  bottle_label: 'bottle',
  pouch: 'pouch',
  standup_pouch: 'pouch',
  foil_pouch: 'pouch',
  flexible_pouch: 'pouch',
});

export const GEOMETRY_STATUS = Object.freeze({
  SOURCE_DERIVED: 'SOURCE_DERIVED',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  PARAMETRIC_ILLUSTRATION: 'PARAMETRIC_ILLUSTRATION',
  UNSUPPORTED: 'UNSUPPORTED',
});

export const FINISH_MASK_MODES = Object.freeze({
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  ILLUSTRATIVE_PREVIEW: 'ILLUSTRATIVE_PREVIEW',
});

export function normalizePackageType(type) {
  if (!type) return PACKAGE_TYPES.FOLDING_CARTON;
  const key = String(type).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return PACKAGE_TYPE_ALIASES[key] || PACKAGE_TYPES.FOLDING_CARTON;
}

export function getPackageTypeMetadata(type) {
  const norm = normalizePackageType(type);
  switch (norm) {
    case 'can':
      return {
        id: 'can',
        canonicalName: 'Aluminium Soda Can',
        shortLabel: 'Can',
        icon: '🥫',
        substrateCategory: 'METAL',
        defaultMaterial: 'ALUMINIUM_METAL',
        supportsWrap: true,
        supportsGusset: false,
        supportsFolding: false,
      };
    case 'bottle':
      return {
        id: 'bottle',
        canonicalName: 'Glass Bottle',
        shortLabel: 'Bottle',
        icon: '🍾',
        substrateCategory: 'GLASS',
        defaultMaterial: 'CLEAR_GLASS',
        supportsWrap: true,
        supportsGusset: false,
        supportsFolding: false,
      };
    case 'pouch':
      return {
        id: 'pouch',
        canonicalName: 'Stand-Up Foil Pouch',
        shortLabel: 'Pouch',
        icon: '🛍️',
        substrateCategory: 'FLEXIBLE_FILM',
        defaultMaterial: 'METALLIZED_FOIL_POUCH',
        supportsWrap: false,
        supportsGusset: true,
        supportsFolding: true, // Inflation/Fullness
      };
    case 'carton':
    default:
      return {
        id: 'carton',
        canonicalName: 'Folding Carton',
        shortLabel: 'Carton',
        icon: '📦',
        substrateCategory: 'PAPERBOARD',
        defaultMaterial: 'SBS_WHITE_CARD',
        supportsWrap: false,
        supportsGusset: false,
        supportsFolding: true, // Kinematic Hinge Folding
      };
  }
}
