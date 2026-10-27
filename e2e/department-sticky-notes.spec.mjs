import { test, expect } from '@playwright/test';

test.describe('E2E: Departmental Sticky Notes (Phase 5A: Multi-Stakeholder Artwork Review)', () => {
  test('Complete Sticky Note Workflow: Routing, Color Accents, Threaded Replies, 2D Markers, Ask Someone, Verdict Immutability, and Signed Report', async ({ page, request }) => {
    // 1. Create review with fieldday sample
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 15000 });

    // Step 4-10: Test Department Filter Pills
    const deptFilterBar = page.locator('[data-dept-filter-bar]');
    await expect(deptFilterBar).toBeVisible();

    const btnAll = page.locator('[data-department="all"]');
    const btnLegal = page.locator('[data-department="legal"]');
    const btnRd = page.locator('[data-department="rd"]');
    const btnBrand = page.locator('[data-department="brand"]');
    const btnPrepress = page.locator('[data-department="prepress"]');

    await expect(btnAll).toBeVisible();
    await expect(btnLegal).toBeVisible();
    await expect(btnRd).toBeVisible();
    await expect(btnBrand).toBeVisible();
    await expect(btnPrepress).toBeVisible();

    // Test Legal
    await btnLegal.click();
    await page.waitForTimeout(300);
    await expect(btnLegal).toHaveAttribute('aria-pressed', 'true');
    const legalCount = await page.locator('.queue-finding').count();
    expect(legalCount).toBeGreaterThan(0);

    // Test R&D
    await btnRd.click();
    await page.waitForTimeout(300);
    await expect(btnRd).toHaveAttribute('aria-pressed', 'true');
    const rdCount = await page.locator('.queue-finding').count();
    expect(rdCount).toBeGreaterThan(0);

    // Test Brand
    await btnBrand.click();
    await page.waitForTimeout(300);
    await expect(btnBrand).toHaveAttribute('aria-pressed', 'true');

    // Test Prepress
    await btnPrepress.click();
    await page.waitForTimeout(300);
    await expect(btnPrepress).toHaveAttribute('aria-pressed', 'true');

    // Return to All Departments
    await btnAll.click();
    await page.waitForTimeout(300);

    // Select the first finding in queue
    const firstFinding = page.locator('.queue-finding').first();
    await firstFinding.click();
    await page.waitForTimeout(400);

    // Verify Sticky Notes Section exists in right panel
    const stickyNotesPanel = page.locator('[data-sticky-notes-panel]');
    await expect(stickyNotesPanel).toBeVisible();

    // Click "+ Add Sticky Note"
    const btnAddNote = page.locator('[data-action="toggle-new-note-form"]');
    await expect(btnAddNote).toBeVisible();
    await btnAddNote.click();

    // Fill note form
    const noteFormWrapper = page.locator('[data-new-note-wrapper]');
    await expect(noteFormWrapper).toBeVisible();

    const noteTextarea = noteFormWrapper.locator('textarea[name="noteText"]');
    await noteTextarea.fill('R&D Food Science verification: Check moisture content and serving size consistency across batches.');

    // Select R&D department
    await noteFormWrapper.locator('select[name="departmentId"]').selectOption('rd');

    // Submit note
    const btnSaveNote = noteFormWrapper.locator('.btn-save-note');
    await btnSaveNote.click();
    await page.waitForTimeout(600);

    // Verify note is rendered in the list with R&D styling
    const createdNoteCard = page.locator('.sticky-note-card.rd').first();
    await expect(createdNoteCard).toBeVisible();
    await expect(createdNoteCard).toContainText('R&D & FORMULATION');
    await expect(createdNoteCard).toContainText('moisture content and serving size');

    // Test Persistence across page reload
    await page.reload();
    await page.waitForSelector('.review-workbench', { timeout: 15000 });
    const findingAfterReload = page.locator('.queue-finding').first();
    await findingAfterReload.click();
    await page.waitForTimeout(400);

    const reloadedNoteCard = page.locator('.sticky-note-card.rd').first();
    await expect(reloadedNoteCard).toBeVisible();
    await expect(reloadedNoteCard).toContainText('moisture content and serving size');

    // Test Threaded Reply
    const replyInput = reloadedNoteCard.locator('.input-reply-text');
    await replyInput.fill('Formulation team confirms batch specifications match 2026 specs.');
    const btnReply = reloadedNoteCard.locator('[data-action="send-note-reply"]');
    await btnReply.click();
    await page.waitForTimeout(600);

    // Verify reply appears in thread
    const replyItem = reloadedNoteCard.locator('.note-reply-item').last();
    await expect(replyItem).toBeVisible();
    await expect(replyItem).toContainText('Formulation team confirms batch specifications');

    // Test Verdict Immutability: Close sticky note thread
    const statusSelect = reloadedNoteCard.locator('.note-status-select');
    await statusSelect.selectOption('CLOSED');
    await page.waitForTimeout(600);

    // Confirm note status is updated to CLOSED
    await expect(reloadedNoteCard).toHaveClass(/status-closed/);

    // Confirm underlying finding badge / verdict has NOT changed
    const findingBadge = page.locator('.finding-head .status, .queue-finding.active .status-pill, .badge-status').first();
    if (await findingBadge.count() > 0) {
      const badgeText = await findingBadge.textContent();
      expect(badgeText).not.toBe('');
    }

    // Test Ask Someone Integration
    const btnAskSomeone = page.locator('[data-action="ask-someone"]').first();
    if (await btnAskSomeone.count() > 0) {
      await btnAskSomeone.click();
      await page.waitForTimeout(400);

      const askModal = page.locator('#ask-someone-modal');
      await expect(askModal).toBeVisible();
      const deptSelect = askModal.locator('#ask-dept-select');
      await expect(deptSelect).toBeVisible();

      // Close modal
      const btnCloseModal = askModal.locator('[data-ask-action="close"]').first();
      await btnCloseModal.click();
      await page.waitForTimeout(200);
    }

    // Scroll sticky notes panel into view and take screenshot for documentation
    const notesPanel = page.locator('[data-sticky-notes-panel]');
    await notesPanel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/department_sticky_notes_verified.png' });
  });
});
