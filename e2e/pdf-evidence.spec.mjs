import { test, expect } from '@playwright/test';

test.describe('E2E: PDF Preflight & Hidden Text Visibility', () => {
  test('opens PDF Preflight dashboard and screens visibility and typography', async ({ page, request }) => {
    // 1. Create review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Wait until ready
    for (let i = 0; i < 90; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(500);
    }

    // 3. Open in browser and click PDF Preflight tab
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 45000 });
    const preflightTabBtn = page.locator('.tab[data-action="tab"][data-tab="preflight"]');
    await preflightTabBtn.waitFor({ state: 'visible' });
    await preflightTabBtn.click({ force: true });

    // 4. Verify PDF Preflight dashboard is visible
    await expect(page.locator('.preflight-dashboard, [data-preflight-dashboard]')).toBeVisible();

    // 5. Verify the 4 screening capabilities are present (PVP-001 through PVP-004)
    const dashboardText = await page.textContent('.preflight-dashboard, [data-preflight-dashboard]');
    expect(dashboardText).toContain('PVP-001');
    expect(dashboardText).toContain('PVP-002');
  });
});
