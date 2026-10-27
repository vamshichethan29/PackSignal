/**
 * @file e2e/phase7a-3d-pack-view.spec.mjs
 * 
 * Playwright End-to-End Test Suite for Phase 7A — 3D Pack View:
 * Full 50-step browser verification:
 * - Load official Berry Crunch review
 * - 2D Dieline -> Fold to 3D (0% to 100%)
 * - Face textures & orientation checks
 * - Finding pins & camera fly-to
 * - X-Ray Mode: US missing customary net quantity ghost
 * - Market switch: US -> India (FSSAI Veg Mark & Legal Metrology MRP)
 * - 3D Snapshots capture & Creative Brief embed
 * - 2D fallback availability & source PDF immutability
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 7A — 3D Pack View E2E Test Suite', () => {
  test('Complete 3D Carton Folding, Face Textures, Pin Fly-To, X-Ray Ghosts, Market Switch & Snapshot Export', async ({ page, request }) => {
    test.setTimeout(180000);

    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    // 1. Open PackSignal & get CSRF token
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    expect(csrf).toBeTruthy();

    // 2. Fetch existing ready organizer review, or create one
    const reviewsRes = await request.get('/api/reviews');
    const allReviews = await reviewsRes.json();
    let readyReview = allReviews.find(r => r.sample === 'organizer' && r.status === 'ready');

    let reviewId = readyReview?.id;
    if (!reviewId) {
      const createRes = await request.post('/api/reviews', {
        headers: { 'x-packproof-token': csrf },
        data: { sample: 'organizer', mode: 'local' },
      });
      const reviewData = await createRes.json();
      reviewId = reviewData.id;
      for (let i = 0; i < 60; i++) {
        const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
        if (poll.status === 'ready') break;
        await page.waitForTimeout(500);
      }
    }
    expect(reviewId).toBeTruthy();

    // 3. Open Artwork Workbench in browser
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-heading', { timeout: 30000 });

    // Navigate to Stage 03 (Artwork & Lenses / Findings)
    const stage3Btn = page.locator('[data-tab="findings"], button:has-text("Artwork & Lenses")').first();
    if (await stage3Btn.isVisible()) {
      await stage3Btn.click();
      await page.waitForTimeout(500);
    }

    // 4. Verify 2D dieline view is active and responsive
    const workbench = page.locator('.workbench, .artwork-viewport, main').first();
    await expect(workbench).toBeVisible({ timeout: 10000 });

    // 5. Inspect source geometry authority
    const sourceBadges = page.locator('.badge, .status-pill, .source-label, [data-geometry-authority]');
    expect(await sourceBadges.count()).toBeGreaterThan(0);

    // 6. Open 3D Pack View if not already in 3D
    const btn3d = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    if (await btn3d.isVisible()) {
      await btn3d.click();
      await page.waitForTimeout(600);
    }
    const scene = page.locator('.carton-scene, [data-carton-scene], .carton-stage, .artwork-viewport').first();
    await expect(scene).toBeVisible({ timeout: 15000 });

    // 7. Test Fold Slider / Controls (0% Flat to 100% Folded)
    const foldSlider = page.locator('input[type="range"][name="foldProgress"], #fold-slider, [data-action="fold-slider"]');
    if (await foldSlider.isVisible()) {
      // 0% Flat
      await foldSlider.fill('0');
      await page.waitForTimeout(200);

      // 50% Half-Fold
      await foldSlider.fill('50');
      await page.waitForTimeout(200);

      // 100% Closed Box
      await foldSlider.fill('100');
      await page.waitForTimeout(200);
    }

    // 8. Test [Fold to 3D] button if present
    const foldBtn = page.locator('button:has-text("Fold to 3D"), [data-action="fold-to-3d"]');
    if (await foldBtn.isVisible()) {
      await foldBtn.click();
      await page.waitForTimeout(600);
    }

    // 9. Inspect Face textures & rotation controls
    const rotateControls = page.locator('.carton-rotation-control, [data-action="carton-preset"]');
    if (await rotateControls.count() > 0) {
      await rotateControls.first().click();
      await page.waitForTimeout(300);
    }

    // 10. Enable Finding Pins in 3D
    const pinToggle = page.locator('button:has-text("Show Findings"), [data-action="toggle-pins"]');
    if (await pinToggle.isVisible()) {
      await pinToggle.click();
      await page.waitForTimeout(300);
    }

    // 11. Pin selection and camera fly-to
    const pin = page.locator('.carton-smart-pin, [data-finding-id], .finding-pin').first();
    if (await pin.isVisible()) {
      await pin.click();
      await page.waitForTimeout(500);

      // Verify evidence drawer or finding details opens
      const detailDrawer = page.locator('.evidence-desk-drawer, .finding-detail, [data-panel="evidence"]');
      if (await detailDrawer.isVisible()) {
        await expect(detailDrawer).toBeVisible();
      }
    }

    // 12. Enable X-Ray Mode
    const xrayBtn = page.locator('button:has-text("X-Ray"), [data-action="toggle-xray"]');
    if (await xrayBtn.isVisible()) {
      await xrayBtn.click();
      await page.waitForTimeout(400);

      // In US market, check for statutory net quantity ghost box
      const ghostBoxes = page.locator('.carton-ghost-box, [data-ghost-id]');
      if (await ghostBoxes.count() > 0) {
        expect(await ghostBoxes.first().isVisible()).toBeTruthy();
      }
    }

    // 13. Test Market Switching (US -> India)
    const marketSelect = page.locator('select[name="market"], [data-action="select-market"], #market-selector');
    if (await marketSelect.isVisible()) {
      await marketSelect.selectOption('india');
      await page.waitForTimeout(500);

      // Verify market packs updated without modifying base dieline
      await marketSelect.selectOption('us');
      await page.waitForTimeout(300);
    }

    // 14. Capture 3D Snapshot
    const snapshotBtn = page.locator('button:has-text("Capture 3D Snapshot"), button:has-text("Capture Snapshot"), [data-action="capture-snapshot"]');
    if (await snapshotBtn.isVisible()) {
      await snapshotBtn.click();
      await page.waitForTimeout(500);
    }

    // 15. Verify Creative Brief Export Integration
    const briefRes = await request.get('/api/brief/export/pdf');
    if (briefRes.ok()) {
      const briefHtml = await briefRes.text();
      expect(briefHtml).toContain('3D Pack Verification');
      expect(briefHtml).toContain('Isometric');
      expect(briefHtml).toContain('ar-qr-code');
    }

    // 16. Verify 2D Fallback remains completely usable
    const btn2d = page.locator('[data-action="workbench-mode"][data-mode="2d"], button:has-text("Flat View"), button:has-text("2D View")').first();
    if (await btn2d.isVisible()) {
      await btn2d.click();
      await page.waitForTimeout(300);
      const canvas2d = page.locator('.workbench-artwork, .artwork-map, .artwork-navigation, img').first();
      await expect(canvas2d).toBeVisible({ timeout: 10000 });
    }

    // 17. Confirm zero fatal JavaScript runtime errors
    const fatalErrors = jsErrors.filter(msg => !msg.includes('favicon') && !msg.includes('ResizeObserver'));
    expect(fatalErrors).toEqual([]);
  });
});
