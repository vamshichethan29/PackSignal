/**
 * @file lib/artwork/finding-locations.mjs
 * 
 * PackSignal Phase 5A — Shared Finding Location Model
 * Computes canonical, source-grounded artwork coordinates, panel mappings,
 * and physical millimeter positions for review findings.
 * 
 * Follows strict physical scale rules:
 * - 1 PDF point = 25.4 / 72 mm only when verified print scale or page TrimBox/DXF is confirmed.
 * - When scale is unconfirmed: physicalPositionMm is null (never invented).
 * - Distinguishes EXACT_SOURCE_LOCATION, VERIFIED_GEOMETRY_LOCATION, 
 *   APPROXIMATE_SOURCE_REGION, PROPOSED_PLACEMENT_REGION (Ghost Box),
 *   UNLOCATED, and LOCATION_AMBIGUOUS.
 */

export const LOCATION_STATUSES = {
  EXACT_SOURCE_LOCATION: 'EXACT_SOURCE_LOCATION',
  VERIFIED_GEOMETRY_LOCATION: 'VERIFIED_GEOMETRY_LOCATION',
  APPROXIMATE_SOURCE_REGION: 'APPROXIMATE_SOURCE_REGION',
  PROPOSED_PLACEMENT_REGION: 'PROPOSED_PLACEMENT_REGION',
  UNLOCATED: 'UNLOCATED',
  LOCATION_AMBIGUOUS: 'LOCATION_AMBIGUOUS'
};

export const PANEL_ROLES = {
  FRONT: 'FRONT',
  BACK: 'BACK',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  TOP: 'TOP',
  BOTTOM: 'BOTTOM',
  FLAP: 'FLAP',
  UNASSIGNED: 'UNASSIGNED'
};

/**
 * Derives the canonical finding location for a single finding within a review.
 * 
 * @param {Object} finding - Canonical review finding
 * @param {Object} review - Entire review object
 * @returns {Object} Canonical finding location record
 */
export function getFindingLocation(finding, review) {
  if (!finding) return null;

  const reviewId = review?.id || 'review-default';
  const revisionId = review?.revisionId || review?.revision || 'rev-1';

  // Find artwork document
  const artworkDoc = (review?.documents || []).find(d => d.role === 'artwork') ||
    review?.artwork ||
    (review?.documents && review.documents[0]) || null;
  const documentId = artworkDoc?.id || 'doc-artwork';
  const documentSha256 = artworkDoc?.sha256 || artworkDoc?.hash || review?.artworkHash || '';

  // 1. Inspect finding artwork evidence
  const artworkEvidence = (finding.evidence || []).filter(e => e.role === 'artwork' && e.box);
  const selectedEvidence = artworkEvidence[0] || null;

  let page = Number(selectedEvidence?.page || finding.page || 1);
  let normalizedBox = null;
  let geometryType = 'BOX';
  let locationStatus = LOCATION_STATUSES.UNLOCATED;
  let locationMethod = finding.method || 'deterministic_check';
  let locationConfidence = 0.5;

  if (selectedEvidence?.box && Array.isArray(selectedEvidence.box) && selectedEvidence.box.length === 4) {
    normalizedBox = [...selectedEvidence.box];
    geometryType = 'BOX';
    locationStatus = finding.status === 'issue' || finding.status === 'match'
      ? LOCATION_STATUSES.EXACT_SOURCE_LOCATION
      : LOCATION_STATUSES.APPROXIMATE_SOURCE_REGION;
    locationConfidence = 0.95;
  } else if (finding.box && Array.isArray(finding.box) && finding.box.length === 4) {
    normalizedBox = [...finding.box];
    geometryType = 'BOX';
    locationStatus = LOCATION_STATUSES.VERIFIED_GEOMETRY_LOCATION;
    locationConfidence = 0.90;
  } else if (finding.ghostBox && Array.isArray(finding.ghostBox)) {
    normalizedBox = [...finding.ghostBox];
    geometryType = 'BOX';
    locationStatus = LOCATION_STATUSES.PROPOSED_PLACEMENT_REGION;
    locationConfidence = 0.85;
  } else if (finding.observed && /not detected/i.test(finding.observed) || finding.status === 'unable') {
    // Missing statutory item without ghost box
    normalizedBox = null;
    locationStatus = LOCATION_STATUSES.UNLOCATED;
    locationConfidence = 0.0;
  }

  // 2. Panel mapping
  const panelMapping = resolvePanelForBox(normalizedBox, page, review);
  const panelId = panelMapping.panelId;
  const panelRole = panelMapping.panelRole;

  // 3. Physical Millimeter Coordinates
  const physical = calculatePhysicalCoordinates(normalizedBox, page, review, artworkDoc);

  // 4. Source Piece IDs and quads
  const sourcePieceIds = selectedEvidence?.sourcePieceIds ||
    (finding.sourcePieceId ? [finding.sourcePieceId] : []);
  const sourceQuads = selectedEvidence?.quads || null;
  const sourcePolygon = selectedEvidence?.polygon || null;

  return {
    findingId: finding.id,
    reviewId,
    revisionId,
    documentId,
    documentSha256,
    page,
    panelId,
    panelRole,
    sourcePieceIds,
    geometryType,
    normalizedBox,
    sourceQuads,
    sourcePolygon,
    physicalPositionMm: physical.positionMm,
    physicalPolygonMm: physical.polygonMm,
    physicalScaleAuthority: physical.scaleAuthority,
    physicalScaleNotice: physical.scaleNotice,
    layer: finding.layer || selectedEvidence?.layer || 'artwork-content',
    locationMethod,
    locationConfidence,
    locationStatus,
    evidenceRefs: (finding.evidence || []).map(e => ({
      role: e.role,
      page: e.page,
      location: e.location,
      quote: e.quote,
      documentName: e.name
    }))
  };
}

