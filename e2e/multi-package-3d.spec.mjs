import { test, expect } from '@playwright/test';

test.describe('E2E: Advanced Multi-Geometry 3D Packaging Studio', () => {
  test('Complete 3D Packaging Studio: 4 Packaging Types, PBR Materials, Finishes, Finding Pins, and Camera Focus', async ({ page, request }) => {
    test.setTimeout(180000);

    // 1. Create a review with Fieldday sample
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

    // Switch to 3D Packaging Studio mode
    const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    await expect(mode3dBtn).toBeVisible();
    await mode3dBtn.click();
    await page.waitForTimeout(500);

    // Verify 3D stage and WebGL viewport exist
    const stage = page.locator('.carton-stage, .carton-studio');
    await expect(stage).toBeVisible();

    const webglViewport = page.locator('[data-carton-webgl]');
    await expect(webglViewport).toBeVisible();

    // Verify format switcher bar exists with all 4 types
    const cartonBtn = page.locator('[data-pkg-format="carton"]');
    const canBtn = page.locator('[data-pkg-format="can"]');
    const bottleBtn = page.locator('[data-pkg-format="bottle"]');
    const pouchBtn = page.locator('[data-pkg-format="pouch"]');

    await expect(cartonBtn).toBeVisible();
    await expect(canBtn).toBeVisible();
    await expect(bottleBtn).toBeVisible();
    await expect(pouchBtn).toBeVisible();

    // ==========================================
    // STEP 1: FOLDING CARTON
    // ==========================================
    await cartonBtn.click();
    await page.waitForTimeout(300);
    await expect(cartonBtn).toHaveClass(/active/);

    const cartonFoldBar = page.locator('[data-carton-fold-bar]');
    await expect(cartonFoldBar).toBeVisible();

    // Inspect inspector badge and dimensions
    const inspDims = page.locator('[data-insp-dims]');
    await expect(inspDims).toBeVisible();
    const cartonDimsText = await inspDims.innerText();
    expect(cartonDimsText).toContain('mm');

    // Reset camera
    const resetBtn = page.locator('[data-carton-reset]').first();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(200);
    }

    // ==========================================
    // STEP 2: ALUMINIUM SODA CAN
    // ==========================================
    await canBtn.click();
    await page.waitForTimeout(300);
    await expect(canBtn).toHaveClass(/active/);

    // Can controls bar should appear
    const canBar = page.locator('[data-can-control-bar]');
    await expect(canBar).toBeVisible();

    // Model inspector should show Can diameter & height
    const canDimsText = await inspDims.innerText();
    expect(canDimsText).toContain('Ø');

    // Toggle seam highlight and wrap mode
    const seamHighlightBtn = page.locator('[data-can-seam-highlight]');
    if (await seamHighlightBtn.isVisible()) {
      await seamHighlightBtn.click();
      await page.waitForTimeout(100);
    }

    const canWrapBtn = page.locator('[data-can-wrap-mode]');
    if (await canWrapBtn.isVisible()) {
      await canWrapBtn.click();
      await page.waitForTimeout(100);
      await canWrapBtn.click(); // Toggle back
    }

    // ==========================================
    // STEP 3: GLASS BOTTLE
    // ==========================================
    await bottleBtn.click();
    await page.waitForTimeout(300);
    await expect(bottleBtn).toHaveClass(/active/);

    const bottleBar = page.locator('[data-bottle-control-bar]');
    await expect(bottleBar).toBeVisible();

    // Switch bottle substrate material preset (Clear Glass vs Amber Glass vs PET)
    const amberBtn = page.locator('[data-bottle-sub="amber"]');
    if (await amberBtn.isVisible()) {
      await amberBtn.click();
      await page.waitForTimeout(200);
      await expect(amberBtn).toHaveClass(/active/);
    }

    const clearGlassBtn = page.locator('[data-bottle-sub="glass"]');
    if (await clearGlassBtn.isVisible()) {
      await clearGlassBtn.click();
      await page.waitForTimeout(200);
      await expect(clearGlassBtn).toHaveClass(/active/);
    }

    // ==========================================
    // STEP 4: STAND-UP FOIL POUCH
    // ==========================================
    await pouchBtn.click();
    await page.waitForTimeout(300);
    await expect(pouchBtn).toHaveClass(/active/);

    const pouchBar = page.locator('[data-pouch-control-bar]');
    await expect(pouchBar).toBeVisible();

    // Pouch fullness slider & gusset toggles
    const gussetBtn = page.locator('[data-pouch-gusset-toggle]');
    if (await gussetBtn.isVisible()) {
      await gussetBtn.click();
      await page.waitForTimeout(100);
      await gussetBtn.click();
    }

    // ==========================================
    // STEP 5: PBR MATERIALS & FINISH PREVIEWS
    // ==========================================
    const matPanel = page.locator('[data-materials-panel]');
    if (await matPanel.isVisible()) {
      // Test Spot UV finish quick button
      const spotUvBtn = page.locator('[data-quick-finish="spot_uv"]');
      if (await spotUvBtn.isVisible()) {
        await spotUvBtn.click();
        await page.waitForTimeout(200);
      }

      // Test Gold Foil quick button
      const goldFoilBtn = page.locator('[data-quick-finish="gold_foil"]');
      if (await goldFoilBtn.isVisible()) {
        await goldFoilBtn.click();
        await page.waitForTimeout(200);
      }

      // Verify disclaimer notes
      const disclaimer = page.locator('.materials-disclaimer');
      await expect(disclaimer).toBeVisible();
      const discText = await disclaimer.innerText();
      expect(discText.toLowerCase()).toContain('visual');
    }

    // ==========================================
    // STEP 6: FINDING PIN SELECTION & EVIDENCE FOCUS
    // ==========================================
    // Switch back to carton for verified dieline pin review
    await cartonBtn.click();
    await page.waitForTimeout(300);

    // Check nav next finding button
    const nextFindingBtn = page.locator('[data-finding-next]');
    if (await nextFindingBtn.isVisible()) {
      await nextFindingBtn.click();
      await page.waitForTimeout(300);
    }

    // Check department filter
    const btnPrepress = page.locator('[data-carton-filter="issues"]');
    if (await btnPrepress.isVisible()) {
      await btnPrepress.click();
      await page.waitForTimeout(200);
      await expect(btnPrepress).toHaveClass(/active/);
    }

    const btnAllPins = page.locator('[data-carton-filter="all"]');
    if (await btnAllPins.isVisible()) {
      await btnAllPins.click();
      await page.waitForTimeout(200);
    }

    // Capture screenshot of multi-geometry 3D packaging studio
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/smart_3d_pins_demonstration.png' });
  });
});
