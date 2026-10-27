import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

test('Native typography measurement extracts exact font point size and distinguishes from box height', () => {
  const scriptPath = resolve(REPO_ROOT, 'lib/pdf-structure.py');
  const pdfPath = resolve(REPO_ROOT, 'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf');

  const stdout = execFileSync('python3', [scriptPath, pdfPath], { encoding: 'utf8' });
  const data = JSON.parse(stdout);
  const spans = data.pages[0].spans;

  const storageSpan = spans.find(s => s.text.toLowerCase().includes('store in a cool'));
  assert.ok(storageSpan);
  assert.equal(storageSpan.fontSizePt, 5.8);
  assert.equal(storageSpan.font, 'Acorn-Regular');

  // Verify that font point size (5.8) is NOT confused with multi-line glyph/block height (> 20 pt)
  assert.ok(storageSpan.glyphHeightPt > 20, 'Wrapped block height is multi-line height');
  assert.notEqual(storageSpan.fontSizePt, storageSpan.glyphHeightPt);

  // Check company rulebook comparison: 5.8 pt < 6.0 pt threshold
  const passesThreshold = storageSpan.fontSizePt >= 6.0;
  assert.equal(passesThreshold, false, 'Storage statement fails 6.0 pt minimum company threshold');
});
