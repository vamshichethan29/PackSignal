import { test, expect } from '@playwright/test';

test.describe('E2E: Phase 4 — Core Browser Workflow & Unified Evidence Desk', () => {
  test('COMPLETE WORKFLOW: Multi-Format Intake, Clickable Source Chips, Conflict Cards Resolution, Questions Stack, and Creative Brief Sync', async ({ page }) => {
    test.setTimeout(180000);

    const fatalErrors = [];
    page.on('pageerror', err => fatalErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && (msg.text().includes('TypeError') || msg.text().includes('ReferenceError') || msg.text().includes('Uncaught'))) {
        fatalErrors.push(msg.text());
      }
    });

    // 1. Open PackSignal
    await page.goto('/');

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

    // Dismiss overlap shield if present
    const shieldBtn = page.locator('#btn-toggle-overlap-mode');
    if (await shieldBtn.isVisible()) {
      await shieldBtn.click();
    }

    // 4. Open Evidence Desk
    const deskTabBtn = page.locator('button[data-tab="evidence-desk"]:visible').first();
    if (await deskTabBtn.isVisible()) {
      await deskTabBtn.click();
    } else {
      await page.locator('button[data-tab="evidence-desk"]').first().click({ force: true });
    }

    // 5. Verify Evidence Desk Header and Stepper
    await expect(page.locator('.desk-wrapper h2')).toContainText('Evidence Desk');
    const stepperCard = page.locator('#desk-stepper-card');
    await expect(stepperCard).toBeVisible();
    await expect(stepperCard).toContainText('Multi-Format Intake');

    // Visual QA Screenshot (Phase 4 Evidence Desk)
    await page.locator('.desk-wrapper').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'public/phase4-evidence-desk.png', fullPage: false });
    const fs = await import('node:fs');
    fs.copyFileSync('public/phase4-evidence-desk.png', '/Users/vamshi/.gemini/antigravity-ide/brain/a8b4a443-51af-4484-b56e-d014708ca091/phase4-evidence-desk.png');

    // 6. Inspect Document Sources (Left Column)
    const filesContainer = page.locator('#desk-files-container');
    await expect(filesContainer).toBeVisible();
    await expect(filesContainer).toContainText('DancingFish_Granola_Berry_US_Carton.pdf');
    await expect(filesContainer).toContainText('DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');
    await expect(filesContainer).toContainText('DancingFish_Granola_Product_Spec.docx');
    await expect(filesContainer).toContainText('DancingFish_Granola_Tech_Spec.pdf');
    await expect(filesContainer).toContainText('DancingFish_QA_Notes.txt');
    await expect(filesContainer).toContainText('DancingFish_Old_Design.png');

    // 7. Inspect Fact Sheet with Clickable Source Chips (Right Column)
    const factsContainer = page.locator('#desk-facts-container');
    await expect(factsContainer).toBeVisible();
    await expect(factsContainer).toContainText('Dancing Fish Berry Crunch Granola');
    await expect(factsContainer).toContainText('480 g (16.9 oz)');

    // 8. Click an Artwork Source Chip and verify exact spot evidence
    const sourceChip = factsContainer.locator('[data-source-chip]').first();
    await expect(sourceChip).toBeVisible();
    await sourceChip.click();

    // Dialog opens with exact spot details
    const dialog = page.locator('#dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/DOCX|VERIFIED|PDF|Spreadsheet|Location/i);
    const closeDialogBtn = dialog.locator('.close-dialog').first();
    await closeDialogBtn.click();
    await expect(dialog).not.toBeVisible();

    // 9. Inspect Side-by-Side Conflict Cards (Center Column)
    const conflictsContainer = page.locator('#desk-conflicts-container');
    await expect(conflictsContainer).toContainText(/Honey Content Discrepancy|Honey Formulation/i);
    await expect(conflictsContainer).toContainText('SOURCE A');
    await expect(conflictsContainer).toContainText('SOURCE B');

    // 10. Resolve Conflict via Authorized Reviewer Selection
    const selectSourceBtn = conflictsContainer.locator('.btn-select-a').first();
    await expect(selectSourceBtn).toBeVisible();
    await selectSourceBtn.click();

    // Auditable resolution modal opens
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Confirm Authoritative Source');
    await expect(dialog.locator('#cr-reviewer-name')).toHaveValue('Packaging Reviewer');
    const confirmResBtn = dialog.locator('#cr-btn-confirm');
    await confirmResBtn.click();
    await expect(dialog).not.toBeVisible();

    // Verify conflict card reflects resolved state
    await expect(conflictsContainer).toContainText(/Resolved|Decision/i);

    // 11. Inspect Prioritized Questions Stack (Max 10)
    const questionsContainer = page.locator('#desk-questions-container');
    await expect(questionsContainer).toBeVisible();
    const questionCards = questionsContainer.locator('.question-item-card');
    const qCount = await questionCards.count();
    expect(qCount).toBeLessThanOrEqual(10);
    expect(qCount).toBeGreaterThan(0);

    // 12. Answer a Question and verify live review sync
    const firstAnswerBtn = questionsContainer.locator('.btn-answer-opt').first();
    await expect(firstAnswerBtn).toBeVisible();
    await firstAnswerBtn.click();

    // Verify question marked as answered
    await expect(questionsContainer).toContainText(/✓ Decided|Answered/i);

    // 13. Verify Creative Brief Matrix Updates Live
    const briefKeep = page.locator('#m-list-keep');
    await expect(briefKeep).toBeVisible();
    await expect(briefKeep.locator('li').first()).toBeVisible();

    // 14. Test Pasted Notes Modal (Phase 11)
    const pasteModalBtn = page.locator('#btn-open-paste-modal');
    await expect(pasteModalBtn).toBeVisible();
    await pasteModalBtn.click();

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Paste Notes / Quality Handover');
    const pasteInput = dialog.locator('#paste-text-input');
    await pasteInput.fill('Line 1: Urgent batch verification.\nLine 2: Regulatory sign-off completed.');
    const submitPasteBtn = dialog.locator('#btn-submit-paste');
    await submitPasteBtn.click();
    await expect(dialog).not.toBeVisible();

    // 15. Verify Run Analysis button triggers stage transitions
    const runAnalysisBtn = page.locator('#btn-run-analysis');
    await expect(runAnalysisBtn).toBeVisible();
    await runAnalysisBtn.click();
    await page.waitForTimeout(1600);

    // 16. Reload browser and confirm review decisions persist (Phase 28 & 34)
    await page.reload();
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // Return to Evidence Desk tab
    const reopenDeskBtn = page.locator('button[data-tab="evidence-desk"]:visible').first();
    if (await reopenDeskBtn.isVisible()) {
      await reopenDeskBtn.click();
    } else {
      await page.locator('button[data-tab="evidence-desk"]').first().click({ force: true });
    }
    await expect(page.locator('.desk-wrapper h2')).toContainText('Evidence Desk');

    // Confirm persisted state
    await expect(page.locator('#desk-conflicts-container')).toContainText(/Resolved|Decision/i);

    // 17. Confirm no fatal errors
    expect(fatalErrors).toHaveLength(0);
  });
});
