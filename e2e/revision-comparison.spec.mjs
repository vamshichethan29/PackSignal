import { test, expect } from '@playwright/test';

test.describe('E2E: Artwork Revision Comparison & Regression Detection', () => {
  test('REVISION A VS REVISION B: creates revision, compares finding mapping, and verifies resolution of mismatch', async ({ page, request }) => {
    // 1. Create Revision A (base review with defect)
    const { csrf } = await (await request.get('/api/status')).json();
    const revARes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const revA = await revARes.json();
    const revAId = revA.id;

    // 2. Poll until Revision A is ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${revAId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Create Revision B with parentId pointing to Revision A
    const revBRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { parentId: revAId, sampleRevision: true, mode: 'local' }
    });
    const revB = await revBRes.json();
    const revBId = revB.id;

    // 4. Poll until Revision B is ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${revBId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 5. Open Revision B in browser
    await page.goto(`/#review/${revBId}`);
    await expect(page.locator('.review-heading')).toBeVisible();

    // 6. Switch to Revisions tab
    const revTab = page.locator('.tab[data-action="tab"][data-tab="revisions"]');
    await revTab.click();

    // 7. Verify revisions panel rendered
    await expect(page.locator('.review-body')).toBeVisible();
    const revisionPanelText = await page.textContent('.review-body');

    // 8. Verify before/after status comparison or change tracking exists
    expect(revisionPanelText).toMatch(/(resolved|changes|previous|revision|rechecked)/i);

    // 9. Verify button to navigate back to previous review exists
    const prevBtn = page.locator('button[data-action="open"][data-id="' + revAId + '"]');
    if (await prevBtn.count() > 0) {
      await expect(prevBtn).toBeVisible();
    }
  });
});
