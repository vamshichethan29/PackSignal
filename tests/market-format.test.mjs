import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenMarketSpecificCopy,
  evaluateNetQuantity,
  evaluateManufacturerAddress
} from '../lib/claims/added-sugar-screen.mjs';

test('Market copy screen flags EU Reference Intake icons and Annex II phrasing on US packs', () => {
  const text = 'ENERGY 197kJ 4% | Saturates | Salt | Cereals Containing Gluten';
  const findings = screenMarketSpecificCopy(text, 'us');
  assert.equal(findings.length, 4);

  const types = findings.map(f => f.type);
  assert.ok(types.includes('EU_ENERGY_UNIT'));
  assert.ok(types.includes('EU_NUTRIENT_NAME'));
  assert.ok(types.includes('EU_ALLERGEN_PHRASING'));
});

test('Net quantity evaluator enforces dual units and PDP location under US FPLA', () => {
  // Back panel, metric only
  const defect = evaluateNetQuantity('480g', 'Back');
  assert.equal(defect.status, 'issue');
  assert.equal(defect.isDualDeclaration, false);
  assert.equal(defect.isPdp, false);

  // Front panel, dual declaration
  const compliant = evaluateNetQuantity('NET WT 16.9 OZ (1.05 LB) 480g', 'Front');
  assert.equal(compliant.status, 'match');
  assert.equal(compliant.isDualDeclaration, true);
  assert.equal(compliant.isPdp, true);
});

test('Manufacturer address evaluator enforces 21 CFR 101.5 city, state, and ZIP requirements', () => {
  const incomplete = evaluateManufacturerAddress('PRODUCED BY DANCING FISH GRANOLA CO.');
  assert.equal(incomplete.status, 'issue');
  assert.equal(incomplete.findingStatus, 'MANUFACTURER_ADDRESS_INCOMPLETE');

  const complete = evaluateManufacturerAddress('PRODUCED BY DANCING FISH GRANOLA CO., Boulder, CO 80301');
  assert.equal(complete.status, 'match');
  assert.equal(complete.findingStatus, 'MANUFACTURER_ADDRESS_COMPLIANT');
});
