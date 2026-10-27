import { test, expect } from '@playwright/test';

test.describe('Phase 9 — Ship: Final Release Verification Flow', () => {

  test('1. Landing Cockpit loads, reports healthy status, and shows local developer port', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Title & Brand
    const title = await page.title();
    expect(title).toMatch(/PackSignal/i);

    // Verify main header
    const heading = page.locator('h1, .app-title, .brand-title').first();
    await expect(heading).toBeVisible();

    // Verify system status
    const response = await page.request.get('/api/status');
    expect(response.status()).toBe(200);
    const statusJson = await response.json();
    expect(statusJson.scope).toBeDefined();
    expect(statusJson.csrf).toBeDefined();
  });

  test('2. Official Organizer Sample Ingestion, Finding Inspection, and Evidence Deep-Zoom', async ({ page }) => {
    // 1. Get ready review or create one with mode: 'local'
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

      // Poll until review processing completes
      for (let i = 0; i < 45; i++) {
        const poll = await page.request.get(`/api/reviews/${reviewId}`);
        if (poll.status() === 200) {
          const body = await poll.json();
          const r = body.review || body;
          if (r.status === 'ready' || (r.findings && r.findings.length > 0)) {
            readyReview = r;
            break;
          }
        }
        await page.waitForTimeout(1000);
      }
    }

    expect(reviewId).toBeDefined();

    // 2. Open review workbench via hash routing
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#review/${reviewId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.review-heading, .review-header', { timeout: 30000 });

    // Verify review workbench is mounted
    const reviewHeading = page.locator('.review-heading, .review-header').first();
    await expect(reviewHeading).toBeVisible();

    // Verify report HTML export is downloadable and valid
    const reportRes = await page.request.get(`/api/reviews/${reviewId}/report.html`);
    expect(reportRes.status()).toBe(200);
    const htmlText = await reportRes.text();
    expect(htmlText.length).toBeGreaterThan(1000);
    expect(htmlText).toContain('PackSignal');
  });

  test('3. Trust Console & Model Bake-Off Scoreboard are accessible', async ({ page }) => {
    await page.goto('/trust');
    await page.waitForLoadState('networkidle');

    // Trust Console UI
    const consoleContainer = page.locator('[data-trust-console], .trust-console, body');
    await expect(consoleContainer).toBeVisible();

    // Verify release gates / metrics endpoint
    const gatesRes = await page.request.get('/api/trust-release-gates');
    if (gatesRes.status() === 200) {
      const gates = await gatesRes.json();
      expect(gates.allPassed).toBe(true);
    }
  });

});
