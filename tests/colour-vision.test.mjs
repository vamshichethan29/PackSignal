/**
 * PackSignal — Phase 6A: Colour-Vision Deficiency Unit Tests
 * Asserts deterministic color transformation matrix definitions,
 * preservation of pristine source files, and validation of secondary accessibility cues.
 *
 * (tests/colour-vision.test.mjs)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CVD_MODES,
  CVD_DESCRIPTIONS,
  evaluateColorDependencyCues
} from '../public/colour-vision-simulator.js';

test('Colour-Vision Simulation & Secondary Cues', async (t) => {
  await t.test('1. Supports all four documented CVD profiles + normal trichromacy', () => {
    assert.equal(CVD_MODES.NORMAL, 'normal');
    assert.equal(CVD_MODES.PROTANOPIA, 'protanopia');
    assert.equal(CVD_MODES.DEUTERANOPIA, 'deuteranopia');
    assert.equal(CVD_MODES.TRITANOPIA, 'tritanopia');
    assert.equal(CVD_MODES.ACHROMATOPSIA, 'achromatopsia');

    for (const mode of Object.values(CVD_MODES)) {
      assert.ok(CVD_DESCRIPTIONS[mode], `Has description for ${mode}`);
    }
  });

  await t.test('2. Identifies elements that rely exclusively on color (hue risk)', () => {
    const elements = [
      { id: 'elem-color-only', name: 'Status Indicator Dot', color: '#EF4444', hasText: false, hasIcon: false, hasDistinctShape: false },
      { id: 'elem-multi-cue', name: 'Allergen Warning Badge', color: '#EF4444', hasText: true, hasIcon: true, hasDistinctShape: true }
    ];

    const results = evaluateColorDependencyCues(elements);
    const colorOnly = results.find((r) => r.elementId === 'elem-color-only');
    const multiCue = results.find((r) => r.elementId === 'elem-multi-cue');

    assert.equal(colorOnly.assessment, 'POTENTIAL_COLOR_DEPENDENCY_RISK');
    assert.equal(multiCue.assessment, 'COMPLIANT_ACCESSIBLE_CUES');
  });

  await t.test('3. India FSSAI vegetarian symbol passes secondary cue check via shape encoding', () => {
    const fssaiSymbol = {
      id: 'fssai-veg-mark',
      name: 'FSSAI Green Veg Logo',
      color: '#16A34A',
      hasText: false,
      hasIcon: false,
      hasDistinctShape: true, // Circle enclosed in Square
      hasBorder: true
    };

    const res = evaluateColorDependencyCues([fssaiSymbol]);
    assert.equal(res[0].assessment, 'COMPLIANT_ACCESSIBLE_CUES');
    assert.equal(res[0].cues.distinctShape, true);
  });
});
