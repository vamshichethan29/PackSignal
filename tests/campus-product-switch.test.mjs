import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSourceFile } from '../lib/source-pieces.mjs';

test('Campus Product Switch — Distinct Independent Facts and Parsers', async () => {
  const root = process.cwd();

  // Verify second product sample files exist
  const sample2Dir = join(root, 'samples', 'campus-product-2');
  const pdfPath = join(sample2Dir, 'AmritChai_Masala_IN_Carton.pdf');
  const xlsxPath = join(sample2Dir, 'AmritChai_Content_Sheet.xlsx');
  const docxPath = join(sample2Dir, 'AmritChai_Product_Spec.docx');
  const manifestPath = join(sample2Dir, 'manifest.json');

  assert.ok(existsSync(pdfPath), 'Amrit Chai PDF must exist');
  assert.ok(existsSync(xlsxPath), 'Amrit Chai XLSX content sheet must exist');
  assert.ok(existsSync(docxPath), 'Amrit Chai DOCX spec must exist');
  assert.ok(existsSync(manifestPath), 'Manifest must exist');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.ok(manifest.productName.includes('Amrit Chai') || manifest.productName.includes('Amrit Organic'), 'Product name must match second product');
  assert.ok(manifest.brand.includes('Amrit'), 'Brand must be Amrit');
  assert.notEqual(manifest.brand, 'Dancing Fish', 'Brand must be distinct from Dancing Fish');

  // Parse XLSX content sheet using real extraction engine
  const parsedXlsx = await parseSourceFile(xlsxPath, { role: 'spec' });

  assert.ok(parsedXlsx.pieces.length >= 20, `XLSX parser extracted ${parsedXlsx.pieces.length} distinct source pieces`);
  const values = parsedXlsx.pieces.map(p => String(p.text || p.rawText || ''));
  assert.ok(values.some(v => v.includes('Amrit Chai')), 'Extracted pieces must contain Amrit Chai brand name');
  assert.ok(values.some(v => v.includes('250 g') || v.includes('२५० ग्राम')), 'Extracted pieces must contain net quantity');
  assert.ok(values.some(v => v.includes('FSSAI') || v.includes('अमृत चाय')), 'Extracted pieces must contain authority or Hindi text');

  // Verify none of the second product facts leak Dancing Fish values
  assert.equal(values.some(v => v.includes('Dancing Fish')), false, 'Second product must not leak Dancing Fish data');
  assert.equal(values.some(v => v.includes('Berry Crunch')), false, 'Second product must not leak Berry Crunch data');
});
