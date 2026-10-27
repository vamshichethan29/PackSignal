import test from 'node:test';
import assert from 'node:assert/strict';
import {
  polygonArea,
  polygonPerimeter,
  pointInPolygon,
  validatePolygon,
  isPolygonSelfIntersecting,
  isPolygonContained,
  boxPolygonIntersection
} from '../lib/geometry/polygons.mjs';
import { snapVertices, extractClosedPolygonsFromSegments } from '../lib/geometry/topology.mjs';
import { toMillimeters, normalizeUnitName, isPhysicalUnit } from '../lib/geometry/units.mjs';
import { transformPolygon, createRotationMatrix, createScaleMatrix } from '../lib/geometry/coordinates.mjs';

test('1. Valid closed rectangular panel computes correct area, bounds, and containment', () => {
  const rect = [[0, 0], [100, 0], [100, 200], [0, 200]];
  const val = validatePolygon(rect);
  assert.equal(val.valid, true);
  assert.equal(val.closed, true);
  assert.equal(val.area, 20000);
  assert.equal(val.perimeter, 600);
  assert.deepEqual(val.boundingBox, [0, 0, 100, 200]);
  assert.equal(pointInPolygon([50, 100], rect), true);
  assert.equal(pointInPolygon([150, 100], rect), false);
});

test('2. Valid nonrectangular panel (L-shape / tuck flap) topology and containment', () => {
  // L-shaped panel polygon
  const lShape = [
    [0, 0],
    [100, 0],
    [100, 50],
    [50, 50],
    [50, 100],
    [0, 100]
  ];
  const val = validatePolygon(lShape);
  assert.equal(val.valid, true);
  assert.equal(val.area, 7500); // 100*50 + 50*50 = 7500
  assert.equal(pointInPolygon([25, 25], lShape), true);
  assert.equal(pointInPolygon([25, 75], lShape), true);
  assert.equal(pointInPolygon([75, 75], lShape), false); // in cutout
});

test('3. Open polyline rejected as closed polygon', () => {
  const openPoly = [[0, 0], [100, 0], [100, 100]]; // only 2 segments, not closed
  const segments = [
    { points: [[0, 0], [100, 0]] },
    { points: [[100, 0], [100, 100]] }
  ];
  const polys = extractClosedPolygonsFromSegments(segments);
  assert.equal(polys.length, 0, 'Open polyline segments must not form closed panels');
});

test('4. Self-intersecting polygon is detected and rejected', () => {
  // Bowtie / figure-8 polygon
  const bowtie = [[0, 0], [100, 100], [100, 0], [0, 100]];
  const isSelf = isPolygonSelfIntersecting(bowtie);
  assert.equal(isSelf, true);
  const val = validatePolygon(bowtie);
  assert.equal(val.valid, false);
  assert.ok(val.limitations.some(l => l.includes('self-intersecting')));
});

test('5. Duplicate boundary detection suppresses identical overlapping faces', () => {
  const segments = [
    { points: [[0, 0], [50, 0]] },
    { points: [[50, 0], [50, 50]] },
    { points: [[50, 50], [0, 50]] },
    { points: [[0, 50], [0, 0]] },
    // Duplicate segments
    { points: [[0, 0], [50, 0]] },
    { points: [[50, 0], [50, 50]] },
    { points: [[50, 50], [0, 50]] },
    { points: [[0, 50], [0, 0]] }
  ];
  const polys = extractClosedPolygonsFromSegments(segments);
  assert.equal(polys.length, 1, 'Duplicate planar boundary must be deduplicated to exactly 1 panel');
});

test('6. Endpoint snapping tolerance heals gaps between adjacent dieline lines', () => {
  const gapSegments = [
    { points: [[0, 0], [100.0005, 0]] },
    { points: [[100.0, 0], [100.0, 100.0]] },
    { points: [[100.0, 100.0], [0, 100.0]] },
    { points: [[0, 100.0], [0, 0.0004]] }
  ];
  const { snappedSegments } = snapVertices(gapSegments, 1e-3);
  assert.equal(snappedSegments.length, 4);
  const polys = extractClosedPolygonsFromSegments(gapSegments, { snapTolerance: 1e-3 });
  assert.equal(polys.length, 1);
  assert.equal(polys[0].closed, true);
});

test('7. Physical unit conversion handles inches and millimeters accurately', () => {
  const mm = toMillimeters(10, 'inches');
  assert.equal(mm.ok, true);
  assert.equal(mm.value, 254.0);

  const pt = toMillimeters(72, 'points');
  assert.equal(pt.ok, true);
  assert.equal(pt.value, 25.4);
});

test('8. Missing or unknown physical units return UNIT_UNVERIFIED without guessing', () => {
  const unk = toMillimeters(100, 'drawing_units');
  assert.equal(unk.ok, false);
  assert.equal(unk.error, 'UNIT_UNVERIFIED');
  assert.equal(unk.value, null);
});

test('26. Rotated coordinate transform rotates polygon vertices correctly', () => {
  const poly = [[0, 0], [10, 0], [10, 20], [0, 20]];
  const rot90 = createRotationMatrix(Math.PI / 2);
  const rotated = transformPolygon(poly, rot90);
  // (x, y) rotated 90 deg CCW -> (-y, x)
  assert.ok(Math.abs(rotated[1][0] - 0) < 1e-6);
  assert.ok(Math.abs(rotated[1][1] - 10) < 1e-6);
});

test('27. Nonuniform scaling limitation correctly transforms rectangular bounds', () => {
  const poly = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const scaleNonUniform = createScaleMatrix(2.0, 0.5);
  const scaled = transformPolygon(poly, scaleNonUniform);
  assert.equal(polygonArea(scaled), 100); // 20 * 5 = 100
  assert.deepEqual(scaled[2], [20, 5]);
});
