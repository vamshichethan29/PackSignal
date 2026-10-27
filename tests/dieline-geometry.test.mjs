/**
 * @file dieline-geometry.test.mjs
 * 
 * Unit tests for dieline geometry, layer inspection, and physical scale authority.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PT_TO_MM,
  MM_TO_PT,
  VERIFIED_BERRY_CRUNCH_PANELS,
  evaluatePhysicalScaleAuthority,
  extractDielineLayersOrGenerateQuestion
} from '../lib/pack-canvas/dieline-geometry.mjs';

test('Dieline Geometry: Exact conversion factors between pt and mm', () => {
  assert.equal(Number(PT_TO_MM.toFixed(6)), 0.352778);
  assert.equal(Number(MM_TO_PT.toFixed(5)), 2.83465);

  // 72 points must equal 25.4 mm (1 inch)
  const oneInchMm = 72 * PT_TO_MM;
  assert.equal(Number(oneInchMm.toFixed(2)), 25.4);
});

test('Dieline Geometry: Authoritative Berry Crunch carton panels extraction', () => {
  assert.equal(VERIFIED_BERRY_CRUNCH_PANELS.length, 6);

  const front = VERIFIED_BERRY_CRUNCH_PANELS.find(p => p.id === 'panel-front');
  const back = VERIFIED_BERRY_CRUNCH_PANELS.find(p => p.id === 'panel-back');
  const left = VERIFIED_BERRY_CRUNCH_PANELS.find(p => p.id === 'panel-left');
  const right = VERIFIED_BERRY_CRUNCH_PANELS.find(p => p.id === 'panel-right');

  assert.ok(front && back && left && right);
  assert.equal(front.widthMm, 142.88);
  assert.equal(front.heightMm, 160.16);
  assert.equal(back.widthMm, 139.35);
  assert.equal(back.heightMm, 160.16);
  assert.equal(left.widthMm, 78.32);
  assert.equal(right.widthMm, 77.61);

  // Area assertions
  assert.ok(front.areaMm2 > 22000);
  assert.ok(back.areaMm2 > 22000);
  assert.ok(left.areaMm2 > 12000);
  assert.ok(right.areaMm2 > 12000);

  // Layer authority
  assert.equal(front.geometryAuthority, 'ESKO_STRUCTURAL_CAD');
});

test('Dieline Geometry: Physical scale authority validation', () => {
  // Case A: High authority CAD
  const cadScale = evaluatePhysicalScaleAuthority({
    unitSource: 'CAD_DIMENSIONS_MM',
    hasExplicitUnits: true,
    pageRotation: 0,
    userUnit: 1.0
  });
  assert.equal(cadScale.authority, 'STRUCTURAL_CAD_SPEC');
  assert.equal(cadScale.scaleConfidence, 'HIGH');
  assert.equal(cadScale.permitsAccurateFitting, true);

  // Case B: Unknown scale
  const unknownScale = evaluatePhysicalScaleAuthority({
    unitSource: 'UNKNOWN_SCREEN_PIXELS',
    hasExplicitUnits: false
  });
  assert.equal(unknownScale.authority, 'PHYSICAL_SCALE_UNCONFIRMED');
  assert.equal(unknownScale.scaleConfidence, 'UNCONFIRMED');
  assert.equal(unknownScale.permitsAccurateFitting, false);
});

test('Dieline Geometry: Layer inspection and guided Pack Size question generation', () => {
  // Case 1: All layers present
  const complete = extractDielineLayersOrGenerateQuestion(['Cut Line', 'Crease Layer', 'Artwork Front']);
  assert.equal(complete.status, 'LAYERS_VERIFIED');
  assert.equal(complete.packSizeQuestion, null);

  // Case 2: Missing Cut and Crease layers
  const missing = extractDielineLayersOrGenerateQuestion(['Flat Print', 'Background Color']);
  assert.equal(missing.status, 'STRUCTURAL_LAYERS_MISSING');
  assert.ok(missing.packSizeQuestion);
  assert.equal(missing.packSizeQuestion.id, 'Q-PACK-DIMENSIONS');
  assert.ok(missing.packSizeQuestion.options.length >= 3);
});
