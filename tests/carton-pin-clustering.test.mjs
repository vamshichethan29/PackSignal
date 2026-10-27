import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterProjectedPins,
  calculateSpiderfyPositions,
  resolveClusterExpansionMode,
} from '../public/carton-pin-clustering.js';

test('7. Overlapping pins within threshold cluster into a single count badge', () => {
  const pins = [
    { pinId: 'p1', findingId: 'f1', panelId: 'front', screenX: 200, screenY: 150, status: 'issue', visible: true },
    { pinId: 'p2', findingId: 'f2', panelId: 'front', screenX: 205, screenY: 152, status: 'review', visible: true },
    { pinId: 'p3', findingId: 'f3', panelId: 'front', screenX: 198, screenY: 148, status: 'match', visible: true },
  ];

  const { clusters, standalonePins } = clusterProjectedPins(pins, { distanceThreshold: 30 });
  assert.equal(clusters.length, 1);
  assert.equal(standalonePins.length, 0);
  assert.equal(clusters[0].count, 3);
  assert.equal(clusters[0].panelId, 'front');
});

test('8. Separated pins beyond threshold remain independent standalone badges', () => {
  const pins = [
    { pinId: 'p1', findingId: 'f1', panelId: 'front', screenX: 100, screenY: 100, status: 'issue', visible: true },
    { pinId: 'p2', findingId: 'f2', panelId: 'front', screenX: 250, screenY: 300, status: 'review', visible: true },
  ];

  const { clusters, standalonePins } = clusterProjectedPins(pins, { distanceThreshold: 30 });
  assert.equal(clusters.length, 0);
  assert.equal(standalonePins.length, 2);
  assert.equal(standalonePins[0].pin.pinId, 'p1');
  assert.equal(standalonePins[1].pin.pinId, 'p2');
});

test('9. Different carton faces do NOT form misleading clusters even if screen projections overlap', () => {
  const pins = [
    { pinId: 'p-front', findingId: 'f1', panelId: 'front', screenX: 200, screenY: 150, status: 'issue', visible: true },
    { pinId: 'p-right', findingId: 'f2', panelId: 'right', screenX: 202, screenY: 151, status: 'review', visible: true },
  ];

  const { clusters, standalonePins } = clusterProjectedPins(pins, { distanceThreshold: 30 });
  assert.equal(clusters.length, 0, 'Pins from different faces must never be merged into one cluster');
  assert.equal(standalonePins.length, 2);
});

test('10. Cluster count equals the exact number of member finding IDs', () => {
  const pins = [
    { pinId: 'p1', findingId: 'f1', panelId: 'back', screenX: 150, screenY: 120, status: 'issue', visible: true },
    { pinId: 'p2', findingId: 'f2', panelId: 'back', screenX: 155, screenY: 125, status: 'issue', visible: true },
    { pinId: 'p3', findingId: 'f3', panelId: 'back', screenX: 148, screenY: 118, status: 'review', visible: true },
    { pinId: 'p4', findingId: 'f4', panelId: 'back', screenX: 160, screenY: 130, status: 'match', visible: true },
  ];

  const { clusters } = clusterProjectedPins(pins, { distanceThreshold: 30 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 4);
  assert.equal(clusters[0].pins.length, 4);
  assert.deepEqual(
    clusters[0].pins.map(p => p.findingId).sort(),
    ['f1', 'f2', 'f3', 'f4']
  );
});

test('11. Cluster priority correctly reflects underlying statuses (ISSUE > REVIEW > MATCH)', () => {
  // Scenario A: 4 issues, 3 review, 2 matches -> highest status is ISSUE
  const pinsMixed = [
    { pinId: 'p1', findingId: 'f1', panelId: 'front', screenX: 200, screenY: 150, status: 'match', visible: true },
    { pinId: 'p2', findingId: 'f2', panelId: 'front', screenX: 202, screenY: 151, status: 'review', visible: true },
    { pinId: 'p3', findingId: 'f3', panelId: 'front', screenX: 204, screenY: 152, status: 'issue', visible: true },
  ];
  const { clusters: cA } = clusterProjectedPins(pinsMixed, { distanceThreshold: 30 });
  assert.equal(cA[0].status, 'issue');
  assert.equal(cA[0].breakdown.issue, 1);
  assert.equal(cA[0].breakdown.review, 1);
  assert.equal(cA[0].breakdown.match, 1);

  // Scenario B: Only Review + Matches -> highest status is REVIEW
  const pinsReview = [
    { pinId: 'p4', findingId: 'f4', panelId: 'front', screenX: 200, screenY: 150, status: 'match', visible: true },
    { pinId: 'p5', findingId: 'f5', panelId: 'front', screenX: 202, screenY: 151, status: 'review', visible: true },
  ];
  const { clusters: cB } = clusterProjectedPins(pinsReview, { distanceThreshold: 30 });
  assert.equal(cB[0].status, 'review');

  // Scenario C: Only Matches -> status is MATCH
  const pinsMatch = [
    { pinId: 'p6', findingId: 'f6', panelId: 'front', screenX: 200, screenY: 150, status: 'match', visible: true },
    { pinId: 'p7', findingId: 'f7', panelId: 'front', screenX: 202, screenY: 151, status: 'match', visible: true },
  ];
  const { clusters: cC } = clusterProjectedPins(pinsMatch, { distanceThreshold: 30 });
  assert.equal(cC[0].status, 'match');
});

test('12. Cluster expansion preserves all original finding records', () => {
  const pins = [
    { pinId: 'p1', findingId: 'f1', panelId: 'left', screenX: 180, screenY: 140, status: 'issue', visible: true },
    { pinId: 'p2', findingId: 'f2', panelId: 'left', screenX: 185, screenY: 145, status: 'review', visible: true },
  ];

  const { clusters } = clusterProjectedPins(pins, { distanceThreshold: 30 });
  const expanded = calculateSpiderfyPositions(clusters[0], { width: 500, height: 400 });

  assert.equal(expanded.length, 2);
  assert.equal(expanded[0].pin.pinId, 'p1');
  assert.equal(expanded[1].pin.pinId, 'p2');
});

test('13. Cluster expansion is deterministic across repeated calls', () => {
  const cluster = {
    screenX: 250,
    screenY: 200,
    pins: [
      { pinId: 'p1', status: 'issue' },
      { pinId: 'p2', status: 'review' },
      { pinId: 'p3', status: 'match' },
    ],
  };

  const exp1 = calculateSpiderfyPositions(cluster, { width: 600, height: 400 });
  const exp2 = calculateSpiderfyPositions(cluster, { width: 600, height: 400 });

  assert.deepEqual(exp1, exp2);
  // Verify positions are displaced from center (first pin is at top: x = 250, y = 200 - radius)
  assert.notEqual(exp1[0].y, 200);
  assert.notEqual(exp1[1].x, 250);
});

test('14. Mobile cluster fallback selects list popover mode when screen is constrained or count > 8', () => {
  // Desktop wide screen, small cluster -> spiderfy
  assert.equal(resolveClusterExpansionMode(4, { width: 600, height: 450 }), 'spiderfy');

  // Mobile small screen -> popover
  assert.equal(resolveClusterExpansionMode(3, { width: 360, height: 300 }), 'popover');

  // Large count (>8 findings) even on desktop -> popover
  assert.equal(resolveClusterExpansionMode(10, { width: 800, height: 600 }), 'popover');
});
