import { test, expect } from '@playwright/test';

test.describe('E2E: Phase 3 — Rules, Requirements and Smart Questions', () => {
  test('COMPLETE PHASE 3 PIPELINE: loads official review, inspects FDA Granola Rule Pack, checks %DV and arithmetic, verifies <=10 smart questions, and projects brand asset decisions into creative brief', async ({ page }) => {
    test.setTimeout(180000);

    // Track browser console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Navigate to root
    await page.goto('/');

    // 2. Click official organizer sample button to open sample dialog
    const sampleBtn = page.locator('button[data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible({ timeout: 15000 });
    await sampleBtn.click();

    // Confirm start review in dialog
    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // 3. Wait for review completion
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // Dismiss overlap shield if active
    const modeBtn = page.locator('#btn-toggle-overlap-mode');
    if (await modeBtn.isVisible()) {
      await modeBtn.click();
    }

    // 4. Open Requirements & Smart Questions Workspace
    const viewReqBtn = page.locator('#review-view-requirements');
    await expect(viewReqBtn).toBeVisible();
    await viewReqBtn.click();

    // 5. Verify Requirements Workspace is mounted and rendered
    const reqRoot = page.locator('#req-workspace-root');
    await expect(reqRoot).toBeVisible({ timeout: 15000 });
    await expect(reqRoot.locator('h2')).toContainText('Regulatory Requirements & Smart Questions');

    // 6. Verify Context Controls: Market = United States (FDA), Launch Date = 2026-10-16
    const marketSelect = reqRoot.locator('#req-market-select');
    await expect(marketSelect).toBeVisible();
    await expect(marketSelect).toHaveValue('us');

    const launchDateInput = reqRoot.locator('#req-launch-date-input');
    await expect(launchDateInput).toBeVisible();
    await expect(launchDateInput).toHaveValue('2026-10-16');

    // 7. Verify Analytics KPI Grid (Passed, Issues, Needs Review, Unable, Not Applicable)
    const kpiGrid = reqRoot.locator('.req-analytics-grid');
    await expect(kpiGrid).toBeVisible();
    const passKpi = kpiGrid.locator('.req-kpi-card.pass .req-kpi-val');
    const issueKpi = kpiGrid.locator('.req-kpi-card.issue .req-kpi-val');
    await expect(passKpi).not.toHaveText('0');
    await expect(issueKpi).not.toHaveText('0');

    // 8. Verify Granola Rule Cards Rendered (US01-US21)
    const ruleCards = reqRoot.locator('.req-card');
    const ruleCount = await ruleCards.count();
    expect(ruleCount).toBeGreaterThanOrEqual(15);

    // 9. Verify Added Sugar Claim Rule (21 CFR 101.60(c))
    const addedSugarCard = reqRoot.locator('.req-card').filter({ hasText: /No Added Sugar/i }).first();
    await expect(addedSugarCard).toBeVisible();
    await expect(addedSugarCard.locator('.req-status-badge')).toContainText(/ISSUE|FAIL/);
    await expect(addedSugarCard).toContainText(/Honey|Sugar/i);

    // 10. Verify Major Allergen Disclosure & Tree Nut Species Identification
    const treeNutCard = reqRoot.locator('.req-card').filter({ hasText: /Tree[- ]Nut|Allergen/i }).first();
    await expect(treeNutCard).toBeVisible();

    const advisoryCard = reqRoot.locator('.req-card').filter({ hasText: /May Contain|Advisory/i }).first();
    await expect(advisoryCard).toBeVisible();

    // 11. Verify Nutrition %DV Calculations (Total Fat, Vitamin D)
    const fatCard = reqRoot.locator('.req-card').filter({ hasText: /Total Fat/i }).first();
    await expect(fatCard).toBeVisible();

    const vitDCard = reqRoot.locator('.req-card').filter({ hasText: /Vitamin D/i }).first();
    await expect(vitDCard).toBeVisible();

    // 12. Verify Calorie Math & Serving Arithmetic Checks
    const calorieCard = reqRoot.locator('.req-card').filter({ hasText: /Calories/i }).first();
    await expect(calorieCard).toBeVisible();

    const servingMathCard = reqRoot.locator('.req-card').filter({ hasText: /Serving/i }).first();
    await expect(servingMathCard).toBeVisible();

    // 13. Verify Barcode GS1 Check Digit Check
    const barcodeCard = reqRoot.locator('.req-card').filter({ hasText: /Barcode|UPC|GTIN/i }).first();
    await expect(barcodeCard).toBeVisible();

    // 14. Filter Tabs: Click ISSUES tab, verify only issues are visible
    const issuesTab = reqRoot.locator('.req-tab-btn[data-tab="ISSUES"]');
    await issuesTab.click();
    const visibleCardsUnderIssues = await reqRoot.locator('.req-card').count();
    expect(visibleCardsUnderIssues).toBeGreaterThan(0);
    expect(visibleCardsUnderIssues).toBeLessThan(ruleCount);

    // Restore to ALL
    const allTab = reqRoot.locator('.req-tab-btn[data-tab="ALL"]');
    await allTab.click();

    // 15. Verify Prioritized Smart Questions Queue (HARD MAX 10)
    const questionsSection = reqRoot.locator('.questions-section');
    await expect(questionsSection).toBeVisible();
    const qCards = questionsSection.locator('.q-card');
    const qCount = await qCards.count();
    expect(qCount).toBeGreaterThan(0);
    expect(qCount).toBeLessThanOrEqual(10);

    // Verify first question has rank, department, why this matters, and clickable options
    const firstQ = qCards.first();
    await expect(firstQ.locator('.q-priority-pill')).toContainText('Rank #1');
    await expect(firstQ.locator('.q-reason')).toContainText('Why this matters');

    // Click an option in the first question to answer it
    const firstOpt = firstQ.locator('.q-opt-btn').first();
    await expect(firstOpt).toBeVisible();
    await firstOpt.click();
    await expect(firstOpt).toHaveClass(/selected/);

    // 16. Verify Design Assets Grid & Creative Brief Feeder
    const designSection = reqRoot.locator('.design-assets-section');
    await expect(designSection).toBeVisible();
    const assetCards = designSection.locator('.asset-card');
    const assetCount = await assetCards.count();
    expect(assetCount).toBeGreaterThanOrEqual(3);

    // Select KEEP for Logo
    const logoCard = designSection.locator('.asset-card').filter({ hasText: /Logo/i }).first();
    await expect(logoCard).toBeVisible();
    const keepBtn = logoCard.locator('button.asset-dec-btn.keep');
    await keepBtn.click();
    await expect(keepBtn).toHaveClass(/active/);

    // Select CHANGE for Colors
    const colorCard = designSection.locator('.asset-card').filter({ hasText: /Palette|Color/i }).first();
    await expect(colorCard).toBeVisible();
    const changeBtn = colorCard.locator('button.asset-dec-btn.change');
    await changeBtn.click();
    await expect(changeBtn).toHaveClass(/active/);

    // Select REMOVE for Tagline
    const taglineCard = designSection.locator('.asset-card').filter({ hasText: /Tagline/i }).first();
    await expect(taglineCard).toBeVisible();
    const removeBtn = taglineCard.locator('button.asset-dec-btn.remove');
    await removeBtn.click();
    await expect(removeBtn).toHaveClass(/active/);

    // 17. Verify Creative Brief Projection Box updates dynamically
    const briefBox = designSection.locator('.brief-projection-box');
    await expect(briefBox).toBeVisible();
    await expect(briefBox).toContainText('CREATIVE BRIEF');
    await expect(briefBox.locator('.brief-proj-row', { hasText: 'KEEP:' })).toContainText(/Logo/i);
    await expect(briefBox.locator('.brief-proj-row', { hasText: 'CHANGE:' })).toContainText(/Palette|Color/i);
    await expect(briefBox.locator('.brief-proj-row', { hasText: 'REMOVE:' })).toContainText(/Tagline/i);

    // 18. Confirm no fatal browser errors
    const fatalErrors = consoleErrors.filter(e => 
      e.includes('TypeError') || e.includes('ReferenceError') || e.includes('SyntaxError') || e.includes('Uncaught')
    );
    expect(fatalErrors).toEqual([]);
  });
});
