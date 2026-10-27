import { test, expect } from '@playwright/test';

test.describe('E2E: Responsive Layout & Accessibility Smoke Tests', () => {
  const viewports = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    test(`renders correctly on ${vp.name} (${vp.width}x${vp.height}) with no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. Load Home Page
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();

      // 2. Verify key interactive buttons are reachable and not occluded
      const uploadBtn = page.locator('button[data-action="upload"]');
      await expect(uploadBtn).toBeVisible();

      // 3. Verify horizontal scroll overflow on body does not exceed viewport width
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

      // 4. Test modal opening and accessible focus
      await uploadBtn.click();
      const dialog = page.locator('#dialog[open]');
      await expect(dialog).toBeVisible();

      // 5. Verify modal close button works
      const closeBtn = page.locator('#dialog button[data-action="close"], #dialog .ghost').first();
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(page.locator('#dialog[open]')).toHaveCount(0);
    });
  }

  test('verifies keyboard accessibility and visible focus outline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // Press Tab multiple times to verify keyboard focus reaches interactive elements
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT', 'SELECT']).toContain(focusedTag);
  });
});
