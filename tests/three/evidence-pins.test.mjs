import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapArtworkPointToPanel,
  buildHingeTree,
  calculateFoldTransforms,
} from '../../public/three/fold-engine.js';
import { PIN_COLORS } from '../../public/three/evidence-pins.js';

test('status colors match required PackSignal prepress conventions', () => {
  assert.equal(PIN_COLORS.issue, 0xd84030, 'Issue pin must be Red');
  assert.equal(PIN_COLORS.review, 0xd48816, 'Review pin must be Amber');
  assert.equal(PIN_COLORS.match, 0x2e7d32, 'Match pin must be Green');
  assert.equal(PIN_COLORS.unable, 0x757575, 'Unable pin must be Gray');
});

test('pin coordinate mapping places defect pins inside confirmed panel boundaries', () => {
  const panelZone = { page: 1, box: [0.05, 0.1, 0.45, 0.9] }; // width = 0.4, height = 0.8
  const panelDimensions = { width: 60, height: 120 };

  // Finding evidence at center of panel: [0.25, 0.5]
  const mapped = mapArtworkPointToPanel([0.25, 0.5], panelZone, panelDimensions);
  assert.equal(mapped.inside, true);
  assert.ok(Math.abs(mapped.u - 0.5) < 1e-4);
  assert.ok(Math.abs(mapped.v - 0.5) < 1e-4);
  assert.deepEqual(mapped.localPoint, [0, 0, 0.5]);
});

test('findings without valid artwork locations do not receive fake 3D pins', () => {
  const panelZone = { page: 1, box: [0.05, 0.1, 0.45, 0.9] };
  const panelDimensions = { width: 60, height: 120 };

  // Null coordinate
  assert.equal(mapArtworkPointToPanel(null, panelZone, panelDimensions), null);

  // Missing box
  assert.equal(mapArtworkPointToPanel([0.2, 0.3], null, panelDimensions), null);

  // Far outside panel boundary [0.9, 0.02]
  const outside = mapArtworkPointToPanel([0.9, 0.02], panelZone, panelDimensions);
  assert.equal(outside.inside, false);
});

test('pin position transforms rigidly with panel geometry across 0% to 100% fold progress', () => {
  const tree = buildHingeTree({ dimensions: { width: 50, height: 100, depth: 30 } });
  const panelZone = { page: 1, box: [0.0, 0.0, 1.0, 1.0] };
  const frontDims = tree.panels.front;

  // Pin on front panel at local [10, 20, 0.5]
  const localPin = [10, 20, 0.5];

  // At 0% flat state
  const transforms0 = calculateFoldTransforms(tree, 0);
  const worldPin0 = transforms0.front.transformPoint(localPin);

  // At 100% folded state
  const transforms1 = calculateFoldTransforms(tree, 1);
  const worldPin1 = transforms1.front.transformPoint(localPin);

  // In flat state, front center is shifted to center dieline, Z is near 0
  assert.ok(Math.abs(worldPin0[2] - 0.5) < 1e-3);

  // In 100% state, front is at Z = +15, so pin at Z = 15 + 0.5 = 15.5
  assert.ok(Math.abs(worldPin1[0] - 10) < 1e-3);
  assert.ok(Math.abs(worldPin1[1] - 20) < 1e-3);
  assert.ok(Math.abs(worldPin1[2] - 15.5) < 1e-3);
});
