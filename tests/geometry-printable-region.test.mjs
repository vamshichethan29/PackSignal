import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePrintableRegion,
  computeUsableConnectedSpace
} from '../lib/geometry/printable-regions.mjs';

test('1. Printable region inset from panel polygon with cut and crease setbacks', () => {
  const panelPolygon = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const res = computePrintableRegion({
    panelPolygon,
    cutSetbackMm: 2,
    creaseSetbackMm: 1.5
  });

  assert.equal(res.status, 'VALID');
  assert.ok(res.safePolygon);
  assert.ok(res.safePolygon.length >= 4);
  // Bounding box should be inset by setback
  const [minX, minY, maxX, maxY] = res.safeBoundingBox;
  assert.ok(minX >= 2);
  assert.ok(minY >= 2);
  assert.ok(maxX <= 98);
  assert.ok(maxY <= 98);
});

test('2. Glue exclusion zone reduces available printable area', () => {
  const panelPolygon = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const glueZone = {
    polygon: [[0, 0], [20, 0], [20, 100], [0, 100]], // 20mm glue flap edge
    classification: 'GLUE'
  };

  const res = computePrintableRegion({
    panelPolygon,
    cutSetbackMm: 1,
    creaseSetbackMm: 1,
    exclusionZones: [glueZone]
  });

  assert.equal(res.status, 'VALID');
  assert.equal(res.exclusionZonesApplied, 1);
  // Usable area must be strictly less than the full inset box
  assert.ok(res.safeBoundingBox[0] >= 1);
});

test('3. Usable connected space calculation avoids fragmented obstacle areas', () => {
  const safeBox = [0, 0, 100, 100];
  const obstacles = [
    { box: [30, 0, 70, 100] } // Bisects the box into left [0, 30] and right [70, 100]
  ];

  const usable = computeUsableConnectedSpace(safeBox, obstacles);
  assert.ok(usable);
  // The max connected width is 30, not 100 - 40 = 60
  assert.ok(usable.maxWidth <= 30);
  assert.equal(usable.isFragmented, true);
});

test('4. Inset collapses degenerate small panel to UNABLE_TO_EVALUATE', () => {
  const smallPolygon = [[0, 0], [2, 0], [2, 2], [0, 2]]; // 2mm x 2mm
  const res = computePrintableRegion({
    panelPolygon: smallPolygon,
    cutSetbackMm: 2, // 2mm setback collapses 2mm panel
    creaseSetbackMm: 2
  });

  assert.equal(res.status, 'UNABLE_TO_EVALUATE');
  assert.ok(res.limitations.length > 0);
});
