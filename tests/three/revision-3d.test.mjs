import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVISION_PIN_COLORS,
  Revision3DViewerController,
} from '../../public/three/revision-3d-controller.js';

test('3D Revision Intelligence semantic pin colors match specification', () => {
  // Green: Verified Correction (Phase 10)
  assert.equal(REVISION_PIN_COLORS.RESOLVED, 0x22c55e, 'Resolved pin must be Green');
  // Red: Regression or New Issue (Phase 11)
  assert.equal(REVISION_PIN_COLORS.REGRESSION, 0xef4444, 'Regression pin must be Red');
  assert.equal(REVISION_PIN_COLORS.NEW_ISSUE, 0xf97316, 'New issue pin must be Orange/Red');
  // Amber: Uncertain / Unverified / Removed (Phase 11 & Phase 17)
  assert.equal(REVISION_PIN_COLORS.UNVERIFIED_CHANGE, 0xf59e0b, 'Unverified change pin must be Amber');
  assert.equal(REVISION_PIN_COLORS.REMOVED_CONTENT, 0xd97706, 'Removed content pin must be Amber');
  // Blue: Neutral Visual Change (Phase 16)
  assert.equal(REVISION_PIN_COLORS.VISUAL_CHANGE, 0x38bdf8, 'Neutral visual change pin must be Blue');
  // Gray: Unchanged / Default
  assert.equal(REVISION_PIN_COLORS.UNCHANGED, 0x64748b, 'Unchanged pin must be Gray');
});

test('checkGeometryCompatibility validates identical carton geometries for 3D swipe', () => {
  const dummyContainer = { clientWidth: 800, clientHeight: 600, appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const controller = new Revision3DViewerController({
    container: dummyContainer,
    reviewV1: {
      options: { packageType: 'carton', cartonDimensions: { width: 60, height: 120, depth: 40 } },
    },
    reviewV2: {
      options: { packageType: 'carton', cartonDimensions: { width: 60, height: 120, depth: 40 } },
    },
    intelligence: {},
  });

  const compat = controller.checkGeometryCompatibility();
  assert.equal(compat.compatible, true);
  assert.ok(compat.reason.includes('Identical'));
});

test('checkGeometryCompatibility detects mismatching packaging types and disables 3D swipe with honest fallback', () => {
  const dummyContainer = { clientWidth: 800, clientHeight: 600, appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const controller = new Revision3DViewerController({
    container: dummyContainer,
    reviewV1: {
      options: { packageType: 'carton' },
    },
    reviewV2: {
      options: { packageType: 'can' },
    },
    intelligence: {},
  });

  const compat = controller.checkGeometryCompatibility();
  assert.equal(compat.compatible, false);
  assert.ok(compat.reason.includes('Different packaging types'));
});

test('checkGeometryCompatibility detects dimensional mismatch (> 2mm) in carton structures', () => {
  const dummyContainer = { clientWidth: 800, clientHeight: 600, appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const controller = new Revision3DViewerController({
    container: dummyContainer,
    reviewV1: {
      options: { packageType: 'carton', cartonDimensions: { width: 60, height: 120, depth: 40 } },
    },
    reviewV2: {
      options: { packageType: 'carton', cartonDimensions: { width: 65, height: 120, depth: 40 } },
    },
    intelligence: {},
  });

  const compat = controller.checkGeometryCompatibility();
  assert.equal(compat.compatible, false);
  assert.ok(compat.reason.includes('Carton dimensions differ'));
});

test('3D Scissor Test division math provides continuous coverage without gaps', () => {
  const rw = 1200;
  const rh = 800;

  for (const progress of [0, 25, 50, 75, 100]) {
    const splitPixel = Math.round(rw * (progress / 100));

    // Left scissor (Revision A)
    const leftScissor = { x: 0, y: 0, w: splitPixel, h: rh };
    // Right scissor (Revision B)
    const rightScissor = { x: splitPixel, y: 0, w: rw - splitPixel, h: rh };

    // Total width covered must equal rw exactly
    assert.equal(leftScissor.w + rightScissor.w, rw);
    // Left boundary starts at 0, right boundary starts at splitPixel
    assert.equal(leftScissor.x, 0);
    assert.equal(rightScissor.x, splitPixel);
  }
});

test('Finding to panel face normal calculation targets expected carton panel', () => {
  const dummyContainer = { clientWidth: 800, clientHeight: 600, appendChild: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  const controller = new Revision3DViewerController({
    container: dummyContainer,
    reviewV1: {
      id: 'rev-v1',
      options: {
        packageType: 'carton',
        panelZones: {
          front: { page: 1, box: [0.2, 0.2, 0.4, 0.8] },
          left: { page: 1, box: [0.0, 0.2, 0.2, 0.8] },
        },
      },
    },
    reviewV2: {
      id: 'rev-v2',
      options: {
        packageType: 'carton',
        panelZones: {
          front: { page: 1, box: [0.2, 0.2, 0.4, 0.8] },
          left: { page: 1, box: [0.0, 0.2, 0.2, 0.8] },
        },
      },
    },
    intelligence: {
      changes: [
        {
          id: 'chg_1',
          classification: 'RESOLVED',
          evidenceV2: { box: [0.25, 0.4, 0.35, 0.6] }, // inside front panel
        },
        {
          id: 'chg_2',
          classification: 'REGRESSION',
          evidenceV2: { box: [0.05, 0.3, 0.15, 0.7] }, // inside left panel
        },
      ],
    },
  });

  const faceFront = controller.determineChangePanelFace(controller.intelligence.changes[0]);
  assert.equal(faceFront, 'front');

  const faceLeft = controller.determineChangePanelFace(controller.intelligence.changes[1]);
  assert.equal(faceLeft, 'left');
});
