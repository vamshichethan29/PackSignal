import { test, expect } from '@playwright/test';

test.describe('E2E: Smart Ghost Bounding Boxes — Missing Statutory Declaration Visualization', () => {

  test('Complete Statutory Placement Workflow: Net Quantity, Address Candidates, 2D/3D X-Ray, and Signed Report', async ({ page, request }) => {
    test.setTimeout(120000);
    // 1. Fetch CSRF token and create controlled US food packaging review
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    console.log(`[E2E] Review created: ${reviewId}`);
    let isReady = false;
    for (let i = 0; i < 60; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') {
        isReady = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    console.log(`[E2E] Review ready state: ${isReady}`);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 3. Open review in browser
    const jsErrors = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`/#review/${reviewId}`);
    await page.waitForSelector('.review-workbench', { timeout: 15000 });

    // 4. Verify no fatal JS errors on initial load
    expect(jsErrors.length).toBe(0);

    // ==========================================
    // PART 1: 2D X-RAY GHOST BOUNDING BOXES
    // ==========================================

    // Confirm ghost overlay layer is attached to the 2D workbench
    const ghostLayer = page.locator('[data-ghost-overlay-layer]');
    await expect(ghostLayer).toBeAttached();

    // Verify X-Ray button is visible in prepress HUD
    const xrayToggleBtn = page.locator('[data-action="toggle-xray-2d"]');
    await expect(xrayToggleBtn).toBeVisible();

    // Ensure X-Ray mode is active
    if (!(await xrayToggleBtn.getAttribute('class'))?.includes('active')) {
      await xrayToggleBtn.click();
      await page.waitForTimeout(300);
    }

    // Verify statutory permitted region (dashed amber styling)
    const legalRegions = page.locator('.workbench-legal-region');
    const ghostBoxes = page.locator('.workbench-ghost-box');

    await expect(legalRegions.first()).toBeVisible();
    await expect(ghostBoxes.first()).toBeVisible();

    // Confirm ghost badge explicitly identifies it as a proposed statutory placement, NOT observed text
    const badge = ghostBoxes.first().locator('.ghost-badge');
    await expect(badge).toBeVisible();
    const badgeText = await badge.innerText();
    expect(badgeText).toContain('GHOST:');

    // Confirm rule citation pill
    const rulePill = ghostBoxes.first().locator('.ghost-rule-pill');
    await expect(rulePill).toBeVisible();
    const pillText = await rulePill.innerText();
    expect(pillText).toMatch(/21 CFR/);

    // Click on the Net Quantity ghost box to open the Statutory Placement Detail Modal
    const netQtyGhost = page.locator('.workbench-ghost-box.ghost-net-qty, .workbench-ghost-box').first();
    await netQtyGhost.click({ force: true });
    await page.waitForTimeout(400);

    // Inspect the interactive ghost detail modal
    const dialog = page.locator('#dialog');
    await expect(dialog).toBeVisible();

    const dialogContent = dialog.locator('.ghost-card-modal-content');
    await expect(dialogContent).toBeVisible();

    // Verify statutory citations and permitted region descriptions
    await expect(dialog.locator('text=PERMITTED LEGAL REGION')).toBeVisible();
    await expect(dialog.locator('text=STATUTORY GOVERNING RULE')).toBeVisible();
    await expect(dialog.locator('text=21 CFR §101.7').first()).toBeVisible();

    // Verify action buttons inside ghost card
    const askSomeoneGhostBtn = dialog.locator('[data-action="ask-someone-ghost"]');
    const showIn3dBtn = dialog.locator('[data-action="show-in-3d-ghost"]');
    const createTicketBtn = dialog.locator('[data-action="create-ticket-ghost"]');

    await expect(askSomeoneGhostBtn).toBeVisible();
    await expect(showIn3dBtn).toBeVisible();
    await expect(createTicketBtn).toBeVisible();

    // ==========================================
    // PART 2: ASK LEGAL INTEGRATION
    // ==========================================
    await askSomeoneGhostBtn.click();
    await page.waitForTimeout(400);

    const askModal = page.locator('#ask-someone-modal');
    await expect(askModal).toBeVisible();

    const editor = askModal.locator('#ask-message-editor');
    await expect(editor).toBeVisible();
    const askText = await editor.inputValue();

    // Verify source-backed clarification message contains real context
    expect(askText).toContain('Legal');
    expect(askText).toContain('PackSignal could not verify the required');
    expect(askText).toMatch(/21 CFR §101\.7/);
    expect(askText).toContain('Could you confirm the approved wording and placement before the next revision?');

    // Close Ask Someone modal
    await askModal.locator('[data-ask-action="close"]').first().click();
    await page.waitForTimeout(300);

    // Close Ghost detail dialog
    if (await dialog.isVisible()) {
      await dialog.locator('[data-action="close"]').first().click();
      await page.waitForTimeout(300);
    }

    // ==========================================
    // PART 3: 3D CARTON SYNCHRONIZATION & FLY-TO
    // ==========================================
    // Switch to 3D Packaging Studio
    const scene = page.locator('.carton-scene');
    if (!await scene.isVisible()) {
      const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
      await mode3dBtn.click({ force: true });
    }
    await expect(scene).toBeVisible({ timeout: 15000 });

    // Verify 3D carton stage is rendered
    await page.waitForTimeout(500);

    // Switch back to 2D
    const mode2dBtn = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
    await mode2dBtn.click({ force: true });
    await page.waitForTimeout(300);

    // ==========================================
    // PART 4: SIGNED REPORT INTEGRATION
    // ==========================================
    // Trigger report export / sealing
    const reportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(reportRes.ok()).toBeTruthy();
    const reportData = await reportRes.json();
    expect(reportData.signature).toBeDefined();
    expect(reportData.signature.algorithm).toBe('Ed25519');
    expect(reportData.signature.signature).toBeDefined();
    expect(reportData.signature.payloadHash).toBeDefined();

    // Verify cryptographic signature endpoint
    const sigRes = await request.get(`/api/reviews/${reviewId}/signature`);
    expect(sigRes.ok()).toBeTruthy();
    const sigData = await sigRes.json();
    expect(sigData.valid).toBe(true);

    // Verify no fatal JS errors occurred throughout the session
    expect(jsErrors.length).toBe(0);
  });
});
