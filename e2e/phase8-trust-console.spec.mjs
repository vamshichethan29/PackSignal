import { test, expect } from '@playwright/test';

test.describe('Phase 8 — Trust Console & Self-Test Scoreboard', () => {
  test('Complete Browser Flow: Generate, Self-Test, Scoreboard, Bake-Off, and Release Gates', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Get ready review or create one
    const statusRes = await page.request.get('/api/status');
    const { csrf } = await statusRes.json();
    const reviewsRes = await page.request.get('/api/reviews');
    const allReviews = await reviewsRes.json();
    let readyReview = allReviews.find(r => r.sample === 'organizer' && r.status === 'ready') || allReviews[0];
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
    await page.waitForSelector('.review-heading', { timeout: 30000 });

    // Click Trust Console button in review actions / tabs
    await page.evaluate(() => {
      const btn = document.querySelector('[data-action="tab"][data-tab="trust-console"]');
      if (btn) btn.click();
    });

    // 3. Verify Trust Console View is Mounted
    const trustWorkbench = page.locator('[data-trust-console], .trust-console-workbench');
    await expect(trustWorkbench).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-trust-console] h1').first()).toContainText(/Trust Console/i);

    // 4. Test Subtab: Broken Test Generator
    const genTabBtn = page.locator('[data-trust-tab="generator"]');
    await expect(genTabBtn).toBeVisible();
    await genTabBtn.click();
    await page.waitForTimeout(300);

    const runGenBtn = page.locator('[data-action="run-generator"]');
    await expect(runGenBtn).toBeVisible();
    await runGenBtn.click();

    const genResults = page.locator('#gen-results-panel');
    await expect(genResults).toBeVisible({ timeout: 5000 });
    await expect(genResults).toContainText(/Generated/i);

    // 5. Test Subtab: Scoreboard and Run Self-Test
    const scoreTabBtn = page.locator('[data-trust-tab="scoreboard"]');
    await expect(scoreTabBtn).toBeVisible();
    await scoreTabBtn.click();
    await page.waitForTimeout(300);

    const runSelfTestBtn = page.locator('[data-action="run-self-test"]').first();
    await expect(runSelfTestBtn).toBeVisible();
    await runSelfTestBtn.click();

    // 6. Observe progress and completion
    await page.waitForTimeout(1000);
    const scoreboardHeader = page.locator('.ts-title').first();
    await expect(scoreboardHeader).toBeVisible();

    // 7. Verify Metric Highlights ("Caught X of Y")
    const caughtMetric = page.getByText(/Planted Defects Caught/i).first();
    await expect(caughtMetric).toBeVisible({ timeout: 8000 });

    // 8. Test Subtab: Model Bake-Off
    const bakeOffTabBtn = page.locator('[data-trust-tab="bakeoff"]');
    await expect(bakeOffTabBtn).toBeVisible();
    await bakeOffTabBtn.click();
    await page.waitForTimeout(400);

    // Leaderboard table must show winning model gemini-3.8-flash
    const leaderboard = page.locator('table').first();
    await expect(leaderboard).toBeVisible();
    await expect(page.locator('text=gemini-3.8-flash').first()).toBeVisible();
    await expect(page.locator('text=WINNER').first()).toBeVisible();

    // 9. Test Subtab: Change Log
    const changeLogTabBtn = page.locator('[data-trust-tab="changelog"]');
    await expect(changeLogTabBtn).toBeVisible();
    await changeLogTabBtn.click();
    await page.waitForTimeout(300);

    const phase8Entry = page.locator('text=/Phase 8/i').first();
    await expect(phase8Entry).toBeVisible();

    // 10. Test Subtab: Feature Freeze Release Gates
    const gatesTabBtn = page.locator('[data-trust-tab="gates"]');
    await expect(gatesTabBtn).toBeVisible();
    await gatesTabBtn.click();
    await page.waitForTimeout(300);

    const freezeBanner = page.locator('text=/READY_FOR_FREEZE/i');
    await expect(freezeBanner).toBeVisible();
    const gatePassBadges = page.locator('text=/PASS ✓/i');
    expect(await gatePassBadges.count()).toBeGreaterThanOrEqual(10);

    // 11. Confirm zero fatal uncaught console errors
    const fatalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(fatalErrors).toHaveLength(0);
  });
});
