import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('Spot the Mistakes Opener — Canonical Ground Truth Verification', async () => {
  const root = process.cwd();
  
  // Verify organizer ground truth manifest
  const manifestRaw = await readFile(join(root, 'samples/organizer/manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);

  assert.ok(Array.isArray(manifest.files), 'Manifest must list official files');
  assert.equal(manifest.files.length, 2, 'Must include XLSX and PDF');
  assert.ok(manifest.files.some(f => f.name.includes('Content_Sheet.xlsx')));
  assert.ok(manifest.files.some(f => f.name.includes('Carton.pdf')));

  // Verify physical carton props opener copy
  const campusExtrasJs = await readFile(join(root, 'public/campus-extras.js'), 'utf8');
  assert.match(campusExtrasJs, /Spot the Mistakes Opener/, 'Must include Spot the Mistakes opener');
  assert.match(campusExtrasJs, /Mistake #1: Net Quantity Unit/, 'Must identify net quantity unit mismatch');
  assert.match(campusExtrasJs, /Mistake #2: Serving Basis Ambiguity/, 'Must identify serving basis ambiguity');
  assert.match(campusExtrasJs, /Mistake #3: Negated Positive Copy/, 'Must identify negated storage copy');

  // Verify no fabricated defect count: deterministic findings count
  assert.doesNotMatch(campusExtrasJs, /Mistake #99/, 'Must not invent defect numbers beyond verified truth');
});
