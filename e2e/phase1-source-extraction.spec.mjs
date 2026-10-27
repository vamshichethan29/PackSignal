import { test, expect } from '@playwright/test';

test.describe('E2E: Phase 1 — Source Extraction with Positions', () => {
  test('COMPLETE PHASE 1 PIPELINE: loads official Esko samples, verifies provenance, positions, ignored guides, hidden copy, and reconstructed text', async ({ page }) => {
    test.setTimeout(180000);
    // 1. Navigate to home
    await page.goto('/');

    // 2. Click official organizer sample button to open sample dialog
    const sampleBtn = page.locator('button[data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible({ timeout: 15000 });
    await sampleBtn.click();

    // Confirm start review in dialog
    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // 3. Wait for review completion
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // 4. Open Source Pieces Inspector
    const modeBtn = page.locator('#btn-toggle-overlap-mode');
    if (await modeBtn.isVisible()) {
      await modeBtn.click();
    }
    const viewSpBtn = page.locator('button[data-action="view-source-pieces"]').first();
    await expect(viewSpBtn).toBeVisible();
    await viewSpBtn.click();

    // 5. Verify modal opened
    const modal = page.locator('#source-pieces-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.sp-header-title')).toContainText('Extracted Source Pieces');

    // 6. Verify diagnostics numbers populated
    const pdfNative = modal.locator('#diag-pdf-native');
    await expect(pdfNative).not.toHaveText('…');
    const pdfNativeCount = parseInt(await pdfNative.textContent() || '0', 10);
    expect(pdfNativeCount).toBeGreaterThan(50);

    const xlsxAc = modal.locator('#diag-xlsx-ac');
    await expect(xlsxAc).not.toHaveText('…');
    const xlsxAcCount = parseInt(await xlsxAc.textContent() || '0', 10);
    expect(xlsxAcCount).toBeGreaterThan(30);

    // 7. Verify visible PDF piece details
    const visibleBtn = modal.locator('.sp-filter-btn[data-filter="visible"]');
    await visibleBtn.click();
    const firstVisible = modal.locator('.sp-piece-row').first();
    await expect(firstVisible).toBeVisible();
    await firstVisible.click();

    const detailPanel = modal.locator('#sp-detail-panel');
    await expect(detailPanel).toContainText('DancingFish_Granola_Berry_US_Carton.pdf');
    await expect(detailPanel).toContainText('Normalized Box');

    // 8. Filter by Ignored Guides
    const ignoredBtn = modal.locator('.sp-filter-btn[data-filter="ignored"]');
    await ignoredBtn.click();
    await expect(modal.locator('.sp-list-container')).toContainText('Art orientation');
    await expect(modal.locator('.sp-list-container')).toContainText('Copy free');

    // 9. Filter by Hidden Copy (EU per-100g table)
    const hiddenBtn = modal.locator('.sp-filter-btn[data-filter="hidden"]');
    await hiddenBtn.click();
    await expect(modal.locator('.sp-list-container')).toContainText(/100g|typical values/i);

    // 10. Reconstructed text test
    const allBtn = modal.locator('.sp-filter-btn[data-filter="all"]');
    await allBtn.click();
    const searchInput = modal.locator('#sp-search-input');
    await searchInput.fill('15 g');
    await expect(modal.locator('.sp-list-container')).toContainText('15 g');
    await expect(modal.locator('.sp-list-container')).toContainText('1 5 g');

    // 11. Excel sources (A-C)
    const excelBtn = modal.locator('.sp-filter-btn[data-filter="excel"]');
    await excelBtn.click();
    await searchInput.fill('');
    const firstExcel = modal.locator('.sp-piece-row').first();
    await expect(firstExcel).toBeVisible();
    await firstExcel.click();

    await expect(detailPanel).toContainText('DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
    await expect(detailPanel).toContainText('Cell Coordinate');
    await expect(detailPanel).toContainText('Trusted Product Fact (A–C)');
    await expect(detailPanel).toContainText('no physical PDF coordinates');

    // 12. Close modal and verify workbench remains fully interactive
    const closeBtn = modal.locator('.sp-close-btn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click({ force: true });
    await expect(page.locator('.queue-finding, [data-action="select-finding"]').first()).toBeVisible();
  });
});
