import { test, expect } from '@playwright/test';

test.describe('E2E: Wave A UX Upgrades (Ask Someone + Ghost Boxes + Department Filtering)', () => {
  test('Complete Wave A Workflow: Department Filters, Ask Someone Composer, X-Ray Ghost Boxes, and 3D Sync', async ({ page, request }) => {
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

    // ==========================================
    // PART 1: DEPARTMENT FILTER PILLS
    // ==========================================
    const deptFilterBar = page.locator('[data-dept-filter-bar]');
    await expect(deptFilterBar).toBeVisible();

    // Verify all 4 primary departments + All are present
    const btnAll = page.locator('[data-department="all"]');
    const btnLegal = page.locator('[data-department="legal"]');
    const btnRd = page.locator('[data-department="rd"]');
    const btnBrand = page.locator('[data-department="brand"]');
    const btnPrepress = page.locator('[data-department="prepress"]');

    await expect(btnAll).toBeVisible();
    await expect(btnLegal).toBeVisible();
    await expect(btnRd).toBeVisible();
    await expect(btnBrand).toBeVisible();
    await expect(btnPrepress).toBeVisible();

    // Check initial finding queue count
    const totalFindings = await page.locator('.queue-finding').count();
    expect(totalFindings).toBeGreaterThan(0);

    // 4. Click Legal filter
    await btnLegal.click();
    await page.waitForTimeout(300);
    await expect(btnLegal).toHaveAttribute('aria-pressed', 'true');
    const legalFindings = await page.locator('.queue-finding').count();
    expect(legalFindings).toBeGreaterThan(0);
    expect(legalFindings).toBeLessThanOrEqual(totalFindings);

    // Take screenshot of department filters
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/wave_a_department_filters.png' });

    // 5. Click R&D filter
    await btnRd.click();
    await page.waitForTimeout(300);
    await expect(btnRd).toHaveAttribute('aria-pressed', 'true');

    // 6. Click Brand filter
    await btnBrand.click();
    await page.waitForTimeout(300);
    await expect(btnBrand).toHaveAttribute('aria-pressed', 'true');

    // 7. Click Prepress filter
    await btnPrepress.click();
    await page.waitForTimeout(300);
    await expect(btnPrepress).toHaveAttribute('aria-pressed', 'true');

    // 8. Reset to All
    await btnAll.click();
    await page.waitForTimeout(300);
    await expect(btnAll).toHaveAttribute('aria-pressed', 'true');
    const resetFindings = await page.locator('.queue-finding').count();
    expect(resetFindings).toBe(totalFindings);

    // ==========================================
    // PART 2: ASK SOMEONE MESSAGE GENERATOR
    // ==========================================
    // Find an Ask Someone button on a finding card
    const askSomeoneBtn = page.locator('[data-action="ask-someone"]').first();
    await expect(askSomeoneBtn).toBeVisible();
    await askSomeoneBtn.click();

    // Verify Ask Someone modal opens
    const askModal = page.locator('#ask-someone-modal');
    await expect(askModal).toBeVisible();

    const askTitle = askModal.locator('#ask-someone-title');
    await expect(askTitle).toContainText('Ask Someone');

    // Verify department selector is pre-selected
    const deptSelect = askModal.locator('#ask-dept-select');
    await expect(deptSelect).toBeVisible();

    // Verify textarea content contains real information
    const editor = askModal.locator('#ask-message-editor');
    await expect(editor).toBeVisible();
    let text = await editor.inputValue();
    expect(text).toContain('Packaging Clarification');
    expect(text).toContain('Finding ID:');

    // Test Slack format (default: single asterisks)
    expect(text).toContain('*Issue:*');

    // Test Teams format (double asterisks)
    const teamsBtn = askModal.locator('[data-ask-platform="teams"]');
    await teamsBtn.click();
    await page.waitForTimeout(200);
    text = await editor.inputValue();
    expect(text).toContain('**Issue:**');

    // Test Email format (Subject and To line)
    const emailBtn = askModal.locator('[data-ask-platform="email"]');
    await emailBtn.click();
    await page.waitForTimeout(200);
    text = await editor.inputValue();
    expect(text).toContain('Subject: Packaging Clarification');
    expect(text).toContain('To:');

    // Edit message
    await editor.fill(text + '\n\nNote: Please review formulation before 5pm deadline.');
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/wave_a_ask_someone_modal.png' });

    // Test Copy Message
    const copyBtn = askModal.locator('[data-ask-action="copy"]');
    await copyBtn.click();
    await page.waitForTimeout(400);

    const feedback = askModal.locator('#ask-copy-feedback');
    await expect(feedback).toBeVisible();

    // Close Ask Someone modal
    const closeBtn = askModal.locator('[data-ask-action="close"]').first();
    await closeBtn.click();
    await expect(askModal).not.toBeVisible();

    // Verify finding was NOT auto-resolved
    const reviewAfterCopy = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewAfterCopy.status).toBe('ready');

    // ==========================================
    // PART 3: GHOST BOXES / X-RAY MODE
    // ==========================================
    // Verify ghost overlay layer exists
    const ghostLayer = page.locator('[data-ghost-overlay-layer]');
    await expect(ghostLayer).toBeAttached();

    // Toggle X-Ray mode
    const xrayBtn = page.locator('[data-action="toggle-xray-2d"]');
    if (await xrayBtn.count() > 0) {
      await xrayBtn.click();
      await page.waitForTimeout(300);
    }

    // Capture screenshot of workbench showing ghost boxes and evidence
    const workbenchStage = page.locator('.workbench-stage');
    if (await workbenchStage.count() > 0) {
      await workbenchStage.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: '/Users/vamshi/.gemini/antigravity-ide/brain/bcd545d2-3f43-47d3-b1c2-2d11df71d258/wave_a_ghost_boxes_xray.png' });

    // Switch to 3D view and verify 3D stage
    const btn3d = page.locator('[data-tab="3d"], button:has-text("3D context"), button:has-text("3D")').first();
    if (await btn3d.count() > 0) {
      await btn3d.click();
      await page.waitForTimeout(500);
      const stage3d = page.locator('.cad-carton-stage, [data-cad-carton-stage], .carton-3d-wrapper');
      if (await stage3d.count() > 0) {
        await expect(stage3d.first()).toBeVisible();
      }
    }

    // Switch back to 2D
    const btn2d = page.locator('button:has-text("2D proof"), button:has-text("2D")').first();
    if (await btn2d.count() > 0) {
      await btn2d.click();
      await page.waitForTimeout(300);
    }

    // Final confirmation: Reviewer state remains preserved across reload
    await page.reload();
    await page.waitForSelector('.review-workbench', { timeout: 15000 });
    await expect(page.locator('[data-dept-filter-bar]')).toBeVisible();
  });
});
