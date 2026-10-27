import { test, expect } from '@playwright/test';

test.describe('E2E: Advanced Atwater Calorie Verification & Proof Card', () => {
  test('verifies 9/4/4 mathematical proof, serving basis, mass balance, Ask R&D, and signed report export', async ({ page, request }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 1. Get CSRF and create review with organizer sample
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(500);
    }

    // 3. Open review page in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 45000 });

    // 4. Ensure findings tab is active
    const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"]');
    if (await findingsTab.isVisible()) {
      await findingsTab.click({ force: true });
    }

    // 5. Locate the Atwater Calorie Consistency finding in the queue
    const atwaterFindingItem = page.locator(
      '[data-action="select-finding"][data-finding-id="nutrition-sanity:atwater"], ' +
      '[data-action="select-finding"]:has-text("calories vs macronutrients"), ' +
      '[data-action="select-finding"]:has-text("Atwater")'
    ).first();

    await expect(atwaterFindingItem).toBeVisible({ timeout: 15000 });
    await atwaterFindingItem.click();

    // 6. Verify the structured Atwater Proof Card is displayed prominently
    const proofCard = page.locator('.atwater-proof-card');
    await expect(proofCard).toBeVisible({ timeout: 10000 });

    // 7. Verify the Mathematical Metrics (250 kcal declared, 4250 kcal estimated, 4000 kcal diff)
    await expect(proofCard.locator('.atwater-metric-box.declared .metric-value')).toContainText('250');
    await expect(proofCard.locator('.atwater-metric-box.estimated .metric-value')).toContainText('4250');
    await expect(proofCard.locator('.atwater-metric-box.estimated .metric-sub')).toContainText('4000');

    // 8. Confirm formula breakdown uses actual macronutrients
    // Total Fat: 250g x 9 = 2250 kcal
    // Carbohydrates: 250g x 4 = 1000 kcal
    // Protein: 250g x 4 = 1000 kcal
    const macroRows = proofCard.locator('.breakdown-row');
    await expect(macroRows).toHaveCount(4); // 3 macros + total row
    const cardText = await proofCard.innerText();
    expect(cardText).toContain('250 g');
    expect(cardText).toContain('2250');
    expect(cardText).toContain('1000');

    // 9. Verify Mass-Balance validation warning is prominently rendered
    // (250 + 250 + 250 = 750g exceeds serving mass / 100g basis)
    const massBalanceAlert = proofCard.locator('.mass-balance-alert');
    await expect(massBalanceAlert).toBeVisible();
    expect(await massBalanceAlert.innerText()).toMatch(/Mass-Balance|750/i);

    // 10. Test "Show Step-by-Step Math" expandable proof
    const toggleMathBtn = proofCard.locator('button[data-action="toggle-atwater-proof"]');
    await expect(toggleMathBtn).toBeVisible();
    await toggleMathBtn.click();
    const proofSteps = proofCard.locator('.atwater-proof-expandable');
    await expect(proofSteps).toBeVisible();
    const stepsText = await proofSteps.innerText();
    expect(stepsText).toContain('250');
    expect(stepsText).toContain('4250');

    // 11. Test "Ask R&D" integration
    const askRdBtn = proofCard.locator('button[data-action="ask-rd"]');
    await expect(askRdBtn).toBeVisible();
    await askRdBtn.click();

    // Verify Ask Someone modal opens and targets R&D with pre-populated Atwater message
    const askModal = page.locator('#ask-someone-modal, .ask-someone-modal, [data-ask-modal]').first();
    await expect(askModal).toBeVisible();
    const modalText = await askModal.innerText();
    expect(modalText).toContain('R&D');
    const messageEditor = askModal.locator('#ask-message-editor');
    const messageText = await messageEditor.inputValue();
    expect(messageText).toMatch(/250\s*kcal/);
    expect(messageText).toMatch(/4250/);
    expect(messageText).toMatch(/macronutrient calculation|unrounded nutrient values/i);

    // Close the Ask Someone modal
    const closeBtn = askModal.locator('button[data-ask-action="close"]').first();
    await closeBtn.click();
    await expect(askModal).not.toBeVisible({ timeout: 5000 });

    // 12. Test Macro artwork focus buttons
    const fatMacroBtn = proofCard.locator('button[data-focus-macro="fat"]');
    if (await fatMacroBtn.isVisible()) {
      await fatMacroBtn.click();
      // Ensure no fatal error upon clicking focus
      await page.waitForTimeout(300);
    }

    // 13. Verify Signed Report Export includes NUTRITION ENERGY VERIFICATION
    const reportRes = await request.get(`/api/reviews/${reviewId}/report.html`);
    expect(reportRes.ok()).toBeTruthy();
    const reportHtml = await reportRes.text();
    expect(reportHtml).toContain('NUTRITION ENERGY VERIFICATION');
    expect(reportHtml).toContain('4250');
    expect(reportHtml).toContain('250');
    expect(reportHtml).toContain('4000');

    // 14. Confirm zero fatal page errors
    expect(pageErrors.filter(msg => !msg.includes('favicon'))).toHaveLength(0);
  });
});
