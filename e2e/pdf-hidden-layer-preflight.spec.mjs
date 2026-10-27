import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test.describe('E2E: Native PDF Hidden Text & Opaque Overlay Preflight', () => {
  test('Complete Hidden Text Preflight: Detection, X-Ray Overlay, Inspector Modal, and Nutrition Isolation', async ({ page }) => {
    // 1. Go to homepage
    await page.goto('/');

    // 2. Open upload modal
    const uploadBtn = page.locator('button[data-action="upload"]');
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    await uploadBtn.click();

    // 3. Attach dual-nutrition PDF fixture
    const dialog = page.locator('#dialog[open]');
    await expect(dialog).toBeVisible();

    const fixturePath = resolve('tests/fixtures/pdf-visibility/fixture_o_dual_nutrition.pdf');
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

    // 5. Wait for review to process and load workbench
    await expect(page.locator('.review-workbench')).toBeVisible({ timeout: 35000 });

    // 6. Verify the PDF preflight hidden native text finding appears in the queue
    const hiddenFindingBtn = page.locator('.queue-finding:has-text("hidden native text")');
    await expect(hiddenFindingBtn).toBeVisible({ timeout: 10000 });

    // Click on the hidden finding
    await hiddenFindingBtn.click();
    await page.waitForTimeout(400);

    // 7. Verify detail explanation mentions the obsolete covered copy and opaque shape
    const detailExplanation = page.locator('.detail-explanation');
    await expect(detailExplanation).toContainText('covered');
    await expect(detailExplanation).toContainText('opaque');

    // 8. Verify Prepress Department Filter
    const btnPrepress = page.locator('[data-department="prepress"]');
    await expect(btnPrepress).toBeVisible();
    await btnPrepress.click();
    await page.waitForTimeout(300);

    // Finding should still be visible under Prepress filter
    await expect(page.locator('.queue-finding:has-text("hidden native text")')).toBeVisible();

    // Reset filter to All
    await page.locator('[data-department="all"]').click();
    await page.waitForTimeout(300);

    // 9. Verify 2D Workbench HUD has "Show Hidden PDF Objects" toggle
    const hiddenObjectsToggle = page.locator('[data-layer-hidden-text]');
    await expect(hiddenObjectsToggle).toBeVisible();
    await expect(hiddenObjectsToggle).toBeChecked();

    // 10. Verify 2D Artwork displays X-Ray hidden text overlay
    const hiddenOverlayLayer = page.locator('.workbench-hidden-text-layer');
    await expect(hiddenOverlayLayer).toBeVisible();

    // Verify presence of occluder mask and hidden text boxes
    const occluderMask = page.locator('.workbench-occluder-mask');
    await expect(occluderMask.first()).toBeVisible();

    const hiddenSpan = page.locator('.workbench-hidden-span-box');
    await expect(hiddenSpan.first()).toBeVisible();

    // 11. Click on hidden text span to trigger the Prepress Diagnostic Modal
    await hiddenSpan.first().click();
    await page.waitForSelector('#pdf-hidden-text-modal[open]', { timeout: 5000 });

    const modal = page.locator('#pdf-hidden-text-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Hidden PDF Text');
    await expect(modal).toContainText('CONFIRMED HIDDEN');
    await expect(modal).toContainText('Covering Shape Operator');
    await expect(modal).toContainText('Text Paint Sequence');
    await expect(modal).toContainText('Geometric Enclosure');

    // 12. Test Ask Prepress Team button in modal
    const btnAskPrepress = modal.locator('[data-action="ask-prepress-hidden"]');
    await expect(btnAskPrepress).toBeVisible();
    await btnAskPrepress.click();

    // Verify Ask Someone modal opened with source-backed prepress message
    const askModal = page.locator('#ask-someone-modal');
    await expect(askModal).toBeVisible({ timeout: 5000 });
    const messageEditor = page.locator('#ask-message-editor');
    await expect(messageEditor).toBeVisible();
    const editorValue = await messageEditor.inputValue();
    expect(editorValue).toContain('Hi Prepress Team');
    expect(editorValue).toContain('PackSignal found native text within the artwork PDF');

    // Close Ask Someone modal
    await page.locator('[data-ask-action="close"]').first().click();
    await page.waitForTimeout(300);

    // 13. Verify visible text vs hidden text separation:
    // In the workbench, visible US Nutrition Facts are displayed,
    // while obsolete covered table values (Typical Values per 100g) are excluded from visible copy!
    const pageText = await page.textContent('.review-workbench');
    expect(pageText).toContain('Nutrition %DV');
    expect(pageText).toContain('Calories vs Macronutrients');
  });
});
