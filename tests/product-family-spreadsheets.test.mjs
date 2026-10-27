import test from 'node:test';
import assert from 'node:assert/strict';
import { suppliedGtinCandidates } from '../lib/gtin.mjs';
import { detectAmbiguities } from '../lib/ambiguity/index.mjs';

test('product family spreadsheet parser detects duplicate rows and preserves sheet/cell provenance', () => {
  const specDoc = {
    id: 'sheet-family',
    role: 'spec',
    name: 'Multi_SKU_Matrix.xlsx',
    cells: [
      { sheet: 'SKU_List', row: 1, col: 1, value: 'SKU' },
      { sheet: 'SKU_List', row: 1, col: 2, value: 'GTIN' },
      { sheet: 'SKU_List', row: 1, col: 3, value: 'Status' },
      // Row 2
      { sheet: 'SKU_List', row: 2, col: 1, value: 'SKU-100', cell: 'A2' },
      { sheet: 'SKU_List', row: 2, col: 2, value: '012345678905', cell: 'B2' },
      { sheet: 'SKU_List', row: 2, col: 3, value: 'Approved', cell: 'C2' },
      // Row 3 (Conflicting duplicate SKU row with draft status)
      { sheet: 'SKU_List', row: 3, col: 1, value: 'SKU-100', cell: 'A3' },
      { sheet: 'SKU_List', row: 3, col: 2, value: '098765432109', cell: 'B3' },
      { sheet: 'SKU_List', row: 3, col: 3, value: 'Draft / In Review', cell: 'C3' },
    ],
  };

  const gtins = suppliedGtinCandidates([specDoc]);
  assert.equal(gtins.length, 2);
  assert.ok(gtins.some(g => g.location.includes('B2')));
  assert.ok(gtins.some(g => g.location.includes('B3')));
});

test('ambiguity detector identifies conflicting nutrition basis columns in family spreadsheet', () => {
  const specDoc = {
    id: 'spec-nutrition',
    role: 'spec',
    name: 'Formula_Nutrition.xlsx',
    sha256: 'e'.repeat(64),
    cells: [
      { sheet: 'Nutrition', row: 1, col: 1, value: 'Nutrition Facts', cell: 'A1' },
      { sheet: 'Nutrition', row: 1, col: 2, value: 'Per Serving (40g)', cell: 'B1' },
      { sheet: 'Nutrition', row: 1, col: 3, value: 'Per 100g', cell: 'C1' },
      { sheet: 'Nutrition', row: 2, col: 1, value: 'Sodium', cell: 'A2' },
      { sheet: 'Nutrition', row: 2, col: 2, value: '110mg', cell: 'B2' },
      { sheet: 'Nutrition', row: 2, col: 3, value: '275mg', cell: 'C2' },
    ],
  };

  const review = {
    documents: [specDoc],
    findings: [],
  };

  const questions = detectAmbiguities(review);
  assert.ok(questions.length >= 1, 'Should generate an ambiguity question for multiple nutrition bases');
  assert.equal(questions[0].field, 'nutrition.basis');
});
