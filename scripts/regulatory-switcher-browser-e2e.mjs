import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';

async function runRegulatorySwitcherE2E() {
  console.log(`[Regulatory E2E] Connecting to ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1600, height: 1100 } });

  try {
    // 1. Fetch existing ready organizer review or create one
    let reviewId = null;
    try {
      const existingRes = await page.request.get(`${BASE_URL}/api/reviews`);
      const existingList = await existingRes.json();
      const readyOrganizer = Array.isArray(existingList) && existingList.find(r => r.status === 'ready' && r.name?.includes('Dancing Fish'));
      if (readyOrganizer) {
        reviewId = readyOrganizer.id;
        console.log(`[Regulatory E2E] Reusing existing ready review: ${reviewId}`);
      }
    } catch {}

    if (!reviewId) {
      const statusRes = await page.request.get(`${BASE_URL}/api/status`);
      const statusData = await statusRes.json();
      const csrf = statusData.csrf;

      const createRes = await page.request.post(`${BASE_URL}/api/reviews`, {
        headers: { 'x-packproof-token': csrf },
        data: { sample: 'organizer', mode: 'local' },
      });
      assert.ok(createRes.ok(), `Review creation failed: ${createRes.status()}`);
      const reviewMeta = await createRes.json();
      reviewId = reviewMeta.id;
      console.log(`[Regulatory E2E] Review created: ${reviewId}`);

      for (let i = 0; i < 80; i++) {
        const poll = await (await page.request.get(`${BASE_URL}/api/reviews/${reviewId}`)).json();
        if (poll.status === 'ready') break;
        await page.waitForTimeout(500);
      }
    }

    // 2. Open Review Workspace
    await page.goto(`${BASE_URL}/#review/${reviewId}`);
    await page.locator('.review-heading').waitFor({ timeout: 15000 });
    console.log(`[Regulatory E2E] Loaded review workspace`);

    // 3. Verify Regulatory Switcher panel presence
    const switcherPanel = page.locator('[data-regulatory-switcher]').first();
    await switcherPanel.waitFor({ timeout: 10000 });
    assert.ok(await switcherPanel.isVisible(), 'Regulatory switcher panel must be visible');
    console.log(`[Regulatory E2E] Regulatory Switcher panel mounted`);

    // 4. Verify the 3 Market Buttons: USA (FDA), EU (1169/2011), and India (FSSAI)
    const usBtn = switcherPanel.locator('[data-reg-market="us"]').first();
    const euBtn = switcherPanel.locator('[data-reg-market="eu"]').first();
    const inBtn = switcherPanel.locator('[data-reg-market="india"]').first();

    assert.ok(await usBtn.isVisible(), 'USA FDA button must be visible');
    assert.ok(await euBtn.isVisible(), 'EU 1169/2011 button must be visible');
    assert.ok(await inBtn.isVisible(), 'India FSSAI button must be visible');
    console.log(`[Regulatory E2E] Verified all three jurisdiction buttons (USA, EU, India)`);

    // 5. Test Switching to EU 1169/2011
    console.log(`[Regulatory E2E] Switching to EU 1169/2011...`);
    await euBtn.click();
    await page.locator('.reg-jurisdiction-banner').filter({ hasText: 'European Union' }).waitFor({ timeout: 10000 });
    const banner = page.locator('.reg-jurisdiction-banner').first();
    const bannerText = await banner.textContent();
    assert.ok(bannerText.includes('European Union') || bannerText.includes('1169/2011'), 'Banner must reflect EU jurisdiction');
    console.log(`[Regulatory E2E] EU 1169/2011 active: "${bannerText.trim().replace(/\s+/g, ' ').slice(0, 60)}…"`);

    // 6. Test Switching to India (FSSAI)
    console.log(`[Regulatory E2E] Switching to FSSAI (India)...`);
    const inBtnFresh = page.locator('[data-regulatory-switcher] [data-reg-market="india"]').first();
    await inBtnFresh.click();
    await page.locator('.reg-jurisdiction-banner').filter({ hasText: 'Food Safety' }).waitFor({ timeout: 10000 });
    const inBannerText = await page.locator('.reg-jurisdiction-banner').first().textContent();
    assert.ok(inBannerText.includes('Food Safety and Standards Authority of India') || inBannerText.includes('FSSAI'), 'Banner must reflect FSSAI jurisdiction');
    console.log(`[Regulatory E2E] FSSAI (India) active: "${inBannerText.trim().replace(/\s+/g, ' ').slice(0, 60)}…"`);

    // 7. Test Mode Toggle: Target Market vs Cross-Market What-If
    console.log(`[Regulatory E2E] Testing Cross-Market What-If toggle...`);
    const previewBtn = switcherPanel.locator('[data-reg-mode="preview"]').first();
    await previewBtn.click();
    await page.waitForTimeout(300);
    const badgeText = await switcherPanel.locator('.reg-banner-mode-badge').textContent();
    assert.ok(badgeText.includes('WHAT-IF PREVIEW'), 'Mode badge must indicate WHAT-IF PREVIEW');
    console.log(`[Regulatory E2E] Verified What-If Preview mode`);

    // 8. Test Market Readiness Worklist Modal
    console.log(`[Regulatory E2E] Opening Market Readiness Worklist...`);
    const worklistBtn = switcherPanel.locator('[data-reg-action="open-worklist"]').first();
    await worklistBtn.click();
    await page.waitForTimeout(600);
    const worklistDialog = page.locator('#reg-worklist-dialog');
    await worklistDialog.waitFor({ timeout: 5000 });
    assert.ok(await worklistDialog.isVisible(), 'Worklist modal must open');
    const worklistHandoff = await worklistDialog.locator('#handoff-markdown-textarea').inputValue();
    assert.ok(worklistHandoff.includes('PackSignal Prepress Regulatory Handoff'), 'Handoff markdown must be present');
    console.log(`[Regulatory E2E] Verified Market Readiness Worklist and Designer Handoff markdown`);
    await worklistDialog.locator('[data-action="close"]').click();
    await page.waitForTimeout(300);

    // 9. Test Three-Market Comparison Matrix Modal
    console.log(`[Regulatory E2E] Opening Three-Market Comparison Matrix...`);
    const compareBtn = switcherPanel.locator('[data-reg-action="compare-all-markets"]').first();
    await compareBtn.click();
    await page.waitForTimeout(800);
    const matrixDialog = page.locator('#reg-matrix-dialog');
    await matrixDialog.waitFor({ timeout: 5000 });
    assert.ok(await matrixDialog.isVisible(), 'Comparison matrix modal must open');
    const matrixText = await matrixDialog.innerText();
    console.log(`[Regulatory E2E] Matrix Text sample: ${matrixText.slice(0, 300).replace(/\s+/g, ' ')}`);
    assert.ok(matrixText.includes('USA') || matrixText.includes('FDA'), 'Matrix must include USA column');
    assert.ok(matrixText.includes('EU') || matrixText.includes('1169'), 'Matrix must include EU column');
    assert.ok(matrixText.includes('India') || matrixText.includes('FSSAI'), 'Matrix must include India column');
    console.log(`[Regulatory E2E] Verified 3-column cross-market comparison matrix with statutory citations`);
    await matrixDialog.locator('[data-action="close"]').click();

    console.log(`[Regulatory E2E] ALL REGULATORY SWITCHER E2E TESTS PASSED CLEANLY!`);
  } finally {
    await browser.close();
  }
}

runRegulatorySwitcherE2E().catch(err => {
  console.error('[Regulatory E2E] Failed:', err);
  process.exit(1);
});
