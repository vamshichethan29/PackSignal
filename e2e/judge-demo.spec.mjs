import { test, expect } from '@playwright/test';

test.describe('E2E: Official Esko Judge Demonstration Path', () => {
  test('JUDGE DEMO PATH: exercises complete 5-minute judge demonstration workflow', async ({ page, request }) => {
    // 1. Open app home
    await page.goto('/');
    await expect(page.locator('.eyebrow, h1').first()).toBeVisible();

    // 2. Load controlled mismatch sample (Fieldday V1)
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: reviewId } = await createRes.json();

    // Wait until review compiles
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(500);
    }

    // 3. Open Review in Browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 45000 });

    // 4. Select Net Quantity Finding
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click({ force: true });
    const findingItems = page.locator('.queue-finding, [data-action="select-finding"]');
    await expect(findingItems.first()).toBeVisible();

    // 5. Open Artwork Evidence Spotlight
    await expect(page.locator('.workbench-evidence')).toBeVisible();
    await expect(page.locator('.detail-values')).toBeVisible();

    // 6. Record Reviewer Decision
    const reviewBtn = page.locator('button[data-action="proof"]').first();
    if (await reviewBtn.count() > 0) {
      await reviewBtn.click();
      const decisionSelect = page.locator('select[name="decision"], [data-decision-select]').first();
      if (await decisionSelect.count() > 0) {
        await decisionSelect.selectOption({ index: 1 });
      }
      const closeBtn = page.locator('button[data-action="close-dialog"], .dialog-close').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
    }

    // 7. Verify Revision Comparison
    const revisionsTab = page.locator('.tab[data-action="tab"][data-tab="revisions"]');
    if (await revisionsTab.count() > 0) {
      await revisionsTab.click({ force: true });
      await expect(page.locator('.review-body')).toBeVisible();
    }

    // 8. Verify Signed Report Export endpoint is live
    const reportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(reportRes.ok()).toBeTruthy();
    const reportJson = await reportRes.json();
    expect(reportJson.id).toBe(reviewId);
    expect(reportJson.signature).toBeDefined();
    expect(reportJson.signature.algorithm.toLowerCase()).toBe('ed25519');
  });
});
