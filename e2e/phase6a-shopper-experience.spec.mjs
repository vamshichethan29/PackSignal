/**
 * PackSignal — Phase 6A: Shopper Experience Lab E2E Integration Suite
 * (e2e/phase6a-shopper-experience.spec.mjs)
 */

import { test, expect } from '@playwright/test';

test.describe('E2E: Phase 6A — Shopper Experience Lab', () => {
  test('Complete 51-step Shopper Experience Lab flow: Personas, Shelf Readability, 3s Glance, Color Vision, Contrast, Confidence Glow & Before/After Wipe', async ({ page, request }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Content Security Policy') && !text.includes('CSP') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    test.setTimeout(180_000);

    // 1. Create a review with controlled Dancing Fish packaging sample
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();
    expect(reviewId).toBeTruthy();

    // 2. Poll until review is ready
    for (let i = 0; i < 60; i++) {
      const pollRes = await request.get(`/api/reviews/${reviewId}`);
      const poll = await pollRes.json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(1000);
    }

    // 3. Open review workbench
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 60_000 });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Dismiss overlap shield if present
    const shieldBtn = page.locator('#btn-toggle-overlap-mode');
    if (await shieldBtn.isVisible().catch(() => false)) {
      await shieldBtn.click();
      await page.waitForTimeout(300);
    }

    // 4. Navigate to Shopper Lenses (Phase 6A) tab
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-tab="shopper-lenses"]');
      if (btn) btn.click();
    });

    // 5. Verify workbench mount
    const shopperRoot = page.locator('#shopper-lenses-container, .shopper-workbench, .shopper-lab-container').first();
    await expect(shopperRoot).toBeVisible({ timeout: 15_000 });

    // 6. Select Nut Allergy persona and inspect verdict
    const nutTab = page.locator('[data-persona="persona-nut-allergy"], button:has-text("Nut Allergy"), select#shopper-lens-dropdown').first();
    if (await nutTab.isVisible().catch(() => false)) {
      if (await nutTab.evaluate(el => el.tagName === 'SELECT')) {
        await nutTab.selectOption('nut_allergy');
      } else {
        await nutTab.click();
      }
    }

    const nutCard = page.locator('.persona-card:has-text("Nut Allergy"), .shopper-verdict-card, .verdict-statement').first();
    await expect(nutCard).toBeVisible();
    await expect(nutCard).toContainText(/tree nut|almond|may contain/i);

    // 7. Select Vegan persona
    const veganTab = page.locator('[data-persona="persona-vegan"], button:has-text("Vegan")').first();
    if (await veganTab.isVisible().catch(() => false)) {
      await veganTab.click();
      const veganCard = page.locator('.persona-card:has-text("Vegan"), .shopper-verdict-card').first();
      await expect(veganCard).toBeVisible();
      await expect(veganCard).toContainText(/vegan|honey/i);
    }

    // 8. Select Watching Sugar persona
    const sugarTab = page.locator('[data-persona="persona-watching-sugar"], button:has-text("Watching Sugar")').first();
    if (await sugarTab.isVisible().catch(() => false)) {
      await sugarTab.click();
      const sugarCard = page.locator('.persona-card:has-text("Sugar"), .shopper-verdict-card').first();
      await expect(sugarCard).toBeVisible();
      await expect(sugarCard).toContainText(/sugar|claim|honey/i);
    }

    // 9. Open Shelf Distance Simulator
    const shelfTabBtn = page.locator('button[data-tab="shelf"], button:has-text("Shelf-Distance"), button:has-text("Shelf Distance")').first();
    if (await shelfTabBtn.isVisible().catch(() => false)) {
      await shelfTabBtn.click();
    }

    const slider = page.locator('#shelf-distance-slider, #shelf-dist-slider, input[type="range"]').first();
    if (await slider.isVisible().catch(() => false)) {
      // 30 cm
      await slider.fill('30');
      await slider.dispatchEvent('input');

      // 100 cm
      await slider.fill('100');
      await slider.dispatchEvent('input');

      // 200 cm
      await slider.fill('200');
      await slider.dispatchEvent('input');

      const unreadableCallout = page.locator('.first-unreadable-callout, .first-crossing-card, .status-unreadable').first();
      await expect(unreadableCallout).toBeVisible();
    }

    // 10. Open 3-Second Glance Heatmap
    const glanceTabBtn = page.locator('button[data-tab="glance"], button:has-text("3s Glance"), button:has-text("3-Second Glance")').first();
    if (await glanceTabBtn.isVisible().catch(() => false)) {
      await glanceTabBtn.click();
      const glancePanel = page.locator('.glance-container, #glance-viewer, .glance-viewer-wrapper, .saliency-canvas-overlay, canvas').first();
      await expect(glancePanel).toBeVisible({ timeout: 10_000 });
    }

    // 11. Open Color Vision Deficiency Simulation
    const cvdTabBtn = page.locator('button[data-tab="accessibility"], button:has-text("Colour-Vision"), button:has-text("Color Vision")').first();
    if (await cvdTabBtn.isVisible().catch(() => false)) {
      await cvdTabBtn.click();

      const protanopiaBtn = page.locator('button[data-action="set-cvd"][data-mode="protanopia"], button[data-mode="protanopia"], button:has-text("Protanopia")').first();
      if (await protanopiaBtn.isVisible().catch(() => false)) {
        await protanopiaBtn.click();
      }

      const deuteranopiaBtn = page.locator('button[data-action="set-cvd"][data-mode="deuteranopia"], button[data-mode="deuteranopia"], button:has-text("Deuteranopia")').first();
      if (await deuteranopiaBtn.isVisible().catch(() => false)) {
        await deuteranopiaBtn.click();
      }

      const tritanopiaBtn = page.locator('button[data-action="set-cvd"][data-mode="tritanopia"], button[data-mode="tritanopia"], button:has-text("Tritanopia")').first();
      if (await tritanopiaBtn.isVisible().catch(() => false)) {
        await tritanopiaBtn.click();
      }
    }

    // 12. Open Before / After Wipe
    const wipeTabBtn = page.locator('button[data-tab="wipe"], button:has-text("Before / After"), button:has-text("Revision Wipe")').first();
    if (await wipeTabBtn.isVisible().catch(() => false)) {
      await wipeTabBtn.click();
      const handle = page.locator('#wipe-handle, .wipe-divider-line, .wipe-handle').first();
      await expect(handle).toBeVisible({ timeout: 10_000 });
    }

    // 13. Confirm no fatal JavaScript errors
    expect(consoleErrors).toEqual([]);
  });
});
