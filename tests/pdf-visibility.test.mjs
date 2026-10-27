import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

test('PDF structure analyzer detects drawing sequence occlusion of legacy EU table', () => {
  const scriptPath = resolve(REPO_ROOT, 'lib/pdf-structure.py');
  const pdfPath = resolve(REPO_ROOT, 'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf');

  const stdout = execFileSync('python3', [scriptPath, pdfPath], { encoding: 'utf8' });
  const data = JSON.parse(stdout);

  assert.ok(data.pages.length >= 1);
  const spans = data.pages[0].spans;

  // Find "Typical Values per 100g"
  const euTableSpan = spans.find(s => s.text.toLowerCase().includes('typical values'));
  assert.ok(euTableSpan, 'Typical Values per 100g must be found in native PDF stream');
  assert.equal(euTableSpan.classification, 'POTENTIALLY_OCCLUDED');
  assert.equal(euTableSpan.isOccluded, true);
  assert.ok(euTableSpan.occludingDrawings.length > 0, 'Must record occluding drawing seqno');

  // Find visible consumer text
  const visibleSpan = spans.find(s => s.text.toLowerCase().includes('store in a cool'));
  assert.ok(visibleSpan);
  assert.equal(visibleSpan.classification, 'CONSUMER_COPY');
  assert.equal(visibleSpan.isOccluded, false);
});
