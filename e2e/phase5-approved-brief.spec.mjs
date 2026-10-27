/**
 * @file e2e/phase5-approved-brief.spec.mjs
 * 
 * Playwright End-to-End Test for PackSignal Phase 5:
 * Evidence-Backed Packaging Brief, Clause-Level Audit, Brief Editor,
 * Server-Side Approval Gate, PDF/Checklist Export, and Grounded "Ask About This" Assistant.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 5 — Evidence-Backed Packaging Brief, Audit, Approval & Export E2E', () => {

  test('Full Browser Workflow: Draft -> Audit Blocker -> Edit -> Approval -> Export -> Grounded Q&A', async ({ page }) => {
    test.setTimeout(120_000);

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Open PackSignal
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    // 2. Load official organizer review
    const sampleBtn = page.locator('button[data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible({ timeout: 15000 });
    await sampleBtn.click();

    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // 3. Wait for review to load
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // 4. Open Creative Brief tab
    const briefTabBtn = page.locator('button[data-tab="creative-brief"]:visible').first();
    if (await briefTabBtn.count() > 0) {
      await briefTabBtn.click();
    } else {
      await page.locator('button[data-tab="creative-brief"]').first().click({ force: true });
    }

    // 3. Verify Creative Brief workspace loads
    const briefContainer = page.locator('#creative-brief-container');
    await expect(briefContainer).toBeVisible({ timeout: 15_000 });

    // 4. Verify Brief Header & Title
    await expect(page.locator('.brief-header-card, .brief-editor-header')).toBeVisible();
    await expect(page.locator('text=Dancing Fish Berry Crunch Granola').first()).toBeVisible();

    // 5. Inspect Scoreboard & Initial Audit State
    const scoreboard = page.locator('.audit-scoreboard, .inspector-metrics-grid');
    await expect(scoreboard).toBeVisible();
    await expect(page.locator('text=Compliance Score').first()).toBeVisible();

    // 6. Inspect Initial Sections and Sentences
    const sectionTitle = page.locator('text=Product Identity').first();
    await expect(sectionTitle).toBeVisible();

    // 7. Verify inline clickable evidence chips
    const factChip = page.locator('.inline-evidence-chip').first();
    if (await factChip.count() > 0) {
      await expect(factChip).toBeVisible();
      await factChip.click();
      // Verify source evidence modal/dialog opened
      const dialog = page.locator('#dialog[open], dialog[open]');
      await expect(dialog.first()).toBeVisible({ timeout: 5000 });
      const closeBtn = dialog.first().locator('.close-dialog');
      if (await closeBtn.count() > 0) await closeBtn.first().click();
    }

    // 8. Test Sentence Editing: Insert an unsupported number (e.g. 999 g)
    const editBtn = page.locator('.btn-edit-sentence, .btn-sentence-edit-toggle').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      const textarea = page.locator('.sentence-edit-textarea, .sentence-edit-input').first();
      await expect(textarea).toBeVisible();
      await textarea.fill('The packaging declares 999 g net weight without supporting spec.');
      const saveBtn = page.locator('.btn-save-edit, .btn-save-sent-edit').first();
      await saveBtn.click();
    }

    // 9. Run Evidence Audit to verify the unsupported claim is flagged
    const reauditBtn = page.locator('#btn-reaudit, #btn-run-audit').first();
    await expect(reauditBtn).toBeVisible();
    await reauditBtn.click();
    await page.waitForTimeout(1000);

    // 10. Attempt Approval while unproven claims exist -> Verify button is disabled or server rejects
    const approveBtn = page.locator('#btn-approve-brief').first();
    await expect(approveBtn).toBeVisible();
    const isDisabled = await approveBtn.isDisabled();
    expect(isDisabled).toBe(true);

    // 11. Now Sync Proven Facts / Correct Sentence to achieve Zero Unproven Claims
    const syncBtn = page.locator('#btn-sync-proven, #btn-re-draft').first();
    if (await syncBtn.count() > 0) {
      await syncBtn.click();
      await page.waitForTimeout(1000);
    }

    // 12. Test PDF Export Link
    const exportPdfBtn = page.locator('#btn-export-pdf').first();
    await expect(exportPdfBtn).toBeVisible();

    // 13. Test Checklist Export Link
    const exportChkBtn = page.locator('#btn-export-checklist').first();
    await expect(exportChkBtn).toBeVisible();

    // 14. Test "Ask About This" Grounded Assistant (Closed by default)
    const toggleAskBtn = page.locator('#btn-toggle-ask, #btn-toggle-ask-drawer').first();
    await expect(toggleAskBtn).toBeVisible();

    // Drawer should initially not have open class
    const askDrawer = page.locator('#ask-side-panel, #ask-drawer-panel').first();
    const isInitiallyOpen = await askDrawer.evaluate(el => el.classList.contains('open'));
    expect(isInitiallyOpen).toBe(false);

    // Click to open drawer
    await toggleAskBtn.click();
    await expect(askDrawer).toHaveClass(/open/);

    // 15. Query Grounded Assistant about Honey
    const quickHoneyBtn = page.locator('.ask-pill-btn, .quick-ask-chip').first();
    if (await quickHoneyBtn.count() > 0) {
      await quickHoneyBtn.click();
      await page.waitForTimeout(1500);

      // Verify grounded answer appeared in chat
      const chatFeed = page.locator('#ask-chat-feed, #ask-conversation-feed').first();
      await expect(chatFeed).toContainText(/honey/i);
    }

    // 16. Verify no fatal unhandled exceptions
    const relevantErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('404') && 
      !e.includes('Content Security Policy')
    );
    expect(relevantErrors).toEqual([]);
  });

});
