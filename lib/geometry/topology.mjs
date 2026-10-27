/**
 * PackSignal Packaging Geometry — Topology & Closed Polygon Boundary Detection
 * (lib/geometry/topology.mjs)
 *
 * Implements Step 5: Closed panel polygon detection pipeline.
 * Extracts closed planar faces from structural edges with endpoint snapping.
 */

import { validatePolygon, cleanPolygonVertices } from './polygons.mjs';
import { pointDistance, segmentLength } from './segments.mjs';

/**
 * Snaps vertices that are within snapTolerance of each other to a canonical vertex.
 */
export function snapVertices(segments, snapTolerance = 1e-4) {
  const canonicalVertices = [];

  function getCanonical(pt) {
    for (const cv of canonicalVertices) {
      if (pointDistance(pt, cv) <= snapTolerance) {
        return cv;
      }
    }
    const newVertex = [Math.round(pt[0] * 1e8) / 1e8, Math.round(pt[1] * 1e8) / 1e8];
    canonicalVertices.push(newVertex);
    return newVertex;
  }

  const snappedSegments = [];
  for (const seg of segments) {
    if (!Array.isArray(seg?.points) || seg.points.length < 2) continue;
    const p1 = getCanonical(seg.points[0]);
    const p2 = getCanonical(seg.points[1]);
    if (pointDistance(p1, p2) > snapTolerance) {
      snappedSegments.push({
        ...seg,
        points: [p1, p2]
      });
    }
  }

  return { snappedSegments, canonicalVertices };
}

/**
 * Finds closed polygon boundaries from connected planar line segments.
 * Uses angular sort (counter-clockwise cycle finding / leftmost turn) to extract minimal faces.
 */
export function extractClosedPolygonsFromSegments(segments, options = {}) {
  const snapTolerance = options.snapTolerance ?? 1e-4;
  const minArea = options.minArea ?? 1e-5;

  const { snappedSegments } = snapVertices(segments, snapTolerance);

  // Build directed half-edges
  // For each vertex key "x,y", list outgoing edges with their polar angle
  const vertexKey = pt => `${pt[0].toFixed(8)},${pt[1].toFixed(8)}`;
  const adjacency = new Map(); // key -> list of { toKey, toPt, angle, edgeId, originalSeg }

  let nextEdgeId = 0;
  for (const seg of snappedSegments) {
    const p1 = seg.points[0];
    const p2 = seg.points[1];
    const k1 = vertexKey(p1);
    const k2 = vertexKey(p2);

    const a12 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const a21 = Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);

    if (!adjacency.has(k1)) adjacency.set(k1, []);
    if (!adjacency.has(k2)) adjacency.set(k2, []);

    adjacency.get(k1).push({
      id: nextEdgeId++,
      fromKey: k1,
      fromPt: p1,
      toKey: k2,
      toPt: p2,
      angle: a12,
      seg
    });

    adjacency.get(k2).push({
      id: nextEdgeId++,
      fromKey: k2,
      fromPt: p2,
      toKey: k1,
      toPt: p1,
      angle: a21,
      seg
    });
  }

  // Sort outgoing edges at each vertex in counter-clockwise order (ascending angle)
  for (const [, edges] of adjacency.entries()) {
    edges.sort((a, b) => a.angle - b.angle);
  }

  // Next-edge lookup for planar face traversal:
  // When arriving at vertex V via directed edge E (which has incoming angle A_in),
  // the next edge on the left face is the edge whose outgoing angle is immediately CCW
  // from the reverse of E (A_rev = A_in + PI).
  const visitedHalfEdges = new Set();
  const rawPolygons = [];

  for (const [, edges] of adjacency.entries()) {
    for (const startEdge of edges) {
      if (visitedHalfEdges.has(startEdge.id)) continue;

      const cyclePoints = [];
      const cycleEdgeIds = [];
      let currentEdge = startEdge;
      let isClosed = false;

      // Max search depth to prevent infinite loops on non-planar or disconnected graphs
      for (let step = 0; step < 500; step++) {
        visitedHalfEdges.add(currentEdge.id);
        cyclePoints.push(currentEdge.fromPt);
        cycleEdgeIds.push(currentEdge.id);

        const nextVertexKey = currentEdge.toKey;
        if (nextVertexKey === startEdge.fromKey) {
          isClosed = true;
          break;
        }

        const outgoing = adjacency.get(nextVertexKey) || [];
        if (outgoing.length === 0) break;

        // Angle of incoming direction reversed:
        const incomingRevAngle = currentEdge.angle > 0
          ? currentEdge.angle - Math.PI
          : currentEdge.angle + Math.PI;

        // Find the edge that is immediately CCW from incomingRevAngle
        let nextIdx = -1;
        for (let i = 0; i < outgoing.length; i++) {
          if (outgoing[i].angle > incomingRevAngle) {
            nextIdx = i;
            break;
          }
        }
        if (nextIdx === -1) nextIdx = 0; // Wrap around

        currentEdge = outgoing[nextIdx];
        if (visitedHalfEdges.has(currentEdge.id)) {
          break; // Cycle intersected already visited path
        }
      }

      if (isClosed && cyclePoints.length >= 3) {
        rawPolygons.push({
          points: cyclePoints,
          edgeIds: cycleEdgeIds
        });
      }
    }
  }

  // Validate extracted polygons and filter out the exterior infinite face (negative area)
  // or duplicate / degenerate faces
  const validPolygons = [];
  for (const raw of rawPolygons) {
    const val = validatePolygon(raw.points, { minArea, snapTolerance });
    // Keep positive signed area (interior CCW faces)
    // If area is valid, include
    if (val.valid && val.area >= minArea) {
      // Check for duplicate boundary (same bounding box and area)
      const isDuplicate = validPolygons.some(p =>
        Math.abs(p.area - val.area) < 1e-6 &&
        Math.abs(p.boundingBox[0] - val.boundingBox[0]) < 1e-4 &&
        Math.abs(p.boundingBox[1] - val.boundingBox[1]) < 1e-4
      );

      if (!isDuplicate) {
        validPolygons.push({
          polygonId: `poly_${validPolygons.length + 1}`,
          points: val.points,
          area: val.area,
          perimeter: val.perimeter,
          boundingBox: val.boundingBox,
          closed: true,
          valid: true,
          limitations: val.limitations
        });
      }
    }
  }

  return validPolygons;
}
