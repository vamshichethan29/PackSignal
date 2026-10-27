import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chainSegmentsIntoPolygons,
  inferCartonPanels,
  pointInPolygon,
  computePolygonArea,
} from '../lib/geometry/panel-inference.mjs';
import { FoldGraph, buildFoldGraphFromPanels } from '../lib/geometry/fold-graph.mjs';
import { screenLayoutFit } from '../lib/geometry/layout-fit.mjs';

test('chainSegmentsIntoPolygons assembles closed rectangular polygon and rejects open lines', () => {
  // Rectangle 100x200
  const closedSegments = [
    { p1: [0, 0], p2: [100, 0] },
    { p1: [100, 0], p2: [100, 200] },
    { p1: [100, 200], p2: [0, 200] },
    { p1: [0, 200], p2: [0, 0] },
  ];

  const polys = chainSegmentsIntoPolygons(closedSegments);
  assert.equal(polys.length, 1);
  assert.equal(computePolygonArea(polys[0]), 20000);

  // Open segments
  const openSegments = [
    { p1: [0, 0], p2: [100, 0] },
    { p1: [100, 0], p2: [100, 200] },
  ];
  const openPolys = chainSegmentsIntoPolygons(openSegments);
  assert.equal(openPolys.length, 0);
});

test('inferCartonPanels associates text labels with containing polygons', () => {
  const polyFront = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const polyBack = [[100, 0], [200, 0], [200, 100], [100, 100]];

  const labels = [
    { text: 'Front Panel', box: [40, 40, 60, 60] },
    { text: 'Back Panel', box: [140, 40, 160, 60] },
  ];

  const result = inferCartonPanels({
    polygons: [polyFront, polyBack],
    labels,
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.mainPanelsCount, 2);
  const front = result.panels.find(p => p.name === 'front');
  const back = result.panels.find(p => p.name === 'back');
  assert.ok(front);
  assert.ok(back);
  assert.equal(front.mappingStatus, 'INFERRED_CONFIRMED');
});

test('buildFoldGraphFromPanels constructs validated connectivity graph across shared crease lines', () => {
  const panelA = {
    name: 'front',
    polygon: [[0, 0], [100, 0], [100, 200], [0, 200]],
  };
  const panelB = {
    name: 'left',
    polygon: [[100, 0], [150, 0], [150, 200], [100, 200]],
  };

  const graph = buildFoldGraphFromPanels([panelA, panelB]);
  assert.equal(graph.areAdjacent('front', 'left'), true);
  assert.equal(graph.getNeighbors('front').includes('left'), true);

  const shared = graph.getSharedEdge('front', 'left');
  assert.ok(shared);
  assert.equal(shared.hingeAxis, 'vertical');

  const validation = graph.validateConsistency();
  assert.equal(validation.isValid, true);
  assert.equal(validation.isConnected, true);
});

test('screenLayoutFit warns when text violates trim clearance or overflows panel', () => {
  const panels = [
    {
      name: 'front',
      polygon: [[0, 0], [100, 0], [100, 100], [0, 100]],
      bbox: [0, 0, 100, 100],
    },
  ];

  const textSpans = [
    { text: 'Safe Text', boxPt: [40, 40, 60, 50] },
    { text: 'Too Close to Cut', boxPt: [98, 40, 102, 50] },
  ];

  const cutSegments = [
    { p1: [100, 0], p2: [100, 100], type: 'cut' },
  ];

  const result = screenLayoutFit({
    textSpans,
    panels,
    boundarySegments: cutSegments,
    minClearanceMm: 1.5,
  });

  assert.equal(result.hasRisks, true);
  const clearanceWarn = result.warnings.find(w => w.type === 'INSUFFICIENT_CLEARANCE');
  assert.ok(clearanceWarn);
  assert.equal(clearanceWarn.text, 'Too Close to Cut');
  assert.equal(clearanceWarn.boundaryType, 'cut');
});
