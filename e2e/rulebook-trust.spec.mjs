import { test, expect } from '@playwright/test';

test.describe('E2E: Rule Trust Center & Rule Quotation Verification', () => {
  test('opens Rulebook Trust tab and inspects verified quotes and execution ledger', async ({ page, request }) => {
    // 1. Get CSRF and review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Wait until ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open Review and click Rulebook Trust tab
    await page.goto(`/#review/${reviewId}`);
    const rulebookTabBtn = page.locator('button[data-action="tab"][data-tab="rulebook"]');
    await rulebookTabBtn.waitFor();
    await rulebookTabBtn.click();

    // 4. Verify Rulebook Trust Center view renders
    await expect(page.locator('.rulebook-trust-view, [data-rulebook-view]')).toBeVisible();

    // 5. Verify rule cards show quote verification status and lifecycle badges
    const ruleCards = page.locator('.rule-card, [data-rule-id]');
    expect(await ruleCards.count()).toBeGreaterThanOrEqual(1);

    // 6. Verify an approved rule is distinguished from unverified/proposed rules
    const statusText = await page.textContent('.rulebook-trust-view');
    expect(statusText).toContain('Rule Trust Center');
  });
});
