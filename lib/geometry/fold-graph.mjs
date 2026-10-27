/**
 * PackSignal Packaging Geometry — Fold Adjacency Graph
 * (lib/geometry/fold-graph.mjs)
 *
 * Implements Step 8: Topological fold connection graph.
 * Determines adjacency from actual shared boundaries, not merely touching corners or nearby bounding boxes.
 */

import { STRUCTURAL_CLASSIFICATIONS, VERIFICATION_STATES } from './model.mjs';
import { sharedSegmentOverlap, segmentLength } from './segments.mjs';

/**
 * Object-oriented FoldGraph wrapper for topological validation and neighbor inspection.
 */
export class FoldGraph {
  constructor(rawGraph = {}) {
    this.nodes = rawGraph.nodes || [];
    this.edges = rawGraph.edges || [];
    this.componentCount = rawGraph.componentCount || 0;
    this.isFullyConnected = Boolean(rawGraph.isFullyConnected);
  }

  areAdjacent(nameA, nameB) {
    return this.edges.some(e =>
      (e.faceA === nameA && e.faceB === nameB) ||
      (e.faceA === nameB && e.faceB === nameA) ||
      (e.panelA === nameA && e.panelB === nameB) ||
      (e.panelA === nameB && e.panelB === nameA)
    );
  }

  getNeighbors(name) {
    const neighbors = [];
    for (const e of this.edges) {
      if (e.faceA === name || e.panelA === name) neighbors.push(e.faceB || e.panelB);
      if (e.faceB === name || e.panelB === name) neighbors.push(e.faceA || e.panelA);
    }
    return [...new Set(neighbors)];
  }

  getSharedEdge(nameA, nameB) {
    const edge = this.edges.find(e =>
      (e.faceA === nameA && e.faceB === nameB) ||
      (e.faceA === nameB && e.faceB === nameA) ||
      (e.panelA === nameA && e.panelB === nameB) ||
      (e.panelA === nameB && e.panelB === nameA)
    );
    if (!edge || !edge.hingeGeometry) return null;
    const [p1, p2] = edge.hingeGeometry;
    const isVertical = Math.abs(p2[0] - p1[0]) <= Math.abs(p2[1] - p1[1]);
    return {
      hingeAxis: isVertical ? 'vertical' : 'horizontal',
      points: edge.hingeGeometry,
      length: edge.sharedBoundaryLength
    };
  }

  validateConsistency() {
    return {
      isValid: this.nodes.length > 0,
      isConnected: this.isFullyConnected,
      componentCount: this.componentCount
    };
  }
}

/**
 * Builds FoldGraph instance from panels array.
 */
export function buildFoldGraphFromPanels(panels = []) {
  const normPanels = panels.map(p => ({
    panelId: p.name || p.id,
    face: p.name || p.face || 'unknown_panel',
    polygon: p.polygon,
    dimensions: {},
    verificationState: VERIFICATION_STATES.REVIEWER_CONFIRMED
  }));

  const raw = buildFoldGraph({ panels: normPanels, tolerance: 1.0, minSharedLength: 1.0 });
  return new FoldGraph(raw);
}

/**
 * Builds a topological fold adjacency graph from inferred panels and structural crease lines.
 */
export function buildFoldGraph({
  panels = [],
  structuralSegments = [],
  tolerance = 1e-3,
  minSharedLength = 1e-3
}) {
  const nodes = [];
  const edges = [];
  const warnings = [];

  // 1. Build Nodes
  for (const panel of panels) {
    nodes.push({
      panelId: panel.panelId,
      face: panel.face,
      polygon: panel.polygon,
      dimensions: panel.dimensions,
      sourceEvidence: panel.sourceEvidence,
      verificationState: panel.verificationState
    });
  }

  // 2. Filter candidate crease segments
  const creaseLines = structuralSegments.filter(s =>
    s.structuralClassification === STRUCTURAL_CLASSIFICATIONS.CREASE ||
    s.kind === 'crease' ||
    s.kind === 'perforation'
  );

  // 3. Find shared boundaries between each pair of panels
  for (let i = 0; i < panels.length; i++) {
    const pA = panels[i];
    const polyA = pA.polygon;

    for (let j = i + 1; j < panels.length; j++) {
      const pB = panels[j];
      const polyB = pB.polygon;

      let maxOverlap = 0;
      let sharedHinge = null;
      let matchingCrease = null;

      // Check each edge of polyA against each edge of polyB
      for (let ea = 0; ea < polyA.length; ea++) {
        const segA = [polyA[ea], polyA[(ea + 1) % polyA.length]];

        for (let eb = 0; eb < polyB.length; eb++) {
          const segB = [polyB[eb], polyB[(eb + 1) % polyB.length]];

          const overlap = sharedSegmentOverlap(segA, segB, tolerance);
          if (overlap > maxOverlap && overlap >= minSharedLength) {
            maxOverlap = overlap;
            sharedHinge = segA;

            // Check if there is an explicit structural crease along this shared boundary
            for (const c of creaseLines) {
              const cOverlap = sharedSegmentOverlap(segA, c.points, tolerance);
              if (cOverlap > 0.5 * overlap) {
                matchingCrease = c;
                break;
              }
            }
          }
        }
      }

      // If an actual shared boundary edge exists (not just a single point/corner)
      if (maxOverlap >= minSharedLength) {
        const edgeVerification = matchingCrease
          ? VERIFICATION_STATES.REVIEWER_CONFIRMED
          : VERIFICATION_STATES.GEOMETRIC_CANDIDATE;

        edges.push({
          edgeId: `fold_${pA.panelId}_${pB.panelId}`,
          panelA: pA.panelId,
          panelB: pB.panelId,
          faceA: pA.face,
          faceB: pB.face,
          sharedBoundaryLength: maxOverlap,
          boundaryType: matchingCrease ? 'CREASE' : 'PANEL_BOUNDARY',
          hasExplicitCreaseLine: Boolean(matchingCrease),
          hingeGeometry: sharedHinge,
          sourceEdgeIds: matchingCrease?.geometryId ? [matchingCrease.geometryId] : [],
          verificationState: edgeVerification
        });
      }
    }
  }

  // 4. Graph validation (connected components)
  const adjacency = new Map();
  for (const n of nodes) adjacency.set(n.panelId, []);
  for (const e of edges) {
    adjacency.get(e.panelA)?.push(e.panelB);
    adjacency.get(e.panelB)?.push(e.panelA);
  }

  const visited = new Set();
  let componentCount = 0;

  for (const n of nodes) {
    if (!visited.has(n.panelId)) {
      componentCount++;
      const queue = [n.panelId];
      visited.add(n.panelId);

      while (queue.length > 0) {
        const curr = queue.shift();
        const neighbors = adjacency.get(curr) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  if (componentCount > 1) {
    warnings.push(`Dieline consists of ${componentCount} disconnected panel groups. Some flaps or panels lack verified crease connections.`);
  }

  // Limitation statement: physical folding requires caliper, collision analysis, etc.
  const physicalLimitations = [
    'Graph connectivity verifies 2D crease topology only.',
    'Physical 3D foldability additionally requires board caliper, fold direction, flap tuck clearances, and collision analysis.'
  ];

  return {
    nodes,
    edges,
    componentCount,
    isFullyConnected: componentCount === 1 && nodes.length > 0,
    warnings,
    limitations: physicalLimitations
  };
}
