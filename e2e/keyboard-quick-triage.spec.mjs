import { test, expect } from '@playwright/test';

test.describe('E2E: Keyboard Quick Triage (Superhuman-Style Packaging Review)', () => {
  test('Complete Keyboard Quick Triage Workflow: J/K, 1 (Ack), 2 (Remedy), 3 (Evidence), 4 (Skip), ? (Help), Esc, Typing Safety, Persistence', async ({ page, request }) => {
    // 1. Create a review with sample
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

    // 4. Verify Quick Triage toolbar is visible
    const toolbar = page.locator('.quick-triage-toolbar');
    await expect(toolbar).toBeVisible();

    const counter = page.locator('#triage-counter');
    await expect(counter).toBeVisible();
    const initialCounterText = await counter.textContent();
    expect(initialCounterText).toMatch(/\d+ of \d+ Findings/);

    await toolbar.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/quick_triage_toolbar.png' });

    // 5. Check initial selection
    const firstSelected = page.locator('.queue-finding.selected');
    await expect(firstSelected).toBeVisible();
    const firstFindingId = await firstSelected.getAttribute('data-id');

    // 6. Press J to select next finding
    await page.keyboard.press('j');
    await page.waitForTimeout(300);

    const secondSelected = page.locator('.queue-finding.selected');
    const secondFindingId = await secondSelected.getAttribute('data-id');
    expect(secondFindingId).not.toBe(firstFindingId);

    // 7. Press K to return to previous finding
    await page.keyboard.press('k');
    await page.waitForTimeout(300);

    const backSelected = page.locator('.queue-finding.selected');
    expect(await backSelected.getAttribute('data-id')).toBe(firstFindingId);

    // 8. Test Action 1: Accept / Acknowledge finding
    await page.keyboard.press('1');
    await page.waitForTimeout(600);

    // Verify confirmation and advancement to next finding
    const afterAckSelected = page.locator('.queue-finding.selected');
    const ackNextFindingId = await afterAckSelected.getAttribute('data-id');
    expect(ackNextFindingId).not.toBe(firstFindingId);

    // Verify first finding was recorded as acknowledged on backend and engine verdict is preserved
    const reviewAfterAck = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewAfterAck.decisions[firstFindingId]).toBeDefined();
    expect(reviewAfterAck.decisions[firstFindingId].disposition).toBe('acknowledged');

    const originalFirstFinding = reviewAfterAck.findings.find(f => f.id === firstFindingId);
    expect(originalFirstFinding.status).not.toBe('match'); // Original verdict preserved!

    // 9. Test Action 2: Flag for Remedy (press 2)
    const currentFindingToFlag = ackNextFindingId;
    await page.keyboard.press('2');
    await page.waitForSelector('.triage-composer', { timeout: 5000 });

    const remedyModal = page.locator('.triage-composer');
    await expect(remedyModal).toBeVisible();
    await expect(remedyModal.locator('#triage-composer-title')).toContainText('Flag for Remedy');

    // Fill reason and submit via Enter
    const noteArea = remedyModal.locator('#triage-note-input');
    await noteArea.fill('Correct net quantity font height to at least 3.2mm per statutory dieline rules.');
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/quick_triage_remedy_composer.png' });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);

    // Verify composer closed
    await expect(page.locator('.triage-composer')).toHaveCount(0);

    // Verify decision persisted on backend
    const reviewAfterRemedy = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewAfterRemedy.decisions[currentFindingToFlag]?.disposition).toBe('needs_changes');

    // 10. Test Action 3: Needs Evidence (press 3)
    const afterRemedyFinding = await page.locator('.queue-finding.selected').getAttribute('data-id');
    await page.keyboard.press('3');
    await page.waitForSelector('.triage-composer', { timeout: 5000 });

    const evidenceModal = page.locator('.triage-composer');
    await expect(evidenceModal).toBeVisible();
    await expect(evidenceModal.locator('#triage-composer-title')).toContainText('Needs Additional Evidence');

    // Fill evidence request
    const evidenceText = evidenceModal.locator('#triage-note-input');
    await evidenceText.fill('Laboratory certificate of analysis missing for declared sodium value.');
    const evidenceSubmitBtn = evidenceModal.locator('#triage-composer-submit');
    await evidenceSubmitBtn.click();
    await page.waitForTimeout(600);

    // Verify backend recorded needs_evidence
    const reviewAfterEvidence = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewAfterEvidence.decisions[afterRemedyFinding]?.disposition).toBe('needs_evidence');

    // 11. Test Action 4: Skip for Now (press 4)
    const beforeSkipId = await page.locator('.queue-finding.selected').getAttribute('data-id');
    await page.keyboard.press('4');
    await page.waitForTimeout(300);

    const afterSkipId = await page.locator('.queue-finding.selected').getAttribute('data-id');
    expect(afterSkipId).not.toBe(beforeSkipId);

    // Skipped finding has no permanent disposition recorded
    const reviewAfterSkip = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewAfterSkip.decisions[beforeSkipId]?.disposition || 'open').toBe('open');

    // 12. Test Shortcuts Reference (?) and Escape
    await page.keyboard.press('?');
    await page.waitForSelector('.triage-help-modal', { timeout: 5000 });
    await expect(page.locator('.triage-help-modal')).toBeVisible();
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/quick_triage_shortcuts_modal.png' });

    // Press Escape to close help
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('.triage-help-modal')).toHaveCount(0);

    // 13. Test Typing Safety: Shortcuts must not trigger while typing in an input
    const testInput = await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'test-typing-input';
      document.body.appendChild(input);
      input.focus();
      return true;
    });
    expect(testInput).toBe(true);

    const selectedBeforeTyping = await page.locator('.queue-finding.selected').getAttribute('data-id');
    await page.keyboard.type('j k 1 2 3 4');
    await page.waitForTimeout(200);

    const selectedAfterTyping = await page.locator('.queue-finding.selected').getAttribute('data-id');
    expect(selectedAfterTyping).toBe(selectedBeforeTyping);

    // Clean up test input
    await page.evaluate(() => document.getElementById('test-typing-input')?.remove());

    // 14. Reload and confirm persistence across sessions
    await page.reload();
    await page.waitForSelector('.review-workbench', { timeout: 15000 });

    const reviewReloaded = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewReloaded.decisions[firstFindingId]?.disposition).toBe('acknowledged');
    expect(reviewReloaded.decisions[currentFindingToFlag]?.disposition).toBe('needs_changes');
    expect(reviewReloaded.decisions[afterRemedyFinding]?.disposition).toBe('needs_evidence');
  });
});
