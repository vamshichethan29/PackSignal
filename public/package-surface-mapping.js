/**
 * PackSignal 3D Packaging Studio — Surface UV & Physical Coordinate Mapping
 * (public/package-surface-mapping.js)
 *
 * Implements Phase 8, 11, 12, 14, 18:
 * - 2D-to-3D forward projection for Carton, Can, Bottle, Pouch
 * - 3D-to-2D reverse projection
 * - Source-backed Finding Pin anchor resolution
 * - Ghost Box provisional region mapping
 * - Truthful authority tracking (SOURCE_VERIFIED, REVIEWER_CONFIRMED, ILLUSTRATIVE, UNMAPPED)
 */

export const MAPPING_AUTHORITY = Object.freeze({
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  REVIEWER_CONFIRMED: 'REVIEWER_CONFIRMED',
  ILLUSTRATIVE: 'ILLUSTRATIVE',
  UNMAPPED: 'UNMAPPED',
});

/**
 * Standard default physical dimensions in millimeters.
 */
export const DEFAULT_DIMENSIONS = Object.freeze({
  carton: { width: 160, height: 220, depth: 55 },
  can: { radius: 33, height: 115, canHeight: 122 }, // Standard 330ml sleek/standard beverage can
  bottle: { radius: 34, height: 230, labelHeight: 100, labelRadius: 34.4, labelOffsetY: 30 },
  pouch: { width: 140, height: 200, depth: 70, sealWidth: 6, bottomGussetDepth: 35 },
});

/**
 * Maps normalized (u, v) [0..1] to a 3D point on a Folding Carton face.
 */
export function mapNormalizedToCarton(u, v, face = 'front', dimensions = DEFAULT_DIMENSIONS.carton) {
  const { width, height, depth } = dimensions;
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  // Normalized u (0=left, 1=right), v (0=top, 1=bottom)
  switch (face) {
    case 'front':
      return {
        point: [(u - 0.5) * width, (0.5 - v) * height, hd + 0.3],
        normal: [0, 0, 1],
        surface: 'front',
      };
    case 'back':
      return {
        point: [(0.5 - u) * width, (0.5 - v) * height, -hd - 0.3],
        normal: [0, 0, -1],
        surface: 'back',
      };
    case 'left':
      return {
        point: [-hw - 0.3, (0.5 - v) * height, (u - 0.5) * depth],
        normal: [-1, 0, 0],
        surface: 'left',
      };
    case 'right':
      return {
        point: [hw + 0.3, (0.5 - v) * height, (0.5 - u) * depth],
        normal: [1, 0, 0],
        surface: 'right',
      };
    case 'top':
      return {
        point: [(u - 0.5) * width, hh + 0.3, (0.5 - v) * depth],
        normal: [0, 1, 0],
        surface: 'top',
      };
    case 'bottom':
      return {
        point: [(u - 0.5) * width, -hh - 0.3, (v - 0.5) * depth],
        normal: [0, -1, 0],
        surface: 'bottom',
      };
    default:
      return {
        point: [(u - 0.5) * width, (0.5 - v) * height, hd + 0.3],
        normal: [0, 0, 1],
        surface: 'front',
      };
  }
}

/**
 * Maps normalized (u, v) [0..1] to a 3D point on an Aluminium Soda Can cylindrical wrap.
 * u=0.5 faces +Z (front center facing camera), u=0.0 / 1.0 is at the back seam.
 */
export function mapNormalizedToCan(u, v, { radius = DEFAULT_DIMENSIONS.can.radius, height = DEFAULT_DIMENSIONS.can.height, seamOffset = 0 } = {}) {
  // Wrap angle theta: u=0.5 -> theta = 0 (faces +Z towards camera), u=0/1 at back seam (-Z)
  const theta = (u - 0.5) * Math.PI * 2 + seamOffset;
  
  const x = radius * Math.sin(theta);
  const z = radius * Math.cos(theta);
  const y = (0.5 - v) * height; // v=0 is top, v=1 is bottom

  // Surface normal is radially outward
  const nx = Math.sin(theta);
  const nz = Math.cos(theta);

  return {
    point: [x, y, z],
    normal: [nx, 0, nz],
    surface: 'cylinder_body',
    theta,
  };
}

/**
 * Maps 3D coordinates on a cylinder back to normalized (u, v).
 */
export function mapCanPointToNormalized(x, y, z, { radius = DEFAULT_DIMENSIONS.can.radius, height = DEFAULT_DIMENSIONS.can.height, seamOffset = 0 } = {}) {
  let theta = Math.atan2(x, z) - seamOffset;
  let u = (theta / (Math.PI * 2)) + 0.5;
  u = ((u % 1.0) + 1.0) % 1.0;
  let v = 0.5 - (y / height);
  v = Math.max(0, Math.min(1, v));
  return { u, v };
}


/**
 * Maps normalized (u, v) to a 3D point on a Glass Bottle applied label cylinder.
 */
export function mapNormalizedToBottleLabel(u, v, {
  labelRadius = DEFAULT_DIMENSIONS.bottle.labelRadius,
  labelHeight = DEFAULT_DIMENSIONS.bottle.labelHeight,
  labelOffsetY = DEFAULT_DIMENSIONS.bottle.labelOffsetY,
  wrapCoverage = 1.0, // 1.0 for 360 wrap, 0.4 for front-only patch label
} = {}) {
  // Center label around front (+Z)
  const span = wrapCoverage * Math.PI * 2;
  const theta = (u - 0.5) * span;

  const x = labelRadius * Math.sin(theta);
  const z = labelRadius * Math.cos(theta);
  // labelOffsetY centers the label on the cylindrical body section
  const y = labelOffsetY + (0.5 - v) * labelHeight;

  return {
    point: [x, y, z],
    normal: [Math.sin(theta), 0, Math.cos(theta)],
    surface: 'bottle_label',
  };
}

