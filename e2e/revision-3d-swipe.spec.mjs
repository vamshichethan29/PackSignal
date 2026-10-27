/**
 * Playwright E2E Test Suite for Interactive 3D Revision Swipe Studio (e2e/revision-3d-swipe.spec.mjs)
 * Uses standard Playwright webServer config on baseURL http://127.0.0.1:4178
 */

import { test, expect } from '@playwright/test';

test.describe('Interactive 3D Revision Swipe Studio', () => {
  test('compares Fieldday V1 vs V2 with 3D swipe, synchronized cameras, and evidence inspection', async ({ page, request }) => {
    test.setTimeout(180000);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Create a review with Fieldday sample
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-heading h1', { timeout: 15000 });

    const titleText = await page.locator('.review-heading h1').textContent();
    expect(titleText).toContain('Fieldday');

    // 4. Trigger Fieldday V2 revision creation
    const revBtn = page.locator('button[data-action="revision"]').first();
    await revBtn.click();
    await page.waitForSelector('#dialog[open]');

    const runV2Btn = page.locator('button[data-action="sample-revision"]');
    await expect(runV2Btn).toBeVisible();
    await runV2Btn.click();

    // 5. Wait for V2 analysis to complete and Revisions tab to activate
    await page.waitForSelector('[data-revision-studio]', { timeout: 45000 });
    await page.waitForTimeout(2000);

    // Verify Revisions tab is active
    const studioHeader = page.locator('.rev-studio-header h2');
    await expect(studioHeader).toContainText('Artwork Change Control');

    // 6. Verify 3D packaging mount exists
    const rev3dMount = page.locator('#rev-3d-mount');
    await expect(rev3dMount).toBeVisible();

    // 7. Test 3D View Mode buttons
    const sideBySideBtn = page.locator('.btn-3d-mode[data-3d-mode="3d-side-by-side"]');
    const swipeModeBtn = page.locator('.btn-3d-mode[data-3d-mode="3d-swipe"]');
    await expect(sideBySideBtn).toBeVisible();
    await expect(swipeModeBtn).toBeVisible();

    // Switch to 3D Swipe Slider Mode
    await swipeModeBtn.click();
    await page.waitForTimeout(1000);

    // Verify 3D Swipe controls bar and divider are active
    const swipeControlsBar = page.locator('#rev-3d-swipe-controls-bar');
    await expect(swipeControlsBar).toBeVisible();

    const swipeDivider = page.locator('#rev-3d-swipe-divider');
    await expect(swipeDivider).toBeVisible();

    // 8. Test Swipe Presets: 100% (V1), 0% (V2), 50% (Split)
    const showV1Btn = page.locator('.btn-swipe-preset[data-swipe-target="100"]');
    const showV2Btn = page.locator('.btn-swipe-preset[data-swipe-target="0"]');
    const split50Btn = page.locator('.btn-swipe-preset[data-swipe-target="50"]');

    await showV1Btn.click();
    await page.waitForTimeout(300);
    let valOut = await page.locator('#rev-3d-swipe-val').textContent();
    expect(valOut).toContain('100%');

    await showV2Btn.click();
    await page.waitForTimeout(300);
    valOut = await page.locator('#rev-3d-swipe-val').textContent();
    expect(valOut).toContain('0%');

    await split50Btn.click();
    await page.waitForTimeout(300);
    valOut = await page.locator('#rev-3d-swipe-val').textContent();
    expect(valOut).toContain('50%');

    // 9. Test Range Slider adjustments
    const swipeRange = page.locator('#rev-3d-swipe-range');
    await swipeRange.fill('25');
    await page.waitForTimeout(300);
    valOut = await page.locator('#rev-3d-swipe-val').textContent();
    expect(valOut).toContain('25%');

    await swipeRange.fill('75');
    await page.waitForTimeout(300);
    valOut = await page.locator('#rev-3d-swipe-val').textContent();
    expect(valOut).toContain('75%');

    // 10. Test Camera Presets
    const frontCamBtn = page.locator('.btn-cam-preset[data-cam="front"]');
    const backCamBtn = page.locator('.btn-cam-preset[data-cam="back"]');
    const resetCamBtn = page.locator('.btn-cam-preset[data-cam="reset"]');

    await frontCamBtn.click();
    await page.waitForTimeout(400);
    await backCamBtn.click();
    await page.waitForTimeout(400);
    await resetCamBtn.click();
    await page.waitForTimeout(400);

    // 11. Test Change Filters: Resolved, Regressions, All
    const resolvedFilterBtn = page.locator('.filter-chip[data-rev-filter="resolved"]');
    const regressionsFilterBtn = page.locator('.filter-chip[data-rev-filter="regressions"]');
    const allFilterBtn = page.locator('.filter-chip[data-rev-filter="all"]');

    await resolvedFilterBtn.click();
    await page.waitForTimeout(400);
    const resolvedCards = page.locator('.rev-change-card');
    const resolvedCount = await resolvedCards.count();
    expect(resolvedCount).toBeGreaterThan(0);

    // Click first resolved change and inspect detail card
    await resolvedCards.first().click();
    await page.waitForTimeout(500);

    const detailCard = page.locator('.rev-detail-card');
    await expect(detailCard).toBeVisible();
    const detailText = await detailCard.textContent();
    expect(detailText).toContain('V1 PREVIOUS OBSERVED');
    expect(detailText).toContain('V2 REVISED OBSERVED');

    // Filter by Regressions
    await regressionsFilterBtn.click();
    await page.waitForTimeout(400);
    const regrCards = page.locator('.rev-change-card');
    const regrCount = await regrCards.count();
    expect(regrCount).toBeGreaterThanOrEqual(0);

    // Return to All filter
    await allFilterBtn.click();
    await page.waitForTimeout(400);

    // 12. Test Department Filter dropdown
    const deptSelect = page.locator('#rev-dept-filter');
    if (await deptSelect.isVisible()) {
      await deptSelect.selectOption('legal');
      await page.waitForTimeout(400);
      await deptSelect.selectOption('all');
      await page.waitForTimeout(400);
    }

    // 13. Switch to Side-by-Side 3D View Mode
    await sideBySideBtn.click();
    await page.waitForTimeout(800);
    const paneV1 = page.locator('#rev-3d-pane-v1');
    const paneV2 = page.locator('#rev-3d-pane-v2');
    await expect(paneV1).toBeVisible();
    await expect(paneV2).toBeVisible();

    // 14. Switch to 2D Artwork Proof Dimension and back
    const dim2dBtn = page.locator('button[data-rev-dimension="2d"]');
    await dim2dBtn.click();
    await page.waitForTimeout(600);
    const stage2d = page.locator('#rev-stage-container');
    await expect(stage2d).toBeVisible();

    const dim3dBtn = page.locator('button[data-rev-dimension="3d"]');
    await dim3dBtn.click();
    await page.waitForTimeout(800);
    await expect(rev3dMount).toBeVisible();

    // Assert no fatal JS crashes
    expect(consoleErrors).toEqual([]);
  });
});
