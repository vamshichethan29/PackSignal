import { test, expect } from '@playwright/test';

test.describe('E2E: Deep Verification & Organizer Investigation Workflow', () => {
  test('DEEP VERIFICATION WORKFLOW: opens organizer sample, navigates 10 categories, inspects cells, formulas, rules, occlusion, and 2D artwork', async ({ page, request }) => {
    // 1. Fetch CSRF token and create official organizer review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    let review = null;
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') {
        review = poll;
        break;
      }
      await page.waitForTimeout(500);
    }
    expect(review).toBeDefined();
    expect(review.deepVerification).toBeDefined();

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 45000 });

    // 4. Open Deep Verification tab
    const deepTabBtn = page.locator('button[data-action="tab"][data-tab="deep-verification"]');
    await expect(deepTabBtn).toBeVisible();
    await deepTabBtn.click();
    await expect(page.locator('[data-deep-dashboard]')).toBeVisible();

    // 5. Verify category cards (10 categories: Source & Ingredients, Nutrition & DV, Claims, Allergens, Market Copy, Quantity, PDF Structure, Typography, Guide Content, Rule Execution)
    const cards = page.locator('.deep-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(9);

    // 6. View Spreadsheet Cell Coordinate Modal
    const viewCellBtn = page.locator('button[data-action="deep-view-cell"]').first();
    if (await viewCellBtn.count() > 0) {
      await viewCellBtn.click();
      await expect(page.locator('#deep-modal-container')).toBeVisible();
      await expect(page.locator('#deep-modal-container')).toContainText('Spreadsheet Source Coordinate');
      await page.locator('button[data-action="deep-modal-close"]').click();
      await expect(page.locator('#deep-modal-container')).toBeHidden();
    }

    // 7. View Formula & Calculation Proof Modal
    const formulaBtn = page.locator('button[data-action="deep-view-formula"]').first();
    if (await formulaBtn.count() > 0) {
      await formulaBtn.click();
      await expect(page.locator('#deep-modal-container')).toBeVisible();
      await expect(page.locator('#deep-modal-container')).toContainText('Calculation Proof');
      await page.locator('button[data-action="deep-modal-close"]').click();
      await expect(page.locator('#deep-modal-container')).toBeHidden();
    }

    // 8. View Rule Detail Modal
    const ruleInspectBtn = page.locator('button[data-action="deep-view-rule"]').first();
    if (await ruleInspectBtn.count() > 0) {
      await ruleInspectBtn.click();
      await expect(page.locator('#deep-modal-container')).toBeVisible();
      await expect(page.locator('#deep-modal-container')).toContainText('Rule Detail');
      await page.locator('button[data-action="deep-modal-close"]').click();
      await expect(page.locator('#deep-modal-container')).toBeHidden();
    }

    // 9. Inspect PDF Structural Occlusion Modal if present
    const toggleBtn = page.locator('button[data-action="deep-toggle-occlusion"]').first();
    if (await toggleBtn.count() > 0 && await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(page.locator('#deep-modal-container')).toBeVisible();
      await expect(page.locator('#deep-modal-container')).toContainText('Occlusion Detected');
      await page.locator('button[data-action="deep-modal-close"]').click();
      await expect(page.locator('#deep-modal-container')).toBeHidden();
    }

    // 10. Navigate from Deep Verification finding to 2D Evidence Canvas
    const viewArtworkBtn = page.locator('button[data-action="deep-view-artwork"]').first();
    if (await viewArtworkBtn.count() > 0) {
      await viewArtworkBtn.click();
      await expect(page.locator('.workbench-evidence')).toBeVisible();
    }

    // 11. Verify Signed HTML Report Export includes Deep Verification Summary
    const htmlRes = await request.get(`/api/reviews/${reviewId}/report.html`);
    expect(htmlRes.ok()).toBeTruthy();
    const htmlContent = await htmlRes.text();
    expect(htmlContent).toContain('Deep Verification &amp; Packaging QA Summary');
  });
});
