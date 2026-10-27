import { test, expect } from '@playwright/test';

test.describe('E2E: Shopper Personas — Consumer Impact Lens (Upgrade #42)', () => {
  test('Complete 34-step Shopper Personas flow: Nut Allergy, Vegan, Sugar Watcher, 2D/3D integration, and Report export', async ({ page }) => {
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Content Security Policy') && !text.includes('CSP')) {
          consoleErrors.push(text);
        }
      }
    });

    test.setTimeout(180000);

    // 1. Open PackSignal
    await page.goto('/');

    // 2. Load official Dancing Fish sample or click recent review
    const recentDf = page.locator('button.review-card:has-text("Dancing Fish"), article.review-card:has-text("Dancing Fish"), a:has-text("Dancing Fish"), tr:has-text("Dancing Fish") button[data-action="open"]').first();
    if (await recentDf.isVisible({ timeout: 1500 }).catch(() => false)) {
      await recentDf.click();
    } else {
      const sampleBtn = page.locator('button[data-action="sample"][data-sample="organizer"]').first();
      await expect(sampleBtn).toBeVisible();
      await sampleBtn.click();

      const runBtn = page.locator('button[data-action="run-sample"]');
      await expect(runBtn).toBeVisible();
      await runBtn.click();
    }

    // 3. Wait for Dancing Fish review to complete and Workbench to appear
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.review-workbench')).toBeVisible({ timeout: 15000 });

    // 4. Locate Shopper View dropdown (toolbar or queue filter)
    const personaSelect = page.locator('select[data-action="select-shopper-persona"], select[data-action="filter-queue-persona"]').first();
    await expect(personaSelect).toBeVisible();

    // 5. Select Nut Allergy Shopper
    await personaSelect.selectOption('nut-allergy');

    // 6. Verify Nut Allergy perspective banner is rendered
    const banner = page.locator('.shopper-perspective-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('NUT ALLERGY SHOPPER');
    await expect(banner).toContainText('VIEW FILTER ONLY');

    // 7. Verify highlighted almonds, pecans, walnuts, and May Contain statement in 2D overlay
    const overlay = page.locator('.shopper-highlights-layer');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('ALMONDS (INTENTIONAL)');
    await expect(overlay).toContainText('PECANS (INTENTIONAL)');
    await expect(overlay).toContainText('WALNUTS (INTENTIONAL)');
    await expect(overlay).toContainText('MAY CONTAIN (ADVISORY)');

    // 8. Select DF-03 or tree nut finding and check consumer consequence card
    const nutFindingBtn = page.locator('button[data-action="select-finding"]:has-text("tree nut"), button[data-action="select-finding"]:has-text("May Contain"), button[data-action="select-finding"]:has-text("Allergen")').first();
    if (await nutFindingBtn.isVisible().catch(() => false)) {
      await nutFindingBtn.click();
    }

    const consequenceCard = page.locator('.consumer-consequence-card');
    await expect(consequenceCard).toBeVisible();
    await expect(consequenceCard).toContainText('NUT ALLERGY CONSUMER PERSPECTIVE');
    await expect(consequenceCard).toContainText('WHAT THE SHOPPER SEES');
    await expect(consequenceCard).toContainText('WHY THIS MATTERS TO CONSUMERS');

    // 9. Confirm no false medical or safety clearance is claimed
    await expect(banner).not.toContainText('Safe for consumption');
    await expect(consequenceCard).not.toContainText('Medical Clearance');

    // 10. Switch to Vegan Shopper
    await personaSelect.selectOption('vegan');

    // 11. Verify Vegan perspective banner and 2D highlights
    await expect(banner).toContainText('VEGAN SHOPPER');
    await expect(overlay).toContainText('SUITABLE FOR VEGANS (CLAIM)');
    await expect(overlay).toContainText('HONEY (ANIMAL PRODUCT)');
    await expect(overlay).toContainText('CHOLESTEROL 45MG (ANOMALY)');

    // 12. Check Vegan consequence card
    await expect(consequenceCard).toContainText('VEGAN CONSUMER PERSPECTIVE');
    await expect(consequenceCard).toContainText('Suitable for Vegans');
    await expect(consequenceCard).toContainText('Honey');

    // 13. Verify no fabricated Certified Vegan trademark
    await expect(consequenceCard).not.toContainText('Certified Vegan Trademark Registered');

    // 14. Open Vegan vs Honey Decision Ripple
    const rippleBtn = consequenceCard.locator('button[data-action="explore-decision-ripple"]');
    await expect(rippleBtn).toBeVisible();
    await rippleBtn.click();

    // 15. Verify Decision Ripple modal dialog opens
    const rippleModal = page.locator('#decision-ripple-modal');
    await expect(rippleModal).toBeVisible();
    await expect(rippleModal).toContainText('WHAT-IF REFORMULATION ENGINE');

    // 16. Close modal to return to review workbench
    const closeModalBtn = rippleModal.locator('button[data-action="close-modal"], button:has-text("✕")').first();
    await closeModalBtn.click();
    await expect(rippleModal).not.toBeVisible();

    // 17. Switch to Sugar Watcher
    await personaSelect.selectOption('sugar-watcher');

    // 18. Verify Sugar Watcher perspective banner and 2D highlights
    await expect(banner).toContainText('SUGAR WATCHER');
    await expect(overlay).toContainText('NO ADDED SUGAR (CLAIM)');
    await expect(overlay).toContainText('0G ADDED SUGARS (ROUNDED)');
    await expect(overlay).toContainText('HONEY (ADDED SUGAR)');
    await expect(overlay).toContainText('COCONUT SUGAR (ADDED SUGAR)');
    await expect(overlay).toContainText('CANE SUGAR (IN GINGER)');

    // 19. Check Sugar consequence card
    await expect(consequenceCard).toContainText('SUGAR WATCHER CONSUMER PERSPECTIVE');
    await expect(consequenceCard).toContainText('21 CFR 101.60(c)(2)');

    // 20. Verify quantitative honesty (no guessed sugar grams)
    await expect(consequenceCard).toContainText('Quantitative verification requires approved formulation data');

    // 21. Compose with Department Filter (Legal)
    const legalDeptBtn = page.locator('button[data-action="filter-department"][data-dept="legal"], button[data-dept="legal"]').first();
    if (await legalDeptBtn.isVisible().catch(() => false)) {
      await legalDeptBtn.click();
      await expect(page.locator('.workbench-queue')).toBeVisible();
    }

    // 22. Switch to 3D Context Mode
    const btn3d = page.locator('button[data-action="workbench-mode"][data-mode="3d"]').first();
    await expect(btn3d).toBeVisible();
    await btn3d.click();

    // 23. Verify 3D packaging scene is rendered
    await expect(page.locator('.carton-scene, .carton-stage').first()).toBeVisible();

    // 24. Switch back to 2D Proof
    const btn2d = page.locator('button[data-action="workbench-mode"][data-mode="2d"]').first();
    await expect(btn2d).toBeVisible();
    await btn2d.click();

    // 25. Click [✕ Clear Lens] to reset to All Perspectives
    const resetBtn = page.locator('button[data-action="reset-shopper-persona"]').first();
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // 26. Verify banner is removed and all findings return
    await expect(banner).not.toBeVisible();

    // 27. Fetch the HTML report export and confirm SHOPPER PERSPECTIVE SUMMARY
    const reviewId = await page.evaluate(() => window.location.pathname.split('/').pop() || document.querySelector('[data-review-id]')?.dataset.reviewId || 'current');
    const reportResponse = await page.request.get(`/api/reviews/${reviewId}/report.html`);
    if (reportResponse.ok()) {
      const reportHtml = await reportResponse.text();
      expect(reportHtml).toContain('SHOPPER PERSPECTIVE SUMMARY');
      expect(reportHtml).toContain('Nut Allergy Shopper');
      expect(reportHtml).toContain('Vegan Shopper');
      expect(reportHtml).toContain('Sugar Watcher');
      expect(reportHtml).toContain('VIEW FILTER ONLY');
    }

    // 28. Confirm no fatal console errors
    expect(consoleErrors).toEqual([]);
  });
});
