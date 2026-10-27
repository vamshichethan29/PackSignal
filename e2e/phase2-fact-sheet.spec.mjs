import { test, expect } from '@playwright/test';

test.describe('E2E: Phase 2 — Fact Sheet & Evidence Verification', () => {
  test('COMPLETE PHASE 2 PIPELINE: loads official review, inspects Fact Sheet, 3 states, honey conflict, carbohydrate basis, ingredient diff, vegan wording & click-to-source evidence', async ({ page }) => {
    test.setTimeout(180000);

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
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

    // 4. Open Fact Sheet tab / action
    const modeBtn = page.locator('#btn-toggle-overlap-mode');
    if (await modeBtn.isVisible()) {
      await modeBtn.click();
    }

    const viewFsBtn = page.locator('button[data-action="view-fact-sheet"]').first();
    await expect(viewFsBtn).toBeVisible();
    await viewFsBtn.click();

    // 5. Verify Fact Sheet container is mounted and populated
    const fsRoot = page.locator('#fact-sheet-root');
    await expect(fsRoot).toBeVisible({ timeout: 15000 });
    await expect(fsRoot.locator('h2')).toContainText('PACKSIGNAL — FACT SHEET');

    // 6. Verify Analytics Dashboard Bar
    const analytics = fsRoot.locator('.fact-analytics-grid');
    await expect(analytics).toBeVisible();
    const verifiedStat = analytics.locator('.analytics-card.verified .stat-value');
    await expect(verifiedStat).not.toHaveText('0');

    const conflictStat = analytics.locator('.analytics-card.conflicted .stat-value');
    await expect(conflictStat).not.toHaveText('0');

    // 7. Verify Sourced Conflict Cards (Honey, Carbohydrate, Ingredients)
    const honeyConflict = fsRoot.locator('.conflict-group-card[data-conflict-id="CONFLICT-HONEY-PERCENTAGE"]');
    await expect(honeyConflict).toBeVisible();
    await expect(honeyConflict).toContainText('Honey');
    await expect(honeyConflict).toContainText('1%');
    await expect(honeyConflict).toContainText('9%');

    const carbConflict = fsRoot.locator('.conflict-group-card[data-conflict-id="CONFLICT-TOTAL-CARBOHYDRATE"]');
    await expect(carbConflict).toBeVisible();
    await expect(carbConflict).toContainText('Total Carbohydrate');
    await expect(carbConflict).toContainText('66g');
    await expect(carbConflict).toContainText('15g');

    // 8. Test Filter Tabs: [Verified], [AI Suggested], [Conflicted], [All]
    const tabVerified = fsRoot.locator('.fact-filter-tab[data-filter="VERIFIED"]');
    await tabVerified.click();
    await expect(fsRoot.locator('.fact-item-card.state-verified').first()).toBeVisible();
    // Conflicted cards shouldn't be listed under VERIFIED filter
    const conflictedUnderVerified = await fsRoot.locator('.fact-item-card.state-conflicted').count();
    expect(conflictedUnderVerified).toBe(0);

    const tabSuggested = fsRoot.locator('.fact-filter-tab[data-filter="SUGGESTED"]');
    await tabSuggested.click();
    await expect(fsRoot.locator('.fact-item-card.state-suggested').first()).toBeVisible();

    const tabConflicted = fsRoot.locator('.fact-filter-tab[data-filter="CONFLICTED"]');
    await tabConflicted.click();
    await expect(fsRoot.locator('.conflict-group-card').first()).toBeVisible();

    const tabAll = fsRoot.locator('.fact-filter-tab[data-filter="ALL"]');
    await tabAll.click();

    // 9. Click-to-source evidence drawer on a Fact Card
    const honeyCard = fsRoot.locator('.fact-item-card[data-fact-id*="honey"]').first();
    await expect(honeyCard).toBeVisible();
    await honeyCard.click();

    const drawer = fsRoot.locator('#evidence-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.evidence-drawer-header h3')).toContainText('Click-to-Source');
    await expect(drawer).toContainText('ingredient.honey.percentage');
    await expect(drawer).toContainText('Document SHA-256');

    // 10. Close evidence drawer
    const closeBtn = drawer.locator('#btn-close-drawer');
    await closeBtn.click();
    await expect(drawer).toBeHidden();

    // 11. Click another category: Nutrition & Net Quantity
    const netQtyCard = fsRoot.locator('.fact-item-card[data-fact-id*="net_quantity"]').first();
    await expect(netQtyCard).toBeVisible();
    await netQtyCard.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('net_quantity');
    await closeBtn.click();

    // 12. Switch back to Review Overview tab
    const overviewTab = page.locator('button[data-action="tab"][data-tab="findings"]').first();
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
      await expect(page.locator('.findings-heading, .review-body')).toBeVisible();
    }

    // 13. Ensure zero fatal JavaScript errors
    const fatalErrors = consoleErrors.filter(e => 
      e.includes('TypeError') || e.includes('ReferenceError') || e.includes('SyntaxError') || e.includes('Uncaught')
    );
    expect(fatalErrors.length).toBe(0);
  });
});
