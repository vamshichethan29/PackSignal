import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CAMPUS_SCENES, getCampusScenes, getCurrentScene, goToCampusScene } from '../public/campus-demo.js';

test('Campus Demo State — 10 Guided Scenes Metadata & Specification Integrity', async () => {
  const scenes = getCampusScenes();
  assert.equal(scenes.length, 10, 'Must define exactly 10 guided rehearsal scenes');

  const expectedIds = [
    'spot-mistakes',
    'evidence-desk',
    'fact-sheet',
    'requirements',
    'red-pen',
    'pack-canvas',
    'india-switch',
    'second-product',
    '3d-ar',
    'brief-trust',
  ];

  scenes.forEach((scene, i) => {
    assert.equal(scene.sceneId, expectedIds[i], `Scene index ${i} must have sceneId ${expectedIds[i]}`);
    assert.ok(scene.label && scene.label.length > 3, 'Scene must have human-readable label');
    assert.ok(scene.expectedTimeWindow, 'Scene must declare an expected presentation time window');
    assert.ok(scene.fallbackScene, 'Scene must declare an explicit fallback scene');
    assert.ok(scene.resetBehavior, 'Scene must declare explicit reset behavior');
    assert.ok(Array.isArray(scene.allowedInteractions), 'Scene must specify allowed user interactions');
  });

  // Verify Phase 10A and Phase 10B are complete
  const doc10A = await readFile(join(process.cwd(), 'docs/campus/PHASE_10A_STATUS.md'), 'utf8');
  assert.match(doc10A, /IMPLEMENTED_AND_TESTED/, 'Phase 10A is now implemented and tested');

  const doc10B = await readFile(join(process.cwd(), 'docs/campus/PHASE_10B_STATUS.md'), 'utf8');
  assert.match(doc10B, /IMPLEMENTED_AND_TESTED/, 'Phase 10B is now implemented and tested');
});
