/**
 * PackSignal — Smart 3D Finding Pins Data Model
 * Extracts canonical, evidence-backed finding pins mapped to 3D package panels.
 * Preserves exact identities and statuses; never fabricates fictitious coordinates.
 */

export const FINDING_STATUSES = {
  ISSUE: 'issue',
  REVIEW: 'review',
  MATCH: 'match',
  UNABLE: 'unable',
};

export const STATUS_LABELS = {
  issue: 'ISSUE',
  review: 'REVIEW',
  match: 'MATCH',
  unable: 'UNABLE',
};

export const STATUS_SYMBOLS = {
  issue: '!',
  review: '?',
  match: '✓',
  unable: '—',
};

export const STATUS_PRIORITY = {
  issue: 3,
  review: 2,
  match: 1,
  unable: 0,
};

/**
 * Determine panel mapping for a given point [x, y] in artwork page coordinates.
 *
 * @param {Array<number>} point - [cx, cy] center point
 * @param {number} page - page number
 * @param {Object} panelZones - Map of faceName -> { page, box: [x0, y0, x1, y1] }
 * @returns {{ panelId: string, zone: Object, normalizedPoint: { u: number, v: number } } | null}
 */
export function resolvePanelForPoint(point, page, panelZones) {
  if (!point || !Array.isArray(point) || point.length < 2 || !panelZones) return null;
  const [x, y] = point;

  for (const [panelId, zone] of Object.entries(panelZones)) {
    if (!zone || zone.page !== page || !Array.isArray(zone.box) || zone.box.length < 4) continue;
    const [x0, y0, x1, y1] = zone.box;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      const spanX = Math.max(0.0001, maxX - minX);
      const spanY = Math.max(0.0001, maxY - minY);
      const u = Math.max(0, Math.min(1, (x - minX) / spanX));
      const v = Math.max(0, Math.min(1, (y - minY) / spanY));
      return { panelId, zone, normalizedPoint: { u, v } };
    }
  }

  return null;
}

/**
 * Extracts canonical finding pins from a PackSignal review record.
 *
 * @param {Object} review - The active review record
 * @param {Object} [options]
 * @param {Object} [options.panelZones] - Resolved panel zones (front, back, left, right, etc.)
 * @param {Object} [options.cadModel] - CAD/DXF model if present
 * @returns {{ pins: Array<Object>, unlocatedFindings: Array<Object> }}
 */
export function extractCartonFindingPins(review, options = {}) {
  const pins = [];
  const unlocatedFindings = [];

  if (!review || !Array.isArray(review.findings)) {
    return { pins, unlocatedFindings };
  }

  const reviewId = review.id || 'review-active';
  const artworkDoc = (review.documents || []).find(d => d.role === 'artwork') || null;
  const artworkVersion = artworkDoc?.version || review.version || 'v1.0';
  const artworkDocId = artworkDoc?.id || 'doc-artwork';

  const panelZones = options.panelZones || review.options?.faceZones || review.options?.panelZones || {};
  const cadModel = options.cadModel || null;

  // Determine geometry provenance level
  const confirmedMapping = Boolean(review.options?.confirmedMapping || review.options?.faceMappingsConfirmed);
  const mappingSource = cadModel?.ok
    ? 'dxf_verified'
    : confirmedMapping
      ? 'reviewer_confirmed'
      : review.sample
        ? 'illustrative'
        : 'suggested';
  const mappingConfirmed = cadModel?.ok || confirmedMapping;

  // Map of decisions by findingId
  const reviewerDecisions = review.decisions || {};

  for (const finding of review.findings) {
    if (!finding || !finding.id) continue;

    // Filter out synthetic ghost box markers if represented as findings
    if (finding.isGhostPlacement || finding.type === 'ghost_region') {
      continue;
    }

    const findingId = finding.id;
    const status = (finding.status || 'review').toLowerCase();
    const severity = (finding.severity || 'medium').toLowerCase();
    const title = finding.title || 'Untitled Finding';
    const ruleId = finding.ruleId || finding.check || finding.rule || '';
    const observed = finding.observed || finding.quote || '';
    const expected = finding.expected || '';
    const summary = finding.summary || finding.explanation || '';
    const reviewerDecisionId = reviewerDecisions[findingId]?.decision || null;

    // Locate artwork evidence bounding box
    const artworkEvidence = (finding.evidence || []).filter(
      item => item && item.role === 'artwork' && Number.isInteger(item.page) && Array.isArray(item.box) && item.box.length >= 4
    );

    if (artworkEvidence.length === 0) {
      unlocatedFindings.push({
        findingId,
        title,
        status,
        severity,
        reason: 'Missing artwork bounding box',
        ruleId,
      });
      continue;
    }

    let locatedOnPanel = false;

    // Create a pin for each valid artwork evidence occurrence
    for (const [evIndex, item] of artworkEvidence.entries()) {
      const [bx0, by0, bx1, by1] = item.box;
      const centerX = (bx0 + bx1) / 2;
      const centerY = (by0 + by1) / 2;

      const mapping = resolvePanelForPoint([centerX, centerY], item.page, panelZones);

      if (!mapping) {
        continue;
      }

      locatedOnPanel = true;
      const pinId = `pin-${findingId}-${evIndex}`;

      pins.push({
        pinId,
        findingId,
        evidenceIndex: evIndex,
        reviewId,
        artworkVersion,
        status,
        statusLabel: STATUS_LABELS[status] || status.toUpperCase(),
        statusSymbol: STATUS_SYMBOLS[status] || '•',
        severity,
        title,
        panelId: mapping.panelId,
        sourceDocumentId: finding.sourceDocumentId || null,
        artworkDocumentId: artworkDocId,
        artworkPage: item.page,
        artworkBoundingBox: [bx0, by0, bx1, by1],
        normalizedPanelPoint: mapping.normalizedPoint,
        mappingSource,
        mappingConfirmed,
        ruleId,
        evidenceIds: [item.id || `ev-${evIndex}`],
        primaryDepartment: finding.primaryDepartment || 'unassigned',
        collaboratingDepartments: finding.collaboratingDepartments || [],
        observed,
        expected,
        summary,
        quote: item.quote || observed,
        reviewerDecisionId,
      });
    }

    if (!locatedOnPanel) {
      unlocatedFindings.push({
        findingId,
        title,
        status,
        severity,
        reason: 'Evidence outside mapped panel zones',
        ruleId,
      });
    }
  }

  return { pins, unlocatedFindings };
}
