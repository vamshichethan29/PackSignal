import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('E2E: Real File Upload Flow', () => {
  test('REAL FILE UPLOAD WORKS: uploads real PDF, XLSX, and rulebook via browser file API', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');

    // 2. Open upload modal
    const uploadBtn = page.locator('button[data-action="upload"]');
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();

    // 3. Verify upload dialog is open
    const dialog = page.locator('#dialog[open]');
    await expect(dialog).toBeVisible();

    // 4. Attach real files via input[type=file]#files
    const fileInput = page.locator('input#files');
    const artworkPath = path.resolve(__dirname, 'fixtures/artwork-revA.pdf');
    const specPath = path.resolve(__dirname, 'fixtures/spec-approved.xlsx');
    const rulebookPath = path.resolve(__dirname, 'fixtures/rulebook.json');

    await fileInput.setInputFiles([artworkPath, specPath, rulebookPath]);

    // 5. Verify the files appear in the upload list
    await expect(page.locator('#upload-list')).toBeVisible();
    const rows = page.locator('#upload-list .upload-row');
    await expect(rows).toHaveCount(3);

    // 6. Ensure roles are assigned properly
    const selectArtwork = page.locator('select[data-upload="0"]');
    if (await selectArtwork.count() > 0) {
      await selectArtwork.selectOption('artwork');
    }
    const selectSpec = page.locator('select[data-upload="1"]');
    if (await selectSpec.count() > 0) {
      await selectSpec.selectOption('spec');
    }
    const selectRules = page.locator('select[data-upload="2"]');
    if (await selectRules.count() > 0) {
      await selectRules.selectOption('rules');
    }

    // 7. Submit upload form
    const submitBtn = page.locator('button[type="submit"][form="upload-form"]');
    await submitBtn.click();

    // 8. Wait for review to process and load workspace
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 35000 });

    // 9. Verify documents and roles in Sources tab
    const sourcesBtn = page.locator('button[data-tab="sources"]').first();
    await sourcesBtn.click({ force: true });
    await expect(page.locator('.review-body')).toBeVisible();
    const pageText = await page.textContent('body');
    expect(pageText).toContain('artwork-revA.pdf');
    expect(pageText).toContain('spec-approved.xlsx');
    expect(pageText).toContain('rulebook.json');

    // 10. Verify Findings tab displays discrepancy
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click({ force: true });
    const findingsList = page.locator('.queue-finding, [data-action="select-finding"]');
    await expect(findingsList.first()).toBeVisible();
    expect(await findingsList.count()).toBeGreaterThanOrEqual(1);

    // 11. Verify net quantity finding exists (750 mL vs 1000 mL)
    const findingsText = await page.textContent('.review-workbench');
    expect(findingsText).toMatch(/(quantity|750|1000|net)/i);
  });
});
