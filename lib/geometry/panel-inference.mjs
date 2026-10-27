/**
 * PackSignal Packaging Geometry — Evidence-Backed Panel Face Inference
 * (lib/geometry/panel-inference.mjs)
 *
 * Implements Step 6 & Step 7:
 * - Deterministic inference of carton faces: FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM, FLAP, GLUE_TAB.
 * - Evidence-based status: EXPLICITLY_LABELED, GEOMETRIC_CANDIDATE, REVIEWER_CONFIRMED, AMBIGUOUS, UNRESOLVED.
 * - Preserves reviewer confirmations and rejects guessing or fake confidence percentages.
 */

import { CARTON_FACES, VERIFICATION_STATES, SOURCE_TYPES } from './model.mjs';
import { pointInPolygon, polygonArea } from './polygons.mjs';
import { extractClosedPolygonsFromSegments } from './topology.mjs';

export { pointInPolygon };
export const computePolygonArea = polygonArea;

/**
 * Chains line segments { p1: [x, y], p2: [x, y] } into closed polygon boundaries.
 */
export function chainSegmentsIntoPolygons(segments = []) {
  const normSegs = segments.map(s => ({
    points: s.points || (s.p1 && s.p2 ? [s.p1, s.p2] : [])
  })).filter(s => s.points.length === 2);

  const polys = extractClosedPolygonsFromSegments(normSegs, { snapTolerance: 1e-3, minArea: 1e-4 });
  return polys.map(p => p.points);
}

/**
 * Backward-compatible carton panel inference wrapper.
 */
export function inferCartonPanels({ polygons = [], labels = [] }) {
  const polyObjs = polygons.map((poly, idx) => ({
    polygonId: `poly_${idx + 1}`,
    points: poly,
    area: polygonArea(poly),
    boundingBox: [
      Math.min(...poly.map(p => p[0])),
      Math.min(...poly.map(p => p[1])),
      Math.max(...poly.map(p => p[0])),
      Math.max(...poly.map(p => p[1]))
    ],
    limitations: []
  }));

  const inferred = inferPanelFaces({
    polygons: polyObjs,
    panelLabels: labels,
    reviewerZones: {}
  });

  return {
    status: 'SUCCESS',
    mainPanelsCount: inferred.length,
    panels: inferred.map(p => ({
      ...p,
      name: p.face,
      mappingStatus: p.verificationState === VERIFICATION_STATES.EXPLICITLY_LABELED
        ? 'INFERRED_CONFIRMED'
        : p.verificationState
    }))
  };
}

/**
 * Normalizes text to detect explicit panel face labels.
 */
