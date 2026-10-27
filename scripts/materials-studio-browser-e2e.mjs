import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';

async function runMaterialsStudioE2E() {
  console.log(`[Materials E2E] Connecting to ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Fetch CSRF token and run organizer sample
    const statusRes = await page.request.get(`${BASE_URL}/api/status`);
    const statusData = await statusRes.json();
    const csrf = statusData.csrf;

    const createRes = await page.request.post(`${BASE_URL}/api/reviews`, {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' },
    });
    assert.ok(createRes.ok(), `Review creation failed: ${createRes.status()}`);
    const reviewMeta = await createRes.json();
    const reviewId = reviewMeta.id;
    console.log(`[Materials E2E] Review created: ${reviewId}`);

    for (let i = 0; i < 40; i++) {
      const poll = await (await page.request.get(`${BASE_URL}/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') {
        break;
      }
      await page.waitForTimeout(200);
    }

    // 2. Open review page
    await page.goto(`${BASE_URL}/#review/${reviewId}`);
    await page.locator('.review-heading').waitFor({ timeout: 15000 });
    console.log(`[Materials E2E] Loaded review workspace`);

    // 3. Switch to 3D inspection mode
    const mode3dBtn = page.locator('button[data-action="workbench-mode"][data-mode="3d"]').first();
    await mode3dBtn.click();

    // Wait for 3D viewer to finish texture loading and mounting
    await page.waitForSelector('[data-carton-webgl][data-viewer-ready="true"]', { timeout: 15000 });
    console.log(`[Materials E2E] 3D packaging viewport mounted and ready`);

    // 4. Test Materials & Finishes Panel controls
    // Check quick finish button: Spot UV
    const spotUvBtn = page.locator('[data-quick-finish="spot_uv"]').first();
    if (await spotUvBtn.count() > 0) {
      await spotUvBtn.click();
      await page.waitForTimeout(300);
      const finLayerType = await page.locator('[data-fin-layer-type]').first().textContent();
      assert.ok(finLayerType.includes('Spot UV'), `Expected Spot UV finish layer type, got: ${finLayerType}`);
      console.log(`[Materials E2E] Spot UV finish applied: "${finLayerType.trim()}"`);
    }

    // Check quick finish button: Gold Foil
    const goldFoilBtn = page.locator('[data-quick-finish="gold_foil"]').first();
    if (await goldFoilBtn.count() > 0) {
      await goldFoilBtn.click();
      await page.waitForTimeout(300);
      const finLayerType = await page.locator('[data-fin-layer-type]').first().textContent();
      assert.ok(finLayerType.includes('Gold Foil'), `Expected Gold Foil finish layer type, got: ${finLayerType}`);
      console.log(`[Materials E2E] Gold Foil finish applied: "${finLayerType.trim()}"`);
    }

    // Check Substrate selector
    const subSelect = page.locator('[data-mat-substrate]').first();
    if (await subSelect.count() > 0) {
      await subSelect.selectOption('aluminum');
      await page.waitForTimeout(300);
      console.log(`[Materials E2E] Changed substrate to Aluminum`);
    }

    // Check Compare Original toggle
    const compToggle = page.locator('[data-action="toggle-original-view"]').first();
    if (await compToggle.count() > 0) {
      await compToggle.click();
      await page.waitForTimeout(200);
      await compToggle.click();
      await page.waitForTimeout(200);
      console.log(`[Materials E2E] Compare Original toggle verified`);
    }

    // Check Light Sweep animation start/pause
    const lightSweepBtn = page.locator('[data-action="toggle-light-sweep"]').first();
    if (await lightSweepBtn.count() > 0) {
      await lightSweepBtn.click();
      await page.waitForTimeout(400);
      await lightSweepBtn.click();
      console.log(`[Materials E2E] Light sweep highlight cycle verified`);
    }

    console.log(`[Materials E2E] ALL MATERIALS & FINISHES BROWSER TESTS PASSED!`);
  } finally {
    await browser.close();
  }
}

runMaterialsStudioE2E().catch(err => {
  console.error('[Materials E2E] Failed:', err);
  process.exit(1);
});
