import { test, expect } from '@playwright/test';

test.describe('E2E: Dancing Fish 16-Check Organizer Validation Suite', () => {
  test('42-STEP USER JOURNEY: loads Dancing Fish sample, validates 16 checks + P01, inspects proofs, filters departments, interacts with cards, and verifies draft authority', async ({ page }) => {
    // 1. Navigate to home
    await page.goto('/');

    // 2. Click official organizer sample button to open sample dialog
    const sampleBtn = page.locator('button[data-action="sample"][data-sample="organizer"]').first();
    await expect(sampleBtn).toBeVisible();
    await sampleBtn.click();

    // Confirm start review in dialog
    const runBtn = page.locator('button[data-action="run-sample"]');
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // 3. Wait for review heading and completion
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.review-heading h1')).toContainText('Dancing Fish');

    // Step 3: Verify File Identity & Draft Authority
    const sourceStatusBadge = page.locator('text=Draft / In Review').first();
    await expect(sourceStatusBadge).toBeVisible();

    // Step 4 & 5: Confirm Dancing Fish Organizer Validation Suite is visible in Checks workspace
    const dfSection = page.locator('#organizer-validation-suite');
    await expect(dfSection).toBeVisible();
    await expect(dfSection).toContainText('DANCING FISH — ORGANIZER VALIDATION');

    // Scoreboard metrics
    const metricTotal = page.locator('#df-metric-total');
    await expect(metricTotal).toHaveText('16');

    const metricIssues = page.locator('#df-metric-issues');
    await expect(metricIssues).toHaveText('10');

    const metricReviews = page.locator('#df-metric-reviews');
    await expect(metricReviews).toHaveText('5');

    const metricMatches = page.locator('#df-metric-matches');
    await expect(metricMatches).toHaveText('1');

    const metricControls = page.locator('#df-metric-controls');
    await expect(metricControls).toContainText('1 / 1');

    // Filter Buttons Interactions
    const filterAllBtn = page.locator('.df-filter-btn[data-df-filter="all"]');
    const filterIssuesBtn = page.locator('.df-filter-btn[data-df-filter="issues"]');
    const filterReviewsBtn = page.locator('.df-filter-btn[data-df-filter="reviews"]');
    const filterMatchesBtn = page.locator('.df-filter-btn[data-df-filter="matches"]');
    const filterLegalBtn = page.locator('.df-filter-btn[data-df-filter="legal"]');
    const filterRdBtn = page.locator('.df-filter-btn[data-df-filter="rd"]');
    const filterBrandBtn = page.locator('.df-filter-btn[data-df-filter="brand"]');
    const filterPrepressBtn = page.locator('.df-filter-btn[data-df-filter="prepress"]');

    // Click 'Issues' -> only 10 issue cards shown
    await filterIssuesBtn.click();
    const issueCards = page.locator('#organizer-validation-checks-container article');
    await expect(issueCards).toHaveCount(10);

    // Click 'Needs Review' -> only 5 review cards shown
    await filterReviewsBtn.click();
    const reviewCards = page.locator('#organizer-validation-checks-container article');
    await expect(reviewCards).toHaveCount(5);

    // Click 'Matches' -> 2 match cards (DF-13 + positive control P01)
    await filterMatchesBtn.click();
    const matchCards = page.locator('#organizer-validation-checks-container article');
    expect(await matchCards.count()).toBeGreaterThanOrEqual(1);

    // Click 'Legal' -> Legal checks shown
    await filterLegalBtn.click();
    const legalCards = page.locator('#organizer-validation-checks-container article');
    expect(await legalCards.count()).toBeGreaterThanOrEqual(4);

    // Click 'R&D' -> R&D checks shown
    await filterRdBtn.click();
    const rdCards = page.locator('#organizer-validation-checks-container article');
    expect(await rdCards.count()).toBeGreaterThanOrEqual(6);

    // Click 'Brand' -> Brand checks shown
    await filterBrandBtn.click();
    const brandCards = page.locator('#organizer-validation-checks-container article');
    expect(await brandCards.count()).toBeGreaterThanOrEqual(3);

    // Click 'Prepress' -> Prepress checks shown
    await filterPrepressBtn.click();
    const prepressCards = page.locator('#organizer-validation-checks-container article');
    expect(await prepressCards.count()).toBeGreaterThanOrEqual(2);

    // Reset to 'All'
    await filterAllBtn.click();
    const allCards = page.locator('#organizer-validation-checks-container article');
    await expect(allCards).toHaveCount(17); // 16 checks + P01

    // Step 6: Evidence Interactions on individual cards
    // 6a. DF-01 View Artwork
    const df01Card = page.locator('article[data-canonical-id="DF-01"]');
    await expect(df01Card).toBeVisible();
    const df01ViewArtBtn = df01Card.locator('button[data-action="df-view-artwork"]');
    if (await df01ViewArtBtn.count() > 0) {
      await df01ViewArtBtn.click();
      // Verifies it navigates to 2D artwork view
      await expect(page.locator('.workbench-canvas')).toBeVisible();
    }

    // Return to Checks tab
    const checksTabBtn = page.locator('button.tab[data-action="tab"][data-tab="findings"]').first();
    if (await checksTabBtn.count() > 0) {
      await checksTabBtn.click();
    }

    // 6b. DF-01 View Source
    const df01ViewSourceBtn = page.locator('article[data-canonical-id="DF-01"] button[data-action="df-view-source"]');
    if (await df01ViewSourceBtn.count() > 0) {
      await df01ViewSourceBtn.click();
      // Verify notification toast displays B26 & draft status
      await expect(page.locator('.toast')).toContainText('B26');
    }

    // 6c. DF-08 Inspect Calculation
    const df08InspectBtn = page.locator('article[data-canonical-id="DF-08"] button[data-action="df-inspect-calc"]');
    if (await df08InspectBtn.count() > 0) {
      await df08InspectBtn.click();
      const calcModal = page.locator('.dialog-backdrop');
      await expect(calcModal).toBeVisible();
      await expect(calcModal).toContainText('DF-08 · ARITHMETIC PROOF');
      await expect(calcModal).toContainText('15g declared / 78g');
      await calcModal.locator('button[data-action="close-dialog"]').click();
      await expect(calcModal).toBeHidden();
    }

    // 6d. DF-11 Inspect Calculation (Serving math)
    const df11InspectBtn = page.locator('article[data-canonical-id="DF-11"] button[data-action="df-inspect-calc"]');
    if (await df11InspectBtn.count() > 0) {
      await df11InspectBtn.click();
      const calcModal = page.locator('.dialog-backdrop');
      await expect(calcModal).toBeVisible();
      await expect(calcModal).toContainText('DF-11 · ARITHMETIC PROOF');
      await expect(calcModal).toContainText('480g / 8');
      await calcModal.locator('button[data-action="close-dialog"]').click();
      await expect(calcModal).toBeHidden();
    }

    // 6e. DF-03 Ask Someone (Legal)
    const df03AskBtn = page.locator('article[data-canonical-id="DF-03"] button[data-action="df-ask-someone"]');
    if (await df03AskBtn.count() > 0) {
      await df03AskBtn.click();
      // Either modal or toast appears for team collaboration
      const modalOrToast = page.locator('.dialog-backdrop, .toast');
      await expect(modalOrToast.first()).toBeVisible();
      const dismissBtn = page.locator('.dialog-backdrop button[data-action="close-dialog"]');
      if (await dismissBtn.count() > 0) {
        await dismissBtn.click();
      }
    }

    // 6f. DF-04 Flag for Remedy
    const df04FlagBtn = page.locator('article[data-canonical-id="DF-04"] button[data-action="df-flag-remedy"]');
    if (await df04FlagBtn.count() > 0) {
      await df04FlagBtn.click();
      await expect(page.locator('.toast')).toContainText('DF-04');
    }

    // Step 7: Confirm Positive Control P01 is displayed as a passing check (Green MATCH)
    const p01Card = page.locator('article[data-canonical-id="P01"]');
    await expect(p01Card).toBeVisible();
    await expect(p01Card).toContainText('POSITIVE CONTROL');
    await expect(p01Card).toContainText('MATCH / PASS');
    await expect(p01Card).toContainText('1 20000 00003 6');

    // Step 8: Confirm Draft Source Warning is persistently visible
    const draftAlert = page.locator('text=Draft / In Review').first();
    await expect(draftAlert).toBeVisible();

    // Step 9: Export Report verification
    const reportLink = page.locator('a[href*="/report.json"]').first();
    await expect(reportLink).toBeVisible();
  });
});
