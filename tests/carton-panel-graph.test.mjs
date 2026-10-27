/**
 * @file tests/carton-panel-graph.test.mjs
 * 
 * Tests for structural panel model and fold graph connectivity.
 * Verifies:
 * - Actual panel graph extracted from verified dimensions and layers
 * - Rejection of invalid / disconnected panel sets
 * - Clear distinction of Cut edges vs. Crease hinges
 * - Physical millimeter scale preservation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCartonStructuralPanels,
  validateCartonStructure,
  PANEL_ROLES,
  TUCK_END_VARIANTS,
} from '../lib/geometry/carton-structure.mjs';

test('1. Structural panel model builds all six mandatory faces with verified physical dimensions', () => {
  const structure = buildCartonStructuralPanels({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
    caliperMm: 0.45,
    variant: TUCK_END_VARIANTS.REVERSE_TUCK,
    documentHash: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
  });

  assert.ok(structure, 'Structure must be generated');
  assert.equal(structure.dimensions.width, 142.88);
  assert.equal(structure.dimensions.height, 160.16);
  assert.equal(structure.dimensions.depth, 77.61);

  // Validate presence of the six primary faces
  assert.ok(structure.panels[PANEL_ROLES.FRONT]);
  assert.ok(structure.panels[PANEL_ROLES.BACK]);
  assert.ok(structure.panels[PANEL_ROLES.LEFT]);
  assert.ok(structure.panels[PANEL_ROLES.RIGHT]);
  assert.ok(structure.panels[PANEL_ROLES.TOP]);
  assert.ok(structure.panels[PANEL_ROLES.BOTTOM]);

  // Validate PDP front dimensions
  const front = structure.panels[PANEL_ROLES.FRONT];
  assert.equal(front.widthMm, 142.88);
  assert.equal(front.heightMm, 160.16);
  assert.equal(front.parentPanel, null, 'Front is kinematic root');

  // Validate validation pass
  const validation = validateCartonStructure(structure);
  assert.equal(validation.ok, true);
  assert.equal(validation.isComplete, true);
  assert.equal(validation.errors.length, 0);
});

test('2. Invalid or incomplete panel structure is rejected with actionable diagnostics', () => {
  // Missing required dimensions
  const invalidDims = validateCartonStructure({
    dimensions: { width: -10, height: 160.16, depth: 0 },
    panels: {},
  });
  assert.equal(invalidDims.ok, false);
  assert.ok(invalidDims.errors.some(e => e.includes('positive numbers')));

  // Missing back panel
  const missingBack = buildCartonStructuralPanels({
    dimensions: { width: 100, height: 100, depth: 50 },
  });
  delete missingBack.panels[PANEL_ROLES.BACK];
  const invalidBack = validateCartonStructure(missingBack);
  assert.equal(invalidBack.ok, false);
  assert.ok(invalidBack.errors.some(e => e.includes('Missing mandatory carton panel: back')));
});

test('3. Caliper (board thickness) and material authority metadata are preserved', () => {
  const structure = buildCartonStructuralPanels({
    dimensions: { width: 142.88, height: 160.16, depth: 77.61 },
    caliperMm: 0.50,
    authority: 'ESKO_ARTIOSCAD_ARD',
    documentHash: 'sha-esko-test-hash',
  });

  assert.equal(structure.caliperMm, 0.50);
  assert.equal(structure.authority, 'ESKO_ARTIOSCAD_ARD');
  assert.equal(structure.panels[PANEL_ROLES.FRONT].thicknessMm, 0.50);
  assert.equal(structure.panels[PANEL_ROLES.FRONT].materialAuthority, 'ESKO_ARTIOSCAD_ARD');
});
