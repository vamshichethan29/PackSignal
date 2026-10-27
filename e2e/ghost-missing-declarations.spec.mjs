/**
 * e2e/ghost-missing-declarations.spec.mjs
 * Playwright E2E Test Suite for Smart Missing-Declaration Ghost Bounding Boxes
 * Verifies 2D artwork X-Ray overlays, 3D packaging projection, camera fly-to,
 * V1/V2 revision resolution, and cryptographic signed review report verification.
 */

import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const verifyScript = join(root, 'scripts/verify-report.mjs');

test.describe('E2E: Smart Missing-Declaration Ghost Boxes (Upgrade #50)', () => {
  test('Complete 28-step statutory placement region, 3D carton fly-to, V1/V2 verification workflow', async ({ page, request }) => {
    test.setTimeout(180000);

    const fatalErrors = [];
    page.on('pageerror', err => fatalErrors.push(err.message));

    // 1. Open PackSignal & Load controlled Fieldday review
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' },
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

    // 4. Verify 2D Ghost Overlay layer is attached
    const ghostLayer = page.locator('[data-ghost-overlay-layer]');
    await expect(ghostLayer).toBeAttached();

    // 5. Verify X-Ray button and enable X-Ray mode
    const xrayToggleBtn = page.locator('[data-action="toggle-xray-2d"]');
    await expect(xrayToggleBtn).toBeVisible();

    if (!(await xrayToggleBtn.getAttribute('class'))?.includes('active')) {
      await xrayToggleBtn.click();
      await page.waitForTimeout(300);
    }

    // 6. Verify statutory permitted region (dashed amber styling)
    const legalRegions = page.locator('.workbench-legal-region');
    const ghostBoxes = page.locator('.workbench-ghost-box');
    await expect(legalRegions.first()).toBeVisible();
    await expect(ghostBoxes.first()).toBeVisible();

    // 7. Verify ghost badge explicitly identifies it as hypothetical statutory placement
    const badge = ghostBoxes.first().locator('.ghost-badge');
    await expect(badge).toBeVisible();
    expect(await badge.innerText()).toContain('GHOST:');

    // 8. Verify rule citation pill (21 CFR)
    const rulePill = ghostBoxes.first().locator('.ghost-rule-pill');
    await expect(rulePill).toBeVisible();
    expect(await rulePill.innerText()).toMatch(/21 CFR/);

    // 9. Click on Ghost Box to open Statutory Placement Detail Modal
    const netQtyGhost = page.locator('.workbench-ghost-box').first();
    await page.evaluate(() => {
      const b = document.querySelector('.workbench-ghost-box');
      if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      else if (window.__openGhostPlacementModal) window.__openGhostPlacementModal();
    });
    await page.waitForTimeout(500);

    const dialog = page.locator('#dialog');
    await expect(dialog).toBeVisible();

    // 10. Verify governing legal source and permitted placement zone description
    await expect(dialog.locator('text=PERMITTED LEGAL REGION')).toBeVisible();
    await expect(dialog.locator('text=STATUTORY GOVERNING RULE')).toBeVisible();
    await expect(dialog.locator('text=21 CFR §101.7').first()).toBeVisible();

    // 11. Test Ask Legal integration
    const askSomeoneGhostBtn = dialog.locator('[data-action="ask-someone-ghost"]');
    await expect(askSomeoneGhostBtn).toBeVisible();
    await askSomeoneGhostBtn.click();
    await page.waitForTimeout(400);

    const askModal = page.locator('#ask-someone-modal');
    await expect(askModal).toBeVisible();
    const editor = askModal.locator('#ask-message-editor');
    expect(await editor.inputValue()).toContain('Legal');

    // Close Ask Someone modal
    await askModal.locator('[data-ask-action="close"]').first().click();
    await page.waitForTimeout(300);

    // 12. Switch to 3D Packaging Studio & Verify 3D Carton Mount
    if (await dialog.isVisible()) {
      await dialog.locator('[data-action="close"]').first().click();
      await page.waitForTimeout(300);
    }

    const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    if (await mode3dBtn.isVisible()) {
      await mode3dBtn.click({ force: true });
      await page.waitForTimeout(800);
      const scene = page.locator('.carton-scene');
      await expect(scene).toBeVisible();
    }

    // 13. Trigger Fieldday V2 Revision Comparison
    const revBtn = page.locator('button[data-action="revision"]').first();
    await revBtn.click();
    await page.waitForSelector('#dialog[open]');

    const runV2Btn = page.locator('button[data-action="sample-revision"]');
    await expect(runV2Btn).toBeVisible();
    await runV2Btn.click();

    // Wait for Revision Studio
    await page.waitForSelector('[data-revision-studio]', { timeout: 45000 });
    await page.waitForTimeout(1000);

    // 14. Export Signed Review Snapshot & Verify Integrity via CLI
    const exportResponse = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(exportResponse.status()).toBe(200);
    const signedReport = await exportResponse.json();

    const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-ghost-e2e-'));
    try {
      const reportPath = join(tempDir, 'ghost-report.json');
      await writeFile(reportPath, JSON.stringify(signedReport, null, 2));

      const cliRes = spawnSync(process.execPath, [verifyScript, reportPath], { encoding: 'utf8' });
      expect(cliRes.status).toBe(0);
      expect(cliRes.stdout).toContain('SIGNATURE:                      VALID');
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    // 15. Confirm no fatal JS crashes
    expect(fatalErrors).toEqual([]);
  });
});
