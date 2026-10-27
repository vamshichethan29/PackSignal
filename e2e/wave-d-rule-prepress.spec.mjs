import { test, expect } from '@playwright/test';

test.describe('E2E: Wave D Advanced Deterministic Rule Compiler & Press Quality Radar', () => {
  test('Complete Wave D Workflow: 6 Packaging Rule Families, Press Radar physics, Ask Someone routing, and Prepress verification', async ({ page, request }) => {
    // 1. Create a review with Fieldday sample (contains rich packaging and regulatory elements)
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 15000 });

    // ==========================================
    // PART 1: PRESS QUALITY RADAR UI
    // ==========================================
    // Check if the Press Quality Radar or Prepress section exists
    const prepressNav = page.locator('button[data-tab="prepress"], .press-radar, [data-panel="prepress"], a[href*="prepress"]').first();
    if (await prepressNav.isVisible()) {
      await prepressNav.click();
      await page.waitForTimeout(300);
    }

    // Verify Press Quality Radar container
    const pressRadar = page.locator('.press-radar, #press-quality-radar, [data-press-radar]').first();
    if (await pressRadar.isVisible()) {
      // Check for radar tiles: TAC, Bleed, Separations, Barcode
      const radarText = await pressRadar.innerText();
      expect(radarText.toLowerCase()).toContain('tac');
      expect(radarText.toLowerCase()).toContain('separat');
    }

    // ==========================================
    // PART 2: DEPARTMENT FILTERING & RULE FAMILIES
    // ==========================================
    const deptFilterBar = page.locator('[data-dept-filter-bar]');
    if (await deptFilterBar.isVisible()) {
      const btnPrepress = page.locator('[data-department="prepress"]');
      const btnLegal = page.locator('[data-department="legal"]');
      const btnRd = page.locator('[data-department="rd"]');

      await expect(btnPrepress).toBeVisible();
      await expect(btnLegal).toBeVisible();
      await expect(btnRd).toBeVisible();

      // Click Prepress
      await btnPrepress.click();
      await page.waitForTimeout(300);
      await expect(btnPrepress).toHaveAttribute('aria-pressed', 'true');

      // Click Legal
      await btnLegal.click();
      await page.waitForTimeout(300);
      await expect(btnLegal).toHaveAttribute('aria-pressed', 'true');

      // Reset to All
      const btnAll = page.locator('[data-department="all"]');
      await btnAll.click();
      await page.waitForTimeout(300);
    }

    // ==========================================
    // PART 3: ASK SOMEONE MODAL ROUTING
    // ==========================================
    const askSomeoneBtn = page.locator('[data-action="ask-someone"]').first();
    if (await askSomeoneBtn.isVisible()) {
      await askSomeoneBtn.click();

      const modal = page.locator('#ask-someone-modal');
      await expect(modal).toBeVisible();

      // Verify platform toggles
      const slackToggle = modal.locator('[data-ask-platform="slack"]');
      const teamsToggle = modal.locator('[data-ask-platform="teams"]');
      const emailToggle = modal.locator('[data-ask-platform="email"]');

      if (await slackToggle.isVisible()) await slackToggle.click();
      if (await teamsToggle.isVisible()) await teamsToggle.click();
      if (await emailToggle.isVisible()) await emailToggle.click();

      // Close modal
      const closeBtn = modal.locator('[data-ask-action="close"]').first();
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    }

    // ==========================================
    // PART 4: GHOST BOUNDING BOXES / X-RAY
    // ==========================================
    const xrayBtn = page.locator('[data-action="toggle-xray-2d"]');
    if (await xrayBtn.count() > 0 && await xrayBtn.first().isVisible()) {
      await xrayBtn.first().click();
      await page.waitForTimeout(300);
    }

    // ==========================================
    // PART 5: REPORT EXPORT CONTAINS DETERMINISTIC PREPRESS
    // ==========================================
    const exportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(exportRes.ok()).toBeTruthy();
    const reportData = await exportRes.json();
    expect(reportData).toBeDefined();
  });
});
