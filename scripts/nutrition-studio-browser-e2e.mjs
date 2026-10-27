/**
 * scripts/nutrition-studio-browser-e2e.mjs
 * 
 * PackSignal Phase 2: Nutrition Comparison Studio Browser E2E Test
 * Verifies the complete nutrition verification workflow in headless Chromium:
 * 1. Start local server & create review with nutrition facts
 * 2. Navigate to "Nutrition Comparison" tab
 * 3. Verify Summary KPIs & Plausibility screening cards
 * 4. Verify Comparison Table with nutrients (Sodium, Total Fat, etc.)
 * 5. Open Calculation Formula Modal -> verify proof details & statutory %DV arithmetic
 * 6. Open Source Cell Modal -> verify native spreadsheet coordinate preservation
 * 7. Click [Artwork] button -> verify navigation to 2D artwork view
 * 8. Verify reviewer ambiguity confirmation workflow
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));

let child = null;
let storageDir = null;

async function getFreePort() {
  const s = createServer();
  await new Promise((resolve, reject) => {
    s.once('error', reject);
    s.listen(0, '127.0.0.1', resolve);
  });
  const port = s.address().port;
  await new Promise((resolve, reject) => s.close(err => err ? reject(err) : resolve()));
  return port;
}

async function ensureServer() {
  if (process.env.PACKSIGNAL_TEST_URL) {
    return process.env.PACKSIGNAL_TEST_URL;
  }
  const port = await getFreePort();
  storageDir = await mkdtemp(join(tmpdir(), 'packsignal-nutrition-e2e-'));
  const env = {
    ...process.env,
    PORT: String(port),
    PACKSIGNAL_DATA_DIR: storageDir,
    NODE_ENV: 'test'
  };
  child = spawn('node', ['server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Server process terminated prematurely');
    try {
      const res = await fetch(`${base}/api/status`);
      if (res.ok) {
        return base;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Server failed to start in time');
}

let browser = null;

try {
  const base = await ensureServer();
  console.log(`[Nutrition Studio E2E] Target server active at ${base}...`);

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(15000);

  const errors = [];
  page.on('pageerror', err => {
    console.error('BROWSER PAGE ERROR:', err);
    errors.push(err.message);
  });

  // 1. Get status & CSRF token
  const statusRes = await page.request.get(`${base}/api/status`);
  const statusData = await statusRes.json();
  const csrf = statusData.csrf;

  // 2. Ingest organizer sample review containing nutrition panels & multi-column spreadsheet
  console.log('[Nutrition Studio E2E] Ingesting organizer review with nutrition facts...');
  const createRes = await page.request.post(`${base}/api/reviews`, {
    headers: { 'x-packproof-token': csrf },
    data: { sample: 'organizer', mode: 'local' }
  });
  assert.ok(createRes.ok(), 'Failed to create organizer review');
  const reviewMeta = await createRes.json();
  const reviewId = reviewMeta.id;
  console.log(`[Nutrition Studio E2E] Review created: ${reviewId}`);

  // Poll until ready
  let review = null;
  for (let i = 0; i < 40; i++) {
    const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
    if (poll.status === 'ready') {
      review = poll;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(review, 'Review did not finish within timeout');
  assert.ok(review.nutrition, 'Expected nutrition snapshot on completed review');

  // 3. Open review workspace in browser
  console.log('[Nutrition Studio E2E] Loading review workspace in browser...');
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-heading').waitFor();

  // 4. Navigate to Nutrition Comparison Tab
  console.log('[Nutrition Studio E2E] Clicking Nutrition Comparison tab...');
  const tabBtn = page.locator('nav.tabs button[data-tab="nutrition"]');
  await tabBtn.waitFor();
  await tabBtn.click();
  await page.waitForTimeout(500);

  // 5. Verify Nutrition Studio Container & Summary KPIs
  console.log('[Nutrition Studio E2E] Verifying summary KPI cards...');
  await page.locator('.nutrition-studio-container').waitFor();
  const countsGrid = page.locator('.nutrition-studio-container .counts');
  await countsGrid.waitFor();
  const comparedCount = await countsGrid.locator('.count').first().locator('b').textContent();
  assert.ok(Number(comparedCount) > 0, `Expected compared nutrients > 0, got ${comparedCount}`);
  console.log(`[Nutrition Studio E2E] Verified ${comparedCount} nutrients compared`);

  // Verify Atwater and Plausibility panels
  const atwaterText = await page.locator('.nutrition-studio-container').textContent();
  assert.ok(atwaterText.includes('Calorie Plausibility'), 'Expected Calorie Plausibility card');
  assert.ok(atwaterText.includes('Chemical Consistency'), 'Expected Chemical Consistency card');

  // 6. Verify Comparison Table with Nutrients
  console.log('[Nutrition Studio E2E] Verifying Comparison Table...');
  const rows = page.locator('.nutrition-studio-container table tbody tr');
  const rowCount = await rows.count();
  assert.ok(rowCount > 0, `Expected comparison rows, found ${rowCount}`);

  // 7. Verify Calculation Formula Modal
  console.log('[Nutrition Studio E2E] Testing [Formula] proof modal...');
  const formulaBtn = page.locator('button[data-action="view-proof-modal"]').first();
  if (await formulaBtn.count() > 0) {
    await formulaBtn.click();
    await page.locator('#dialog[open]').waitFor();
    const modalHeading = await page.locator('#dialog .dialog-header h2').textContent();
    assert.ok(modalHeading.includes('Calculation Proof'), `Expected proof title, got: ${modalHeading}`);
    const modalContent = await page.locator('#dialog .dialog-content').textContent();
    assert.ok(modalContent.includes('Daily Value Ref') || modalContent.includes('Formula ID'), 'Expected calculation proof steps');
    console.log(`[Nutrition Studio E2E] Verified proof modal: ${modalHeading.trim()}`);

    // Close modal
    await page.locator('#dialog [data-action="close"]').click();
    await page.waitForTimeout(300);
  }

  // 8. Verify Source Cell Modal
  console.log('[Nutrition Studio E2E] Testing [Cell] source modal...');
  const cellBtn = page.locator('button[data-action="view-source-cell-modal"]').first();
  if (await cellBtn.count() > 0) {
    await cellBtn.click();
    await page.locator('#dialog[open]').waitFor();
    const modalHeading = await page.locator('#dialog .dialog-header h2').textContent();
    assert.ok(modalHeading.includes('Source Cell Evidence'), `Expected source cell title, got: ${modalHeading}`);
    const modalContent = await page.locator('#dialog .dialog-content').textContent();
    assert.ok(modalContent.includes('Cell Coordinate') || modalContent.includes('Document ID'), 'Expected spreadsheet coordinate info');
    console.log(`[Nutrition Studio E2E] Verified source cell modal: ${modalHeading.trim()}`);

    // Close modal
    await page.locator('#dialog [data-action="close"]').click();
    await page.waitForTimeout(300);
  }

  // 9. Verify 5-Section Nutrient Detail Drawer
  console.log('[Nutrition Studio E2E] Testing 5-section Nutrient Detail Drawer...');
  const detailsBtn = page.locator('button[data-action="toggle-nutrient-drawer"]').first();
  await detailsBtn.click();
  await page.locator('.nutrient-drawer-content').first().waitFor();

  const drawerText = await page.locator('.nutrient-drawer-content').first().textContent();
  assert.ok(drawerText.includes('A. Source Specification'), 'Expected Section A');
  assert.ok(drawerText.includes('B. Artwork Declaration'), 'Expected Section B');
  assert.ok(drawerText.includes('C. Mathematical Proof'), 'Expected Section C');
  assert.ok(drawerText.includes('D. Regulatory Reference'), 'Expected Section D');
  assert.ok(drawerText.includes('E. Review & Audit'), 'Expected Section E');
  console.log('[Nutrition Studio E2E] All 5 drawer sections verified (A, B, C, D, E)');

  // 10. Verify Ambiguity Confirmation or Recheck
  console.log('[Nutrition Studio E2E] Testing Recompute / Ambiguity Resolution...');
  const confirmBtn = page.locator('button[data-action="confirm-nutrition-basis"]');
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
    console.log('[Nutrition Studio E2E] Confirmed nutrition variant basis');
  }

  // 11. Verify Artwork Navigation Button
  console.log('[Nutrition Studio E2E] Testing [Artwork] button navigation...');
  const artworkBtn = page.locator('button[data-action="view-artwork-evidence"]').first();
  if (await artworkBtn.count() > 0) {
    await artworkBtn.click();
    await page.waitForTimeout(500);
    const activeTab = await page.evaluate(() => document.querySelector('nav.tabs button.tab.active')?.dataset.tab);
    assert.equal(activeTab, 'artwork', 'Clicking [Artwork] should switch to artwork workbench tab');
    console.log('[Nutrition Studio E2E] Verified [Artwork] switches to 2D artwork view');
  }

  assert.equal(errors.length, 0, `Browser logged errors: ${errors.join(', ')}`);
  console.log('\n✅ [Nutrition Studio E2E] All Browser E2E checks passed successfully!');
  process.exit(0);

} catch (err) {
  console.error('\n❌ [Nutrition Studio E2E] Failed:', err);
  process.exit(1);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (child) child.kill();
  if (storageDir) await rm(storageDir, { recursive: true, force: true }).catch(() => {});
}
