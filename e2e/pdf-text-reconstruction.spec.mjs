import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test.describe('E2E: Advanced PDF Text Reconstruction (Letter-Spaced & Curved Arc)', () => {
  test('Complete Text Reconstruction Workflow: Upload, HUD Layer, Inspector Modal, and Word Boundary Preservation', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');

    // 2. Open upload modal
    const uploadBtn = page.locator('button[data-action="upload"]');
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    await uploadBtn.click();

    // 3. Attach controlled tracked words fixture
    const dialog = page.locator('#dialog[open]');
    await expect(dialog).toBeVisible();

    const fixturePath = resolve('tests/fixtures/reconstruction/fixture_c_tracked_words.pdf');
    const fileInput = page.locator('input#files');
    await fileInput.setInputFiles([fixturePath]);

    // Ensure role is artwork
    await expect(page.locator('#upload-list')).toBeVisible();
    const selectArtwork = page.locator('select[data-upload="0"]');
    if (await selectArtwork.count() > 0) {
      await selectArtwork.selectOption('artwork');
    }

    // 4. Submit form
    const submitBtn = page.locator('button[type="submit"][form="upload-form"]');
    await submitBtn.click();

    // 5. Wait for review workbench to load
    await expect(page.locator('.review-workbench')).toBeVisible({ timeout: 35000 });

    // 6. Check that 2D proof HUD includes [Show Reconstructed Text] checkbox
    const hudCheckbox = page.locator('input[data-layer-reconstructed-text]');
    await expect(hudCheckbox).toBeVisible({ timeout: 10000 });
    await expect(hudCheckbox).toBeChecked();

    // 7. Verify the reconstructed text overlay layer is rendered
    const reconLayer = page.locator('.workbench-reconstructed-text-layer');
    await expect(reconLayer).toBeVisible();

    // 8. Find reconstructed box and inspect it
    const reconBox = page.locator('.workbench-reconstructed-box').first();
    await expect(reconBox).toBeVisible();
    await expect(reconBox).toContainText('PACKED WITH GOODNESS');

    // 9. Click on the reconstructed box to open Before/After Inspector modal
    await reconBox.click();

    // 10. Verify Text Reconstruction Inspector modal opens
    const inspectorDialog = page.locator('dialog.pdf-reconstruction-dialog[open]');
    await expect(inspectorDialog).toBeVisible({ timeout: 5000 });
    await expect(inspectorDialog).toContainText('TEXT RECONSTRUCTION INSPECTOR');

    // 11. Verify raw text vs reconstructed text
    await expect(inspectorDialog.locator('.recon-card-raw')).toContainText('P A C K E D');
    await expect(inspectorDialog.locator('.recon-card-reconstructed')).toContainText('PACKED WITH GOODNESS');

    // 12. Verify status and actions
    await expect(inspectorDialog.locator('.recon-meta-badge')).toContainText('NATIVE GEOMETRY VERIFIED');
    const closeBtn = inspectorDialog.locator('[data-recon-modal-close]').first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // 13. Verify modal closes cleanly
    await expect(inspectorDialog).not.toBeVisible();

    // 14. Test HUD layer toggle: uncheck Show Reconstructed Text
    await hudCheckbox.uncheck();
    await expect(reconLayer).not.toBeVisible();

    // Re-check Show Reconstructed Text
    await hudCheckbox.check();
    await expect(reconLayer).toBeVisible();
  });
});
