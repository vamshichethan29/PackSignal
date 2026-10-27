import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPROVED_PRESS_PROFILES,
  PRINTING_PROCESSES,
  SUBSTRATES,
  getPressProfile,
  listApprovedPressProfiles,
} from '../lib/print/press-profiles.mjs';

test('1. Press profiles define explicit industrial print conditions with full schema', () => {
  const profiles = listApprovedPressProfiles();
  assert.ok(profiles.length >= 4, 'Must register at least 4 industrial press profiles');

  const offset = getPressProfile('ISO-OFFSET-COATED-300');
  assert.equal(offset.printingProcess, PRINTING_PROCESSES.OFFSET);
  assert.equal(offset.substrate, SUBSTRATES.COATED_SBS_BOARD);
  assert.equal(offset.tacLimitPercent, 300);
  assert.equal(offset.tacLimit, 300);
  assert.equal(offset.bleedExtensionMm, 3.0);
  assert.equal(offset.trimSafetyInsetMm, 3.0);
  assert.equal(offset.creaseClearanceMm, 1.5);
  assert.equal(offset.imageResolutionMinimum, 300);
  assert.ok(offset.outputCondition.includes('FOGRA39'));
  assert.ok(offset.sourceReference.includes('ISO 12647-2'));
  assert.equal(offset.approvalStatus, 'APPROVED');
  assert.ok(offset.approvedBy.includes('Committee'));
  assert.ok(offset.limitations.length > 0);
});

test('2. Flexo film pouch profile has lower TAC limit and higher text safety inset', () => {
  const flexo = getPressProfile('FTA-FLEXO-POUCH-280');
  assert.equal(flexo.printingProcess, PRINTING_PROCESSES.FLEXOGRAPHY);
  assert.equal(flexo.substrate, SUBSTRATES.FLEXIBLE_BARRIER_FILM);
  assert.equal(flexo.tacLimitPercent, 280, 'Flexo film TAC limit must be 280% due to dot gain and drying');
  assert.equal(flexo.trimSafetyInsetMm, 3.5);
  assert.equal(flexo.bleedExtensionMm, 2.5);
  assert.equal(flexo.creaseClearanceMm, 2.0);
  assert.ok(flexo.sourceReference.includes('FIRST 6.0'));
});

test('3. Beverage can profile defines seam clearance and aluminum substrate', () => {
  const can = getPressProfile('GRAVURE-BEVERAGE-CAN-340');
  assert.equal(can.printingProcess, PRINTING_PROCESSES.GRAVURE);
  assert.equal(can.substrate, SUBSTRATES.METALLIC_ALUMINUM);
  assert.equal(can.tacLimitPercent, 340);
  assert.equal(can.trimSafetyInsetMm, 4.0);
  assert.equal(can.creaseClearanceMm, 0.0, 'Can has no folding creases');
});

test('4. Digital folding carton profile supports 320% TAC with instant drying', () => {
  const digital = getPressProfile('DIGITAL-FOLDING-320');
  assert.equal(digital.printingProcess, PRINTING_PROCESSES.DIGITAL);
  assert.equal(digital.tacLimitPercent, 320);
  assert.equal(digital.bleedExtensionMm, 1.5);
  assert.equal(digital.trimSafetyInsetMm, 2.5);
});

test('5. Provisional screening profile is clearly labeled as uncertified screening default', () => {
  const prov = getPressProfile('PROVISIONAL-SCREENING-300');
  assert.equal(prov.verified, false);
  assert.equal(prov.approvalStatus, 'PROVISIONAL');
  assert.ok(prov.limitations.includes('illustrative screening estimates only'));
  assert.ok(prov.warning.includes('not certified'));
});

test('6. Unknown or unapproved profile returns review-required status without claiming certification', () => {
  const unknown = getPressProfile('NON_EXISTENT_PROFILE');
  assert.equal(unknown.verified, false);
  assert.equal(unknown.approvalStatus, 'REVIEW_REQUIRED');
  assert.ok(unknown.warning.includes('not certified'));
});
