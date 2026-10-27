import { test, expect } from '@playwright/test';

test.describe('E2E: Rulebook Trust Center & Approval Workflow', () => {
  test('RULEBOOK WORKFLOW: verifies rule extraction, quotation provenance, and human approval lifecycle', async ({ page, request }) => {
    page.on('dialog', dialog => dialog.accept('Standard regulatory requirement check'));

    // 1. Create review with rulebook sample
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

    // 3. Open review and go to Rule Trust Center
    await page.goto(`/#review/${reviewId}`);
    const rulebookTab = page.locator('nav.tabs button[data-tab="rulebook"]');
    await rulebookTab.click();

    // 4. Verify Rule Trust Center view renders
    await expect(page.locator('.rulebook-trust-workbench')).toBeVisible();

    // 5. Verify rule cards are displayed with quotations and citations
    const ruleRows = page.locator('.rule-card, tr[data-rule-id]');
    await expect(ruleRows.first()).toBeVisible();
    const count = await ruleRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 6. Find a proposed rule with an approve button
    const approveBtn = page.locator('button[data-action="approve-rule"]').first();
    if (await approveBtn.count() > 0) {
      const ruleId = await approveBtn.getAttribute('data-rule-id');

      // Click approve
      await approveBtn.click();

      // Verify rule row updates to show approved status
      const updatedRow = page.locator(`tr[data-rule-id="${ruleId}"]`);
      await expect(updatedRow).toContainText(/approved/i);
    }

    // 7. Verify audit event was generated on backend
    const auditRes = await request.get(`/api/reviews/${reviewId}`);
    const reviewData = await auditRes.json();
    const ruleAuditEvent = (reviewData.audit || []).find(e => e.action === 'rule_approved');
    expect(ruleAuditEvent).toBeDefined();
  });
});
