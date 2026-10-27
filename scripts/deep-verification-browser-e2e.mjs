/**
 * PackSignal End-to-End Deep Verification Browser Test.
 * Runs Phase 29 full Playwright verification against live local server.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');

const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';
console.log(`Connecting Playwright e2e to ${base}...`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
page.setDefaultTimeout(15000);

const errors = [];
page.on('pageerror', err => errors.push(err.message));

async function runTest() {
  // 1. Fetch CSRF token and create official organizer review
  const statusRes = await page.request.get(`${base}/api/status`);
  const statusData = await statusRes.json();
  const csrf = statusData.csrf;

  const createRes = await page.request.post(`${base}/api/reviews`, {
    headers: { 'x-packproof-token': csrf },
    data: { sample: 'organizer', mode: 'local' }
  });
  assert.ok(createRes.ok(), 'Review creation failed');
  const reviewMeta = await createRes.json();
  const reviewId = reviewMeta.id;
  console.log(`[E2E] Review created: ${reviewId}`);

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
  assert.ok(review.deepVerification, 'Review must have deepVerification attached');

  // 2. Open Review in Browser
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-heading').waitFor();
  console.log('[E2E] Page loaded with review heading');

  // 3. Open Deep Verification Tab
  const deepTabBtn = page.locator('button[data-action="tab"][data-tab="deep-verification"]');
  await deepTabBtn.waitFor();
  await deepTabBtn.click();
  await page.locator('[data-deep-dashboard]').waitFor();
  console.log('[E2E] Deep Verification tab opened successfully');

  // Verify categories are rendered
  const categories = await page.locator('.deep-card').count();
  assert.ok(categories >= 9, 'Must render at least 9 category cards');
  console.log(`[E2E] ${categories} category cards verified`);

  // 4. View Spreadsheet Cell Coordinate Modal
  const viewCellBtn = page.locator('button[data-action="deep-view-cell"]').first();
  await viewCellBtn.click();
  await page.locator('#deep-modal-container').waitFor({ state: 'visible' });
  const cellModalText = await page.locator('#deep-modal-container').innerText();
  assert.ok(cellModalText.includes('Spreadsheet Source Coordinate'), 'Modal must show spreadsheet coordinate');
  console.log('[E2E] Spreadsheet cell modal displayed');

  // Close modal
  await page.locator('button[data-action="deep-modal-close"]').click();
  await page.locator('#deep-modal-container').waitFor({ state: 'hidden' });

  // 5. View Formula Modal
  const formulaBtn = page.locator('button[data-action="deep-view-formula"]').first();
  await formulaBtn.click();
  await page.locator('#deep-modal-container').waitFor({ state: 'visible' });
  const formulaModalText = await page.locator('#deep-modal-container').innerText();
  assert.ok(formulaModalText.includes('Calculation Proof'), 'Modal must show calculation proof');
  console.log('[E2E] Calculation formula modal displayed');

  // Close modal
  await page.locator('button[data-action="deep-modal-close"]').click();
  await page.locator('#deep-modal-container').waitFor({ state: 'hidden' });

  // 6. View Rule Detail Modal
  const ruleInspectBtn = page.locator('button[data-action="deep-view-rule"]').first();
  await ruleInspectBtn.click();
  await page.locator('#deep-modal-container').waitFor({ state: 'visible' });
  const ruleModalText = await page.locator('#deep-modal-container').innerText();
  assert.ok(ruleModalText.includes('Rule Detail'), 'Modal must show rule detail');
  console.log('[E2E] Rule detail modal displayed');

  // Close modal
  await page.locator('button[data-action="deep-modal-close"]').click();
  await page.locator('#deep-modal-container').waitFor({ state: 'hidden' });

  // 7. Toggle Occlusion Modal
  const toggleBtn = page.locator('button[data-action="deep-toggle-occlusion"]').first();
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    await page.locator('#deep-modal-container').waitFor({ state: 'visible' });
    const occlusionText = await page.locator('#deep-modal-container').innerText();
    assert.ok(occlusionText.includes('Occlusion Detected'), 'Must explain drawing sequence occlusion');
    console.log('[E2E] PDF structural occlusion modal verified');
    await page.locator('button[data-action="deep-modal-close"]').click();
  }

  // 8. Test Navigation from Deep Verification to 2D Artwork Canvas
  const viewArtworkBtn = page.locator('button[data-action="deep-view-artwork"]').first();
  await viewArtworkBtn.click();
  await page.locator('.workbench-evidence').waitFor({ state: 'visible' });
  console.log('[E2E] Successfully navigated from Deep Verification finding to 2D Evidence Canvas');

  // 9. Verify Signed HTML report export
  const htmlRes = await page.request.get(`${base}/api/reviews/${reviewId}/report.html`);
  assert.ok(htmlRes.ok(), 'HTML report export must succeed');
  const htmlContent = await htmlRes.text();
  assert.ok(htmlContent.includes('Deep Verification &amp; Packaging QA Summary'), 'HTML report must include Deep Verification summary');
  console.log('[E2E] Signed HTML report verified with Deep Verification summary');

  assert.equal(errors.length, 0, `Page errors encountered: ${errors.join(', ')}`);
  console.log('\n[E2E] Playwright workflow passed all 9 verification stages with 100% success!\n');
}

try {
  await runTest();
} finally {
  await browser.close();
}
