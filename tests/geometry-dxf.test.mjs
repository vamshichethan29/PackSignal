import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStructuralSegment,
  filterTrustedStructuralSegments,
  STRUCTURAL_CLASSIFICATIONS
} from '../lib/geometry/segments.mjs';
import { toMillimeters, normalizeUnitName, isPhysicalUnit } from '../lib/geometry/units.mjs';
import { extractClosedPolygonsFromSegments } from '../lib/geometry/topology.mjs';

test('1. DXF structural layer classification: CUT, CREASE, GLUE, BLEED', () => {
  const cutSeg = classifyStructuralSegment({ layer: 'CUT_OUTLINE', points: [[0, 0], [100, 0]] });
  assert.equal(cutSeg.structuralClassification, STRUCTURAL_CLASSIFICATIONS.CUT);

  const creaseSeg = classifyStructuralSegment({ layer: 'SCORE_CREASE_LINES', points: [[0, 0], [100, 0]] });
  assert.equal(creaseSeg.structuralClassification, STRUCTURAL_CLASSIFICATIONS.CREASE);

  const glueSeg = classifyStructuralSegment({ layer: 'GLUE_TAB_AREA', points: [[0, 0], [100, 0]] });
  assert.equal(glueSeg.structuralClassification, STRUCTURAL_CLASSIFICATIONS.GLUE);

  const bleedSeg = classifyStructuralSegment({ layer: 'BLEED_MARGIN', points: [[0, 0], [100, 0]] });
  assert.equal(bleedSeg.structuralClassification, STRUCTURAL_CLASSIFICATIONS.BLEED_GUIDE);

  const unknownSeg = classifyStructuralSegment({ layer: 'DIM_MISC_0', points: [[0, 0], [100, 0]] });
  assert.equal(unknownSeg.structuralClassification, STRUCTURAL_CLASSIFICATIONS.UNKNOWN);
});

test('2. Physical unit conversion from DXF units', () => {
  // Millimeters
  assert.equal(toMillimeters(100, 'mm').value, 100);
  assert.equal(toMillimeters(100, 'millimeters').value, 100);

  // Inches
  assert.equal(toMillimeters(2, 'in').value, 50.8);
  assert.equal(toMillimeters(1, 'inches').value, 25.4);

  // Points
  assert.equal(toMillimeters(72, 'pt').value, 25.4);

  // Unverified/unspecified unit
  assert.equal(toMillimeters(100, 'unspecified').ok, false);
  assert.equal(toMillimeters(100, null).ok, false);
  assert.equal(isPhysicalUnit('pixel'), false);
  assert.equal(isPhysicalUnit('normalized'), false);
  assert.equal(isPhysicalUnit('mm'), true);
});

test('3. DXF segments snap endpoints within tolerance to form closed polygons', () => {
  // 4 segments with a 0.05 gap at corners
  const tolerance = 0.5;
  const segments = [
    { points: [[0, 0], [99.98, 0]], layer: 'CUT' },
    { points: [[100.02, 0], [100, 49.95]], layer: 'CUT' },
    { points: [[100, 50.04], [0.03, 50]], layer: 'CUT' },
    { points: [[0, 49.97], [0, 0.02]], layer: 'CUT' }
  ];

  const polys = extractClosedPolygonsFromSegments(segments, { snapTolerance: tolerance });
  assert.equal(polys.length, 1, 'Should close boundary after vertex snapping');
  assert.equal(polys[0].points.length, 4);
});
