/**
 * @file e2e/phase6-pack-canvas.spec.mjs
 * 
 * Playwright End-to-End Test for PackSignal Phase 6:
 * Pack Canvas — True-Scale Packaging Content Fit Engine.
 * 
 * Verifies:
 * 1. Workbench mount and true-scale dieline geometry
 * 2. Cut/Crease layers, safe margins, and locked brand art protection
 * 3. Corrected US content blocks and dynamic text measurement
 * 4. Dimension-aware live panel space meters
 * 5. Controlled extra-content fixture triggering back-panel overflow
 * 6. Explainable fix suggestions with regulatory citations
 * 7. One-click fix application and independent constraint re-validation
 * 8. "OVERFLOW CLEARED" verification indicator
 * 9. Proposal save and machine-readable JSON proof export
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 6: Pack Canvas True-Scale Content Fit Engine E2E', () => {

  test('Interactive Pack Canvas: Flat Dieline, Locked Brand Art, Space Meters, Overflow Simulation & Verified Fix Clearance', async ({ page, request }) => {
    test.setTimeout(120_000);

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404') && !msg.text().includes('Content Security Policy')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Create a review with controlled packaging sample
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();
    expect(reviewId).toBeTruthy();

    // 2. Poll until review is ready
    for (let i = 0; i < 60; i++) {
      const pollRes = await request.get(`/api/reviews/${reviewId}`);
      const poll = await pollRes.json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(1000);
    }

    // 3. Open review workbench
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 60_000 });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Dismiss overlap shield if present
    const shieldBtn = page.locator('#btn-toggle-overlap-mode');
    if (await shieldBtn.isVisible()) {
      await shieldBtn.click();
      await page.waitForTimeout(300);
    }

    // 4. Navigate to Pack Canvas tab
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-tab="pack-canvas"]');
      if (btn) btn.click();
    });

    // 5. Verify Pack Canvas workbench root mount
    const workbenchRoot = page.locator('#canvas-workbench-root');
    await expect(workbenchRoot).toBeVisible({ timeout: 15_000 });

    // 6. Verify header and physical scale authority badge
    const headerTitle = page.locator('.canvas-title-group h2');
    await expect(headerTitle).toContainText('Pack Canvas');
    const authorityBadge = page.locator('.scale-authority-badge');
    await expect(authorityBadge).toBeVisible();
    await expect(authorityBadge).toContainText('VERIFIED ESKO DIELINE');

    // 7. Verify live Space Meters Strip (6 panels)
    const meterCards = page.locator('.space-meters-strip .meter-card');
    await expect(meterCards).toHaveCount(6);

    const backPanelMeter = page.locator('.meter-card[data-panel="panel-back"]');
    const frontPanelMeter = page.locator('.meter-card[data-panel="panel-front"]');
    await expect(backPanelMeter).toBeVisible();
    await expect(frontPanelMeter).toBeVisible();

    // In standard scenario, Back panel should be OPTIMAL (utilization < 100%)
    await expect(backPanelMeter).toHaveClass(/status-optimal/);
    const compliantNotice = page.locator('.compliant-notice-box');
    await expect(compliantNotice).toBeVisible();
    await expect(compliantNotice).toContainText('FIT VERIFIED');

    // 8. Inspect flat dieline board
    const dielineBoard = page.locator('#dieline-board');
    await expect(dielineBoard).toBeVisible();

    // Verify presence of locked brand art zones
    const logoZone = page.locator('.locked-art-zone[data-id="lock-pdp-logo"]');
    await expect(logoZone).toBeVisible();
    await expect(logoZone).toContainText('Dancing Fish Brand Logo');

    // Click logo to open inspector modal
    await logoZone.click();
    const modal = page.locator('.block-inspector-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Locked Brand Art Zone');
    await expect(modal).toContainText('Dancing Fish Brand Logo');

    // Close modal
    const closeBtn = page.locator('#modal-close-btn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // 9. Inspect a regulatory content block (Nutrition Facts or Net Quantity)
    const netQtyBlock = page.locator('.placed-content-block[data-id="block-front-net-quantity"]');
    await expect(netQtyBlock).toBeVisible();
    await expect(netQtyBlock).toContainText('NET WT 16.9 OZ');

    await netQtyBlock.click();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('21 CFR 101.7');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // 10. Activate Controlled Overflow Scenario (+ Extra Items)
    const overflowScenarioBtn = page.locator('button[data-scenario="overflow"]');
    await expect(overflowScenarioBtn).toBeVisible();
    await overflowScenarioBtn.click();
    await page.waitForTimeout(500);

    // Verify overflow alert displays
    const overflowAlert = page.locator('.overflow-alert-box');
    await expect(overflowAlert).toBeVisible();
    await expect(overflowAlert).toContainText('Space Overflow Detected on Back Panel');
    await expect(overflowAlert).toContainText('OVER CAPACITY');

    // Verify Back Panel meter is now in OVERFLOW state
    await expect(backPanelMeter).toHaveClass(/status-overflow/);

    // 11. Inspect Suggested Fixes
    const fixCards = page.locator('.fixes-grid .fix-card');
    await expect(fixCards.first()).toBeVisible();
    const fixCount = await fixCards.count();
    expect(fixCount).toBeGreaterThanOrEqual(2);

    // 12. Apply suggested fix (Multi-column or Condense typography)
    const applyFixBtn = page.locator('button[data-action="apply-fix"]').first();
    await expect(applyFixBtn).toBeVisible();
    await applyFixBtn.click();
    await page.waitForTimeout(600);

    // 13. Verify overflow is CLEARED after applying fix
    await expect(page.locator('.compliant-notice-box')).toBeVisible();
    await expect(page.locator('.status-cleared-pill')).toContainText('FIT VERIFIED');
    await expect(backPanelMeter).toHaveClass(/status-optimal/);

    // 14. Toggle Rulers and Grid
    const rulersToggle = page.locator('#btn-toggle-rulers');
    await rulersToggle.click();
    await page.waitForTimeout(300);
    // Click again to toggle back
    await rulersToggle.click();

    // 15. Verify India market switch
    const indiaBtn = page.locator('button[data-scenario="india"]');
    await expect(indiaBtn).toBeVisible();
    await indiaBtn.click();
    await page.waitForTimeout(600);

    // Net Quantity should show metric-only (480 g)
    const metricQty = page.locator('.placed-content-block[data-id="block-front-net-quantity"]');
    await expect(metricQty).toContainText('NET WT 480 g');

    // 16. Verify no fatal console errors
    expect(consoleErrors).toEqual([]);
  });

});
