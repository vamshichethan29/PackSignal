/**
 * PackSignal 3D Packaging Studio — Canonical Geometry Contract & Models
 * (public/packaging-3d/package-geometry.js)
 */

import { PACKAGE_TYPES, GEOMETRY_STATUS, normalizePackageType } from './package-types.js';

export const DIMENSION_UNITS = Object.freeze({
  MILLIMETERS: 'mm',
});

/**
 * Creates a structured canonical package geometry record.
 */
export function createPackageGeometry({
  packageType = PACKAGE_TYPES.FOLDING_CARTON,
  geometryVersion = '1.0.0',
  dimensions = null,
  dimensionUnit = DIMENSION_UNITS.MILLIMETERS,
  geometrySource = 'parametric',
  geometryStatus = null,
  surfaceDefinitions = null,
  artworkMappings = [],
  materialPreset = null,
  limitations = [],
} = {}) {
  const normType = normalizePackageType(packageType);

  let defaultDims = {};
  let defaultSurfaces = [];
  let defaultMaterial = 'SBS_WHITE_CARD';
  let isSourceDerived = geometryStatus === GEOMETRY_STATUS.SOURCE_DERIVED;

  if (normType === 'can') {
    defaultDims = {
      diameter: 66,
      radius: 33,
      height: 122,
      bodyHeight: 104,
      rimHeight: 11,
      baseHeight: 7,
      printableWrapWidth: 207.3, // Math.PI * 66
    };
    defaultSurfaces = [
      { id: 'body', name: 'Printed Cylindrical Body', type: 'CYLINDRICAL_SURFACE', uRange: [0, 1], vRange: [0, 1] },
      { id: 'lid', name: 'Aluminium Lid & Stay-Tab', type: 'PLANAR_DISC', uRange: [0, 0], vRange: [0, 0] },
      { id: 'chime', name: 'Rolled Top Rim', type: 'TAPERED_CYLINDER', uRange: [0, 0], vRange: [0, 0] },
      { id: 'base', name: 'Tapered Bottom Dome', type: 'CONCAVE_DOME', uRange: [0, 0], vRange: [0, 0] },
    ];
    defaultMaterial = 'ALUMINIUM_METAL';
  } else if (normType === 'bottle') {
    defaultDims = {
      diameter: 72,
      radius: 36,
      height: 190,
      bodyHeight: 105,
      neckRadius: 13.7,
      neckHeight: 45,
      shoulderHeight: 25,
      capHeight: 18,
    };
    defaultSurfaces = [
      { id: 'body', name: 'Glass Body', type: 'REVOLVED_SURFACE', uRange: [0, 1], vRange: [0, 1] },
      { id: 'label_wrap', name: 'Front / Wrap Label', type: 'CYLINDRICAL_OFFSET_LABEL', uRange: [0, 1], vRange: [0, 1] },
      { id: 'neck', name: 'Bottle Neck', type: 'REVOLVED_CYLINDER', uRange: [0, 0], vRange: [0, 0] },
      { id: 'cap', name: 'Molded Closure Cap', type: 'CYLINDRICAL_CAP', uRange: [0, 0], vRange: [0, 0] },
    ];
    defaultMaterial = 'CLEAR_GLASS';
  } else if (normType === 'pouch') {
    defaultDims = {
      width: 140,
      height: 200,
      depth: 65,
      sealWidth: 8,
      tearNotchHeight: 30,
      gussetDepth: 55,
    };
    defaultSurfaces = [
      { id: 'front', name: 'Front Pillow Panel', type: 'CONVEX_DEFORMED_SURFACE', uRange: [0, 1], vRange: [0, 1] },
      { id: 'back', name: 'Back Pillow Panel', type: 'CONVEX_DEFORMED_SURFACE', uRange: [0, 1], vRange: [0, 1] },
      { id: 'bottom_gusset', name: 'Expanding Bottom Gusset', type: 'INVERTED_V_GUSSET', uRange: [0, 1], vRange: [0, 1] },
      { id: 'top_seal', name: 'Top Heat Seal & Zipper', type: 'PLANAR_FLANGE', uRange: [0, 1], vRange: [0, 0.05] },
      { id: 'side_seals', name: 'Perimeter Heat Seal Flanges', type: 'PLANAR_FLANGE', uRange: [0, 1], vRange: [0, 1] },
    ];
    defaultMaterial = 'METALLIZED_FOIL_POUCH';
  } else {
    // Folding carton
    defaultDims = {
      width: 160,
      height: 220,
      depth: 55,
      caliperMm: 0.45,
    };
    defaultSurfaces = [
      { id: 'front', name: 'Principal Display Panel (Front)', type: 'PLANAR_FACE', normal: [0, 0, 1], uRange: [0, 1], vRange: [0, 1] },
      { id: 'back', name: 'Information Panel (Back)', type: 'PLANAR_FACE', normal: [0, 0, -1], uRange: [0, 1], vRange: [0, 1] },
      { id: 'left', name: 'Left Side Panel', type: 'PLANAR_FACE', normal: [-1, 0, 0], uRange: [0, 1], vRange: [0, 1] },
      { id: 'right', name: 'Right Side Panel (Nutrition/Facts)', type: 'PLANAR_FACE', normal: [1, 0, 0], uRange: [0, 1], vRange: [0, 1] },
      { id: 'top', name: 'Top Closure Flap', type: 'PLANAR_FACE', normal: [0, 1, 0], uRange: [0, 1], vRange: [0, 1] },
      { id: 'bottom', name: 'Bottom Closure Flap', type: 'PLANAR_FACE', normal: [0, -1, 0], uRange: [0, 1], vRange: [0, 1] },
    ];
    defaultMaterial = 'SBS_WHITE_CARD';
  }

  const finalDims = { ...defaultDims, ...(dimensions || {}) };
  const finalStatus = geometryStatus || (isSourceDerived ? GEOMETRY_STATUS.SOURCE_DERIVED : GEOMETRY_STATUS.PARAMETRIC_ILLUSTRATION);

  const finalLimitations = [...(limitations || [])];
  if (finalStatus === GEOMETRY_STATUS.PARAMETRIC_ILLUSTRATION) {
    if (!finalLimitations.some(l => l.includes('Illustrative geometry'))) {
      finalLimitations.push('Illustrative geometry — dimensions not verified from production CAD.');
    }
  }

  return {
    packageType: normType,
    geometryVersion,
    dimensions: finalDims,
    dimensionUnit,
    geometrySource: geometrySource || (isSourceDerived ? 'dxf' : 'parametric'),
    geometryStatus: finalStatus,
    geometryVerified: finalStatus === GEOMETRY_STATUS.SOURCE_DERIVED || finalStatus === GEOMETRY_STATUS.REVIEWER_CONFIRMED,
    surfaceDefinitions: surfaceDefinitions || defaultSurfaces,
    faces: (surfaceDefinitions || defaultSurfaces).map(s => s.id),
    surfaces: surfaceDefinitions || defaultSurfaces,
    artworkMappings,
    materialPreset: materialPreset || defaultMaterial,
    limitations: finalLimitations,
    modelLimitations: finalLimitations.join(' '),
  };
}
