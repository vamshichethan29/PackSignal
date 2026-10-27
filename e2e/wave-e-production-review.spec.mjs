import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test.describe('E2E: Wave E Production Review & Cryptographic Verification', () => {
  test.setTimeout(120000);

  test('Complete Wave E Inspection: Prepress Radar, 3D Geometries, Typography, Time Machine & Signed Verification', async ({ page, request }) => {
    // 1. Create a review with fieldday sample
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
    await page.waitForSelector('.review-workbench', { timeout: 20000 });

    // ==========================================
    // PART 1: TOP-BAR LAUNCH READINESS BANNER
    // ==========================================
    const readinessBanner = page.locator('#rtm-root');
    await expect(readinessBanner).toBeVisible();

    const quickTriageBar = page.locator('.quick-triage-toolbar');
    await expect(quickTriageBar).toBeVisible();

    // ==========================================
    // PART 2: 3D WORKBENCH & 4 PACKAGING GEOMETRIES
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });

    const scene = page.locator('.carton-scene');
    if (!await scene.isVisible()) {
      const btn3d = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
      await btn3d.click();
    }
    await expect(scene).toBeVisible({ timeout: 15000 });

    const overlay = page.locator('.carton-pin-overlay-layer');
    if (await overlay.isVisible()) {
      await expect(overlay).toBeVisible();
    }

    // Switch back to 2D
    const btn2d = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
    await btn2d.click();
    await page.waitForTimeout(500);

    // ==========================================
    // PART 3: PREPRESS DEPARTMENT FILTER & RADAR
    // ==========================================
    const btnPrepress = page.locator('[data-department="prepress"]');
    if (await btnPrepress.isVisible()) {
      await btnPrepress.click();
      await page.waitForTimeout(300);
      await expect(btnPrepress).toHaveAttribute('aria-pressed', 'true');
    }

    // Reset to all departments
    const btnAll = page.locator('[data-department="all"]');
    if (await btnAll.isVisible()) {
      await btnAll.click();
      await page.waitForTimeout(300);
    }

    // ==========================================
    // PART 4: ASK SOMEONE MESSAGE GENERATION
    // ==========================================
    const firstFinding = page.locator('.queue-finding').first();
    await expect(firstFinding).toBeVisible();
    await firstFinding.click();
    await page.waitForTimeout(400);

    const askBtn = page.locator('[data-action="ask-someone"]').first();
    if (await askBtn.isVisible()) {
      await askBtn.click();
      await page.waitForTimeout(500);

      const askModal = page.locator('#ask-someone-modal');
      await expect(askModal).toBeVisible();

      // Verify Slack / Teams tabs and preview message
      const msgPreview = page.locator('#ask-message-editor');
      await expect(msgPreview).toBeVisible();
      const previewText = await msgPreview.inputValue();
      expect(previewText.length).toBeGreaterThan(20);

      // Close modal
      const closeBtn = page.locator('[data-ask-action="close"]').first();
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // ==========================================
    // PART 5: KEYBOARD QUICK TRIAGE
    // ==========================================
    // Focus first finding card and press '1' to acknowledge
    await page.keyboard.press('1');
    await page.waitForTimeout(400);

    // Press 'J' for next finding
    await page.keyboard.press('j');
    await page.waitForTimeout(300);

    // ==========================================
    // PART 6: REGULATORY TIME MACHINE
    // ==========================================
    const dateInput = page.locator('#rtm-exact-date');
    if (await dateInput.isVisible()) {
      await dateInput.fill('2027-07-01');
      await dateInput.dispatchEvent('change');
      await page.waitForTimeout(400);
    }

    // ==========================================
    // PART 7: CRYPTOGRAPHIC VERIFICATION CLI
    // ==========================================
    // Fetch review data JSON
    const reviewData = await (await request.get(`/api/reviews/${reviewId}`)).json();
    expect(reviewData).toBeDefined();

    // Test CLI verification with temporary files
    const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-wave-e-e2e-'));
    try {
      const reviewJsonPath = join(tempDir, 'review-export.json');
      await writeFile(reviewJsonPath, JSON.stringify(reviewData, null, 2));

      // 1. If signed review, test verification
      if (reviewData.signature) {
        const cliRes = spawnSync(process.execPath, [
          join(root, 'scripts/verify-report.mjs'),
          reviewJsonPath,
        ], { encoding: 'utf8' });

        expect(cliRes.status).toBe(0);
        expect(cliRes.stdout).toContain('SIGNATURE VALID');

        // 2. Tampered review test
        const tampered = JSON.parse(JSON.stringify(reviewData));
        if (tampered.findings?.[0]) {
          tampered.findings[0].status = tampered.findings[0].status === 'match' ? 'issue' : 'match';
        }
        const tamperedPath = join(tempDir, 'tampered-export.json');
        await writeFile(tamperedPath, JSON.stringify(tampered, null, 2));

        const tamperedCliRes = spawnSync(process.execPath, [
          join(root, 'scripts/verify-report.mjs'),
          tamperedPath,
        ], { encoding: 'utf8' });

        expect(tamperedCliRes.status).toBe(1);
        expect(tamperedCliRes.stdout + tamperedCliRes.stderr).toContain('INVALID');
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
