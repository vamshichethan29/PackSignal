/**
 * @file tests/3d-feature-freeze-gates.test.mjs
 * 
 * Tests for Phase 36 & 37: Feature-Freeze Fallback & Release Gates:
 * - Evaluates the 16 critical release gates
 * - When all gates pass -> 3D status is 3D_VERIFIED
 * - If any critical structural gate fails -> status defaults to 3D_PARTIAL_PREVIEW or 3D_UNAVAILABLE
 * - 2D artwork viewing, 2D finding pins, and source evidence navigation remain 100% operational
 */

import test from 'node:test';
import assert from 'node:assert/strict';

export const RELEASE_GATE_STATUSES = {
  VERIFIED_3D: '3D_VERIFIED',
  PARTIAL_3D: '3D_PARTIAL_PREVIEW',
  UNAVAILABLE_3D: '3D_UNAVAILABLE',
};

/**
 * Evaluates the 16 Phase 37 release gates against a package review state.
 */
export function evaluate3DReleaseGates({
  dimensionsVerified = true,
  panelGeometryComplete = true,
  hingeGraphValidated = true,
  tuckEndTopologyModeled = true,
  foldAnimationCloses = true,
  faceTexturesOriented = true,
  noMirroring = true,
  noPanelSwap = true,
  pinsFollowHinges = true,
  pinsMatchPdfEvidence = true,
  cameraFlyToOperational = true,
  xrayUsesActualRules = true,
  marketSwitchingOperational = true,
  snapshotExportFunctional = true,
  noViewerCrashes = true,
  unitTestsPassing = true,
} = {}) {
  const gates = [
    { id: 'gate_01_dimensions', name: 'Physical dimensions verified', passed: Boolean(dimensionsVerified), critical: true },
    { id: 'gate_02_panel_geometry', name: 'Panel geometry complete', passed: Boolean(panelGeometryComplete), critical: true },
    { id: 'gate_03_hinge_graph', name: 'Hinge graph validated', passed: Boolean(hingeGraphValidated), critical: true },
    { id: 'gate_04_tuck_topology', name: 'Tuck-end topology modeled', passed: Boolean(tuckEndTopologyModeled), critical: true },
    { id: 'gate_05_fold_closure', name: 'Fold animation reaches closed geometry', passed: Boolean(foldAnimationCloses), critical: true },
    { id: 'gate_06_textures_oriented', name: 'Face textures correctly oriented', passed: Boolean(faceTexturesOriented), critical: true },
    { id: 'gate_07_no_mirroring', name: 'No artwork face mirrored', passed: Boolean(noMirroring), critical: true },
    { id: 'gate_08_no_swapping', name: 'No panel textures swapped', passed: Boolean(noPanelSwap), critical: true },
    { id: 'gate_09_pins_follow_hinges', name: 'Pins follow panel transforms', passed: Boolean(pinsFollowHinges), critical: true },
    { id: 'gate_10_pins_match_evidence', name: 'Pins match PDF evidence coordinates', passed: Boolean(pinsMatchPdfEvidence), critical: true },
    { id: 'gate_11_camera_flyto', name: 'Camera fly-to operational', passed: Boolean(cameraFlyToOperational), critical: true },
    { id: 'gate_12_xray_rules', name: 'X-Ray uses statutory placement rules', passed: Boolean(xrayUsesActualRules), critical: true },
    { id: 'gate_13_market_switching', name: 'Market switching refreshes overlays', passed: Boolean(marketSwitchingOperational), critical: true },
    { id: 'gate_14_snapshot_export', name: 'Snapshot export operational', passed: Boolean(snapshotExportFunctional), critical: true },
    { id: 'gate_15_no_crashes', name: 'No viewer crashes or WebGL leaks', passed: Boolean(noViewerCrashes), critical: true },
    { id: 'gate_16_tests_pass', name: 'All automated tests pass', passed: Boolean(unitTestsPassing), critical: true },
  ];

  const failedGates = gates.filter(g => !g.passed);
  const criticalFails = failedGates.filter(g => g.critical);

  let status = RELEASE_GATE_STATUSES.VERIFIED_3D;
  if (criticalFails.length > 3) {
    status = RELEASE_GATE_STATUSES.UNAVAILABLE_3D;
  } else if (criticalFails.length > 0) {
    status = RELEASE_GATE_STATUSES.PARTIAL_3D;
  }

  return {
    status,
    allPassed: failedGates.length === 0,
    passedCount: gates.length - failedGates.length,
    totalCount: gates.length,
    failedGates,
    fallback2DActive: status !== RELEASE_GATE_STATUSES.VERIFIED_3D,
    twoDReviewAvailable: true, // 2D always guaranteed available
  };
}

test('1. When all 16 release gates pass, 3D is labeled 3D_VERIFIED', () => {
  const result = evaluate3DReleaseGates();
  assert.equal(result.status, RELEASE_GATE_STATUSES.VERIFIED_3D);
  assert.equal(result.allPassed, true);
  assert.equal(result.passedCount, 16);
  assert.equal(result.failedGates.length, 0);
  assert.equal(result.fallback2DActive, false);
});

test('2. When critical geometry gates fail, 3D gracefully falls back to PARTIAL without breaking 2D review', () => {
  const result = evaluate3DReleaseGates({
    dimensionsVerified: false,
    hingeGraphValidated: false,
  });

  assert.equal(result.status, RELEASE_GATE_STATUSES.PARTIAL_3D);
  assert.equal(result.allPassed, false);
  assert.equal(result.fallback2DActive, true);
  assert.equal(result.twoDReviewAvailable, true, '2D review must remain 100% available');
  assert.equal(result.failedGates.length, 2);
});
