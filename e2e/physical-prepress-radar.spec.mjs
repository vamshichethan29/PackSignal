import { test, expect } from '@playwright/test';

test.describe('E2E: Physical Prepress Print Readiness Radar (Upgrade #46)', () => {
  test('Complete Physical Prepress Radar flow: TAC, bleed, trim safety, crease, densitometer and dieline overlays', async ({ page }) => {
    const fatalErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Content Security Policy') && !text.includes('CSP') && !text.includes('404')) {
          fatalErrors.push(text);
        }
      }
    });

    test.setTimeout(120000);

    // 1. Open PackSignal
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 2. Open an existing review or sample
    const openBtn = page.locator('button[data-action="open-review"]').first();
    if (await openBtn.isVisible()) {
      await openBtn.click();
    } else {
      const sampleBtn = page.locator('button[data-action="sample"][data-sample="organizer"]').first();
      await sampleBtn.click();
      const runBtn = page.locator('button[data-action="run-sample"]');
      await runBtn.click();
    }

    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 60000 });

    // 3. Verify Print Readiness Radar button or mount
    const radarBtn = page.locator('#review-toggle-print-radar, button[data-action="toggle-print-radar"]').first();
    if (await radarBtn.isVisible()) {
      await radarBtn.click();
    }

    // 4. Verify Print Readiness Radar panel is rendered
    const radarPanel = page.locator('#print-readiness-radar');
    await expect(radarPanel).toBeVisible({ timeout: 15000 });

    // 5. Verify Panel Title and Profile Selector
    await expect(radarPanel).toContainText('PACKSIGNAL — PRINT READINESS RADAR');

    const profileSelect = page.locator('#radar-press-profile-select');
    await expect(profileSelect).toBeVisible();

    // 6. Verify 4 Core Physical Prepress Cards
    const tacCard = page.locator('.radar-card[data-radar-check="tac"]');
    await expect(tacCard).toBeVisible();
    await expect(tacCard).toContainText('Ink Coverage (TAC)');
    await expect(tacCard).toContainText('Max measured TAC');

    const bleedCard = page.locator('.radar-card[data-radar-check="bleed"]');
    await expect(bleedCard).toBeVisible();
    await expect(bleedCard).toContainText('Bleed Extension');
    await expect(bleedCard).toContainText('Required outward');

    const trimCard = page.locator('.radar-card[data-radar-check="trim"]');
    await expect(trimCard).toBeVisible();
    await expect(trimCard).toContainText('Trim Safety');

    const creaseCard = page.locator('.radar-card[data-radar-check="crease"]');
    await expect(creaseCard).toBeVisible();
    await expect(creaseCard).toContainText('Crease Clearance');

    // 7. Test Densitometer / Ink Inspector Tool button
    const densitometerBtn = page.locator('#btn-inspect-cmyk-radar, #btn-card-tac-inspect').first();
    await expect(densitometerBtn).toBeVisible();
    await densitometerBtn.click();

    // Verify Densitometer / Hotspot Modal displays
    const modal = page.locator('.print-densitometer-modal, .tac-hotspot-modal, #dialog .prepress-modal-content');
    if (await modal.isVisible()) {
      await expect(modal).toContainText('PRINT INK INSPECTOR');
      const closeBtn = page.locator('#btn-close-densitometer-modal, #btn-densitometer-done, #btn-close-tac-modal').first();
      await closeBtn.click();
    }

    // 8. Test Toggle Dieline Safety
    const dielineToggle = page.locator('#btn-toggle-bleed-safety-radar');
    await expect(dielineToggle).toBeVisible();
    await dielineToggle.click();
    await page.waitForTimeout(300);

    // 9. Inspect Trim/Crease Details
    const trimInspectBtn = page.locator('#btn-card-trim-inspect');
    if (await trimInspectBtn.isVisible()) {
      await trimInspectBtn.click();
      const detailDrawer = page.locator('#radar-detail-drawer');
      await expect(detailDrawer).toBeVisible();
      await expect(detailDrawer).toContainText('Trim Safety');
      const closeDrawer = page.locator('#radar-detail-close');
      await closeDrawer.click();
    }

    // 10. Switch Press Profile and verify reactivity
    await profileSelect.selectOption('FTA-FLEXO-POUCH-280');
    await page.waitForTimeout(300);
    await expect(radarPanel).toContainText('FLEXOGRAPHY');

    // 11. Assert no fatal console errors
    expect(fatalErrors).toEqual([]);
  });
});
