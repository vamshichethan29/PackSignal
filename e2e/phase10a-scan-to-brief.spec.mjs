/**
 * PackSignal — Phase 10A Mobile Scan to Brief E2E Test
 * Tests mobile packaging camera intake, dual-reader consensus,
 * shelf-vs-approved comparison, two routes equivalence, and brief generation.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 10A — Scan to Brief E2E Sequence', () => {

  test('Complete Mobile Camera Intake -> Dual-Reader -> Two Routes -> Brief', async ({ page }) => {
    // 1. Visit Desktop Home and verify entry points
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify both Route A and Route B entry points exist
    const scanPhysicalBtn = page.locator('#hero-scan-physical');
    const uploadSourcesBtn = page.locator('#hero-upload-sources');
    const scanPhoneBtn = page.locator('#hero-scan-with-phone');

    await expect(scanPhysicalBtn).toBeVisible({ timeout: 10000 });
    await expect(uploadSourcesBtn).toBeVisible();
    await expect(scanPhoneBtn).toBeVisible();

    // 2. Click [SCAN WITH PHONE] on desktop and verify pairing token modal
    await scanPhoneBtn.click();
    const pairingDialog = page.locator('dialog[open]');
    await expect(pairingDialog).toBeVisible({ timeout: 5000 });
    await expect(pairingDialog).toContainText('PAIRING TOKEN');
    await expect(pairingDialog).toContainText('Valid for 15 minutes');

    // Close pairing dialog
    await page.locator('dialog[open] button[data-action="close"]').first().click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    // 3. Open Mobile Scanner Page in mobile viewport
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 dimensions
    await page.goto('/scan.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__scanInitialized === true);

    // Verify mobile header and HUD elements
    await expect(page.locator('.scan-header')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#face-badge')).toBeVisible();
    await expect(page.locator('#sharpness-badge')).toBeVisible();
    await expect(page.locator('.scan-bank-card-anchor')).toBeVisible();

    // 4. Step 1: Capture Front PDP
    const captureBtn = page.locator('#capture-panel-btn');
    await expect(captureBtn).toBeVisible();
    await expect(page.locator('#current-task-label')).toContainText('Front PDP');
    await captureBtn.click();

    // Wait for front processing and advance to Step 2
    await expect(page.locator('#step-indicator')).toContainText('Step 2 of 4', { timeout: 8000 });
    await expect(page.locator('#pip-front')).toHaveClass(/completed/);

    // 5. Step 2: Capture Right Side (Nutrition Facts)
    await expect(page.locator('#current-task-label')).toContainText('Right Side');
    await captureBtn.click();

    await expect(page.locator('#step-indicator')).toContainText('Step 3 of 4', { timeout: 8000 });
    await expect(page.locator('#pip-right')).toHaveClass(/completed/);

    // 6. Step 3: Capture Back Panel (Ingredients & Allergens)
    await expect(page.locator('#current-task-label')).toContainText('Back Panel');
    await captureBtn.click();

    await expect(page.locator('#step-indicator')).toContainText('Step 4 of 4', { timeout: 8000 });
    await expect(page.locator('#pip-back')).toHaveClass(/completed/);

    // 7. Step 4: Capture Bottom Panel (Barcode GTIN)
    await expect(page.locator('#current-task-label')).toContainText('Bottom');
    await captureBtn.click();

    // Verify completion
    await expect(page.locator('#step-indicator')).toContainText('Complete (4 of 4)', { timeout: 8000 });
    await expect(page.locator('#capture-btn-text')).toContainText('Carton Intake Complete');

    // 8. Test Retake Action
    const retakeBtn = page.locator('#retake-face-btn');
    await retakeBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('#step-indicator')).toContainText('Step 4 of 4');

    // Re-capture bottom
    await captureBtn.click();
    await page.waitForTimeout(400);

    // 9. Verify "Two Routes, Same Answer" Proof Button
    const twoRoutesBtn = page.locator('#run-two-routes-btn');
    await twoRoutesBtn.click();
    const twoRoutesBox = page.locator('#two-routes-box');
    await expect(twoRoutesBox).toBeVisible({ timeout: 5000 });
    await expect(twoRoutesBox).toContainText('Two routes, same answer');
    await expect(twoRoutesBox).toContainText('Excluded'); // Hidden EU table excluded

    // 10. Compare Shelf vs Approved Spec Button
    const shelfBtn = page.locator('#compare-shelf-btn');
    await shelfBtn.click();
    const shelfBox = page.locator('#shelf-compare-box');
    await expect(shelfBox).toBeVisible({ timeout: 5000 });
    await expect(shelfBox).toContainText('Shelf vs Approved Conflicts');

    // 11. Generate Evidence-Backed Brief
    const briefBtn = page.locator('#generate-brief-btn');
    await briefBtn.click();
    const briefBox = page.locator('#scan-brief-box');
    await expect(briefBox).toBeVisible({ timeout: 5000 });
    await expect(briefBox).toContainText('Evidence-Backed Packaging Brief');
    await expect(briefBox).toContainText('Dancing Fish');
    await expect(briefBox).toContainText('zero hallucinations from hidden PDF layers');
  });

});
