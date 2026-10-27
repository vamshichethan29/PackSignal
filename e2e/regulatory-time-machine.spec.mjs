import { test, expect } from '@playwright/test';

test.describe('E2E: Wave B — Regulatory Time Machine', () => {
  test('Complete Wave B Workflow: Launch Date Slider, FSSAI 2026 Cutover, Draft FOPNL Monitoring, MoCRA Scope, and Comparison Modal', async ({ page, request }) => {
    // 1. Create review with organizer sample
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(500);
    }

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 60000 });

    // 4. Verify Regulatory Time Machine top bar widget
    const rtmRoot = page.locator('#rtm-root');
    await expect(rtmRoot).toBeVisible();

    const title = page.locator('.rtm-title');
    await expect(title).toHaveText(/Regulatory Launch Horizon/);

    // 5. Verify Market Select and Category Select
    const marketSelect = page.locator('#rtm-market-select');
    const categorySelect = page.locator('#rtm-category-select');
    await expect(marketSelect).toBeVisible();
    await expect(categorySelect).toBeVisible();

    // Configure Market to India and Scope to Food
    await marketSelect.selectOption('india');
    await categorySelect.selectOption('food');
    await page.waitForTimeout(300);

    // 6. Test Exact Boundary: June 30, 2027 (Day BEFORE FSSAI cutover)
    const dateInput = page.locator('#rtm-exact-date');
    await expect(dateInput).toBeVisible();
    await dateInput.fill('2027-06-30');
    await dateInput.dispatchEvent('change');
    await page.waitForTimeout(600);

    // Expand What Changed panel
    const toggleBtn = page.locator('#rtm-btn-toggle-changes');
    await expect(toggleBtn).toBeVisible();
    const changePanel = page.locator('#rtm-change-panel');
    if (await changePanel.isHidden()) {
      await toggleBtn.click();
      await page.waitForTimeout(300);
    }
    await expect(changePanel).toBeVisible();

    const changeContentJune = page.locator('#rtm-change-content');
    const textJune = await changeContentJune.textContent();
    expect(textJune).not.toContain('NEWLY EFFECTIVE REQUIREMENTS AT LAUNCH');

    // Screenshot of June 30 before cutover
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/rtm_june_2027_baseline.png' });

    // 7. Test Exact Boundary: July 1, 2027 (COMMENCEMENT DATE)
    const btnFssai = page.locator('#rtm-btn-fssai');
    await expect(btnFssai).toBeVisible();
    await btnFssai.click();
    await page.waitForTimeout(1000);

    const textJuly = await changeContentJune.textContent();
    expect(textJuly).toContain('FSSAI 2026 First Amendment');
    expect(textJuly).toContain('Mandatory bold font and increased size');

    // 8. Verify Draft FOPNL remains non-binding
    expect(textJuly).toMatch(/PROPOSED \/ FORWARD-MONITORING INITIATIVES|DRAFT \/ PROPOSED/);
    expect(textJuly).toContain('NOT yet notified as enforceable law');

    // Screenshot of July 1 cutover active
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/rtm_july_2027_active.png' });

    // 9. Test Product Category Gating: Switch scope to Cosmetics (MoCRA)
    await categorySelect.selectOption('cosmetic');
    await page.waitForTimeout(600);
    await marketSelect.selectOption('us');
    await page.waitForTimeout(800);

    const textCosmetics = await changeContentJune.textContent();
    expect(textCosmetics).not.toContain('FSSAI-LDR-2026-AMEND-BOLD-RDA');

    // Reset to Food and India for comparison modal
    await marketSelect.selectOption('india');
    await categorySelect.selectOption('food');
    await page.waitForTimeout(500);

    // 10. Open Compare Dates modal
    const btnCompare = page.locator('#rtm-btn-compare');
    await expect(btnCompare).toBeVisible();
    await btnCompare.click();

    const modalCard = page.locator('.rtm-modal-card');
    await expect(modalCard).toBeVisible();

    const diffMatrix = page.locator('.rtm-diff-matrix');
    await expect(diffMatrix).toBeVisible();
    const diffText = await diffMatrix.textContent();
    expect(diffText).toContain('Active Binding Rules');

    // Screenshot of Compare Dates Modal
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/rtm_compare_dates_modal.png' });

    // Close modal
    const closeBtn = page.locator('#rtm-modal-close');
    await closeBtn.click();
    await expect(modalCard).not.toBeVisible();

    // 11. Verify Signed Report export contains Regulatory Time Machine and Snapshot ID
    const reportRes = await request.get(`/api/reviews/${reviewId}/report.html`);
    expect(reportRes.ok()).toBeTruthy();
    const reportHtml = await reportRes.text();
    expect(reportHtml).toContain('Regulatory Time Machine — Date-Aware Packaging Intelligence');
    expect(reportHtml).toContain('reg-snap-');
  });
});
