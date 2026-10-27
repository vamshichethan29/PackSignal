import { test, expect } from '@playwright/test';

test.describe('E2E: AI Auto-Fix & Copy Remediation Studio Workflow', () => {
  test('CLICK AUTO-FIX, VIEW DIFF, VALIDATE, AND APPROVE FOR HANDOFF', async ({ page, request, context }) => {
    // 1. Grant clipboard permissions if supported
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {
      // Ignore if browser environment does not support dynamic permission grants
    }

    // 2. Obtain CSRF token and create a sample review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    expect([200, 202]).toContain(createRes.status());
    const { id: reviewId } = await createRes.json();

    // 3. Poll until ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 4. Open review workbench
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Findings tab
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click();

    // 6. Locate an actionable issue finding
    const issueFinding = page.locator('.queue-finding.issue, .queue-finding.attention').first();
    await expect(issueFinding).toBeVisible();
    await issueFinding.click();

    // 7. Verify Auto-Fix button is present in workbench actions
    const autoFixBtn = page.locator('.workbench-actions [data-action="generate-suggested-fix"]').first();
    await expect(autoFixBtn).toBeVisible();
    await expect(autoFixBtn).toContainText('AI Auto-Fix');

    // 8. Click [✨ AI Auto-Fix]
    await autoFixBtn.click();

    // 9. Verify Remediation Studio card mounts in the workbench
    const studioCard = page.locator('[data-remediation-studio]');
    await expect(studioCard).toBeVisible({ timeout: 10000 });

    // 10. Verify Studio title and legal disclaimers
    await expect(studioCard.locator('.eyebrow')).toContainText('AI-ASSISTED REMEDIATION STUDIO');
    await expect(studioCard.locator('.remediation-legal-disclaimer')).toContainText('Proposed Copy Only');

    // 11. Verify Before vs After copy comparison or Designer ticket
    const copyComparison = studioCard.locator('.remediation-diff-grid, .remediation-ticket-view, .remediation-blocked-view');
    await expect(copyComparison.first()).toBeVisible();

    page.on('dialog', dialog => dialog.accept('Reviewed and approved for prepress handoff.'));

    // 12. If copy comparison view is shown, test diff display and validation
    const hasDiff = await studioCard.locator('.remediation-diff-grid').count();
    if (hasDiff > 0) {
      await expect(studioCard.locator('.diff-column.diff-original')).toBeVisible();
      await expect(studioCard.locator('.diff-column.diff-proposed')).toBeVisible();

      // Test hypothetical preview validation button
      const validateBtn = studioCard.locator('[data-action="validate-fix"]');
      if (await validateBtn.count() > 0) {
        await validateBtn.click();
        const validationBox = studioCard.locator('[data-validation-result]');
        await expect(validationBox).toBeVisible({ timeout: 5000 });
        await expect(validationBox).toContainText(/Check|Passed|Hypothetical/i);
      }

      // Test Human Approval Decision
      const approveBtn = studioCard.locator('[data-action="approve-proposal"]');
      if (await approveBtn.count() > 0) {
        await approveBtn.click();
        // Check updated status badge
        const statusBadge = studioCard.locator('.remediation-status-badge');
        await expect(statusBadge).toContainText(/APPROVED|DESIGN_HANDOFF/i, { timeout: 5000 });
      }

      // Test Copy Button
      const copyBtn = studioCard.locator('[data-action="copy-proposed"]');
      if (await copyBtn.count() > 0) {
        await copyBtn.click();
        // Toast appears or button indicates action
      }
    }

    // 13. Verify Audit event was recorded on the review
    const updatedReview = await (await request.get(`/api/reviews/${reviewId}`)).json();
    const auditEvents = updatedReview.audit || [];
    const remediationEvents = auditEvents.filter(e =>
      e.action.includes('proposal') ||
      e.action.includes('remediation') ||
      e.action.includes('correction_ticket')
    );
    expect(remediationEvents.length).toBeGreaterThan(0);
  });
});
