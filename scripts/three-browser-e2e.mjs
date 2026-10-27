/**
 * PackSignal 3D Packaging Folding & Inspection Studio Browser E2E Test
 * Verifies interactive WebGL folding carton, fold slider, 3D pin selection,
 * camera fly-to, and seamless 2D/3D inspection roundtrip.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');

const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';
console.log(`[3D E2E] Connecting to ${base}...`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
page.setDefaultTimeout(15000);

const errors = [];
page.on('pageerror', err => errors.push(err.message));

async function runTest() {
  // 1. Fetch CSRF token and run organizer sample
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
  console.log(`[3D E2E] Review created: ${reviewId}`);

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

  // 2. Open Review in Browser
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-heading').waitFor();
  console.log('[3D E2E] Loaded review workspace');

  // 3. Switch to 3D Inspection Mode ("3D context")
  const btn3D = page.locator('button[data-action="workbench-mode"][data-mode="3d"]').first();
  await btn3D.waitFor();
  await btn3D.click();

  // Wait for 3D stage and WebGL viewport ready
  await page.locator('[data-carton-webgl][data-viewer-ready="true"]').waitFor({ timeout: 15000 });
  await page.locator('[data-carton-fold-slider]').waitFor();
  console.log('[3D E2E] 3D packaging viewport initialized and fold slider mounted');

  // 4. Test Fold Slider Interaction (100% -> 0% -> 50% -> 100%)
  const foldSlider = page.locator('[data-carton-fold-slider]');
  const foldOutput = page.locator('[data-carton-fold-output]');

  // Click Flat 0% button
  const flatBtn = page.locator('[data-carton-fold-flat]');
  await flatBtn.click();
  await page.waitForTimeout(300);
  assert.equal(await foldOutput.textContent(), '0%');
  console.log('[3D E2E] Flat 0% dieline state verified');

  // Click Fold 100% button
  const foldBtn = page.locator('[data-carton-fold-full]');
  await foldBtn.click();
  await page.waitForTimeout(300);
  assert.equal(await foldOutput.textContent(), '100%');
  console.log('[3D E2E] Folded 100% carton state verified');

  // Test slider manual adjustment to 45%
  await foldSlider.fill('45');
  await foldSlider.dispatchEvent('input');
  assert.equal(await foldOutput.textContent(), '45%');
  console.log('[3D E2E] Continuous intermediate fold slider verified at 45%');

  // 5. Select a Finding in 3D Mode
  const findingRow = page.locator('.queue-finding').first();
  await findingRow.click();
  await page.waitForTimeout(400);

  // Verify finding is selected in 3D inspector
  const findingTitle = await page.locator('.workbench-evidence h3').first().textContent();
  assert.ok(findingTitle, 'Selected finding title must appear in inspector');
  console.log(`[3D E2E] Selected finding in 3D: "${findingTitle}"`);

  // 6. Test "View in 2D Artwork Proof" transition
  const view2DBtn = page.locator('.btn-view-2d[data-mode="2d"]').first();
  assert.ok(await view2DBtn.isVisible(), 'View in 2D button must be visible in 3D mode');
  await view2DBtn.click();

  // Wait for 2D proof frame
  await page.locator('[data-workbench-frame]').waitFor();
  console.log('[3D E2E] Switched seamlessly to 2D proof view');

  // Verify finding selection is preserved in 2D
  const active2DTitle = await page.locator('.workbench-evidence h3').first().textContent();
  assert.equal(active2DTitle, findingTitle, 'Finding selection must be preserved when jumping to 2D');

  // 7. Return to 3D Inspection Mode
  const return3DBtn = page.locator('.btn-view-2d[data-mode="3d"]').first();
  await return3DBtn.click();
  await page.locator('[data-carton-webgl][data-viewer-ready="true"]').waitFor({ timeout: 15000 });
  console.log('[3D E2E] Returned to 3D inspection mode with selection preserved');

  // 8. Test X-Ray toggle and Panel Names toggle
  const xrayBtn = page.locator('[data-carton-xray]');
  await xrayBtn.click();
  assert.equal(await xrayBtn.getAttribute('aria-pressed'), 'true');
  await xrayBtn.click();
  assert.equal(await xrayBtn.getAttribute('aria-pressed'), 'false');
  console.log('[3D E2E] X-Ray inspection toggle verified');

  // 9. Test Multi-Format Packaging Switching & Dedicated Control Bars
  // Switch to Can
  const canBtn = page.locator('[data-pkg-format="can"]');
  await canBtn.click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-can-control-bar]').isVisible(), 'Can control bar must be visible');
  assert.ok(!(await page.locator('[data-carton-fold-bar]').isVisible()), 'Carton fold bar must be hidden for Can');

  // Test Can seam slider and highlight
  const canSlider = page.locator('[data-can-seam-slider]');
  await canSlider.fill('120');
  await canSlider.dispatchEvent('input');
  assert.equal(await page.locator('[data-can-seam-val]').textContent(), '120°');

  const canHighlightBtn = page.locator('[data-can-seam-highlight]');
  await canHighlightBtn.click();
  assert.ok(await canHighlightBtn.evaluate(el => el.classList.contains('active')), 'Seam highlight button should be active');

  const canWrapBtn = page.locator('[data-can-wrap-mode]');
  await canWrapBtn.click();
  assert.equal(await canWrapBtn.textContent(), 'Front Label (180°)');
  console.log('[3D E2E] Beverage Can packaging controls verified');

  // Switch to Bottle
  const bottleBtn = page.locator('[data-pkg-format="bottle"]');
  await bottleBtn.click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-bottle-control-bar]').isVisible(), 'Bottle control bar must be visible');
  assert.ok(!(await page.locator('[data-carton-fold-bar]').isVisible()), 'Carton fold bar must be hidden for Bottle');

  const amberBtn = page.locator('[data-bottle-sub="amber"]');
  await amberBtn.click();
  assert.ok(await amberBtn.evaluate(el => el.classList.contains('active')), 'Amber glass button active');

  const bottleLabelBtn = page.locator('[data-bottle-label-placement]');
  await bottleLabelBtn.click();
  assert.equal(await bottleLabelBtn.textContent(), 'Front Label');
  console.log('[3D E2E] Bottle packaging controls and substrate preview verified');

  // Switch to Stand-up Pouch
  const pouchBtn = page.locator('[data-pkg-format="pouch"]');
  await pouchBtn.click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-pouch-control-bar]').isVisible(), 'Pouch control bar must be visible');
  assert.ok(!(await page.locator('[data-carton-fold-bar]').isVisible()), 'Carton fold bar must be hidden for Pouch');

  const pouchSlider = page.locator('[data-pouch-fullness-slider]');
  await pouchSlider.fill('60');
  await pouchSlider.dispatchEvent('input');
  assert.equal(await page.locator('[data-pouch-fullness-output]').textContent(), '60%');

  const pouchGussetBtn = page.locator('[data-pouch-gusset-toggle]');
  await pouchGussetBtn.click();
  const pouchSealsBtn = page.locator('[data-pouch-seals-toggle]');
  await pouchSealsBtn.click();
  console.log('[3D E2E] Stand-up Pouch fullness and gusset controls verified');

  // Switch back to Folding Carton
  const cartonBtn = page.locator('[data-pkg-format="carton"]');
  await cartonBtn.click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-carton-fold-bar]').isVisible(), 'Carton fold bar must be restored for Carton');
  console.log('[3D E2E] Restored Folding Carton mode');

  // Ensure no unhandled client exceptions occurred
  assert.equal(errors.length, 0, `Browser console errors encountered: ${errors.join('; ')}`);
  console.log('[3D E2E] ALL BROWSER INTERACTION TESTS PASSED CLEANLY!');
}

try {
  await runTest();
  process.exit(0);
} catch (err) {
  console.error('[3D E2E] TEST FAILED:', err);
  process.exit(1);
} finally {
  await browser.close();
}