/**
 * Maps normalized (u, v) to a 3D point on a Stand-Up Foil Pouch pillow/gusset mesh.
 */
export function mapNormalizedToPouch(u, v, surface = 'front', dimensions = DEFAULT_DIMENSIONS.pouch) {
  const { width, height, depth, sealWidth = 6 } = dimensions;
  const effectiveW = width - 2 * sealWidth;
  const effectiveH = height - 2 * sealWidth;

  const x = (u - 0.5) * effectiveW;
  const y = (0.5 - v) * effectiveH;

  // Realistic pillow bulge formula: maximum bulge in center, tapering to zero at seals
  const bulgeProfileX = Math.cos((u - 0.5) * Math.PI); // 1 at center, 0 at edges
  const bulgeProfileY = Math.sin(v * Math.PI); // 1 in middle, 0 at top/bottom seals
  const maxBulge = (depth / 2) * 0.85;
  const zOffset = maxBulge * Math.max(0, bulgeProfileX * bulgeProfileY);

  const isFront = surface === 'front';
  const z = isFront ? zOffset + 0.4 : -zOffset - 0.4;
  const nz = isFront ? 1 : -1;

  return {
    point: [x, y, z],
    normal: [0, 0, nz],
    surface: isFront ? 'pouch_front' : 'pouch_back',
  };
}

/**
 * Resolves a finding pin's exact physical 3D anchor and truth authority.
 * Never fabricates coordinates for unlocated findings!
 */
export function resolveFindingAnchor(finding, packageType = 'carton', options = {}) {
  if (!finding) {
    return { status: MAPPING_AUTHORITY.UNMAPPED, reason: 'No finding object supplied' };
  }

  // Check for valid 2D bounding box
  const box = finding.box || finding.bbox || (finding.regions && finding.regions[0]?.box);
  if (!Array.isArray(box) || box.length < 4) {
    return {
      status: MAPPING_AUTHORITY.UNMAPPED,
      findingId: finding.id,
      title: finding.title || 'Untitled finding',
      reason: 'No 2D artwork bounding box detected in source PDF or review evidence.',
    };
  }

  const [minX, minY, maxX, maxY] = box;
  const uCenter = Math.max(0, Math.min(1, (minX + maxX) / 2));
  const vCenter = Math.max(0, Math.min(1, (minY + maxY) / 2));

  let proj = null;
  const normType = String(packageType).toLowerCase();

  if (normType === 'can') {
    proj = mapNormalizedToCan(uCenter, vCenter, options);
  } else if (normType === 'bottle') {
    proj = mapNormalizedToBottleLabel(uCenter, vCenter, options);
  } else if (normType === 'pouch') {
    const surface = options.surface || (finding.panel === 'back' ? 'back' : 'front');
    proj = mapNormalizedToPouch(uCenter, vCenter, surface, options);
  } else {
    // Folding carton
    const face = finding.face || finding.panel || options.face || 'front';
    proj = mapNormalizedToCarton(uCenter, vCenter, face, options);
  }

  if (!proj || !proj.point) {
    return {
      status: MAPPING_AUTHORITY.UNMAPPED,
      findingId: finding.id,
      reason: 'Failed to calculate surface projection on model geometry.',
    };
  }

  const authority = finding.isVerified || finding.sourcePlate
    ? MAPPING_AUTHORITY.SOURCE_VERIFIED
    : (finding.isReviewerConfirmed ? MAPPING_AUTHORITY.REVIEWER_CONFIRMED : MAPPING_AUTHORITY.ILLUSTRATIVE);

  return {
    status: authority,
    findingId: finding.id,
    title: finding.title,
    point: proj.point,
    normal: proj.normal,
    surface: proj.surface,
    u: uCenter,
    v: vCenter,
    sourceBox: [minX, minY, maxX, maxY],
    isBinding: authority === MAPPING_AUTHORITY.SOURCE_VERIFIED,
  };
}

/**
 * Maps a Ghost Bounding Box (provisional placement region for missing declarations) onto package surfaces.
 */
export function mapGhostBoxToSurface(box, packageType = 'carton', options = {}) {
  if (!Array.isArray(box) || box.length < 4) return null;
  const [minX, minY, maxX, maxY] = box;

  // Sample corner points and center
  const corners = [
    { u: minX, v: minY },
    { u: maxX, v: minY },
    { u: maxX, v: maxY },
    { u: minX, v: maxY },
  ];

  const surfacePoints = corners.map(({ u, v }) => {
    if (packageType === 'can') return mapNormalizedToCan(u, v, options).point;
    if (packageType === 'bottle') return mapNormalizedToBottleLabel(u, v, options).point;
    if (packageType === 'pouch') return mapNormalizedToPouch(u, v, options.surface || 'front', options).point;
    return mapNormalizedToCarton(u, v, options.face || 'front', options).point;
  });

  return {
    corners: surfacePoints,
    center: [
      (surfacePoints[0][0] + surfacePoints[2][0]) / 2,
      (surfacePoints[0][1] + surfacePoints[2][1]) / 2,
      (surfacePoints[0][2] + surfacePoints[2][2]) / 2,
    ],
    isProvisional: true,
    label: options.label || 'PROPOSED PLACEMENT REGION',
  };
}
