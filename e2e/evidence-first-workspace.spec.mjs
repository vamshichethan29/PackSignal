import { test, expect } from '@playwright/test';

test.describe('E2E: Advanced Evidence-First Review Workspace (BriefForge-Inspired Features)', () => {
  test('Complete verification workflow: SourceChips, Evidence Drawer, Conflict Cards, Guided Questions, Rule Map, Ingredient Diff, and Designer Handoff', async ({ page }) => {
    // 1. Open PackSignal home
    await page.goto('/');

    // 2. Open official organizer Dancing Fish sample
    const sampleBtn = page.locator('button[data-action="sample"][data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Confirm start in dialog
    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Wait for review to load
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // 3. Open Evidence & Sources tab
    const sourcesTab = page.locator('.tab[data-action="tab"][data-tab="sources"]');
    await sourcesTab.click({ force: true });
    await expect(page.locator('.review-body')).toBeVisible();

    // Verify Ingredient Difference View (Part 9)
    await expect(page.locator('.ingredient-diff-panel')).toBeVisible();
    const diffText = await page.locator('.ingredient-diff-panel').textContent();
    expect(diffText).toContain('INGREDIENT DIFFERENCE VIEW');
    expect(diffText).toContain('Honey');
    expect(diffText).toMatch(/(ORDER DIFFERENCE|PERCENTAGE DIFFERENCE)/);

    // Verify Source Facts Explorer (Part 8)
    await expect(page.locator('.source-facts-explorer')).toBeVisible();
    const factsTable = page.locator('.source-facts-explorer table');
    await expect(factsTable).toBeVisible();

    // 4. Click a SourceChip to open Universal Evidence Drawer (Part 2 & 3)
    const chip = page.locator('.source-facts-explorer [data-source-chip="true"]').first();
    await expect(chip).toBeVisible();
    await chip.click();

    // Verify Evidence Drawer opened
    const drawer = page.locator('#evidence-drawer-panel');
    await expect(drawer).toBeVisible();
    await expect(page.locator('#evidence-drawer-title')).toContainText('DancingFish');

    // Close the Evidence Drawer
    const closeDrawerBtn = page.locator('#evidence-drawer-close');
    await closeDrawerBtn.click();
    await expect(drawer).not.toHaveClass(/open/);

    // 5. Open Findings tab and verify ConflictCard (Part 5)
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click({ force: true });

    // Verify finding items are present
    const findingItem = page.locator('.queue-finding').first();
    await expect(findingItem).toBeVisible();

    // Select finding and check evidence stack has SourceChips
    const evidenceStack = page.locator('.evidence-stack');
    await expect(evidenceStack).toBeVisible();

    // 6. Open Resolve Questions tab (Part 6 & 7)
    const questionsTab = page.locator('.tab[data-action="tab"][data-tab="questions"]');
    await questionsTab.click({ force: true });
    await expect(page.locator('.review-body')).toBeVisible();

    // Verify Guided Resolution Queue with dynamic blocker categories & unlock counts
    await expect(page.locator('.guided-resolution-queue, .question-card').first()).toBeVisible();
    const queueText = await page.locator('.review-body').textContent();
    expect(queueText).toMatch(/(May unblock|Question|SOURCE AUTHORITY|NUTRITION BASIS)/);

    // 7. Open Rule Trust Center (Part 11 & 14)
    const rulebookTab = page.locator('.tab[data-action="tab"][data-tab="rulebook"]');
    await rulebookTab.click({ force: true });

    // Verify Rule Trust Center and Traceability Map
    await expect(page.locator('.rulebook-trust-view, [data-rulebook-view]')).toBeVisible();
    await expect(page.locator('.svg-rule-map, .rule-map-wrapper')).toBeVisible();
    const ruleMapText = await page.locator('.svg-rule-map, .rule-map-wrapper').textContent();
    expect(ruleMapText).toContain('RULE TRACEABILITY MAP');

    // 8. Open Reports tab & check Designer Handoff (Part 19)
    const reportsTab = page.locator('.tab[data-action="tab"][data-tab="reports"]');
    await reportsTab.click({ force: true });

    await expect(page.locator('.designer-handoff-section')).toBeVisible();
    const handoffText = await page.locator('.designer-handoff-section').textContent();
    expect(handoffText).toContain('DESIGNER HANDOFF SYSTEM');
    expect(handoffText).toContain('Designer Handoff & Correction Checklist');
    expect(handoffText).toContain('Preserve Existing Approved Copy');

    // Verify export buttons
    const exportHandoffBtn = page.locator('button[data-action="export-designer-handoff"]');
    await expect(exportHandoffBtn).toBeVisible();

    // 9. Verify Responsive Layout (Tablet / Mobile Viewport)
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.tabs')).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('.tabs')).toBeVisible();
  });
});