export function extractFaceFromLabelText(text) {
  const clean = String(text || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = new Set(clean.split(/\s+/));

  if (tokens.has('front') || clean.includes('front panel') || clean.includes('pdp') || clean.includes('principal display')) {
    return { face: 'front', reason: 'Source label explicitly mentions "front"' };
  }
  if (tokens.has('back') || tokens.has('rear') || clean.includes('back panel')) {
    return { face: 'back', reason: 'Source label explicitly mentions "back" or "rear"' };
  }
  if (tokens.has('left') || clean.includes('left panel') || clean.includes('left side')) {
    return { face: 'left', reason: 'Source label explicitly mentions "left"' };
  }
  if (tokens.has('right') || clean.includes('right panel') || clean.includes('right side')) {
    return { face: 'right', reason: 'Source label explicitly mentions "right"' };
  }
  if (tokens.has('top') || clean.includes('top panel') || clean.includes('top flap')) {
    return { face: 'top', reason: 'Source label explicitly mentions "top"' };
  }
  if (tokens.has('bottom') || clean.includes('bottom panel') || clean.includes('base')) {
    return { face: 'bottom', reason: 'Source label explicitly mentions "bottom" or "base"' };
  }
  if (tokens.has('flap') || tokens.has('dust') || clean.includes('dust flap') || clean.includes('tuck flap')) {
    return { face: 'flap', reason: 'Source label explicitly designates closure or dust flap' };
  }
  if (tokens.has('glue') || tokens.has('adhesive') || clean.includes('glue tab') || clean.includes('glue flap')) {
    return { face: 'glue_tab', reason: 'Source label explicitly designates manufacturer glue tab' };
  }

  return null;
}

/**
 * Computes polygon centroid [cx, cy].
 */
function computePolygonCentroid(points) {
  if (!points || points.length === 0) return [0, 0];
  let sumX = 0;
  let sumY = 0;
  for (const pt of points) {
    sumX += pt[0];
    sumY += pt[1];
  }
  return [sumX / points.length, sumY / points.length];
}

/**
 * Infers panel faces from detected polygons, explicit labels, and carton net structure.
 */
export function inferPanelFaces({
  polygons = [],
  panelLabels = [],
  reviewerZones = {},
  options = {}
}) {
  const inferredPanels = [];
  const assignedFaces = new Map(); // face -> list of panelIds

  // Step 1: Check reviewer-confirmed face mappings first
  const reviewerFaceEntries = Object.entries(reviewerZones || {});

  for (let idx = 0; idx < polygons.length; idx++) {
    const poly = polygons[idx];
    const panelId = poly.polygonId || `panel_${idx + 1}`;
    const centroid = computePolygonCentroid(poly.points);
    const [x0, y0, x1, y1] = poly.boundingBox;
    const width = x1 - x0;
    const height = y1 - y0;

    let candidateFace = 'unknown_panel';
    let status = VERIFICATION_STATES.UNRESOLVED;
    let inferenceReason = 'Unclassified planar boundary; awaiting reviewer confirmation.';
    let sourceEvidence = null;

    // Check if reviewer explicitly confirmed a zone matching this polygon bounds
    const confirmedMatch = reviewerFaceEntries.find(([face, zone]) => {
      if (!zone?.box || !Array.isArray(zone.box)) return false;
      const [zx0, zy0, zx1, zy1] = zone.box;
      const eps = 0.05; // 5% tolerance for reviewer drawn box vs detected polygon
      return Math.abs(x0 - zx0) < eps && Math.abs(y0 - zy0) < eps &&
             Math.abs(x1 - zx1) < eps && Math.abs(y1 - zy1) < eps;
    });

    if (confirmedMatch) {
      candidateFace = confirmedMatch[0];
      status = VERIFICATION_STATES.REVIEWER_CONFIRMED;
      inferenceReason = `Reviewer confirmed this panel as the ${candidateFace.toUpperCase()} face.`;
      sourceEvidence = { reviewerConfirmation: true, zone: confirmedMatch[1] };
    } else {
      // Step 2: Check for explicit source panel labels inside or adjacent to the polygon, or on region
      let foundExplicitLabel = false;

      if (poly.sourceLabel) {
        const detected = extractFaceFromLabelText(poly.sourceLabel);
        if (detected) {
          candidateFace = detected.face;
          status = VERIFICATION_STATES.EXPLICITLY_LABELED;
          inferenceReason = `Suggested ${candidateFace.toUpperCase()} because source region label "${poly.sourceLabel}" matches.`;
          sourceEvidence = { label: poly.sourceLabel };
          foundExplicitLabel = true;
        }
      }

      const containingLabels = panelLabels.filter(lbl => {
        if (!lbl.point && !lbl.box) return false;
        const pt = lbl.point || [(lbl.box[0] + lbl.box[2]) / 2, (lbl.box[1] + lbl.box[3]) / 2];
        return pointInPolygon(pt, poly.points, true);
      });
      for (const lbl of containingLabels) {
        const detected = extractFaceFromLabelText(lbl.text);
        if (detected) {
          candidateFace = detected.face;
          status = VERIFICATION_STATES.EXPLICITLY_LABELED;
          inferenceReason = `Suggested ${candidateFace.toUpperCase()} because source CAD label "${lbl.text}" lies inside this panel boundary.`;
          sourceEvidence = { label: lbl.text, labelBox: lbl.box || null };
          foundExplicitLabel = true;
          break;
        }
      }

      // Step 3: If not labeled, check geometric dimensions and relative net positions
      if (!foundExplicitLabel) {
        // Distinguish small flaps / glue tabs by aspect ratio or relative area
        const aspectRatio = width / Math.max(1e-6, height);
        if ((width < 0.08 || height < 0.08) && (aspectRatio > 3.0 || aspectRatio < 0.33)) {
          candidateFace = 'flap';
          status = VERIFICATION_STATES.GEOMETRIC_CANDIDATE;
          inferenceReason = `Candidate ${candidateFace.toUpperCase()} based on narrow aspect ratio (${aspectRatio.toFixed(2)}) typical of closure or tuck tabs.`;
        } else {
          candidateFace = 'unknown_panel';
          status = VERIFICATION_STATES.UNRESOLVED;
          inferenceReason = 'Panel boundary detected but lacks explicit text label or reviewer mapping. Not assumed without confirmation.';
        }
      }
    }

    if (!assignedFaces.has(candidateFace)) assignedFaces.set(candidateFace, []);
    assignedFaces.get(candidateFace).push(panelId);

    inferredPanels.push({
      panelId,
      face: candidateFace,
      polygon: poly.points,
      boundingBox: poly.boundingBox,
      sourceType: poly.sourceType || SOURCE_TYPES.DXF_VECTOR,
      area: poly.area,
      dimensions: {
        widthNorm: width,
        heightNorm: height
      },
      centroid,
      verificationState: status,
      inferenceReason,
      sourceEvidence,
      limitations: poly.limitations || []
    });
  }

  // Detect ambiguities (e.g. two panels labeled or inferred as FRONT)
  for (const [face, panelIds] of assignedFaces.entries()) {
    if (['front', 'back', 'left', 'right', 'top', 'bottom'].includes(face) && panelIds.length > 1) {
      for (const p of inferredPanels) {
        if (panelIds.includes(p.panelId) && p.verificationState !== VERIFICATION_STATES.REVIEWER_CONFIRMED) {
          p.verificationState = VERIFICATION_STATES.AMBIGUOUS;
          p.inferenceReason += ` Warning: ${panelIds.length} candidate panels match "${face}". Reviewer resolution required.`;
        }
      }
    }
  }

  return inferredPanels;
}