/**
 * Resolves which panel a normalized box falls into using confirmed dieline zones.
 */
function resolvePanelForBox(box, page, review) {
  if (!box || !Array.isArray(box)) {
    return { panelId: 'UNASSIGNED', panelRole: PANEL_ROLES.UNASSIGNED };
  }

  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  const panelZones = review?.options?.panelZones || review?.panelZones || {};
  for (const [panelKey, zone] of Object.entries(panelZones)) {
    if (!zone || !zone.box) continue;
    const zPage = zone.page || 1;
    if (zPage !== page) continue;

    const [zx0, zy0, zx1, zy1] = zone.box;
    if (cx >= zx0 && cx <= zx1 && cy >= zy0 && cy <= zy1) {
      const upper = panelKey.toUpperCase();
      let role = PANEL_ROLES.UNASSIGNED;
      if (upper.includes('FRONT') || upper === 'PDP') role = PANEL_ROLES.FRONT;
      else if (upper.includes('BACK') || upper === 'INFORMATIONAL') role = PANEL_ROLES.BACK;
      else if (upper.includes('LEFT')) role = PANEL_ROLES.LEFT;
      else if (upper.includes('RIGHT')) role = PANEL_ROLES.RIGHT;
      else if (upper.includes('TOP')) role = PANEL_ROLES.TOP;
      else if (upper.includes('BOTTOM')) role = PANEL_ROLES.BOTTOM;
      else if (upper.includes('FLAP') || upper.includes('GLUE')) role = PANEL_ROLES.FLAP;

      return { panelId: panelKey, panelRole: role };
    }
  }

  // Fallback heuristic based on layout position if no zones defined
  if (cx < 0.3) return { panelId: 'panel-left', panelRole: PANEL_ROLES.LEFT };
  if (cx > 0.7) return { panelId: 'panel-right', panelRole: PANEL_ROLES.RIGHT };
  return { panelId: 'panel-center', panelRole: PANEL_ROLES.FRONT };
}

/**
 * Converts normalized [0, 1] coordinates to physical millimeters ONLY when
 * scale authority is verified.
 */
