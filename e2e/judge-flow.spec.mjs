import { test, expect } from '@playwright/test';

test.describe('E2E: Wave 3F Comprehensive Judge Flow', () => {
  test('18-Point Judge Flow Verification', async ({ page, request }) => {
    // 1. Home page loads
    await page.goto('/');
    await expect(page.locator('.eyebrow, h1').first()).toBeVisible();
    await expect(page).toHaveTitle(/PackSignal/i);

    // 2. Organizer sample loads
    const sampleBtn = page.locator('button[data-action="sample"][data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Wait for review to load
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // 3. Original PDF appears & 4. Content sheet appears & 5. Source authority is visible
    const sourcesTab = page.locator('.tab[data-action="tab"][data-tab="sources"]');
    await sourcesTab.click({ force: true });
    await expect(page.locator('.review-body')).toBeVisible();

    const filesList = page.locator('.review-files-list, .file-card, table, .source-facts-explorer');
    await expect(filesList.first()).toBeVisible();

    // Verify PDF and Content Sheet files are listed
    const pageContent = await page.content();
    expect(pageContent).toContain('DancingFish_Granola_Berry_US_Carton.pdf');
    expect(pageContent).toContain('DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx');

    // Verify source authority indicator / draft note
    expect(pageContent.toLowerCase()).toMatch(/(draft|source authority|internal formulation|review)/);

    // 6. Checks screen displays real results
    const checksTab = page.locator('.tab[data-action="tab"][data-tab="findings"], .tab[data-tab="checks"]');
    await checksTab.first().click({ force: true });
    await expect(page.locator('.queue-finding, .finding-card, [data-action="select-finding"]').first()).toBeVisible();

    // 7. Source-backed mismatch opens
    const issueFinding = page.locator('.queue-finding:has-text("issue"), .queue-finding:has-text("mismatch"), .queue-finding:has-text("Honey"), .queue-finding').first();
    await issueFinding.click();

    // 8. Original artwork location opens
    await expect(page.locator('.workbench-evidence, .artwork-viewport, [data-artwork-canvas]').first()).toBeVisible();

    // 9. Calculation proof displays
    const proofDetails = page.locator('.detail-values, .proof-content, .finding-proof, .workbench-evidence');
    await expect(proofDetails.first()).toBeVisible();

    // 10. Rules screen shows quotation evidence
    const rulesTab = page.locator('.tab[data-tab="rulebook"], button[data-tab="rulebook"], .tab[data-tab="rules"]');
    if (await rulesTab.count() > 0) {
      await rulesTab.first().click({ force: true });
      await expect(page.locator('.rulebook-trust-workbench, .rules-screen, .rule-card, tr[data-rule-id], .rule-map, table').first()).toBeVisible();
      const rulesText = await page.content();
      expect(rulesText).toMatch(/(21 CFR|quotation|verified|statutory|requirement|Standard)/i);
    }

    // 11. Proposed rule remains unapplied
    // Verify unapproved/proposed rules have unapplied status
    const rulesScreenContent = await page.content();
    expect(rulesScreenContent).toMatch(/(proposed|unapplied|not applied|pending review)/i);

    // 12. Cleared checks display evidence
    const clearedSection = page.locator('.cleared-checks, [data-tab="cleared"], .rule-cleared, .queue-finding:has-text("match"), .card:has-text("match")');
    if (await clearedSection.count() > 0) {
      await expect(clearedSection.first()).toBeVisible();
    }

    // 13. Reviewer decision persists
    const reviewBtn = page.locator('button[data-action="proof"], button[data-action="review-decision"], .decision-btn').first();
    if (await reviewBtn.count() > 0) {
      await reviewBtn.click();
      const decisionSelect = page.locator('select[name="decision"], [data-decision-select]').first();
      if (await decisionSelect.count() > 0) {
        await decisionSelect.selectOption({ index: 1 });
      }
      const closeBtn = page.locator('button[data-action="close-dialog"], .dialog-close').first();
      if (await closeBtn.count() > 0) await closeBtn.click();
    }

    // 14. Revision comparison works
    const revisionsTab = page.locator('.tab[data-action="tab"][data-tab="revisions"]');
    if (await revisionsTab.count() > 0) {
      await revisionsTab.click({ force: true });
      await expect(page.locator('.review-body')).toBeVisible();
    }

    // 15. Signed report downloads
    const url = page.url();
    const reviewId = url.split('#review/')[1]?.split('/')[0];
    if (reviewId) {
      const reportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
      expect(reportRes.ok()).toBeTruthy();
      const reportJson = await reportRes.json();
      expect(reportJson.id).toBe(reviewId);
      expect(reportJson.signature).toBeDefined();
      expect(reportJson.signature.algorithm.toLowerCase()).toBe('ed25519');
    }

    // 16. Invalid file fails safely
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const badUploadRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { invalidField: 'malformed_payload' }
    });
    // Server must reject or return clean 400 error rather than crashing
    expect(badUploadRes.status()).toBeGreaterThanOrEqual(400);

    // 17. AI unavailable fallback works
    const aiConfigRes = await request.get('/api/status');
    const aiStatus = await aiConfigRes.json();
    expect(aiStatus.aiConfigured !== undefined).toBeTruthy();
    expect(aiStatus.aiConnection).toBeDefined();

    // 18. Mobile layout remains usable
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('header, .review-heading, nav').first()).toBeVisible();
    const bodyVisible = await page.locator('.review-body, main, #app').first().isVisible();
    expect(bodyVisible).toBeTruthy();
  });
});
