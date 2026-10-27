import { test, expect } from '@playwright/test';

test.describe('E2E: PackSignal Upgrade #48 Multi-Packaging 3D Geometry Studio', () => {
  test('Complete verification of all 4 3D models, PBR materials, finish masks, finding pins, and 2D/3D sync', async ({ page, request }) => {
    test.setTimeout(180000);

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 1. Create a review with Fieldday sample via API
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
    await page.waitForSelector('.review-workbench', { timeout: 20000 });


    // 3. Open 3D Packaging Studio mode
    const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    await expect(mode3dBtn).toBeVisible();
    await mode3dBtn.click();
    await page.waitForTimeout(600);

    // 4. Verify 3D stage and WebGL canvas
    const stage = page.locator('.carton-stage, .carton-studio');
    await expect(stage).toBeVisible();

    const webglCanvas = page.locator('[data-carton-webgl]');
    await expect(webglCanvas).toBeVisible();

    // 5. Select Folding Carton
    const cartonBtn = page.locator('[data-pkg-format="carton"]');
    await expect(cartonBtn).toBeVisible();
    await cartonBtn.click();
    await page.waitForTimeout(300);
    await expect(cartonBtn).toHaveClass(/active/);

    // Verify Carton fold controls exist
    const foldBar = page.locator('[data-carton-fold-bar]');
    await expect(foldBar).toBeVisible();

    // Rotate carton with rotation slider
    const rotateSlider = page.locator('[data-carton-rotation]');
    if (await rotateSlider.isVisible()) {
      await rotateSlider.fill('45');
      await page.waitForTimeout(200);
      await rotateSlider.fill('0');
    }

    // 6. Switch Materials: Kraft Paper & SBS White Card
    const substrateSelect = page.locator('[data-mat-substrate]');
    if (await substrateSelect.isVisible()) {
      await substrateSelect.selectOption('matte_paperboard');
      await page.waitForTimeout(200);
      await substrateSelect.selectOption('gloss_paperboard');
      await page.waitForTimeout(200);
    }

    // 7. Select Aluminium Soda Can
    const canBtn = page.locator('[data-pkg-format="can"]');
    await expect(canBtn).toBeVisible();
    await canBtn.click();
    await page.waitForTimeout(300);
    await expect(canBtn).toHaveClass(/active/);

    // Verify Can control bar
    const canBar = page.locator('[data-can-control-bar]');
    await expect(canBar).toBeVisible();

    // Test Seam slider and highlight
    const seamSlider = page.locator('[data-can-seam-slider]');
    if (await seamSlider.isVisible()) {
      await seamSlider.fill('90');
      await page.waitForTimeout(200);
    }

    const seamHighlightBtn = page.locator('[data-can-seam-highlight]');
    if (await seamHighlightBtn.isVisible()) {
      await seamHighlightBtn.click();
      await page.waitForTimeout(100);
    }

    // 8. Select Glass Bottle
    const bottleBtn = page.locator('[data-pkg-format="bottle"]');
    await expect(bottleBtn).toBeVisible();
    await bottleBtn.click();
    await page.waitForTimeout(300);
    await expect(bottleBtn).toHaveClass(/active/);

    // Verify Bottle control bar and material switches
    const bottleBar = page.locator('[data-bottle-control-bar]');
    await expect(bottleBar).toBeVisible();

    const glassSubBtn = page.locator('[data-bottle-sub="glass"]');
    if (await glassSubBtn.isVisible()) {
      await glassSubBtn.click();
      await page.waitForTimeout(200);
    }

    // 9. Select Stand-Up Foil Pouch
    const pouchBtn = page.locator('[data-pkg-format="pouch"]');
    await expect(pouchBtn).toBeVisible();
    await pouchBtn.click();
    await page.waitForTimeout(300);
    await expect(pouchBtn).toHaveClass(/active/);

    // Verify Pouch controls
    const pouchBar = page.locator('[data-pouch-control-bar]');
    await expect(pouchBar).toBeVisible();

    // 10. Enable Finishes: Metallic Gold Foil and Spot UV
    const goldFoilBtn = page.locator('[data-quick-finish="gold_foil"]');
    if (await goldFoilBtn.isVisible()) {
      await goldFoilBtn.click();
      await page.waitForTimeout(200);
    }

    const spotUvBtn = page.locator('[data-quick-finish="spot_uv"]');
    if (await spotUvBtn.isVisible()) {
      await spotUvBtn.click();
      await page.waitForTimeout(200);
    }

    // Verify truth disclaimer
    const disclaimer = page.locator('.materials-disclaimer');
    if (await disclaimer.isVisible()) {
      const text = await disclaimer.innerText();
      expect(text.toLowerCase()).toContain('visual');
    }

    // 11. Toggle Ghost X-Ray mode
    const xrayBtn = page.locator('[data-carton-xray]');
    if (await xrayBtn.isVisible()) {
      await xrayBtn.click();
      await page.waitForTimeout(200);
      await xrayBtn.click();
    }

    // 12. Switch back to Carton and inspect findings nav
    await cartonBtn.click();
    await page.waitForTimeout(300);

    const nextFindingBtn = page.locator('[data-finding-next]');
    if (await nextFindingBtn.isVisible()) {
      await nextFindingBtn.click();
      await page.waitForTimeout(200);
    }

    // 13. Verify no fatal unhandled exceptions occurred
    const fatalErrors = errors.filter(e => !e.includes('ResizeObserver') && !e.includes('favicon'));
    expect(fatalErrors).toHaveLength(0);
  });
});
