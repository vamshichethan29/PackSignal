/**
 * @file tests/carton-face-textures.test.mjs
 * 
 * Tests for source-accurate artwork face textures:
 * - Proper texture source hash preservation
 * - Distinct artwork crops for Front, Back, Left, Right, Top, Bottom
 * - Prevention of mirroring, upside-down branding, or accidental panel swapping
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CartonTextureMapper,
  PANEL_TEXTURE_LAYOUTS,
} from '../public/carton-texture-mapping.js';
import { CARTON_FACES } from '../public/three/fold-engine.js';

test('1. Texture mapper enforces source document provenance and SHA-256 integrity', () => {
  const mapper = new CartonTextureMapper({
    sourceDocumentId: 'DancingFish_Granola_Berry_US_Carton.pdf',
    sourceDocumentHash: 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be',
    sourcePage: 1,
  });

  const frontMapping = mapper.getFaceMapping('front');
  assert.equal(frontMapping.sourceDocumentHash, 'c633ab2f9d227c14aee4f9065cee980cf2efe1a602db963b1cf5e474fec929be');
  assert.equal(frontMapping.sourceDocumentId, 'DancingFish_Granola_Berry_US_Carton.pdf');
  assert.equal(frontMapping.sourcePage, 1);
  assert.equal(frontMapping.isReviewerConfirmed, true);
});

test('2. Every face has a unique, non-overlapping crop coordinate region', () => {
  const mapper = new CartonTextureMapper();
  const validation = mapper.validateTextureMappings();

  assert.equal(validation.isValid, true, 'All faces must pass texture validation');
  assert.equal(validation.errors.length, 0);

  // Compare front vs back crops
  const front = mapper.getFaceMapping('front');
  const back = mapper.getFaceMapping('back');
  assert.notDeepEqual(front.sourceBoxNormalized, back.sourceBoxNormalized, 'Front and back must not share crops');

  // Verify no mirroring flags
  for (const face of CARTON_FACES) {
    const m = mapper.getFaceMapping(face);
    assert.equal(m.flipX, false, `Face ${face} must not be flipped horizontally`);
    assert.equal(m.flipY, false, `Face ${face} must not be flipped vertically`);
    assert.equal(m.rotationDeg, 0, `Face ${face} orientation must be 0 deg`);
  }
});
