import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/engine.mjs';

test('sibling-SKU screening distinguishes variant-specific fields from valid shared brand copy', () => {
  const specDoc = {
    id: 'spec-1',
    role: 'spec',
    name: 'Granola_Family_Specs.xlsx',
    cells: [
      { sheet: 'SKUs', row: 1, col: 1, value: 'SKU' },
      { sheet: 'SKUs', row: 1, col: 2, value: 'Variant' },
      { sheet: 'SKUs', row: 1, col: 3, value: 'Barcode' },
      { sheet: 'SKUs', row: 1, col: 4, value: 'Ingredients' },
      { sheet: 'SKUs', row: 1, col: 5, value: 'Shared Brand Note' },
      // Row 2: Berry Crunch
      { sheet: 'SKUs', row: 2, col: 1, value: 'SKU-001' },
      { sheet: 'SKUs', row: 2, col: 2, value: 'Berry Crunch' },
      { sheet: 'SKUs', row: 2, col: 3, value: '012345678905' },
      { sheet: 'SKUs', row: 2, col: 4, value: 'Oats, Honey, Berries' },
      { sheet: 'SKUs', row: 2, col: 5, value: 'Crafted in Vermont with organic grains' },
      // Row 3: Chocolate Almond
      { sheet: 'SKUs', row: 3, col: 1, value: 'SKU-002' },
      { sheet: 'SKUs', row: 3, col: 2, value: 'Chocolate Almond' },
      { sheet: 'SKUs', row: 3, col: 3, value: '012345678912' },
      { sheet: 'SKUs', row: 3, col: 4, value: 'Oats, Cocoa, Almonds' },
      { sheet: 'SKUs', row: 3, col: 5, value: 'Crafted in Vermont with organic grains' },
    ],
  };

  // Artwork for Berry Crunch SKU-001 that accidentally prints Chocolate Almond ingredients and barcode
  const contaminatedArtwork = {
    id: 'art-1',
    role: 'artwork',
    name: 'BerryCrunch_Carton.pdf',
    pages: [{ number: 1, text: 'Berry Crunch Granola\nOats, Cocoa, Almonds\n012345678912\nCrafted in Vermont with organic grains' }],
    lines: [
      { text: 'Berry Crunch Granola', page: 1 },
      { text: 'Oats, Cocoa, Almonds', page: 1 },
      { text: '012345678912', page: 1 },
      { text: 'Crafted in Vermont with organic grains', page: 1 },
    ],
  };

  const result = analyze({
    documents: [specDoc, contaminatedArtwork],
    options: { productSku: 'SKU-001' },
  });

  // Sibling barcode or ingredients carryover should be flagged or placed under review
  assert.ok(result.findings.length > 0);
  // Shared brand story "Crafted in Vermont with organic grains" should NOT be flagged as a defect
  const brandStoryDefect = result.findings.find(f => f.title.includes('Crafted in Vermont') && f.status === 'issue');
  assert.equal(brandStoryDefect, undefined, 'Shared brand family copy must not be flagged as contamination');
});
