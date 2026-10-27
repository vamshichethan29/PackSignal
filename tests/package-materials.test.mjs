import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PBR_MATERIAL_PRESETS,
  evaluateFinishAuthority,
} from '../public/packaging-3d/package-materials.js';
import { FINISH_MASK_MODES } from '../public/packaging-3d/package-types.js';

test('14. Material presets initialize correctly with physically based parameters', () => {
  const presets = Object.keys(PBR_MATERIAL_PRESETS);
  assert.ok(presets.includes('KRAFT_PAPER'));
  assert.ok(presets.includes('SBS_WHITE_CARD'));
  assert.ok(presets.includes('METALLIC_GOLD_FOIL'));
  assert.ok(presets.includes('SPOT_UV_GLOSS'));
  assert.ok(presets.includes('ALUMINIUM_METAL'));
  assert.ok(presets.includes('CLEAR_GLASS'));
  assert.ok(presets.includes('MATTE_FILM'));
  assert.ok(presets.includes('METALLIZED_FOIL_POUCH'));
});

test('15. Kraft paperboard does not use metallic response (metalness=0, high roughness)', () => {
  const kraft = PBR_MATERIAL_PRESETS.KRAFT_PAPER;
  assert.equal(kraft.metalness, 0.0);
  assert.ok(kraft.roughness >= 0.8);
  assert.equal(kraft.transmission, 0.0);
});

test('16. SBS white card has appropriate board material settings (smooth coated substrate)', () => {
  const sbs = PBR_MATERIAL_PRESETS.SBS_WHITE_CARD;
  assert.ok(sbs.roughness <= 0.45);
  assert.ok(sbs.metalness <= 0.05);
  assert.equal(sbs.isIllustrative, false);
});

test('17. Metallic gold foil has high metalness and specular finish parameters', () => {
  const gold = PBR_MATERIAL_PRESETS.METALLIC_GOLD_FOIL;
  assert.ok(gold.metalness >= 0.9);
  assert.ok(gold.roughness <= 0.25);
  assert.equal(gold.isIllustrative, true);
});

test('18. Spot UV supports high clearcoat and low clearcoat roughness for gloss contrast', () => {
  const spotUv = PBR_MATERIAL_PRESETS.SPOT_UV_GLOSS;
  assert.equal(spotUv.clearcoat, 1.0);
  assert.ok(spotUv.roughness <= 0.1);
});

test('19. Unverified finish remains illustrative and does not satisfy binding prepress rule', () => {
  // Mode B: Illustrative preview
  const unverified = evaluateFinishAuthority({ mode: FINISH_MASK_MODES.ILLUSTRATIVE_PREVIEW });
  assert.equal(unverified.authority, 'ILLUSTRATIVE_PREVIEW');
  assert.equal(unverified.isBinding, false);
  assert.ok(unverified.disclaimer.includes('Visual preview only'));

  // Mode A: Source verified
  const verified = evaluateFinishAuthority({
    mode: FINISH_MASK_MODES.SOURCE_VERIFIED,
    spotColorName: 'PANTONE 871 C Gold Foil',
  });
  assert.equal(verified.authority, 'SOURCE_VERIFIED');
  assert.equal(verified.isBinding, true);
  assert.ok(verified.disclaimer.includes('Source-verified finish'));
});
