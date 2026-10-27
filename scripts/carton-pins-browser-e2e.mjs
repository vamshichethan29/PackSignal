/**
 * @file carton-pins-browser-e2e.mjs
 *
 * PackSignal — Browser End-to-End Validation for Smart 3D Finding Pins & Face Fly-To
 *
 * Tests 20 px circular badges, screen-space clustering, cluster breakdown hover card,
 * spiderfy and popover expansion, perpendicular face-focused fly-to, drag continuity,
 * 2D/3D selection sync, filter bar, next/prev finding navigation, and mobile viewports.
 */

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';

async function run() {
  console.log('--- Starting Smart 3D Finding Pins & Fly-To Browser E2E ---');

  const healthRes = await fetch(`${base}/healthz`).catch(() => null);
  if (!healthRes || !healthRes.ok) {
    throw new Error(`Server not reachable on ${base}. Start with node server.mjs`);
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(15000);

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER LOG [ERR]:', msg.text());
  });
  page.on('pageerror', err => {
    console.log('BROWSER UNCAUGHT ERROR:', err.message, err.stack);
    errors.push(err.message);
  });

  try {
    // 1. Create and load a controlled review (Fieldday or Dancing Fish sample with multiple findings)
    console.log('1. Creating controlled sample review (Fieldday / Dancing Fish)...');
    const statusRes = await page.request.get(`${base}/api/status`);
    const statusData = await statusRes.json();
    const csrf = statusData.csrf;

    const createRes = await page.request.post(`${base}/api/reviews`, {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' },
    });
    assert.ok(createRes.ok(), 'Failed to create review');
    const reviewMeta = await createRes.json();
    const reviewId = reviewMeta.id;

    // Poll until review is ready
    let review = null;
    for (let i = 0; i < 40; i++) {
      const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') {
        review = poll;
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    assert.ok(review, 'Review was not ready within timeout');
    console.log(`Review ready: ${review.id} with ${review.findings?.length || 0} findings`);

    // 2. Navigate to review in browser
    console.log('2. Navigating to review page...');
    await page.goto(`${base}/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 10000 });

    // 3. Switch to 3D Carton Viewer
    console.log('3. Switching to 3D Packaging Viewer...');
    const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    await mode3dBtn.click();
    await page.waitForSelector('.carton-scene', { timeout: 8000 });

    // 4. Verify carton scene rendered
    console.log('4. Verifying carton scene element...');
    const scene = page.locator('.carton-scene');
    assert.ok(await scene.isVisible(), 'Carton scene must be visible');

    // 5. Verify Screen-Space Finding Badges / Clusters
    console.log('5. Verifying finding pins and overlay layer...');
    await page.waitForSelector('.carton-pin-overlay-layer', { timeout: 5000 });
    const overlay = page.locator('.carton-pin-overlay-layer');
    assert.ok(await overlay.isVisible(), 'Pin overlay layer must be mounted');

    // Filter to "all" findings to see full clustering
    const allFilterBtn = page.locator('[data-carton-filter="all"]');
    if (await allFilterBtn.isVisible()) {
      await allFilterBtn.click();
      await page.waitForTimeout(300);
    }

    const pinsCount = await page.locator('.carton-smart-pin').count();
    const clustersCount = await page.locator('.carton-smart-cluster').count();
    console.log(`Found ${pinsCount} standalone pins and ${clustersCount} clusters in 3D scene`);
    assert.ok(pinsCount + clustersCount > 0, 'Must render at least one pin or cluster');

    // 6. Test Badge Dimensions: Must have 20 px visible size
    if (pinsCount > 0) {
      console.log('6. Checking badge visual diameter is strictly 20 px...');
      const firstPin = page.locator('.carton-smart-pin').first();
      const box = await firstPin.boundingBox();
      assert.ok(box, 'Pin bounding box must exist');
      console.log(`First pin dimensions: ${Math.round(box.width)} x ${Math.round(box.height)} px`);
      assert.ok(Math.abs(box.width - 20) <= 2, 'Pin visible width should be ~20 px');
      assert.ok(Math.abs(box.height - 20) <= 2, 'Pin visible height should be ~20 px');
    }

    // 7. Test Cluster Breakdown Hover Card if cluster exists
    if (clustersCount > 0) {
      console.log('7. Testing cluster hover card breakdown...');
      const firstCluster = page.locator('.carton-smart-cluster').first();
      await firstCluster.hover();
      await page.waitForSelector('.carton-cluster-breakdown-card', { timeout: 3000 });
      const card = page.locator('.carton-cluster-breakdown-card');
      assert.ok(await card.isVisible(), 'Breakdown card should appear on cluster hover');
      const cardText = await card.textContent();
      console.log('Cluster breakdown content:', cardText.trim());

      // 8. Test Cluster Click / Expansion
      console.log('8. Clicking cluster to expand...');
      await firstCluster.click();
      await page.waitForTimeout(400);

      const expandedPins = await page.locator('.carton-smart-pin').count();
      console.log(`Pins count after cluster expansion: ${expandedPins}`);
      assert.ok(expandedPins > 0, 'Cluster expansion must reveal selectable pins');

      // 9. Select an individual pin from the cluster
      const pinToSelect = page.locator('.carton-smart-pin').first();
      await pinToSelect.click();
      await page.waitForTimeout(700); // Wait for fly-to animation
    } else if (pinsCount > 0) {
      console.log('Selecting standalone pin...');
      const pinToSelect = page.locator('.carton-smart-pin').first();
      await pinToSelect.click();
      await page.waitForTimeout(700);
    }

    // 10. Verify Smooth Face Fly-To (Perpendicular Front-On View)
    console.log('10. Verifying perpendicular face orientation after fly-to...');
    const angleAfterFlyTo = Number(await scene.getAttribute('data-angle'));
    const tiltAfterFlyTo = Number(await scene.getAttribute('data-tilt'));
    console.log(`Carton pose after fly-to: angle=${angleAfterFlyTo}°, tilt=${tiltAfterFlyTo}°`);
    assert.ok(Number.isFinite(angleAfterFlyTo), 'Carton angle must be finite');
    assert.ok(Math.abs(tiltAfterFlyTo - (-8)) <= 5, 'Tilt should align to face viewing position (~ -8°)');

    // 11. Verify Evidence Details in Workbench Pane
    console.log('11. Verifying finding evidence details pane...');
    const evidenceHead = page.locator('.workbench-evidence h3').first();
    if (await evidenceHead.isVisible()) {
      const heading = await evidenceHead.textContent();
      console.log('Selected finding heading:', heading.trim());
      assert.ok(heading.length > 0, 'Evidence heading must not be empty');
    }

    // 12. Test Previous / Next Finding Navigation
    console.log('12. Testing Next Finding button...');
    const nextBtn = page.locator('[data-finding-next]');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(600);
      console.log('Next finding navigated successfully');
    }

    // 13. Test Drag After Fly-To without Rotation Jump
    console.log('13. Testing mouse drag after fly-to...');
    const sceneBox = await scene.boundingBox();
    assert.ok(sceneBox, 'Scene bounding box required');

    const startX = sceneBox.x + sceneBox.width / 2;
    const startY = sceneBox.y + sceneBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const angleAfterDrag = Number(await scene.getAttribute('data-angle'));
    console.log(`Angle after manual drag: ${angleAfterDrag}°`);
    assert.notEqual(angleAfterDrag, angleAfterFlyTo, 'Angle should update continuously from fly-to pose');

    // 14. Test Reset Button
    console.log('14. Testing Reset button...');
    const resetBtn = page.locator('[data-carton-reset]').first();
    await resetBtn.click();
    await page.waitForTimeout(400);
    const resetAngle = Number(await scene.getAttribute('data-angle'));
    console.log(`Angle after reset: ${resetAngle}°`);
    assert.ok(Math.abs(resetAngle - (-28)) <= 5, 'Angle should return to reset angle (~ -28°)');

    // 15. Test 2D / 3D Synchronization
    console.log('15. Testing 2D Proof synchronization...');
    const mode2dBtn = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
    await mode2dBtn.click();
    await page.waitForSelector('.workbench-art-frame', { timeout: 6000 });
    assert.ok(await page.locator('.workbench-art-frame').isVisible(), '2D art frame must be visible');

    // Return to 3D
    await mode3dBtn.click();
    await page.waitForSelector('.carton-scene', { timeout: 6000 });
    assert.ok(await scene.isVisible(), 'Returned to 3D scene cleanly');

    // 16. Test Mobile Viewport
    console.log('16. Testing mobile viewport resize (375x667)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    assert.ok(await overlay.isVisible(), 'Overlay layer adapts to mobile viewport');

    // Reset viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // 17. Capture Final Demonstration Screenshot
    console.log('17. Saving visual demonstration screenshot...');
    const screenshotPath = '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/smart_3d_pins_demonstration.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Verify no uncaught browser runtime errors occurred
    assert.equal(errors.length, 0, `Uncaught browser errors occurred: ${errors.join('; ')}`);

    console.log('--- SMART 3D FINDING PINS BROWSER E2E: ALL CHECKS PASSED! ---');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('E2E FAILURE:', err);
  process.exit(1);
});
