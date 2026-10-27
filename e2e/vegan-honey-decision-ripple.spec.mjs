import { test, expect } from '@playwright/test';

test.describe('E2E: Vegan vs Honey Decision Ripple What-If Simulation', () => {
  test('Complete What-If Simulation: Option A, Option B, Ripple Visualization, Trade-off Matrix, and Correction Plan creation', async ({ page }) => {
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

    // 2. Load Dancing Fish sample or click recent review if already present
    const recentDf = page.locator('button.review-card:has-text("Dancing Fish"), article.review-card:has-text("Dancing Fish"), a:has-text("Dancing Fish")').first();
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

    // 3. Wait for Dancing Fish review to complete
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // 4. Verify DF-05 (Vegan Claim vs Honey) card is visible in Organizer Suite
    const df05Card = page.locator('#df-card-DF-05, article[data-canonical-id="DF-05"]').first();
    await expect(df05Card).toBeVisible({ timeout: 15000 });
    await df05Card.scrollIntoViewIfNeeded();

    // 5. Click [⚡ Explore Resolution Options] on DF-05 card
    const exploreBtn = df05Card.locator('button[data-action="explore-decision-ripple"]');
    await expect(exploreBtn).toBeVisible();
    await exploreBtn.click();

    // 6. Verify Decision Ripple modal dialog opens
    const modal = page.locator('#decision-ripple-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('WHAT-IF REFORMULATION ENGINE');
    await expect(modal).toContainText('PREVIEW ONLY');

    // 7. Verify conflict hero details
    await expect(modal).toContainText('Honey (9%)');
    await expect(modal).toContainText('Suitable for Vegans');

    // 8. OPTION A: KEEP HONEY, REMOVE VEGAN CLAIM (Active by default)
    const cardOptionA = page.locator('.ripple-option-card[data-option="KEEP_HONEY"]');
    await expect(cardOptionA).toHaveClass(/active/);

    // Verify Option A ripple details
    await expect(modal).toContainText('Brand & Marketing');
    await expect(modal).toContainText('Legal & Regulatory');
    await expect(modal).toContainText('Formula Unchanged');
    await expect(modal).toContainText('Tree Nut Allergens — Unchanged');
    await expect(modal).toContainText('Still Conflicted'); // No Added Sugar

    // Verify copy question for Brand
    const copyQuestionBtn = modal.locator('button[data-action="copy-dept-question"]').first();
    await expect(copyQuestionBtn).toBeVisible();

    // 9. SWITCH TO OPTION B: REMOVE HONEY, KEEP VEGAN CLAIM
    const cardOptionB = page.locator('.ripple-option-card[data-option="REMOVE_HONEY"]');
    await cardOptionB.click();
    await expect(cardOptionB).toHaveClass(/active/);

    // Verify Option B consequences
    await expect(modal).toContainText('R&D & Food Science');
    await expect(modal).toContainText('Recalculation Required');
    await expect(modal).toContainText('Certification Review Required');
    await expect(modal).toContainText('Quantitative nutrition numbers not fabricated');

    // 10. TOGGLE COMPARISON VIEW: [Compare Both Outcomes]
    const compareToggleBtn = modal.locator('button[data-action="toggle-ripple-view"]');
    await expect(compareToggleBtn).toBeVisible();
    await compareToggleBtn.click();

    // Verify Comparison Matrix is visible
    const compareMatrix = modal.locator('.ripple-compare-matrix');
    await expect(compareMatrix).toBeVisible();
    await expect(compareMatrix).toContainText('Product Formulation');
    await expect(compareMatrix).toContainText('Artwork Changes');
    await expect(compareMatrix).toContainText('Nutrition Facts');
    await expect(compareMatrix).toContainText('No Added Sugar Claim');

    // Toggle back to ripple view
    await compareToggleBtn.click();
    await expect(modal.locator('.ripple-graph-panel')).toBeVisible();

    // 11. CREATE CORRECTION PLAN: [Create Correction Plan]
    const createPlanBtn = modal.locator('button[data-action="create-correction-plan"]');
    await expect(createPlanBtn).toBeVisible();
    await createPlanBtn.click();

    // 12. Verify modal closes and success toast is displayed
    await expect(modal).not.toBeVisible();
    const toast = page.locator('.ps-toast, [role="status"]:not(.canvas-notice)');
    await expect(toast.first()).toBeVisible();

    // Confirm no critical uncaught JavaScript errors
    expect(consoleErrors).toEqual([]);
  });
});
