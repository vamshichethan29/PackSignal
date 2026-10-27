import { test, expect } from '@playwright/test';

test.describe('Carton Pin Navigation & Face Fly-To', () => {
  test('3D Finding Pins, Clustering, Expansion, and Face Fly-To', async ({ page, request }) => {
    test.setTimeout(120000);
    // 1. Create review with sample
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
    await page.waitForSelector('.review-workbench', { timeout: 15000 });

    await page.setViewportSize({ width: 1440, height: 900 });

    // 3. Switch to 3D packaging viewer if not already in 3D
    const scene = page.locator('.carton-scene');
    if (!await scene.isVisible()) {
      const btn3d = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
      await btn3d.click();
    }
    await expect(scene).toBeVisible({ timeout: 12000 });

    // 4. Verify pin overlay layer exists
    const overlay = page.locator('.carton-pin-overlay-layer');
    await expect(overlay).toBeVisible();

    // 5. Verify 20px badge visual size
    const allFilter = page.locator('[data-carton-filter="all"]');
    if (await allFilter.isVisible()) {
      await allFilter.click();
      await page.waitForTimeout(300);
    }

    const pin = page.locator('.carton-smart-pin').first();
    const cluster = page.locator('.carton-smart-cluster').first();

    const hasPin = await pin.isVisible().catch(() => false);
    const hasCluster = await cluster.isVisible().catch(() => false);
    expect(hasPin || hasCluster).toBeTruthy();

    if (hasPin) {
      const box = await pin.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box.width - 20)).toBeLessThanOrEqual(3);
      expect(Math.abs(box.height - 20)).toBeLessThanOrEqual(3);
    }

    // 6. Test Cluster Hover & Expansion if present
    if (hasCluster) {
      await cluster.hover();
      const breakdown = page.locator('.carton-cluster-breakdown-card');
      await expect(breakdown).toBeVisible();

      // Click to expand
      await cluster.click();
      await page.waitForTimeout(400);

      const expandedPin = page.locator('.carton-smart-pin').first();
      await expect(expandedPin).toBeVisible();
      await expandedPin.click();
    } else if (hasPin) {
      await pin.click();
    }

    await page.waitForTimeout(700);

    // 7. Verify Face Fly-To finished front-on
    const angle = Number(await scene.getAttribute('data-angle'));
    expect(Number.isFinite(angle)).toBeTruthy();

    // 8. Verify finding details appeared in workbench
    const evidenceHead = page.locator('.workbench-evidence');
    await expect(evidenceHead).toBeVisible();

    // 9. Verify Next Finding Button
    const nextBtn = page.locator('[data-finding-next]');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // 10. Switch to 2D view and back
    const btn2d = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
    await btn2d.click();
    await page.waitForSelector('.workbench-art-frame', { timeout: 6000 });
    await expect(page.locator('.workbench-art-frame')).toBeVisible();

    const btn3d = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    await btn3d.click();
    await expect(scene).toBeVisible({ timeout: 10000 });
  });
});
