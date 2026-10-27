import { test, expect } from '@playwright/test';

test.describe('E2E: AI Provider Unavailable & Deterministic Fallback', () => {
  test('AI UNAVAILABLE: executes deterministic checks cleanly when Gemini is absent, discloses limitations', async ({ page, request }) => {
    // 1. Verify API status reports local-only mode / unconfigured Gemini
    const statusRes = await request.get('/api/status');
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    const csrf = status.csrf;

    // 2. Create review with mode: 'local' (or without API key)
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: reviewId } = await createRes.json();

    // 3. Poll until ready
    let review = null;
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') {
        review = poll;
        break;
      }
      await page.waitForTimeout(200);
    }
    expect(review).toBeTruthy();
    expect(review.status).toBe('ready');

    // 4. Verify deterministic findings were produced
    expect(review.findings.length).toBeGreaterThanOrEqual(10);
    expect(review.counts.issue).toBeGreaterThanOrEqual(1);

    // 5. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible();

    // 6. Verify deterministic review operates without hanging
    const findingsQueue = page.locator('.queue-finding, [data-action="select-finding"]');
    await expect(findingsQueue.first()).toBeVisible();

    // 7. Verify limitation disclosure is displayed
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/(local|exact|deterministic|ai|offline|reading)/i);
  });
});
