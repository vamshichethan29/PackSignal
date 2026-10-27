import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

test('Dieline guide text analyzer classifies construction labels as PRODUCTION_GUIDE', () => {
  const scriptPath = resolve(REPO_ROOT, 'lib/pdf-structure.py');
  const pdfPath = resolve(REPO_ROOT, 'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf');

  const stdout = execFileSync('python3', [scriptPath, pdfPath], { encoding: 'utf8' });
  const data = JSON.parse(stdout);
  const spans = data.pages[0].spans;

  const guideSpans = spans.filter(s => s.classification === 'PRODUCTION_GUIDE');
  assert.ok(guideSpans.length >= 30, 'Must detect all guide spans on Dimensions and text layer');

  const guideTexts = guideSpans.map(s => s.text);
  assert.ok(guideTexts.includes('Art orientation'));
  assert.ok(guideTexts.includes('Copy free'));
  assert.ok(guideTexts.includes('gl1'));

  // Ensure guide spans do not pollute consumer copy count
  const consumerSpans = spans.filter(s => s.classification === 'CONSUMER_COPY');
  for (const cs of consumerSpans) {
    assert.notEqual(cs.text, 'Art orientation');
    assert.notEqual(cs.text, 'Copy free');
  }
});
