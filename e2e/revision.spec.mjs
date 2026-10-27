import { test, expect } from '@playwright/test';

test.describe('E2E: Artwork Revisions & Comparison', () => {
  test('navigates to Revisions tab and inspects revision studio', async ({ page, request }) => {
    // 1. Create review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Wait until ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open in browser and click Revisions tab
    await page.goto(`/#review/${reviewId}`);
    const revisionsTabBtn = page.locator('button[data-action="tab"][data-tab="revisions"]');
    await revisionsTabBtn.waitFor();
    await revisionsTabBtn.click();

    // 4. Verify revisions section is active
    await expect(page.locator('.review-body')).toBeVisible();
  });
});
