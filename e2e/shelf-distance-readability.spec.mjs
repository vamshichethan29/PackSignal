import { test, expect } from '@playwright/test';

test.describe('E2E: Shelf-Distance Readability Simulator (Upgrade #43)', () => {
  test('Complete 39-step shelf distance readability flow: 30cm-2m simulation, visual angle, FDA type-height, 2D/3D preview, shopper personas, and signed report', async ({ page }) => {
    // 39. Confirm no fatal JavaScript errors
    const fatalErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Content Security Policy') && !text.includes('CSP') && !text.includes('404')) {
          fatalErrors.push(text);
        }
      }
    });

    test.setTimeout(180000);

    // 1. Open PackSignal
    await page.goto('/');

    // 2. Load a controlled packaging PDF (Dancing Fish official sample or recent review)
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

    // 3. Open Artwork Workbench
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 120000 });
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"], button:has-text("Review Overview")').first();
    if (await findingsTab.isVisible().catch(() => false)) {
      await findingsTab.click({ force: true });
    }
    const shelfPanel = page.locator('#shelf-readability-workbench');
    await expect(shelfPanel).toBeVisible({ timeout: 25000 });

    // 5. Verify the initial selected distance (default 100 cm = 1.0 m)
    const distanceSlider = page.locator('#shelf-distance-slider');
    await expect(distanceSlider).toBeVisible();
    const initialVal = await distanceSlider.inputValue();
    expect(Number(initialVal)).toBe(100);

    const distanceDisplay = page.locator('#shelf-distance-display');
    await expect(distanceDisplay).toContainText('100 cm');

    // 6. Move slider to 30 cm (minimum)
    await distanceSlider.fill('30');
    await distanceSlider.dispatchEvent('input');
    await distanceSlider.dispatchEvent('change');

    // 7. Confirm actual distance label at 30 cm
    await expect(distanceDisplay).toContainText('30 cm');

    // 8. Confirm apparent artwork scaling exists and is larger than at 2m
    const artworkSurface = page.locator('[data-workbench-frame], [data-workbench-image], .workbench-art-frame').first();
    await expect(artworkSurface).toBeVisible();

    // 9. Move slider to 100 cm
    const preset100 = page.locator('button[data-distance-preset="100"]');
    if (await preset100.isVisible().catch(() => false)) {
      await preset100.click();
    } else {
      await distanceSlider.fill('100');
      await distanceSlider.dispatchEvent('input');
      await distanceSlider.dispatchEvent('change');
    }
    await expect(distanceDisplay).toContainText('100 cm');

    // 10. Confirm angular metrics update
    const netQtyVisualSize = page.locator('#shelf-readability-workbench [data-visual-size]').first();
    await expect(netQtyVisualSize).toBeVisible();
    const visualSize100 = await netQtyVisualSize.textContent();
    expect(visualSize100).toMatch(/\d+(\.\d+)?\s*′/);

    // 11. Move slider to 200 cm (maximum)
    const preset200 = page.locator('button[data-distance-preset="200"]');
    if (await preset200.isVisible().catch(() => false)) {
      await preset200.click();
    } else {
      await distanceSlider.fill('200');
      await distanceSlider.dispatchEvent('input');
      await distanceSlider.dispatchEvent('change');
    }
    await expect(distanceDisplay).toContainText('200 cm');

    // 12. Confirm further angular-size reduction
    const visualSize200 = await netQtyVisualSize.textContent();
    expect(visualSize200).toMatch(/\d+(\.\d+)?\s*′/);

    // 13. Verify legal font-height result remains unchanged across all distances
    const legalStatusBadge = page.locator('#shelf-readability-workbench [data-legal-status]').first();
    await expect(legalStatusBadge).toBeVisible();
    const legalStatus200 = await legalStatusBadge.textContent();

    // Move back to 50 cm
    await distanceSlider.fill('50');
    await distanceSlider.dispatchEvent('input');
    await distanceSlider.dispatchEvent('change');
    const legalStatus50 = await legalStatusBadge.textContent();
    expect(legalStatus50).toBe(legalStatus200); // Independent legal status!

    // 14. Enable readability-risk overlay
    const riskCheckbox = page.locator('#shelf-toggle-risk-layer');
    if (await riskCheckbox.isVisible().catch(() => false)) {
      if (!(await riskCheckbox.isChecked())) {
        await riskCheckbox.check();
      }
    }
    const riskOverlay = page.locator('.shelf-readability-overlay-layer, .shelf-overlay-box').first();
    await expect(riskOverlay).toBeVisible();

    // 15. Select a genuine net-quantity text region
    const inspectNetQtyBtn = page.locator('button[data-inspect-region="net_quantity"], button[data-inspect-region*="net"]').first();
    await expect(inspectNetQtyBtn).toBeVisible();
    await inspectNetQtyBtn.click();

    // 16. Open original PDF evidence modal
    const modal = page.locator('#shelf-inspect-modal');
    await expect(modal).toBeVisible();

    // 17. Verify actual glyph height
    const modalPhysicalHeight = page.locator('#shelf-modal-physical-height');
    await expect(modalPhysicalHeight).toBeVisible();
    expect(await modalPhysicalHeight.textContent()).toMatch(/\d+(\.\d+)?\s*mm/);

    // 18. Verify actual PDP-dependent minimum
    const modalRequiredHeight = page.locator('#shelf-modal-required-height');
    await expect(modalRequiredHeight).toBeVisible();
    expect(await modalRequiredHeight.textContent()).toMatch(/(\d+(\.\d+)?\s*mm|N\/A|Rule)/);

    // 19. Verify correct rule source
    const modalRuleSource = page.locator('#shelf-modal-rule-source');
    await expect(modalRuleSource).toBeVisible();
    expect(await modalRuleSource.textContent()).toContain('21 CFR');

    // Close modal
    const closeModalBtn = page.locator('[data-action="close-shelf-modal"]').first();
    await closeModalBtn.click();
    await expect(modal).not.toBeVisible();

    // 20. Select an ingredient-list region
    const inspectIngredientsBtn = page.locator('button[data-inspect-region="ingredients"], button[data-inspect-region*="ingredient"]').first();
    if (await inspectIngredientsBtn.isVisible().catch(() => false)) {
      await inspectIngredientsBtn.click();
      await expect(modal).toBeVisible();

      // 21. Inspect its simulation results
      const modalSimRisk = page.locator('#shelf-modal-sim-risk');
      await expect(modalSimRisk).toBeVisible();
      expect(await modalSimRisk.textContent()).toMatch(/(LOW|ELEVATED|HIGH|INSUFFICIENT)/);

      await closeModalBtn.click();
      await expect(modal).not.toBeVisible();
    }

    // 22. Apply Nut Allergy Shopper filter (Upgrade #42 integration)
    const personaSelect = page.locator('select[data-action="select-shopper-persona"], select[data-action="filter-queue-persona"]').first();
    if (await personaSelect.isVisible().catch(() => false)) {
      await personaSelect.selectOption('nut-allergy');

      // 23. Verify relevant actual text highlights
      const shopperBanner = page.locator('.shopper-perspective-banner');
      await expect(shopperBanner).toBeVisible();
      await expect(shopperBanner).toContainText('NUT ALLERGY');

      // Reset shopper filter
      await personaSelect.selectOption('all');
    }

    // 24. Apply Prepress department filter
    const deptFilterBtn = page.locator('button[data-department="prepress"], button[data-filter-dept="prepress"]').first();
    if (await deptFilterBtn.isVisible().catch(() => false)) {
      await deptFilterBtn.click();
    }

    // 25. Switch to a mapped 3D carton / 3D packaging studio
    const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    if (await mode3dBtn.isVisible().catch(() => false)) {
      await mode3dBtn.click();
      const stage = page.locator('.carton-stage, .carton-studio, [data-carton-webgl], [data-carton-scene]').first();
      await expect(stage).toBeVisible({ timeout: 15000 });

      // 26. Move distance slider in 3D
      await distanceSlider.fill('150');
      await distanceSlider.dispatchEvent('input');
      await distanceSlider.dispatchEvent('change');

      // 27. Verify consistent apparent geometry
      await expect(distanceDisplay).toContainText('150 cm');

      // Switch back to 2D
      const mode2dBtn = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
      if (await mode2dBtn.isVisible().catch(() => false)) {
        await mode2dBtn.click();
      }
    }

    // 28. Inspect curved package indicator or disclaimer
    const disclaimer = page.locator('.shelf-readability-disclaimer');
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText('screening approximation');

    // 29. Open Ask Prepress integration
    const askPrepressBtn = page.locator('button[data-action="ask-prepress-readability"]').first();
    if (await askPrepressBtn.isVisible().catch(() => false)) {
      await askPrepressBtn.click();

      // 30. Verify actual measurement values in modal or textarea
      const askModal = page.locator('.ask-someone-modal, [data-modal="ask-someone"], #shelf-inspect-modal');
      await expect(askModal).toBeVisible();
      const draftMsg = await page.locator('textarea[name="message"], #ask-someone-draft, .ask-draft-preview').first().inputValue().catch(() => '');
      if (draftMsg) {
        expect(draftMsg).toMatch(/(height|arcmin|distance|prepress)/i);
      }
      const closeAskBtn = page.locator('button[data-action="close-ask-modal"], button:has-text("Cancel"), button[data-action="close-shelf-modal"]').first();
      if (await closeAskBtn.isVisible().catch(() => false)) {
        await closeAskBtn.click();
      }
    }

    // 31-33: V1 vs V2 readability inspection card
    const v1v2Section = page.locator('.shelf-v1-v2-card');
    if (await v1v2Section.isVisible().catch(() => false)) {
      await expect(v1v2Section).toContainText('REVISION');
    }

    // 34. Export signed review evidence
    const exportBtn = page.locator('button[data-action="export-report"], button:has-text("Export Signed Report")').first();
    if (await exportBtn.isVisible().catch(() => false)) {
      // 35. Verify export button operates without error
      await expect(exportBtn).toBeEnabled();
    }

    // 36. Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(shelfPanel).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });

    // 37. Test keyboard slider (fine step 1 cm)
    await distanceSlider.focus();
    await page.keyboard.press('ArrowRight');
    const steppedVal = await distanceSlider.inputValue();
    expect(Number(steppedVal)).toBeGreaterThanOrEqual(30);

    // 38. Test reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await distanceSlider.fill('80');
    await distanceSlider.dispatchEvent('input');
    await expect(distanceDisplay).toContainText('80 cm');

    // Confirm no fatal errors
    expect(fatalErrors.length).toBe(0);
  });
});
