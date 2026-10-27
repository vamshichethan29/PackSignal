import { test, expect } from '@playwright/test';

test.describe('E2E: Source Conflict & Ambiguity Resolution', () => {
  test('opens Resolve Ambiguity studio and validates question queue', async ({ page, request }) => {
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

    // 3. Open Review in Browser and click ambiguity tab
    await page.goto(`/#review/${reviewId}`);
    const ambTabBtn = page.locator('.tab[data-action="tab"][data-tab="ambiguity"]');
    await ambTabBtn.waitFor();
    await ambTabBtn.click();

    // 4. Verify Ambiguity Studio renders
    await expect(page.locator('.source-ambiguity-dashboard, [data-ambiguity-studio]')).toBeVisible();

    // 5. Verify questions list or resolution UI exists
    const questionCards = page.locator('.ambiguity-question-card, [data-question-id]');
    expect(await questionCards.count()).toBeGreaterThanOrEqual(1);
  });
});
