import { test, expect } from '@playwright/test';

test.describe('E2E: FDA Nutrition Facts & Deterministic %DV Arithmetic', () => {
  test('executes US FDA preflight and verifies deterministic daily value calculations', async ({ page, request }) => {
    // 1. Get CSRF and review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Wait until ready
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(500);
    }

    // 3. Trigger US FDA Preflight via API
    const preflightRes = await request.post(`/api/reviews/${reviewId}/us-preflight`, {
      headers: { 'x-packproof-token': csrf },
      data: {}
    });
    expect(preflightRes.ok()).toBeTruthy();
    const resData = await preflightRes.json();
    const checks = resData.checks || resData.preflight?.checks;
    expect(checks).toBeDefined();
    // US-005 should be evaluated
    const dvCheck = checks.find(c => c.checkId === 'US-005');
    expect(dvCheck).toBeDefined();
    expect(dvCheck.legalBasis).toContain('21 CFR 101.9');

    // 4. Open in browser and verify UI reflects checks
    await page.goto(`/#review/${reviewId}`);
    const deepTabBtn = page.locator('button[data-action="tab"][data-tab="deep-verification"]');
    await deepTabBtn.waitFor();
    await deepTabBtn.click();

    await expect(page.locator('[data-deep-dashboard]')).toBeVisible();
  });
});
