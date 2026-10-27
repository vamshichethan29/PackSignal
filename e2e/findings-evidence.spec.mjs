import { test, expect } from '@playwright/test';

test.describe('E2E: Findings Display & Artwork Evidence Navigation', () => {
  test('FINDINGS DISPLAYED & ARTWORK EVIDENCE OPENS: verifies finding detail, quotes, and visual spotlight', async ({ page, request }) => {
    // 1. Create review with sample
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Poll until ready
    let isReady = false;
    for (let i = 0; i < 150; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') {
        isReady = true;
        break;
      }
      if (poll.status === 'failed') {
        throw new Error(`Review processing failed: ${poll.error}`);
      }
      await page.waitForTimeout(500);
    }
    expect(isReady).toBe(true);

    // 3. Open review in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 45000 });

    // 4. Verify Findings queue
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    await findingsTab.click();

    const findings = page.locator('.queue-finding, [data-action="select-finding"]');
    await expect(findings.first()).toBeVisible();

    // 5. Select a discrepancy finding (e.g. quantity or issue finding)
    const issueFinding = page.locator('.queue-finding.issue, .queue-finding.attention').first();
    if (await issueFinding.count() > 0) {
      await issueFinding.click();
    } else {
      await findings.first().click();
    }

    // 6. Verify evidence details in workbench sidebar
    const evidenceSidebar = page.locator('.workbench-evidence');
    await expect(evidenceSidebar).toBeVisible();

    // Verify detail values exist (observed vs expected)
    await expect(page.locator('.detail-values')).toBeVisible();
    const detailText = await evidenceSidebar.textContent();
    expect(detailText.length).toBeGreaterThan(20);

    // 7. Verify source citation/quote is displayed
    const sourceBlock = page.locator('.workbench-source, .evidence-stack');
    await expect(sourceBlock.first()).toBeVisible();

    // 8. Verify artwork spotlight / proof frame displays
    const artFrame = page.locator('.workbench-art-frame, [data-workbench-frame], .workbench-art-content');
    await expect(artFrame.first()).toBeVisible();

    // 9. Inspect evidence region highlight on artwork
    const regionButtons = page.locator('.workbench-region, [data-action="select-evidence"]');
    if (await regionButtons.count() > 0) {
      await expect(regionButtons.first()).toBeVisible();
    } else {
      // If evidence coordinates are unlocated, verify honest unlocated notice
      const note = page.locator('.visibility-note, .unlocated-note');
      await expect(note.first()).toBeVisible();
    }
  });
});
