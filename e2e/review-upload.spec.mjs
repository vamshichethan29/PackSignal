import { test, expect } from '@playwright/test';

test.describe('E2E: Package Review Workflow & Evidence Verification', () => {
  test('creates review with organizer sample and verifies finding evidence', async ({ page, request, baseURL }) => {
    // 1. Get CSRF token
    const statusRes = await request.get('/api/status');
    expect(statusRes.ok()).toBeTruthy();
    const { csrf } = await statusRes.json();

    // 2. Create review with sample
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const reviewMeta = await createRes.json();
    const reviewId = reviewMeta.id;

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

    // 4. Navigate to review in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible();

    // 5. Verify findings overview tab displays discrepancies
    const findingsList = page.locator('.queue-finding, [data-action="select-finding"], .finding-card, .finding-row');
    await expect(findingsList.first()).toBeVisible();
    expect(await findingsList.count()).toBeGreaterThanOrEqual(1);

    // 6. Click on first finding to inspect evidence spotlight
    const firstFinding = findingsList.first();
    await firstFinding.click();

    // 7. Verify artwork map or evidence canvas is active
    await expect(page.locator('.workbench-art-frame, .workbench-art-content, [data-workbench-frame], .artwork-map, .evidence-spotlight, .viewport-canvas, canvas').first()).toBeVisible();
  });
});
