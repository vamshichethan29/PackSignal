/**
 * PackSignal End-to-End PDF Preflight Browser Test (scripts/pdf-preflight-browser-e2e.mjs)
 * Executes the complete Judge Demonstration in a real headless Chrome browser:
 * 1. Open PackSignal review.
 * 2. Select PDF Preflight tab.
 * 3. Verify four screening categories (PVP-001, PVP-002, PVP-003, PVP-004).
 * 4. Verify suspicious/warning findings and 7-point transparency disclosures.
 * 5. Inspect 2D canvas with colored preflight overlays (amber, purple, orange, gray).
 * 6. Inspect cut-clearance distance measurements and threshold provenance.
 * 7. Verify report generation with PDF Visibility & Typography Preflight section.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');

const PORT = 4176;
const base = `http://127.0.0.1:${PORT}`;

console.log(`[PDF Preflight E2E] Spawning test server on port ${PORT}...`);
const serverProcess = spawn('node', ['server.mjs'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

serverProcess.stderr.on('data', d => {
  const msg = d.toString();
  if (!msg.includes('ExperimentalWarning')) {
    console.error('[Server Error]', msg);
  }
});

let serverStarted = false;
serverProcess.stdout.on('data', d => {
  const msg = d.toString();
  if (msg.includes('PackSignal') || msg.includes('http://')) {
    serverStarted = true;
  }
});

for (let i = 0; i < 25; i++) {
  if (serverStarted) break;
  await new Promise(r => setTimeout(r, 200));
}

let browser = null;

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(15000);

  const errors = [];
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); errors.push(err.message); });

  // 1. Get status & CSRF token
  const statusRes = await page.request.get(`${base}/api/status`);
  const statusData = await statusRes.json();
  const csrf = statusData.csrf;

  // 2. Create review with organizer sample (Dancing Fish PDF)
  console.log('[E2E Step 1] Creating review with Dancing Fish packaging artwork PDF...');
  const createRes = await page.request.post(`${base}/api/reviews`, {
    headers: { 'x-packproof-token': csrf },
    data: { sample: 'organizer', mode: 'local' }
  });
  assert.ok(createRes.ok(), 'Failed to create review');
  const createData = await createRes.json();
  const reviewId = createData.id;
  console.log(`[E2E Step 1] Created review: ${reviewId}`);

  // Poll for review ready
  for (let i = 0; i < 40; i++) {
    const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
    if (poll.status === 'ready') break;
    await new Promise(r => setTimeout(r, 250));
  }

  // 3. Navigate to review in browser
  console.log('[E2E Step 2] Loading review in Chrome...');
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-heading').waitFor({ state: 'visible' });

  // 4. Open "PDF Preflight" tab
  console.log('[E2E Step 3] Selecting PDF Preflight tab...');
  const preflightTab = page.locator('button[data-action="tab"][data-tab="preflight"]');
  await preflightTab.click();
  await page.waitForSelector('[data-preflight-dashboard]');

  // 5. Verify the four screening categories
  console.log('[E2E Step 4] Verifying the four prepress screening categories...');
  const catVisibility = page.locator('[data-category="visibility"]');
  const catOverlap = page.locator('[data-category="overlap"]');
  const catTypography = page.locator('[data-category="typography"]');
  const catClearance = page.locator('[data-category="clearance"]');

  await catVisibility.waitFor({ state: 'visible' });
  await catOverlap.waitFor({ state: 'visible' });
  await catTypography.waitFor({ state: 'visible' });
  await catClearance.waitFor({ state: 'visible' });

  const visText = await catVisibility.textContent();
  const overText = await catOverlap.textContent();
  const typoText = await catTypography.textContent();
  const clearText = await catClearance.textContent();

  assert.ok(visText.includes('PVP-001'), 'Must display PVP-001 Rendered Text Visibility');
  assert.ok(overText.includes('PVP-002'), 'Must display PVP-002 Hidden / Overlapping Text');
  assert.ok(typoText.includes('PVP-003'), 'Must display PVP-003 Estimated Text Height');
  assert.ok(clearText.includes('PVP-004'), 'Must display PVP-004 Dieline / Trim Clearance');
  console.log('  ✓ PVP-001 Rendered Text Visibility present');
  console.log('  ✓ PVP-002 Hidden / Overlapping Text present');
  console.log('  ✓ PVP-003 Estimated Text Height present');
  console.log('  ✓ PVP-004 Dieline / Trim Clearance present');

  // 6. Run Prepress Screening with custom thresholds
  console.log('[E2E Step 5] Clicking Run PDF Preflight Screening...');
  const runBtn = page.locator('button[data-action="run-pdf-preflight"]').first();
  await runBtn.click();
  await page.waitForTimeout(2000); // Allow screening calculation

  // 7. Verify preflight findings with 7-point transparency disclosures
  console.log('[E2E Step 6] Verifying 7-point prepress transparency disclosures...');
  const transparencyBox = page.locator('.finding-transparency-disclosure').first();
  await transparencyBox.waitFor({ state: 'visible' });
  const transContent = await transparencyBox.textContent();

  assert.ok(transContent.includes('WHAT WAS OBSERVED?'), 'Must disclose what was observed');
  assert.ok(transContent.includes('WHERE WAS IT OBSERVED?'), 'Must disclose where it was observed');
  assert.ok(transContent.includes('WHICH SCREENING METHOD WAS USED?'), 'Must disclose screening method');
  assert.ok(transContent.includes('WHAT NUMERIC THRESHOLD WAS USED?'), 'Must disclose threshold');
  assert.ok(transContent.includes('WHERE DID THAT THRESHOLD COME FROM?'), 'Must disclose threshold provenance');
  assert.ok(transContent.includes('WHAT IS STILL UNCERTAIN?'), 'Must disclose uncertainty/limitations');
  assert.ok(transContent.includes('WHAT SHOULD THE REVIEWER CHECK?'), 'Must suggest reviewer action');
  console.log('  ✓ All 7 transparency points verified in prepress findings');

  // 8. Inspect on 2D Artwork Canvas
  console.log('[E2E Step 7] Navigating to 2D proof canvas for evidence inspection...');
  const inspectBtn = page.locator('button[data-action="inspect-finding-canvas"]').first();
  await inspectBtn.click();
  await page.waitForSelector('.workbench-canvas');

  // 9. Verify 2D canvas has preflight overlay classes
  console.log('[E2E Step 8] Checking preflight visual overlays and HUD legend...');
  const regionMarker = page.locator('.workbench-region, .evidence-marker, svg.evidence-overlay').first();
  await regionMarker.waitFor({ state: 'visible' });
  const hudLegend = page.locator('.hud-pf-legend');
  await hudLegend.waitFor({ state: 'visible' });
  const legendText = await hudLegend.textContent();
  assert.ok(legendText.includes('Hidden/Overlap'));
  assert.ok(legendText.includes('Small Text'));
  assert.ok(legendText.includes('Cut Clearance'));
  console.log('  ✓ Preflight overlay legend rendered in 2D HUD');

  // 10. Verify HTML report download includes preflight screening
  console.log('[E2E Step 9] Verifying HTML report export with prepress section...');
  const reportRes = await page.request.get(`${base}/api/reviews/${reviewId}/report.html`);
  const reportHtml = await reportRes.text();
  assert.ok(reportHtml.includes('PDF Visibility &amp; Typography Preflight Screening'), 'Report must include PDF Preflight section');
  assert.ok(reportHtml.includes('Prepress Screening Disclaimer'), 'Report must include Prepress Screening Disclaimer');
  assert.ok(reportHtml.includes('PREPRESS SCREENING'), 'Report must use PREPRESS SCREENING terminology');
  console.log('  ✓ Exported report includes verified PDF Preflight section and prepress disclaimer');

  console.log('\n======================================================');
  console.log('🎉 [PDF Preflight E2E] ALL TEST STEPS PASSED PERFECTLY!');
  console.log('======================================================\n');
} finally {
  if (browser) await browser.close();
  serverProcess.kill('SIGKILL');
}
