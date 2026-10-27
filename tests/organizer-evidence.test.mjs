import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification } from '../lib/organizer-verification.mjs';

test('Organizer candidate checks conform strictly to Phase 2 evidence model', () => {
  const result = runOrganizerVerification();
  assert.ok(result.candidateChecks.length >= 20);

  const requiredFields = [
    'checkId',
    'checkType',
    'sourceApprovalStatus',
    'expectedValue',
    'observedValue',
    'ruleId',
    'executionMethod',
    'calculationProof',
    'visibilityStatus',
    'findingStatus',
    'limitations'
  ];

  for (const check of result.candidateChecks) {
    for (const field of requiredFields) {
      assert.ok(field in check, `Check ${check.checkId} must contain field "${field}"`);
    }
  }
});

test('Organizer candidate checks pin exact source spreadsheet cells', () => {
  const result = runOrganizerVerification();
  const checks = result.candidateChecks;

  // Honey % -> B26
  const honey = checks.find(c => c.checkId === 'DF-CHK-HONEY-PCT');
  assert.equal(honey.sourceCell, 'B26');

  // Carbs mismatch -> B53
  const carbs = checks.find(c => c.checkId === 'DF-CHK-NUT-CARB-MISMATCH');
  assert.equal(carbs.sourceCell, 'B53');

  // Sodium mismatch -> B52
  const sodium = checks.find(c => c.checkId === 'DF-CHK-NUT-SODIUM-MISMATCH');
  assert.equal(sodium.sourceCell, 'B52');

  // Net quantity -> B35
  const netQty = checks.find(c => c.checkId === 'DF-CHK-NET-QUANTITY');
  assert.equal(netQty.sourceCell, 'B35');

  // UPC Barcode -> E12
  const upc = checks.find(c => c.checkId === 'DF-CHK-UPC-BARCODE');
  assert.equal(upc.sourceCell, 'E12');
});

test('Rulebook ledger strictly tracks governance lifecycle and does not execute proposed rules', () => {
  const result = runOrganizerVerification();
  const ledger = result.rulebookLedger;
  assert.equal(ledger.rules.length, 21);

  // DF-21 is proposed standard and must have status NOT_APPLIED and verdict not_applied
  const df21 = ledger.rules.find(r => r.ruleId === 'DF-21');
  assert.ok(df21);
  assert.equal(df21.lifecycleState, 'PROPOSED');
  assert.equal(df21.executionStatus, 'NOT_APPLIED');
  assert.equal(df21.verdict, 'not_applied');
});
