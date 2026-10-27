import { test, expect } from '@playwright/test';

test.describe('E2E: Reviewer Decision Persistence & Audit Trail', () => {
  test('REVIEW DECISIONS PERSIST: records decision with note, reloads page, confirms persistence and audit event', async ({ page, request }) => {
    // 1. Create review with sample
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Poll until ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible();

    // 4. Click proof button to open finding decision form
    const proofBtn = page.locator('button[data-action="proof"]').first();
    await expect(proofBtn).toBeVisible();
    await proofBtn.click();

    // 5. Verify decision form in dialog
    const decisionForm = page.locator('form#decision-form');
    await expect(decisionForm).toBeVisible();

    // 6. Record decision: Select 'acknowledged' and enter rationale note
    await page.selectOption('select#disposition', 'acknowledged');
    const testNote = 'Verified by Senior SDET: approved exception for market variant';
    await page.fill('textarea#decision-note', testNote);

    // 7. Submit decision form
    const submitBtn = page.locator('form#decision-form button[type="submit"]');
    await submitBtn.click();

    // 8. Wait for dialog to close
    await expect(page.locator('#dialog[open]')).toHaveCount(0);

    // 9. Reload the browser page to test persistence across sessions
    await page.reload();
    await expect(page.locator('.review-heading')).toBeVisible();

    // 10. Reopen the proof dialog for the same finding
    const proofBtnAfter = page.locator('button[data-action="proof"]').first();
    await expect(proofBtnAfter).toBeVisible();
    await proofBtnAfter.click();

    // 11. Assert that disposition and note persisted exactly
    await expect(page.locator('select#disposition')).toHaveValue('acknowledged');
    const persistedNote = await page.locator('textarea#decision-note').inputValue();
    expect(persistedNote).toBe(testNote);

    // 12. Verify backend audit trail recorded the decision event
    const reviewData = await (await request.get(`/api/reviews/${reviewId}`)).json();
    const decisionEvent = (reviewData.audit || []).find(e => e.action === 'reviewer_decision');
    expect(decisionEvent).toBeDefined();
    expect(decisionEvent.detail || decisionEvent.details).toContain('acknowledged');
  });
});
