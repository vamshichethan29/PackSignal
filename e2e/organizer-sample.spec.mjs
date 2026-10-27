import { test, expect } from '@playwright/test';

test.describe('E2E: Official Organizer Sample Inspection', () => {
  test('OFFICIAL ORGANIZER SAMPLE LOADS: opens sample, checks artwork preview, source files, and ambiguity', async ({ page }) => {
    // 1. Navigate to home
    await page.goto('/');

    // 2. Click official organizer sample button to open sample dialog
    const sampleBtn = page.locator('button[data-action="sample"][data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Confirm start review in dialog
    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // 3. Wait for review heading and completion
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 50000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // 4. Verify original source files are represented
    const sourcesTab = page.locator('.tab[data-action="tab"][data-tab="sources"]');
    await sourcesTab.click({ force: true });
    await expect(page.locator('.review-body')).toBeVisible();
    const sourcesText = await page.textContent('.review-body');
    expect(sourcesText).toContain('DancingFish_Granola_Berry_US_Carton.pdf');
    expect(sourcesText).toContain('DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');

    // 5. Verify source ambiguity or draft status is disclosed
    expect(sourcesText).toMatch(/(draft|unconfirmed|ambiguous|in review)/i);

    // 6. Switch back to Findings tab and verify findings or review limitations are visible
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click({ force: true });
    const findings = page.locator('.queue-finding, [data-action="select-finding"]');
    await expect(findings.first()).toBeVisible();
    expect(await findings.count()).toBeGreaterThanOrEqual(1);

    // 7. Verify 2D artwork canvas or workbench frame is visible
    await expect(page.locator('[data-workbench-frame], .workbench-art-frame, canvas, img[alt*="artwork"]').first()).toBeVisible();
  });
});
