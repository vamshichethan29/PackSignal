/**
 * @file tests/red-pen-paths.test.mjs
 * 
 * Unit tests for Phase 5A: Red Pen Path Generation & Finding Annotation Mapping
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateHandDrawnPath,
  getAnnotationTypeForFinding
} from '../public/red-pen-markup.js';

describe('Phase 5A — Red Pen Markup & Path Generation', () => {

  const testBox = [0.2, 0.3, 0.5, 0.4]; // Normalized box

  it('1. Generates RED_CIRCLE path as a smooth closed bezier stroke around box', () => {
    const pathD = generateHandDrawnPath('RED_CIRCLE', testBox, 1000, 1000);
    assert.ok(pathD.startsWith('M '));
    assert.ok(pathD.includes(' C '));
    // Verify coordinates scale to canvas dimensions (width=1000, height=1000)
    assert.ok(pathD.includes('350')); // cy = 350
  });

  it('2. Generates RED_UNDERLINE path spanning below the text box baseline', () => {
    const pathD = generateHandDrawnPath('RED_UNDERLINE', testBox, 1000, 1000);
    assert.ok(pathD.startsWith('M '));
    assert.ok(pathD.includes(' Q '));
    // y should be near bottom (400) + offset
    assert.ok(pathD.includes('403'));
  });

  it('3. Generates RED_STRIKETHROUGH path passing horizontally through text midpoint', () => {
    const pathD = generateHandDrawnPath('RED_STRIKETHROUGH', testBox, 1000, 1000);
    assert.ok(pathD.startsWith('M '));
    // Midpoint Y of [300, 400] is 350
    assert.ok(pathD.includes('352'));
  });

  it('4. Generates RED_BRACKET path around multiline block', () => {
    const pathD = generateHandDrawnPath('RED_BRACKET', testBox, 1000, 1000);
    assert.ok(pathD.startsWith('M '));
    assert.ok(pathD.includes(' L '));
  });

  it('5. Maps finding semantics accurately to annotation types', () => {
    assert.equal(getAnnotationTypeForFinding({ title: 'Net Weight Mismatch', explanation: 'Declared 480 g' }), 'RED_CIRCLE');
    assert.equal(getAnnotationTypeForFinding({ title: 'Certified Vegan Claim', explanation: 'Marketing claim unverified' }), 'RED_UNDERLINE');
    assert.equal(getAnnotationTypeForFinding({ title: 'Removed Ingredient', explanation: 'Obsolete copy deleted from recipe' }), 'RED_STRIKETHROUGH');
    assert.equal(getAnnotationTypeForFinding({ title: 'Ambiguous Warning', status: 'review', explanation: 'Check formulation' }), 'AMBER_HIGHLIGHT');
  });

});
