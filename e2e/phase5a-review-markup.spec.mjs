/**
 * @file e2e/phase5a-review-markup.spec.mjs
 * 
 * Playwright End-to-End Test for PackSignal Phase 5A:
 * Senior Reviewer Markup Studio — Red Pen Annotations, Numbered Dieline Pins,
 * Department Sticky Notes, Clean/Marked Instant Toggle, Filter Pills,
 * Visual Track Changes Drawer, and Single-Page ISO A3 Review Wall Poster PDF Export.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 5A: Senior Reviewer Markup Studio E2E', () => {

  test('Full Browser Verification: Clean/Marked View, Red Pen Paths, Numbered Pins, Detail Modal, Track Changes & A3 Export', async ({ page, request }) => {
    test.setTimeout(120_000);

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Create a review with the controlled packaging sample (Fieldday)
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();
    expect(reviewId).toBeTruthy();

    // 2. Poll until review analysis is ready (allow up to 60s for full extraction)
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

    // Ensure we are in 2D proof mode
    const mode2dBtn = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
    if (await mode2dBtn.isVisible()) {
      await mode2dBtn.click();
    }
    await page.waitForTimeout(500);

    // 4. Verify Markup Studio Controls Bar
    const controlsBar = page.locator('.markup-studio-controls-bar');
    await expect(controlsBar).toBeVisible({ timeout: 15_000 });

    // 5. Verify Clean / Marked segmented toggle
    const btnClean = page.locator('.markup-btn-clean');
    const btnMarked = page.locator('.markup-btn-marked');
    await expect(btnClean).toBeVisible();
    await expect(btnMarked).toBeVisible();

    // 6. Test Initial View: CLEAN VIEW
    // The overlay should have .mode-clean and be visually hidden
    const overlay = page.locator('.artwork-markup-studio-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveClass(/mode-clean/);
    await expect(btnClean).toHaveClass(/active/);

    // 7. Switch to MARKED VIEW
    await btnMarked.click();
    await page.waitForTimeout(300);

    // Verify overlay transitions to .mode-marked
    await expect(overlay).toHaveClass(/mode-marked/);
    await expect(btnMarked).toHaveClass(/active/);

    // 8. Verify SVG Red Pen Markup Canvas and Paths exist
    const svgCanvas = page.locator('svg.red-pen-markup-canvas');
    await expect(svgCanvas).toBeVisible();

    const redPenPaths = page.locator('path.red-pen-path');
    const pathCount = await redPenPaths.count();
    expect(pathCount).toBeGreaterThan(0);

    // Verify numbered dieline finding pins exist
    const findingPins = page.locator('.dieline-finding-pin');
    const pinCount = await findingPins.count();
    expect(pinCount).toBeGreaterThan(0);

    // First pin should display a numbered identifier "1"
    const firstPin = findingPins.first();
    await expect(firstPin).toBeVisible();
    const pinText = await firstPin.textContent();
    expect(pinText.trim()).toMatch(/^[0-9]+$/);

    // 9. Click a Numbered Finding Pin -> Open Finding Details Modal
    await firstPin.click({ force: true });
    await page.waitForTimeout(400);

    const findingModal = page.locator('.markup-finding-modal');
    await expect(findingModal).toBeVisible();
    await expect(findingModal.locator('.markup-modal-head')).toBeVisible();

    // Verify finding details fields
    const modalTitle = await findingModal.locator('.markup-modal-head h3').textContent();
    expect(modalTitle.trim().length).toBeGreaterThan(0);

    // Verify actions inside modal
    const inspectBtn = findingModal.locator('[data-markup-action="inspect-source"]');
    await expect(inspectBtn).toBeVisible();

    // Close the details modal
    const closeBtn = findingModal.locator('[data-markup-action="close-modal"]').first();
    await closeBtn.click({ force: true });
    await page.waitForTimeout(200);
    await expect(findingModal).toBeHidden();

    // 10. Test Annotation Visibility Filters
    const filterIssue = page.locator('[data-markup-filter="issue"]');
    if (await filterIssue.isVisible()) {
      await filterIssue.click();
      await page.waitForTimeout(200);
      await expect(filterIssue).toHaveClass(/active/);
    }

    const filterRd = page.locator('[data-markup-filter="rd"]');
    if (await filterRd.isVisible()) {
      await filterRd.click();
      await page.waitForTimeout(200);
      await expect(filterRd).toHaveClass(/active/);
    }

    const filterLegal = page.locator('[data-markup-filter="legal"]');
    if (await filterLegal.isVisible()) {
      await filterLegal.click();
      await page.waitForTimeout(200);
      await expect(filterLegal).toHaveClass(/active/);
    }

    const filterAll = page.locator('[data-markup-filter="all"]');
    await filterAll.click();
    await page.waitForTimeout(200);
    await expect(filterAll).toHaveClass(/active/);

    // 11. Test Visual Track Changes Drawer
    const btnTrackChanges = page.locator('#btn-markup-track-changes');
    await expect(btnTrackChanges).toBeVisible();
    await btnTrackChanges.click();
    await page.waitForTimeout(400);

    const tcDrawer = page.locator('#artwork-track-changes-drawer');
    await expect(tcDrawer).toBeVisible();
    await expect(tcDrawer).toHaveClass(/open/);

    // Inspect Track Changes Categories
    const catAllergens = page.locator('.tc-category-pill[data-category="allergens"]');
    await expect(catAllergens).toBeVisible();
    await catAllergens.click();
    await page.waitForTimeout(200);
    await expect(catAllergens).toHaveClass(/active/);

    const catClaims = page.locator('.tc-category-pill[data-category="claims"]');
    await expect(catClaims).toBeVisible();
    await catClaims.click();
    await page.waitForTimeout(200);
    await expect(catClaims).toHaveClass(/active/);

    // Close Track Changes drawer
    const btnCloseTc = page.locator('[data-tc-action="close"]');
    await btnCloseTc.click();
    await page.waitForTimeout(200);
    await expect(tcDrawer).not.toHaveClass(/open/);

    // 12. Test A3 Wall Poster Export Button & Real PDF Endpoint
    const btnExportPoster = page.locator('#btn-export-a3-poster');
    await expect(btnExportPoster).toBeVisible();
    const posterHref = await btnExportPoster.getAttribute('href');
    expect(posterHref).toContain(`/api/reviews/${reviewId}/export/a3-poster`);

    // Verify the server generates the single-page A3 PDF
    const posterRes = await request.get(posterHref);
    expect(posterRes.status()).toBe(200);
    expect(posterRes.headers()['content-type']).toContain('application/pdf');
    const pdfBuf = await posterRes.body();
    expect(pdfBuf.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // 13. Test Instant Toggle & Keyboard Shortcut ('m')
    // Click CLEAN
    await btnClean.click();
    await page.waitForTimeout(200);
    await expect(overlay).toHaveClass(/mode-clean/);

    // Press 'm' keyboard shortcut to toggle to MARKED
    await page.keyboard.press('m');
    await page.waitForTimeout(250);
    await expect(overlay).toHaveClass(/mode-marked/);

    // Press 'm' again to toggle back to CLEAN
    await page.keyboard.press('m');
    await page.waitForTimeout(250);
    await expect(overlay).toHaveClass(/mode-clean/);

    // 14. Confirm No Critical JavaScript Runtime Errors
    const fatalErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') && 
      !e.includes('Content Security Policy')
    );
    expect(fatalErrors).toEqual([]);
  });

});
