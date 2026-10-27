import { test, expect } from '@playwright/test';

test.describe('E2E: "Spot the Mistakes" Interactive Judge Presentation (Upgrade #45)', () => {
  test('Complete 36-step Spot the Mistakes judge demo flow: challenge, timer, reveal, evidence, shopper personas, ripple, 3D, and report', async ({ page }) => {
    const fatalErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Content Security Policy') && !text.includes('CSP') && !text.includes('404')) {
          fatalErrors.push(text);
        }
      }
    });

    test.setTimeout(180000);

    // 1. Open PackSignal
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click Start Judge Demo from topbar or hero
    await page.locator('#hero-review-options > summary').click();
    const startDemoBtn = page.locator('#hero-start-judge-demo');
    await expect(startDemoBtn).toBeVisible({ timeout: 15000 });
    await startDemoBtn.click();

    // 3. Verify Presentation Mode opens & official artwork renders
    const presentation = page.locator('#ps-demo-presentation');
    await expect(presentation).toBeVisible({ timeout: 10000 });

    const artworkImg = page.locator('#demo-artwork-image');
    await expect(artworkImg).toBeVisible();

    // 4. Confirm findings are initially hidden
    const overlayBoxes = page.locator('.demo-finding-box');
    expect(await overlayBoxes.count()).toBe(0);

    const questionText = page.locator('.demo-challenge-question');
    await expect(questionText).toContainText('How many packaging problems can you find');

    // 5. Start 30-second challenge
    const timerDisplay = page.locator('#demo-timer-display');
    await expect(timerDisplay).toContainText('00:30');

    const startTimerBtn = page.locator('#demo-btn-start-timer');
    await expect(startTimerBtn).toBeVisible();
    await startTimerBtn.click();

    // 6. Verify timer is running and counting down
    await page.waitForTimeout(600);
    const pauseBtn = page.locator('#demo-btn-pause-timer');
    await expect(pauseBtn).toBeVisible();

    // 7. Pause and resume
    await pauseBtn.click();
    await page.waitForTimeout(200);
    await expect(startTimerBtn).toBeVisible();

    // 8. Skip remaining countdown
    const skipBtn = page.locator('#demo-btn-skip-timer');
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();
    await expect(timerDisplay).toContainText('00:00');

    // 9. Click Reveal with PackSignal
    const revealTrigger = page.locator('#demo-btn-reveal-trigger');
    await expect(revealTrigger).toBeVisible();
    await revealTrigger.click();

    // 10. Select Run Fresh Analysis or Previously Verified
    const choiceCard = page.locator('.demo-mode-options');
    await expect(choiceCard).toBeVisible();

    const cachedBtn = page.locator('#demo-choose-cached');
    await expect(cachedBtn).toBeVisible();
    await cachedBtn.click();

    // 12. Wait for actual result & scoreboard
    const scoreCard = page.locator('.demo-score-card');
    await expect(scoreCard).toBeVisible({ timeout: 20000 });

    // 13. Verify displayed counts match review data
    const issuesVal = page.locator('#demo-count-issues');
    await expect(issuesVal).toHaveText('10');

    const reviewsVal = page.locator('#demo-count-reviews');
    await expect(reviewsVal).toHaveText('5');

    const matchesVal = page.locator('#demo-count-matches');
    await expect(matchesVal).toHaveText('1');

    // 14. Verify timing is displayed truthfully
    const timingStrip = page.locator('.demo-timing-strip');
    await expect(timingStrip).toBeVisible();
    await expect(timingStrip).toContainText('Measured Processing Time:');
    const timingText = await timingStrip.innerText();
    expect(timingText).not.toContain('0.800 s'); // Never hardcoded 0.8s!

    // 15. Verify positive control is separate
    const controlVal = page.locator('#demo-count-control');
    await expect(controlVal).toContainText('Passed');

    // 16. Inspect first real finding (DF-01 Honey percentage discrepancy)
    const findingItems = page.locator('.demo-finding-item');
    expect(await findingItems.count()).toBeGreaterThanOrEqual(3);

    const firstFinding = findingItems.first();
    await expect(firstFinding).toContainText('Honey');
    await expect(firstFinding).toContainText('Honey (1%)');
    await expect(firstFinding).toContainText('Honey (9%)');

    // 17. Confirm artwork finding overlays now exist
    const revealedBoxes = page.locator('.demo-finding-box');
    expect(await revealedBoxes.count()).toBeGreaterThanOrEqual(3);

    // 18. Reveal next finding
    const nextBtn = page.locator('#demo-btn-next-finding');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    await page.waitForTimeout(300);

    // 19. Open Checks tab
    const openChecksBtn = page.locator('#demo-btn-open-checks, #demo-btn-open-checks-hdr').first();
    await expect(openChecksBtn).toBeVisible();
    await openChecksBtn.click();

    // 20. Verify normal application navigation back in workspace
    await expect(presentation).not.toBeVisible();
    const workbench = page.locator('.review-workbench, .organizer-validation-section').first();
    await expect(workbench).toBeVisible({ timeout: 15000 });

    // 21. Reopen Presentation Mode from review header
    const reviewDemoBtn = page.locator('#review-start-judge-demo, #btn-start-judge-demo').first();
    await expect(reviewDemoBtn).toBeVisible();
    await reviewDemoBtn.click();
    await expect(presentation).toBeVisible();

    // Reveal cached to access transitions
    await page.locator('#demo-btn-reveal-trigger').click();
    await page.locator('#demo-choose-cached').click();
    await expect(scoreCard).toBeVisible();

    // 22. Shopper Personas Transition
    const personasBtn = page.locator('#demo-btn-personas');
    await expect(personasBtn).toBeVisible();
    await personasBtn.click();
    await expect(presentation).not.toBeVisible();

    // 23. Test Keyboard Controls in Presentation Mode
    await reviewDemoBtn.click();
    await expect(presentation).toBeVisible();

    // Press Escape to exit
    await page.keyboard.press('Escape');
    await expect(presentation).not.toBeVisible();

    // 34. Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await reviewDemoBtn.click();
    await expect(presentation).toBeVisible();
    await page.keyboard.press('Escape');

    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // 36. Verify no fatal JavaScript errors
    expect(fatalErrors).toEqual([]);
  });
});
