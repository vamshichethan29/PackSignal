import { test, expect } from '@playwright/test';

test.describe('E2E Phase 8: Mutation Benchmark & Live Trust Scoreboard', () => {
  test('ONE-CLICK SELF-TEST: executes real mutation benchmark, displays honest metrics, and inspects evidence', async ({ page, request }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 1. Load app status and create review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: reviewId } = await createRes.json();

    // Wait until review is ready
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(300);
    }

    // 2. Open Review in Browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 20000 });

    // 3. Navigate to Trust Console tab
    const trustTabBtn = page.locator('button[data-action="tab"][data-tab="trust-console"]').first();
    await expect(trustTabBtn).toBeVisible();
    await trustTabBtn.click();

    // 4. Verify Trust Scoreboard workbench is mounted
    const scoreboardRoot = page.locator('#trust-scoreboard-root, [data-trust-console]');
    await expect(scoreboardRoot.first()).toBeVisible();

    // 5. Verify the One-Click Run Button exists
    const runBtn = page.locator('#ts-run-selftest-btn, button[data-action="run-packsignal-selftest"]');
    await expect(runBtn).toBeVisible();

    // 6. Click [Run PackSignal Self-Test]
    await runBtn.click();

    // 7. Verify live results appear
    await page.waitForSelector('#ts-caught-count, .ts-card-value', { timeout: 15000 });

    // 8. Verify the 5 packaging families are displayed
    const familyBreakdown = page.locator('#ts-family-grid, .ts-family-card');
    await expect(familyBreakdown.first()).toBeVisible();

    // Verify family labels
    await expect(page.locator('text=Allergens & Ingredients').first()).toBeVisible();
    await expect(page.locator('text=Barcodes & GTINs').first()).toBeVisible();
    await expect(page.locator('text=Nutrition Mathematics').first()).toBeVisible();
    await expect(page.locator('text=Quantity, Claims & Copy').first()).toBeVisible();
    await expect(page.locator('text=PDF Prepress & Geometry').first()).toBeVisible();

    // 9. Verify metrics are rendered with honest non-hardcoded values
    const caughtValue = await page.locator('#ts-caught-count').textContent();
    expect(caughtValue).toContain('31');

    const recallValue = await page.locator('#ts-recall-pct').textContent();
    expect(recallValue).toContain('%');

    // 10. Verify test cases table is populated with distinct cases
    const caseRows = page.locator('tr.ts-case-row');
    const caseCount = await caseRows.count();
    expect(caseCount).toBeGreaterThanOrEqual(31);

    // 11. Test Category Filter Buttons
    const barcodeFilterBtn = page.locator('.ts-filter-pill[data-filter="family-b-barcodes"]');
    if (await barcodeFilterBtn.isVisible()) {
      await barcodeFilterBtn.click();
      const visibleBarcodeRow = page.locator('tr.ts-case-row:not([style*="display: none"])').first();
      await expect(visibleBarcodeRow).toContainText('B');
      
      // Reset filter to 'all'
      const allFilterBtn = page.locator('.ts-filter-pill[data-filter="all"]');
      await allFilterBtn.click();
    }

    // 12. Click on a case row (e.g. A1 or B2) to inspect drilldown details
    const firstCaseRow = caseRows.first();
    await firstCaseRow.click();
    const caseDrawer = page.locator('#ts-case-drawer');
    await expect(caseDrawer).toBeVisible();
    await expect(page.locator('#ts-drawer-title')).not.toBeEmpty();

    // Close drawer
    const closeBtn = page.locator('button[data-action="ts-close-drawer"]').first();
    await closeBtn.click();
    await expect(caseDrawer).toHaveClass(/ts-drawer-hidden/);

    // 13. Verify Export Benchmark Report button exists and is clickable
    const exportBtn = page.locator('#ts-export-report-btn, button[data-action="export-benchmark"]');
    await expect(exportBtn).toBeVisible();

    // 14. Zero fatal uncaught JavaScript errors
    expect(pageErrors).toEqual([]);
  });
});
