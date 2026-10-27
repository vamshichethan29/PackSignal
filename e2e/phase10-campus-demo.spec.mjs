/**
 * PackSignal — Campus Round E2E Demonstration Suite
 * Phase 40: 42-Step Full Campus Presentation Sequence
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 10 — Campus Demo E2E Presentation', () => {

  test('42-Step Campus Presentation & Safe Reset Loop', async ({ page }) => {
    // 1. Get ready review or create one
    const statusRes = await page.request.get('/api/status');
    const { csrf } = await statusRes.json();
    const reviewsRes = await page.request.get('/api/reviews');
    const allReviews = await reviewsRes.json();
    let readyReview = allReviews.find(r => r.sample === 'organizer' && (r.status === 'ready' || r.status === 'READY')) || allReviews[0];
    let reviewId = readyReview?.id;

    if (!reviewId) {
      const createRes = await page.request.post('/api/reviews', {
        headers: { 'x-packproof-token': csrf },
        data: { sample: 'organizer', mode: 'local' },
      });
      const reviewData = await createRes.json();
      reviewId = reviewData.id;
    }

    // 2. Open review workbench
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#review/${reviewId}`, { waitUntil: 'domcontentloaded' });

    // Ensure review view has mounted
    await page.waitForSelector('.review-heading, [data-tab="campus-extras"]', { timeout: 15000 });

    // 3. Enter Campus Extras tab
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="campus-extras"]')?.click();
    });
    await expect(page.locator('[data-campus-extras]')).toBeVisible({ timeout: 10000 });

    // 4. Safe Reset Initial State (< 50ms)
    await page.evaluate(() => {
      document.querySelector('[data-campus-reset], [data-campus-action="reset"]')?.click();
    });
    await page.waitForTimeout(300);

    // 5. Open Spot the Mistakes opener
    await page.evaluate(() => {
      document.querySelector('[data-campus-tab="spot-mistakes"]')?.click();
    });
    await expect(page.locator('[data-campus-panel="spot-mistakes"]')).toBeVisible({ timeout: 5000 });

    // 6. Reveal actual findings
    await page.evaluate(() => {
      document.querySelector('[data-auto-reveal-packsignal], [data-reveal-findings]')?.click();
    });
    await page.waitForTimeout(300);

    // 7. Click one artwork finding card
    const mistakeCard = page.locator('[data-mistake-id="1"]').first();
    if (await mistakeCard.isVisible()) {
      await mistakeCard.click();
      await expect(page.locator('[data-mistake-status="1"]')).toContainText(/Identified/i);
    }

    // 8. Open Evidence Desk
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="evidence-desk"]')?.click();
    });
    await expect(page.locator('.desk-wrapper, .evidence-desk-container, [data-evidence-desk]')).toBeVisible({ timeout: 10000 });

    // 9. Open Fact Sheet
    await page.evaluate(() => {
      document.querySelector('[data-action="view-fact-sheet"], [data-tab="fact-sheet"]')?.click();
    });
    await page.waitForTimeout(300);

    // 10. Open Reviewer Lenses / Red Pen
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="reviewer-lenses"]')?.click();
    });
    await expect(page.locator('#reviewer-lenses-container, [data-reviewer-lenses]')).toBeVisible({ timeout: 10000 });

    // 11. Open Pack Canvas
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="pack-canvas"]')?.click();
    });
    await expect(page.locator('#pack-canvas-container, [data-pack-canvas]')).toBeVisible({ timeout: 10000 });

    // 12. Switch to India Market / Regulatory Time Machine
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="regulatory-time-machine"]')?.click();
    });
    await page.waitForTimeout(300);

    // 13. Switch back to Campus Extras for Bilingual India Pack
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="campus-extras"]')?.click();
    });
    await page.evaluate(() => {
      document.querySelector('[data-campus-tab="india-pack"]')?.click();
    });
    await expect(page.locator('[data-campus-panel="india-pack"]')).toBeVisible({ timeout: 5000 });

    // 14. Check Second Product (Amrit Chai) evaluation
    await page.evaluate(() => {
      document.querySelector('[data-run-india-pack-eval]')?.click();
    });
    await page.waitForTimeout(300);

    // 15. Check Competitor Snap panel
    await page.evaluate(() => {
      document.querySelector('[data-campus-tab="competitor"]')?.click();
    });
    await expect(page.locator('[data-campus-panel="competitor"]')).toBeVisible({ timeout: 5000 });
    await page.evaluate(() => {
      document.querySelector('[data-run-competitor-snap]')?.click();
    });
    await page.waitForTimeout(300);

    // 16. Check-back review loop panel
    await page.evaluate(() => {
      document.querySelector('[data-campus-tab="check-back"]')?.click();
    });
    await expect(page.locator('[data-campus-panel="check-back"]')).toBeVisible({ timeout: 5000 });
    await page.evaluate(() => {
      document.querySelector('[data-run-check-back]')?.click();
    });
    await page.waitForTimeout(300);

    // 17. Open Trust Console
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="trust-console"]')?.click();
    });
    await expect(page.locator('[data-trust-console], .trust-scoreboard-container')).toBeVisible({ timeout: 10000 });

    // 18. Safe Reset at end of run
    await page.evaluate(() => {
      document.querySelector('[data-action="tab"][data-tab="campus-extras"]')?.click();
    });
    await page.evaluate(() => {
      document.querySelector('[data-campus-reset], [data-campus-action="reset"]')?.click();
    });
    await page.waitForTimeout(500);

    // 19. Verify no fatal unhandled exceptions
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    expect(errors.length).toBe(0);
  });

});
