import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStructuralEdge, sharedSegmentOverlap } from '../lib/geometry/segments.mjs';
import { buildFoldGraph, FoldGraph } from '../lib/geometry/fold-graph.mjs';
import { STRUCTURAL_CLASSIFICATIONS } from '../lib/geometry/model.mjs';

test('15. Valid cut line classification by explicit layer tokens', () => {
  assert.equal(classifyStructuralEdge('Die_Cut_Layer', ''), STRUCTURAL_CLASSIFICATIONS.CUT);
  assert.equal(classifyStructuralEdge('CUTTING', ''), STRUCTURAL_CLASSIFICATIONS.CUT);
  assert.equal(classifyStructuralEdge('thrucut', ''), STRUCTURAL_CLASSIFICATIONS.CUT);
});

test('16. Valid crease line classification by explicit layer tokens', () => {
  assert.equal(classifyStructuralEdge('Crease_Score', ''), STRUCTURAL_CLASSIFICATIONS.CREASE);
  assert.equal(classifyStructuralEdge('FOLD_INTERNAL', ''), STRUCTURAL_CLASSIFICATIONS.CREASE);
  assert.equal(classifyStructuralEdge('Perforation', ''), STRUCTURAL_CLASSIFICATIONS.CREASE);
});

test('17. Unknown structural line without semantic keywords is classified as UNKNOWN', () => {
  assert.equal(classifyStructuralEdge('Layer0', ''), STRUCTURAL_CLASSIFICATIONS.UNKNOWN);
  assert.equal(classifyStructuralEdge('RED_OUTLINE', ''), STRUCTURAL_CLASSIFICATIONS.UNKNOWN);
});

test('18. Trusted glue polygon recognized from explicit layer', () => {
  assert.equal(classifyStructuralEdge('GLUE_TAB_FLAP', ''), STRUCTURAL_CLASSIFICATIONS.GLUE);
});

test('19. Glue area absent when layer is not explicitly designated as glue', () => {
  assert.equal(classifyStructuralEdge('TUCK_FLAP', ''), STRUCTURAL_CLASSIFICATIONS.UNKNOWN);
});

test('20. Shared-edge fold adjacency identifies genuine crease connection', () => {
  const panelFront = {
    panelId: 'front',
    face: 'front',
    polygon: [[0, 0], [100, 0], [100, 200], [0, 200]]
  };
  const panelRight = {
    panelId: 'right',
    face: 'right',
    polygon: [[100, 0], [150, 0], [150, 200], [100, 200]]
  };
  const crease = {
    points: [[100, 0], [100, 200]],
    structuralClassification: STRUCTURAL_CLASSIFICATIONS.CREASE,
    kind: 'crease'
  };

  const graph = buildFoldGraph({
    panels: [panelFront, panelRight],
    structuralSegments: [crease],
    tolerance: 1e-3,
    minSharedLength: 1e-3
  });

  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].boundaryType, 'CREASE');
  assert.equal(graph.edges[0].hasExplicitCreaseLine, true);
  assert.equal(graph.isFullyConnected, true);
});

test('21. Corner-touching panels are NOT fold adjacent (no shared edge length)', () => {
  // Two squares touching at exactly one point (100, 100)
  const panelA = {
    panelId: 'pA',
    face: 'pA',
    polygon: [[0, 0], [100, 0], [100, 100], [0, 100]]
  };
  const panelB = {
    panelId: 'pB',
    face: 'pB',
    polygon: [[100, 100], [200, 100], [200, 200], [100, 200]]
  };

  const graph = buildFoldGraph({
    panels: [panelA, panelB],
    structuralSegments: [],
    tolerance: 1e-3,
    minSharedLength: 1e-3
  });

  assert.equal(graph.edges.length, 0, 'Touching only at a single corner must NOT create a fold hinge edge');
});

test('22. Disconnected fold graph detected when panels are separated or unhinged', () => {
  const panel1 = {
    panelId: 'p1',
    face: 'front',
    polygon: [[0, 0], [50, 0], [50, 50], [0, 50]]
  };
  const panel2 = {
    panelId: 'p2',
    face: 'back',
    polygon: [[200, 200], [250, 200], [250, 250], [200, 250]]
  };

  const graph = buildFoldGraph({
    panels: [panel1, panel2],
    structuralSegments: [],
    minSharedLength: 1e-3
  });

  assert.equal(graph.isFullyConnected, false);
  assert.equal(graph.componentCount, 2);
  assert.ok(graph.warnings.some(w => w.includes('disconnected panel groups')));
});

test('23. FoldGraph class queries adjacency, neighbors and shared hinge axis', () => {
  const fg = new FoldGraph({
    nodes: [{ panelId: 'front' }, { panelId: 'top' }],
    edges: [{
      panelA: 'front',
      panelB: 'top',
      faceA: 'front',
      faceB: 'top',
      boundaryType: 'CREASE',
      sharedBoundaryLength: 100,
      hingeGeometry: [[0, 0], [100, 0]] // horizontal crease
    }],
    componentCount: 1,
    isFullyConnected: true
  });

  assert.equal(fg.areAdjacent('front', 'top'), true);
  assert.equal(fg.areAdjacent('front', 'bottom'), false);
  assert.deepEqual(fg.getNeighbors('front'), ['top']);
  const hinge = fg.getSharedEdge('front', 'top');
  assert.equal(hinge.hingeAxis, 'horizontal');
});
