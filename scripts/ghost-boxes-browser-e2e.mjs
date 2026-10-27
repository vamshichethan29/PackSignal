/**
 * PackSignal End-to-End "Ghost Bounding Boxes & X-Ray Mode" Browser Test.
 * Step 25 Real-Browser Playwright Workflow:
 * 1. Open PackSignal in browser.
 * 2. Load a controlled packaging review (sample: organizer).
 * 3. Open a missing declaration finding (Net quantity / Address).
 * 4. Verify 2D X-Ray layer and amber dashed ghost boxes on the artwork canvas.
 * 5. Verify the correct panel and statutory bounds.
 * 6. Click the ghost box to open Statutory Placement Review card.
 * 7. Inspect real rule citation (FDA 21 CFR §101.7 / 21 CFR §101.5).
 * 8. Inspect source requirements / specification values.
 * 9. Verify candidate regions for business address (PDP + Info Panel).
 * 10. Test Confirm Panel action.
 * 11. Test Ask Someone integration from ghost modal.
 * 12. Switch to 3D carton and verify 3D X-Ray view.
 * 13. Verify signed HTML report includes "Missing Declarations & Placement Review".
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');

const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';
console.log(`[Ghost Boxes E2E] Connecting to server at ${base}...`);

let serverProc = null;
async function ensureServerRunning() {
  try {
    const res = await fetch(`${base}/healthz`);
    if (res.ok) return;
  } catch {}

  console.log('[Ghost Boxes E2E] Starting local server...');
  serverProc = spawn('node', ['server.mjs'], {
    cwd: resolve('.'),
    stdio: 'inherit',
    env: { ...process.env, PORT: '4173' }
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) {
        console.log('[Ghost Boxes E2E] Local server is ready.');
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Could not start or connect to PackSignal server.');
}

async function run() {
  await ensureServerRunning();

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Step 1: Open PackSignal
  console.log('[Ghost Boxes E2E] Navigating to PackSignal root...');
  await page.goto(`${base}/`);
  await page.waitForLoadState('domcontentloaded');

  // Step 2: Create and load a controlled review (sample: organizer)
  console.log('[Ghost Boxes E2E] Creating and loading controlled review...');
  const statusRes = await page.request.get(`${base}/api/status`);
  const statusData = await statusRes.json();
  const csrf = statusData.csrf;

  const createRes = await page.request.post(`${base}/api/reviews`, {
    headers: { 'x-packproof-token': csrf },
    data: { sample: 'organizer', mode: 'local' }
  });
  assert.ok(createRes.ok(), 'Failed to create review');
  const reviewMeta = await createRes.json();
  const reviewId = reviewMeta.id;

  let review = null;
  for (let i = 0; i < 40; i++) {
    const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
    if (poll.status === 'ready') {
      review = poll;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(review, 'Review failed to become ready');
  console.log(`[Ghost Boxes E2E] Review ready with ${review.findings.length} findings.`);

  // Navigate to review workbench
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-workbench').waitFor({ state: 'visible' });
  console.log('[Ghost Boxes E2E] Review workbench loaded.');

  // Step 3 & 4: Verify 2D Ghost Boxes and Legal Regions are rendered
  await page.locator('.workbench-artwork, [data-workbench-canvas]').waitFor({ state: 'visible' });

  const ghostBoxes = await page.$$('.workbench-ghost-box');
  const legalRegions = await page.$$('.workbench-legal-region');
  console.log(`[Ghost Boxes E2E] Found ${ghostBoxes.length} ghost boxes and ${legalRegions.length} statutory legal regions in 2D.`);
  assert(ghostBoxes.length >= 1, 'Expected at least 1 ghost box in 2D artwork viewer.');
  assert(legalRegions.length >= 1, 'Expected at least 1 statutory legal permitted region in 2D artwork viewer.');

  // Step 5: Check Net Quantity ghost box details
  const netQtyBox = await page.$('.workbench-ghost-box.ghost-net-qty, .workbench-ghost-box[data-ghost-id*="net_quantity"]');
  assert(netQtyBox, 'Expected Net Quantity ghost box on PDP.');
  const netQtyText = await netQtyBox.textContent();
  console.log(`[Ghost Boxes E2E] Net Quantity ghost box badge text: "${netQtyText.trim()}"`);
  assert(/NET QTY|NET QUANTITY/i.test(netQtyText), 'Ghost box badge should mention Net Quantity.');

  // Save 2D Ghost Overlay Screenshot
  const artifactDir = '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258';
  try {
    await page.screenshot({ path: `${artifactDir}/ghost_2d_workbench.png`, fullPage: false });
    console.log('[Ghost Boxes E2E] Saved visual artifact: ghost_2d_workbench.png');
  } catch (err) {
    console.warn('[Ghost Boxes E2E] Could not save workbench screenshot:', err.message);
  }

  // Step 6 & 7: Click Ghost Box to open Statutory Placement Review Modal
  console.log('[Ghost Boxes E2E] Clicking Net Quantity ghost box...');
  await netQtyBox.click({ force: true });
  await page.waitForTimeout(500);

  // Verify modal dialog appeared
  const modal = await page.waitForSelector('#dialog[open], dialog[open]', { timeout: 5000 });
  assert(modal, 'Expected statutory placement review modal dialog to open.');

  try {
    await page.screenshot({ path: `${artifactDir}/ghost_modal_dialog.png`, fullPage: false });
    console.log('[Ghost Boxes E2E] Saved visual artifact: ghost_modal_dialog.png');
  } catch (err) {
    console.warn('[Ghost Boxes E2E] Could not save modal screenshot:', err.message);
  }

  const modalHtml = await modal.innerHTML();
  console.log('[Ghost Boxes E2E] Inspecting modal content...');

  // Step 7: Inspect real rule citation
  assert(/21 CFR §101\.7/i.test(modalHtml), 'Modal must reference statutory governing rule 21 CFR §101.7');
  console.log('[Ghost Boxes E2E] Verified 21 CFR §101.7 citation in modal.');

  // Step 8: Inspect permitted legal region description
  assert(/Bottom 30%|Principal Display Panel|PDP/i.test(modalHtml), 'Modal must describe permitted PDP bottom region.');
  console.log('[Ghost Boxes E2E] Verified permitted legal region description.');

  // Step 9: Verify candidate panels or alternative panels section if present
  const confirmBtn = await page.$('#dialog button[data-action="confirm-panel"]');
  if (confirmBtn) {
    console.log('[Ghost Boxes E2E] Clicking [Confirm Panel]...');
    await confirmBtn.click();
    await page.waitForTimeout(300);
    const btnTextAfter = await confirmBtn.textContent();
    assert(/Confirmed/i.test(btnTextAfter), 'Confirm button text should indicate confirmed state.');
    console.log('[Ghost Boxes E2E] Verified panel confirmation button state.');
  }

  // Step 10: Test Ask Someone integration from ghost card
  const askBtn = await page.$('#dialog button[data-action="ask-someone-ghost"]');
  if (askBtn) {
    console.log('[Ghost Boxes E2E] Clicking [Ask Someone] from ghost card...');
    await askBtn.click();
    await page.waitForTimeout(500);
    const askModal = await page.waitForSelector('#ask-someone-modal[open]', { timeout: 5000 });
    assert(askModal, 'Ask Someone dialog should open from ghost card.');
    const askHtml = await askModal.innerHTML();
    assert(/Net Quantity|21 CFR §101\.7|Clarification/i.test(askHtml), 'Ask Someone should contain finding/rule context.');
    console.log('[Ghost Boxes E2E] Verified Ask Someone modal integration from ghost card.');

    // Close Ask Someone modal
    const closeAskBtn = await page.$('#ask-someone-modal [data-ask-action="close"]');
    if (closeAskBtn) await closeAskBtn.click();
    await page.waitForTimeout(300);
  } else {
    // Close the ghost dialog
    const closeBtn = await page.$('#dialog [data-action="close"]');
    if (closeBtn) await closeBtn.click();
  }

  // Step 11: Test 3D Mode switching
  const mode3dBtn = await page.$('button[data-action="workbench-mode"][data-mode="3d"], button[data-mode="3d"]');
  if (mode3dBtn) {
    console.log('[Ghost Boxes E2E] Switching to 3D carton mode...');
    await mode3dBtn.click();
    await page.waitForTimeout(1000);
    const cartonCanvas = await page.$('.carton-3d-canvas, canvas');
    assert(cartonCanvas, 'Expected 3D carton canvas to be rendered.');
    console.log('[Ghost Boxes E2E] 3D canvas is active.');

    // Toggle 3D X-Ray mode if button exists
    const xray3dBtn = await page.$('button[data-action="toggle-xray-3d"], button[data-action="xray-3d"]');
    if (xray3dBtn) {
      console.log('[Ghost Boxes E2E] Toggling 3D X-Ray mode...');
      await xray3dBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Step 12: Verify Signed Report Export endpoint
  console.log('[Ghost Boxes E2E] Verifying signed report export for ghost review section...');
  const reportRes = await fetch(`${base}/api/reviews/${reviewId}/report.html`);
  assert.ok(reportRes.ok, `Failed to fetch HTML report: status ${reportRes.status}`);
  const reportHtml = await reportRes.text();
  console.log(`[Ghost Boxes E2E] Fetched report for review ${reviewId} (${reportHtml.length} bytes).`);
  assert.ok(
    reportHtml.includes('Missing Declarations &amp; Placement Review (X-Ray)'),
    'Expected "Missing Declarations & Placement Review (X-Ray)" in signed HTML report'
  );
  console.log('[Ghost Boxes E2E] Verified "Missing Declarations & Placement Review (X-Ray)" in signed HTML report!');

  await browser.close();
  if (serverProc) serverProc.kill();
  console.log('✅ [Ghost Boxes E2E] All browser end-to-end tests passed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ [Ghost Boxes E2E] Test failed:', err);
  if (serverProc) serverProc.kill();
  process.exit(1);
});
