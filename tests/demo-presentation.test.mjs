import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

test('public/demo-presentation.js and public/demo-presentation.css exist and are valid', () => {
  const jsContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.js'), 'utf8');
  const cssContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.css'), 'utf8');

  assert.ok(jsContent.length > 500, 'demo-presentation.js must not be empty');
  assert.ok(cssContent.length > 500, 'demo-presentation.css must not be empty');

  // Verify key class and method exports
  assert.ok(jsContent.includes('export class DemoPresentationModal'), 'Must export DemoPresentationModal');
  assert.ok(jsContent.includes('export function openJudgePresentation'), 'Must export openJudgePresentation');
  assert.ok(jsContent.includes('export function closeJudgePresentation'), 'Must export closeJudgePresentation');
});

test('Presentation Mode markup preserves official artwork identity and challenge question', () => {
  const jsContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.js'), 'utf8');

  assert.ok(jsContent.includes('SPOT THE MISTAKES'), 'Must feature SPOT THE MISTAKES title');
  assert.ok(jsContent.includes('Dancing Fish Granola Berry Crunch'), 'Must specify official Dancing Fish carton');
  assert.ok(jsContent.includes('How many packaging problems can you find on this box?'), 'Must feature exact challenge question');
  assert.ok(jsContent.includes('30-Second Challenge'), 'Must feature 30-Second Challenge badge');
});

test('Findings and answer key are strictly hidden before reveal', () => {
  const jsContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.js'), 'utf8');

  // _renderArtworkOverlays must check mode === 'REVEALED'
  assert.ok(jsContent.includes("if (this.mode !== 'REVEALED') return '';"), 'Overlays must be hidden unless mode is REVEALED');
});

test('Countdown controls and 30-second initialization exist', () => {
  const jsContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.js'), 'utf8');

  assert.ok(jsContent.includes('id="demo-timer-display">00:30<'), 'Must initialize at 00:30');
  assert.ok(jsContent.includes('id="demo-btn-start-timer"'), 'Must have Start Challenge button');
  assert.ok(jsContent.includes('id="demo-btn-pause-timer"'), 'Must have Pause button');
  assert.ok(jsContent.includes('id="demo-btn-reset-timer"'), 'Must have Reset button');
  assert.ok(jsContent.includes('id="demo-btn-skip-timer"'), 'Must have Skip Countdown button');
  assert.ok(jsContent.includes('id="demo-btn-reveal-trigger"'), 'Must have Reveal button');
});

test('Fresh Analysis and Previously Verified Review are explicitly labeled', () => {
  const jsContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.js'), 'utf8');

  assert.ok(jsContent.includes('Mode A: Run Fresh Analysis'), 'Must provide Mode A: Run Fresh Analysis');
  assert.ok(jsContent.includes('Mode B: Open Previously Verified Review'), 'Must provide Mode B: Open Previously Verified Review');
  assert.ok(jsContent.includes('Live Fresh Scan'), 'Must include Live Fresh Scan label');
  assert.ok(jsContent.includes('Verified Previous Run'), 'Must include Verified Previous Run label');
});

test('Presenter keyboard shortcuts Space, R, N, F, Esc are supported', () => {
  const jsContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.js'), 'utf8');

  assert.ok(jsContent.includes("e.key === 'Escape'"), 'Must handle Escape to exit');
  assert.ok(jsContent.includes("e.key === ' ' || e.code === 'Space'"), 'Must handle Space for timer');
  assert.ok(jsContent.includes("e.key === 'r' || e.key === 'R'"), 'Must handle R for reveal');
  assert.ok(jsContent.includes("e.key === 'n' || e.key === 'N'"), 'Must handle N for next finding');
  assert.ok(jsContent.includes("e.key === 'f' || e.key === 'F'"), 'Must handle F for full Checks tab');

  // Input guard to avoid interfering with form fields
  assert.ok(jsContent.includes("['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)"), 'Must ignore hotkeys while typing in inputs');
});

test('Reduced motion CSS media query is implemented', () => {
  const cssContent = readFileSync(resolve(REPO_ROOT, 'public/demo-presentation.css'), 'utf8');

  assert.ok(cssContent.includes('@media (prefers-reduced-motion: reduce)'), 'Must include prefers-reduced-motion media query');
  assert.ok(cssContent.includes('animation: none !important'), 'Must disable animations when reduced motion is preferred');
});

test('Original PDF and source files are completely preserved and untouched', () => {
  const cartonPath = resolve(REPO_ROOT, 'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf');
  const sheetPath = resolve(REPO_ROOT, 'samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
  const manifestPath = resolve(REPO_ROOT, 'samples/organizer/manifest.json');

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const cartonDef = manifest.files.find(f => f.name.includes('Carton.pdf'));
  const sheetDef = manifest.files.find(f => f.name.includes('Content_Sheet.xlsx'));

  import('node:crypto').then(({ createHash }) => {
    const cartonHash = createHash('sha256').update(readFileSync(cartonPath)).digest('hex');
    const sheetHash = createHash('sha256').update(readFileSync(sheetPath)).digest('hex');

    assert.equal(cartonHash, cartonDef.sha256, 'Dancing Fish carton PDF hash must match manifest');
    assert.equal(sheetHash, sheetDef.sha256, 'Dancing Fish content sheet XLSX hash must match manifest');
  });
});
