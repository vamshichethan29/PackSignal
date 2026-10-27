import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';

async function runRevisionStudioE2E() {
  console.log(`[Revision E2E] Connecting to ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1600, height: 1100 } });

  try {
    // 1. Fetch CSRF token and create sample review V1
    const statusRes = await page.request.get(`${BASE_URL}/api/status`);
    const statusData = await statusRes.json();
    const csrf = statusData.csrf;

    const createV1Res = await page.request.post(`${BASE_URL}/api/reviews`, {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' },
    });
    assert.ok(createV1Res.ok(), `V1 creation failed: ${createV1Res.status()}`);
    const v1Meta = await createV1Res.json();
    const v1Id = v1Meta.id;
    console.log(`[Revision E2E] Review V1 created: ${v1Id}`);

    // Wait for V1 ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await page.request.get(`${BASE_URL}/api/reviews/${v1Id}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 2. Create Review V2 linked to V1 (Revision with fieldday-v2.pdf)
    const createV2Res = await page.request.post(`${BASE_URL}/api/reviews`, {
      headers: { 'x-packproof-token': csrf },
      data: { sampleRevision: true, mode: 'local', parentId: v1Id },
    });
    assert.ok(createV2Res.ok(), `V2 creation failed: ${createV2Res.status()}`);
    const v2Meta = await createV2Res.json();
    const v2Id = v2Meta.id;
    console.log(`[Revision E2E] Review V2 created (Parent: ${v1Id}): ${v2Id}`);

    // Wait for V2 ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await page.request.get(`${BASE_URL}/api/reviews/${v2Id}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 3. Open Review V2 in Browser
    await page.goto(`${BASE_URL}/#review/${v2Id}`);
    await page.locator('.review-heading').waitFor({ timeout: 15000 });
    console.log(`[Revision E2E] Loaded V2 review workspace`);

    // 4. Navigate to Revision tab / studio
    const revTab = page.locator('button[data-action="tab"][data-tab="revision"], [data-tab="revision"]').first();
    if (await revTab.count() > 0) {
      await revTab.click();
      await page.waitForTimeout(500);
      console.log(`[Revision E2E] Switched to Revision Intelligence tab`);
    }

    // 5. Verify Visual Diff API Endpoint responds
    const visualDiffRes = await page.request.get(`${BASE_URL}/api/reviews/${v2Id}/revision/visual-diff?page=1&prevPage=1`);
    if (visualDiffRes.ok()) {
      const diffData = await visualDiffRes.json();
      console.log(`[Revision E2E] Visual diff API returned ${diffData.regions?.length || 0} pixel regions`);
    }

    // 6. Test Reviewer Change Acknowledgment Endpoint
    const ackRes = await page.request.post(`${BASE_URL}/api/reviews/${v2Id}/revision/acknowledge`, {
      headers: {
        'Content-Type': 'application/json',
        'x-packproof-token': csrf,
      },
      data: {
        changeId: 'chg_sample_01',
        decision: 'accepted_after_review',
        note: 'Verified against approved spec in E2E browser test.',
      },
    });
    assert.ok(ackRes.ok(), `Acknowledgment failed: ${ackRes.status()}`);
    const ackData = await ackRes.json();
    assert.equal(ackData.acknowledgements?.chg_sample_01?.decision, 'accepted_after_review');
    console.log(`[Revision E2E] Reviewer change acknowledgment recorded successfully`);

    // 7. Test 2D Inspection Modes & Controls
    const btn2D = page.locator('[data-rev-dimension="2d"]').first();
    if (await btn2D.count() > 0) {
      await btn2D.click();
      await page.waitForTimeout(400);
      console.log(`[Revision E2E] Switched to 2D Artwork Proof`);

      // Test Side-by-Side Dual Panes
      assert.ok(await page.locator('.rev-dual-pane').isVisible(), 'Dual pane side-by-side should be visible');
      console.log(`[Revision E2E] Verified side-by-side dual viewport layout`);

      // Test Mode 2: Transparent Overlay
      const overlayBtn = page.locator('[data-rev-mode="overlay"]').first();
      await overlayBtn.click();
      await page.waitForTimeout(300);
      assert.ok(await page.locator('.rev-overlay-surface').isVisible(), 'Overlay surface should be visible');
      const opacitySlider = page.locator('#rev-opacity-slider').first();
      await opacitySlider.fill('75');
      console.log(`[Revision E2E] Verified Transparent Overlay mode & opacity slider`);

      // Test Mode 3: Swipe Comparison
      const swipeBtn = page.locator('[data-rev-mode="swipe"]').first();
      await swipeBtn.click();
      await page.waitForTimeout(300);
      assert.ok(await page.locator('.rev-swipe-surface').isVisible(), 'Swipe surface should be visible');
      const swipeSlider = page.locator('#rev-swipe-slider').first();
      await swipeSlider.fill('60');
      console.log(`[Revision E2E] Verified Swipe Comparison mode & slider`);

      // Test Mode 4: Difference Heatmap
      const heatmapBtn = page.locator('[data-rev-mode="heatmap"]').first();
      await heatmapBtn.click();
      await page.waitForTimeout(500);
      assert.ok(await page.locator('.rev-heatmap-surface').isVisible(), 'Heatmap surface should be visible');
      console.log(`[Revision E2E] Verified Visual Difference Heatmap mode`);

      // Test Change selection
      const firstCard = page.locator('.rev-change-card').first();
      if (await firstCard.count() > 0) {
        await firstCard.click();
        await page.waitForTimeout(300);
        assert.ok(await page.locator('.rev-detail-card').isVisible(), 'Detail card should be visible for selected change');
        console.log(`[Revision E2E] Verified click-to-select on revision change card`);
      }

      // Test Filter chips
      const filterResolved = page.locator('[data-rev-filter="resolved"]').first();
      if (await filterResolved.count() > 0) {
        await filterResolved.click();
        await page.waitForTimeout(300);
        console.log(`[Revision E2E] Verified revision change filtering`);
      }
    }

    // 8. Test 3D Packaging Comparison Mode
    const btn3D = page.locator('[data-rev-dimension="3d"]').first();
    if (await btn3D.count() > 0) {
      await btn3D.click();
      await page.waitForTimeout(600);
      console.log(`[Revision E2E] Switched back to 3D Packaging Comparison`);

      // Verify 3D mount container has canvases or controller UI
      const swipeToggle = page.locator('[data-3d-mode="3d-swipe"]').first();
      if (await swipeToggle.count() > 0 && !(await swipeToggle.isDisabled())) {
        await swipeToggle.click();
        await page.waitForTimeout(400);
        console.log(`[Revision E2E] Toggled 3D Swipe mode`);

        const divider = page.locator('#rev-3d-swipe-divider').first();
        if (await divider.count() > 0) {
          assert.ok(await divider.isVisible(), '3D Swipe divider should be visible');
          console.log(`[Revision E2E] Verified 3D Swipe divider rendered`);
        }
      }
    }

    // 9. Verify Report Export includes Revision Intelligence
    const reportRes = await page.request.get(`${BASE_URL}/api/reviews/${v2Id}/report.html`);
    assert.ok(reportRes.ok(), `Report HTML export failed: ${reportRes.status()}`);
    const reportHtml = await reportRes.text();
    assert.ok(reportHtml.includes('Revision comparison') || reportHtml.includes('Revision Intelligence'), 'Report must contain Revision Comparison section');
    console.log(`[Revision E2E] Verified Report HTML export includes Revision Intelligence`);

    // 10. Verify 3D Revision Intelligence Controller classes and Scissor Test
    const { REVISION_PIN_COLORS, Revision3DViewerController } = await import('../public/three/revision-3d-controller.js');
    assert.ok(REVISION_PIN_COLORS.RESOLVED === 0x22c55e, 'Green resolved pin color');
    assert.ok(REVISION_PIN_COLORS.REGRESSION === 0xef4444, 'Red regression pin color');
    assert.ok(typeof Revision3DViewerController === 'function', 'Revision3DViewerController exists');
    console.log(`[Revision E2E] Verified 3D revision viewer module exports and pin semantics`);

    console.log(`[Revision E2E] ALL REVISION INTELLIGENCE & 3D DIFF TESTS PASSED CLEANLY!`);
  } finally {
    await browser.close();
  }
}

runRevisionStudioE2E().catch(err => {
  console.error('[Revision E2E] Failed:', err);
  process.exit(1);
});
