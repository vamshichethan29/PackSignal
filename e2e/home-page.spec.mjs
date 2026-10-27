import { test, expect } from '@playwright/test';

test.describe('E2E: Home Page & Navigation', () => {
  test('HOME PAGE LOADS: verifies identity, navigation, and absence of console errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 1. Navigate to home page
    const response = await page.goto('/');
    expect(response.status()).toBe(200);

    // 2. Verify PackSignal identity & hero banner
    await expect(page.locator('.eyebrow').first()).toContainText('PACKSIGNAL');
    await expect(page.locator('h1')).toContainText('Review packaging artwork');

    // 3. Verify key navigation actions exist
    await expect(page.locator('button[data-action="upload"]')).toBeVisible();
    await expect(page.locator('button[data-sample="organizer"]').first()).toBeVisible();
    await expect(page.locator('button[data-sample="fieldday"]').first()).toBeVisible();

    // 4. Verify samples section and recent reviews table
    await expect(page.locator('.cards')).toBeVisible();
    await expect(page.locator('#history')).toBeVisible();

    // 5. Verify compliance/legal disclaimer exists
    await expect(page.locator('.footer-note')).toContainText('does not certify legal compliance');

    // 6. Verify zero fatal uncaught browser exceptions
    expect(pageErrors).toEqual([]);
  });
});
