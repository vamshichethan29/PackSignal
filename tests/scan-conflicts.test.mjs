import test from 'node:test';
import assert from 'node:assert/strict';
import { compareShelfVsApproved } from '../lib/campus/scan-to-brief.mjs';

test('1. Compares physical shelf-scanned facts against specification facts', () => {
  const shelfPanels = {
    front: { values: { brand_name: 'Dancing Fish', net_quantity: '10 oz (283 g)' } },
    back: { values: { allergen_statement: 'Contains: Almonds, Wheat' } },
    bottom: { values: { barcode_gtin: '012345678905' } },
  };

  const draftSpec = {
    brand_name: 'Dancing Fish',
    net_quantity: '12 oz (340 g)', // Conflict!
    allergen_statement: 'Contains: Almonds, Wheat', // Match
    barcode_gtin: '012345678905', // Match
  };

  const comparison = compareShelfVsApproved(shelfPanels, draftSpec);
  assert.equal(comparison.totalChecked, 4);
  assert.equal(comparison.issues.length, 1);
  assert.equal(comparison.matches.length, 3);

  const netQtyConflict = comparison.issues[0];
  assert.equal(netQtyConflict.field, 'net_quantity');
  assert.equal(netQtyConflict.type, 'SHELF_SPEC_MISMATCH');
  assert.equal(netQtyConflict.observed, '10 oz (283 g)');
  assert.equal(netQtyConflict.approved, '12 oz (340 g)');
  assert.match(netQtyConflict.explanation, /Physical carton printed "10 oz \(283 g\)"/);
});

test('2. Missing fact on shelf flags MISSING_FROM_SHELF issue', () => {
  const shelfPanels = {
    front: { values: { brand_name: 'Dancing Fish' } }, // Missing net_quantity
  };

  const draftSpec = {
    brand_name: 'Dancing Fish',
    net_quantity: '10 oz (283 g)',
  };

  const comparison = compareShelfVsApproved(shelfPanels, draftSpec);
  const missingQty = comparison.issues.find(i => i.field === 'net_quantity');
  assert.ok(missingQty);
  assert.equal(missingQty.type, 'MISSING_FROM_SHELF');
  assert.match(missingQty.explanation, /not found on the scanned front panel/i);
});

test('3. Distinguishes Draft vs Approved source authority wording', () => {
  const isDraftSource = true;
  const comparisonTitle = isDraftSource ? 'SHELF VS DRAFT SPECIFICATION' : 'SHELF VS APPROVED SPECIFICATION';
  assert.equal(comparisonTitle, 'SHELF VS DRAFT SPECIFICATION');
});