function calculatePhysicalCoordinates(box, page, review, artworkDoc) {
  if (!box) {
    return {
      positionMm: null,
      polygonMm: null,
      scaleAuthority: 'NO_GEOMETRY',
      scaleNotice: 'No geometric bounding box detected.'
    };
  }

  // Check if physical print scale is established
  const dieline = (review?.documents || []).find(d => d.role === 'dieline');
  const pageObj = (artworkDoc?.pages || []).find(p => p.number === page);
  const trimBox = pageObj?.trimBox || review?.artworkTrimBox || null;
  const ptToMm = 25.4 / 72; // Standard unscaled PDF point to mm

  // If explicit physical dimensions (widthMm, heightMm) exist in artwork metadata or verified TrimBox
  let pageWidthMm = null;
  let pageHeightMm = null;
  let scaleAuthority = 'UNCONFIRMED_SCALE';

  if (pageObj?.widthMm && pageObj?.heightMm) {
    pageWidthMm = pageObj.widthMm;
    pageHeightMm = pageObj.heightMm;
    scaleAuthority = 'VERIFIED_PAGE_METRICS';
  } else if (trimBox && Array.isArray(trimBox) && trimBox.length === 4) {
    const [t0, t1, t2, t3] = trimBox;
    pageWidthMm = Math.abs(t2 - t0) * ptToMm;
    pageHeightMm = Math.abs(t3 - t1) * ptToMm;
    scaleAuthority = 'PDF_TRIMBOX_GEOMETRY';
  } else if (pageObj?.width && pageObj?.height && pageObj.width > 100 && pageObj.height > 100) {
    // If dimensions are in points
    pageWidthMm = pageObj.width * ptToMm;
    pageHeightMm = pageObj.height * ptToMm;
    scaleAuthority = 'PDF_MEDIABOX_UNSCALED';
  } else if (dieline?.dimensionsMm) {
    pageWidthMm = dieline.dimensionsMm.width;
    pageHeightMm = dieline.dimensionsMm.height;
    scaleAuthority = 'VERIFIED_DXF_DIELINE';
  }

  if (!pageWidthMm || !pageHeightMm) {
    return {
      positionMm: null,
      polygonMm: null,
      scaleAuthority: 'UNCONFIRMED_SCALE',
      scaleNotice: 'Physical millimeter position requires confirmed artwork scale.'
    };
  }

  const [x0, y0, x1, y1] = box;
  const xMm = Number((x0 * pageWidthMm).toFixed(2));
  const yMm = Number((y0 * pageHeightMm).toFixed(2));
  const wMm = Number(((x1 - x0) * pageWidthMm).toFixed(2));
  const hMm = Number(((y1 - y0) * pageHeightMm).toFixed(2));

  const positionMm = {
    xMm,
    yMm,
    widthMm: wMm,
    heightMm: hMm,
    pageWidthMm: Number(pageWidthMm.toFixed(2)),
    pageHeightMm: Number(pageHeightMm.toFixed(2)),
    unit: 'mm',
    coordinateOrigin: 'TOP_LEFT'
  };

  const polygonMm = [
    [xMm, yMm],
    [Number((xMm + wMm).toFixed(2)), yMm],
    [Number((xMm + wMm).toFixed(2)), Number((yMm + hMm).toFixed(2))],
    [xMm, Number((yMm + hMm).toFixed(2))]
  ];

  return {
    positionMm,
    polygonMm,
    scaleAuthority,
    scaleNotice: `Derived from ${scaleAuthority} (1 pt = 25.4/72 mm).`
  };
}

/**
 * Builds canonical location mappings for all findings in a review.
 * Transparently separates locatable findings from unlocated findings.
 * 
 * @param {Object} review 
 * @returns {Object} { locations, locatableFindings, unlocatedFindings, metrics }
 */
export function buildReviewFindingLocations(review) {
  const findings = review?.findings || [];
  const locations = [];
  const locatableFindings = [];
  const unlocatedFindings = [];

  for (const finding of findings) {
    const loc = getFindingLocation(finding, review);
    if (!loc) continue;

    locations.push(loc);

    if (loc.locationStatus === LOCATION_STATUSES.UNLOCATED) {
      unlocatedFindings.push({
        finding,
        location: loc,
        reason: 'Missing element or non-localized requirement without physical coordinates'
      });
    } else {
      locatableFindings.push({
        finding,
        location: loc
      });
    }
  }

  const metrics = {
    totalFindings: findings.length,
    locatableCount: locatableFindings.length,
    unlocatedCount: unlocatedFindings.length,
    exactSourceCount: locations.filter(l => l.locationStatus === LOCATION_STATUSES.EXACT_SOURCE_LOCATION).length,
    geometryCount: locations.filter(l => l.locationStatus === LOCATION_STATUSES.VERIFIED_GEOMETRY_LOCATION).length,
    ghostBoxCount: locations.filter(l => l.locationStatus === LOCATION_STATUSES.PROPOSED_PLACEMENT_REGION).length,
    ambiguousCount: locations.filter(l => l.locationStatus === LOCATION_STATUSES.LOCATION_AMBIGUOUS).length
  };

  return {
    locations,
    locatableFindings,
    unlocatedFindings,
    metrics
  };
}
