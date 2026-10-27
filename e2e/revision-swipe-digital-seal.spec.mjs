/**
 * Playwright E2E Test Suite: 3D Artwork Revision Swipe + Ed25519 Digital Review Seal
 * File: e2e/revision-swipe-digital-seal.spec.mjs
 */

import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const verifyScript = join(root, 'scripts/verify-report.mjs');

test.describe('3D Artwork Revision Swipe + Ed25519 Digital Review Seal E2E Workflow', () => {
  test('Complete Fieldday V1 -> V2 visual swipe inspection, tamper detection, and verification', async ({ page, request }) => {
    test.setTimeout(180000);

    const fatalErrors = [];
    page.on('pageerror', (err) => fatalErrors.push(err.message));

    // 1. Open PackSignal & Create baseline Fieldday review
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
    await page.waitForSelector('.review-heading h1', { timeout: 15000 });

    const titleText = await page.locator('.review-heading h1').textContent();
    expect(titleText).toContain('Fieldday');

    // 4. Trigger Fieldday V2 revision creation
    const revBtn = page.locator('button[data-action="revision"]').first();
    await revBtn.click();
    await page.waitForSelector('#dialog[open]');

    const runV2Btn = page.locator('button[data-action="sample-revision"]');
    await expect(runV2Btn).toBeVisible();
    await runV2Btn.click();

    // 5. Wait for V2 analysis and Revisions Studio to mount
    await page.waitForSelector('[data-revision-studio]', { timeout: 45000 });
    await page.waitForTimeout(2000);

    // 6. Verify 3D Mount & Switch to 3D Swipe Slider Mode
    const rev3dMount = page.locator('#rev-3d-mount');
    await expect(rev3dMount).toBeVisible();

    const swipeModeBtn = page.locator('.btn-3d-mode[data-3d-mode="3d-swipe"]');
    await expect(swipeModeBtn).toBeVisible();
    await swipeModeBtn.click();
    await page.waitForTimeout(600);

    // 7. Verify Draggable Swipe divider and controls
    const swipeControlsBar = page.locator('#rev-3d-swipe-controls-bar');
    await expect(swipeControlsBar).toBeVisible();

    const swipeDivider = page.locator('#rev-3d-swipe-divider');
    await expect(swipeDivider).toBeVisible();

    // 8. Test Swipe Presets: 100% (V1), 0% (V2), 50% (Split)
    const showV1Btn = page.locator('.btn-swipe-preset[data-swipe-target="100"]');
    const showV2Btn = page.locator('.btn-swipe-preset[data-swipe-target="0"]');
    const split50Btn = page.locator('.btn-swipe-preset[data-swipe-target="50"]');

    await showV1Btn.click();
    await page.waitForTimeout(300);
    expect(await page.locator('#rev-3d-swipe-val').textContent()).toContain('100%');

    await showV2Btn.click();
    await page.waitForTimeout(300);
    expect(await page.locator('#rev-3d-swipe-val').textContent()).toContain('0%');

    await split50Btn.click();
    await page.waitForTimeout(300);
    expect(await page.locator('#rev-3d-swipe-val').textContent()).toContain('50%');

    // 9. Inspect Changed Findings: Filter Resolved, Click R03 / Net Quantity
    const resolvedFilterBtn = page.locator('.filter-chip[data-rev-filter="resolved"]');
    await resolvedFilterBtn.click();
    await page.waitForTimeout(400);

    const resolvedCards = page.locator('.rev-change-card');
    const resolvedCount = await resolvedCards.count();
    expect(resolvedCount).toBeGreaterThan(0);

    // Click first resolved finding (Net Quantity or Storage)
    await resolvedCards.first().click();
    await page.waitForTimeout(500);

    const detailCard = page.locator('.rev-detail-card');
    await expect(detailCard).toBeVisible();
    const detailContent = await detailCard.textContent();
    expect(detailContent).toContain('V1 PREVIOUS OBSERVED');
    expect(detailContent).toContain('V2 REVISED OBSERVED');

    // 10. Filter Regressions: Inspect R09 customer-care regression
    const regressionsFilterBtn = page.locator('.filter-chip[data-rev-filter="regressions"]');
    await regressionsFilterBtn.click();
    await page.waitForTimeout(400);

    const regressionCards = page.locator('.rev-change-card');
    const regrCount = await regressionCards.count();
    expect(regrCount).toBeGreaterThanOrEqual(1);

    await regressionCards.first().click();
    await page.waitForTimeout(500);
    const regrDetailText = await page.locator('.rev-detail-card').textContent();
    expect(regrDetailText).toContain('REGRESSION');

    // 11. Return to All filter & verify summary counts
    const allFilterBtn = page.locator('.filter-chip[data-rev-filter="all"]');
    await allFilterBtn.click();
    await page.waitForTimeout(300);

    // 12. Export signed review snapshot / download report
    const exportResponse = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(exportResponse.status()).toBe(200);
    const signedReport = await exportResponse.json();

    expect(signedReport.signature).toBeDefined();
    expect(signedReport.signature.algorithm).toBe('Ed25519');
    expect(signedReport.signature.publicKey).toBeDefined();

    // 13. CLI Verification & Tamper Detection on exported report
    const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-e2e-tamper-'));
    try {
      const genuineJsonPath = join(tempDir, 'exported-report.json');
      await writeFile(genuineJsonPath, JSON.stringify(signedReport, null, 2));

      // Verify unmodified exported report
      const verifyGenuine = spawnSync(process.execPath, [verifyScript, genuineJsonPath], { encoding: 'utf8' });
      expect(verifyGenuine.status).toBe(0);
      expect(verifyGenuine.stdout).toContain('SIGNATURE:                      VALID');
      expect(verifyGenuine.stdout).toContain('Release authorization:          NOT ESTABLISHED');

      // Tamper with finding status (e.g. change finding status from issue to match)
      const tamperedReport = JSON.parse(JSON.stringify(signedReport));
      if (tamperedReport.findings && tamperedReport.findings.length > 0) {
        tamperedReport.findings[0].status = tamperedReport.findings[0].status === 'match' ? 'issue' : 'match';
      }
      const tamperedJsonPath = join(tempDir, 'tampered-exported-report.json');
      await writeFile(tamperedJsonPath, JSON.stringify(tamperedReport, null, 2));

      // Verify tampered report fails
      const verifyTampered = spawnSync(process.execPath, [verifyScript, tamperedJsonPath], { encoding: 'utf8' });
      expect(verifyTampered.status).toBe(1);
      expect(verifyTampered.stdout).toContain('SIGNATURE INVALID');

      // Re-verify genuine passes
      const reVerify = spawnSync(process.execPath, [verifyScript, genuineJsonPath], { encoding: 'utf8' });
      expect(reVerify.status).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    // Assert no fatal JS crashes
    expect(fatalErrors).toEqual([]);
  });
});
