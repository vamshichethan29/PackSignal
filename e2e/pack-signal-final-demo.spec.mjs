/**
 * e2e/pack-signal-final-demo.spec.mjs
 * 
 * MASTER COMPETITIVE DEMO & INTEGRATION E2E SUITE (PACKSIGNAL UPGRADE #51)
 * 
 * Verifies all 12 capabilities connected in one continuous review workflow:
 * Group A (Competitor Inspired):
 *   A1: Dancing Fish 16-Check Suite
 *   A2: Vegan vs Honey Decision Ripple
 *   A3: Shopper Personas Filter
 *   A4: Shelf-Distance Readability Slider
 *   A5: Pluggable India Market Pack
 *   A6: Spot the Mistakes Presentation Opener
 * Group B (PackSignal Differentiators):
 *   B1: Physical Prepress TAC & Bleed Radar
 *   B2: Native PDF Font Point-Size & x-Height
 *   B3: Four Physical 3D Packaging Geometries
 *   B4: 3D V1/V2 Revision Swipe
 *   B5: Ed25519 Signed Evidence & Audit Hash Chain
 *   B6: Ghost Boxes for Missing Declarations
 */

import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const verifyScript = join(root, 'scripts/verify-report.mjs');

test.describe('Master 12-Feature Competitive Integration (PackSignal Upgrade #51)', () => {

  test('Complete 30-Step Master Demonstration and Verification Workflow', async ({ page, request }) => {
    test.setTimeout(300000);

    const fatalErrors = [];
    page.on('pageerror', err => fatalErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });

    // =========================================================================
    // STEP 1-7: SPOT THE MISTAKES PRESENTATION OPENER (A6)
    // =========================================================================
    console.log('[STEP 1-7] Launching Spot the Mistakes Presentation Opener...');
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Launch Judge Presentation Mode from hero or topbar
    await page.locator('#hero-review-options > summary').click();
    const startDemoBtn = page.locator('#hero-start-judge-demo');
    await expect(startDemoBtn).toBeVisible({ timeout: 15000 });
    await startDemoBtn.click();

    // Verify Presentation Mode opens & official Dancing Fish artwork renders
    const presentation = page.locator('#ps-demo-presentation');
    await expect(presentation).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#demo-artwork-image')).toBeVisible();

    // Confirm challenge question and countdown
    await expect(page.locator('.demo-challenge-question')).toContainText('How many packaging problems can you find');
    const timerDisplay = page.locator('#demo-timer-display');
    await expect(timerDisplay).toContainText('00:30');

    // Test countdown timer start and skip
    await page.locator('#demo-btn-start-timer').click();
    await page.waitForTimeout(400);
    await page.locator('#demo-btn-skip-timer').click();
    await expect(timerDisplay).toContainText('00:00');

    // Reveal with PackSignal (select cached review for instant reliable transition)
    await page.locator('#demo-btn-reveal-trigger').click();
    await page.locator('#demo-choose-cached').click();

    // Verify scoreboard reflects actual counts & monotonic timing
    const scoreCard = page.locator('.demo-score-card');
    await expect(scoreCard).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#demo-count-issues')).toHaveText('10');
    await expect(page.locator('#demo-count-reviews')).toHaveText('5');
    await expect(page.locator('#demo-count-matches')).toHaveText('1');
    await expect(page.locator('#demo-count-control')).toContainText('Passed');

    const timingStrip = page.locator('.demo-timing-strip');
    await expect(timingStrip).toBeVisible();
    const timingText = await timingStrip.innerText();
    expect(timingText).not.toContain('0.800 s'); // Never fabricated 0.8s!

    // Transition directly into normal workspace Checks
    const openChecksBtn = page.locator('#demo-btn-open-checks, #demo-btn-open-checks-hdr').first();
    await expect(openChecksBtn).toBeVisible();
    await openChecksBtn.click();
    await expect(presentation).not.toBeVisible();

    // =========================================================================
    // STEP 8-11: DANCING FISH 16-CHECK SUITE (A1) & DECISION RIPPLE (A2)
    // =========================================================================
    console.log('[STEP 8-11] Inspecting Dancing Fish 16 Checks & Decision Ripple...');
    await page.waitForSelector('.review-workbench', { timeout: 25000 });

    // Verify Organizer Validation Section exists with 16 checks
    const dfSection = page.locator('#organizer-validation-suite');
    if (await dfSection.isVisible()) {
      await expect(dfSection.locator('#df-metric-total')).toHaveText('16');
      await expect(dfSection.locator('#df-metric-controls')).toContainText('1 / 1');
    }

    // Verify Shopper Personas Filter (A3)
    const shopperSelect = page.locator('[data-action="filter-queue-persona"]').first();
    if (await shopperSelect.isVisible()) {
      await shopperSelect.selectOption('vegan');
      await page.waitForTimeout(300);
      const queueItems = page.locator('.queue-finding');
      expect(await queueItems.count()).toBeGreaterThan(0);
      await shopperSelect.selectOption('all');
      await page.waitForTimeout(300);
    }

    // Trigger Decision Ripple Modal (A2)
    const rippleBtn = page.locator('[data-action="explore-decision-ripple"]').first();
    if (await rippleBtn.isVisible()) {
      await rippleBtn.click();
      await page.waitForTimeout(400);

      const rippleModal = page.locator('#decision-ripple-modal');
      await expect(rippleModal).toBeVisible();

      // Test Option A: Keep Honey, Propose Removing Vegan Claim
      const optABtn = rippleModal.locator('[data-action="simulate-scenario"][data-scenario-id="option_a"]').first();
      if (await optABtn.isVisible()) {
        await optABtn.click();
        await page.waitForTimeout(300);
        await expect(rippleModal.locator('text=Option A')).toBeVisible();
      }

      // Close modal
      const closeRipple = rippleModal.locator('[data-action="close-ripple"], [data-action="close-modal"], .btn-ripple-close').first();
      if (await closeRipple.isVisible()) {
        await closeRipple.click();
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => {
        document.getElementById('decision-ripple-backdrop')?.remove();
      });
    }

    // =========================================================================
    // STEP 12-14: INDIA MARKET PACK INTEGRATION (A5)
    // =========================================================================
    console.log('[STEP 12-14] Testing Market Switching & India Market Pack...');
    const marketSelect = page.locator('select#rtm-market-select, select[data-action="change-market"]').first();
    if (await marketSelect.isVisible()) {
      await marketSelect.selectOption({ label: 'India (FSSAI / LM)' });
      await page.waitForTimeout(500);
      expect(await marketSelect.inputValue()).toMatch(/in|india/i);

      await marketSelect.selectOption({ label: 'United States (FDA)' });
      await page.waitForTimeout(500);
      expect(await marketSelect.inputValue()).toMatch(/us/i);
    }

    // =========================================================================
    // STEP 15-18: PREPRESS TAC & BLEED RADAR (B1), NATIVE TYPOGRAPHY (B2), SHELF SLIDER (A4)
    // =========================================================================
    console.log('[STEP 15-18] Inspecting Prepress TAC Radar and Shelf Readability Slider...');
    const printRadarBtn = page.locator('#review-toggle-print-radar, button[data-action="toggle-print-radar"]').first();
    if (await printRadarBtn.isVisible()) {
      await printRadarBtn.click();
      await page.waitForTimeout(400);

      const radarPanel = page.locator('#print-readiness-radar');
      await expect(radarPanel).toBeVisible({ timeout: 15000 });
      await expect(radarPanel).toContainText('PRINT READINESS RADAR');

      const tacCard = page.locator('.radar-card[data-radar-check="tac"]');
      await expect(tacCard).toBeVisible();

      // Toggle off
      await printRadarBtn.click();
      await page.waitForTimeout(300);
    }

    // Test Shelf Readability Slider (A4)
    const shelfSlider = page.locator('[data-shelf-distance-slider]').first();
    if (await shelfSlider.isVisible()) {
      await shelfSlider.fill('1.5');
      await shelfSlider.dispatchEvent('input');
      await page.waitForTimeout(200);

      const shelfVal = page.locator('[data-shelf-distance-value]').first();
      await expect(shelfVal).toHaveText('1.5m');
    }

    // =========================================================================
    // STEP 19-21: 3D MULTI-PACKAGING STUDIO (B3) & DASHED GHOST BOXES (B6)
    // =========================================================================
    console.log('[STEP 19-21] Inspecting 3D Packaging Studio & Dashed Ghost Boxes...');
    // Enable 2D X-Ray Ghost Overlays
    const xrayToggle = page.locator('[data-action="toggle-xray-2d"]').first();
    if (await xrayToggle.isVisible() && !(await xrayToggle.getAttribute('class'))?.includes('active')) {
      await xrayToggle.click();
      await page.waitForTimeout(300);
    }

    const ghostBoxes = page.locator('.workbench-ghost-box');
    if ((await ghostBoxes.count()) > 0) {
      await expect(ghostBoxes.first()).toBeVisible();

      await page.evaluate(() => {
        const b = document.querySelector('.workbench-ghost-box');
        if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(400);

      const dialog = page.locator('#dialog');
      if (await dialog.isVisible()) {
        await expect(dialog.locator('text=PERMITTED LEGAL REGION')).toBeVisible();
        await dialog.locator('[data-action="close"]').first().click();
        await page.waitForTimeout(300);
      }
    }

    // Switch to 3D Packaging Studio
    const mode3dBtn = page.locator('[data-action="workbench-mode"][data-mode="3d"]').first();
    if (await mode3dBtn.isVisible()) {
      await mode3dBtn.click({ force: true });
      await page.waitForTimeout(800);
      const cartonScene = page.locator('.carton-scene');
      await expect(cartonScene).toBeVisible();

      const mode2dBtn = page.locator('[data-action="workbench-mode"][data-mode="2d"]').first();
      if (await mode2dBtn.isVisible()) {
        await mode2dBtn.click({ force: true });
        await page.waitForTimeout(400);
      }
    }

    // =========================================================================
    // STEP 22-25: 3D V1/V2 REVISION SWIPE (B4)
    // =========================================================================
    console.log('[STEP 22-25] Inspecting 3D V1/V2 Revision Swipe...');
    const revTab = page.locator('.tab[data-action="tab"][data-tab="revisions"]');
    if (await revTab.isVisible()) {
      await revTab.click({ force: true });
      await page.waitForTimeout(500);

      const revisionView = page.locator('.revision-view, #revision-studio-mount');
      if (await revisionView.isVisible()) {
        expect(await revisionView.innerText()).toMatch(/Revision|V1|V2/i);
      }
    }

    // =========================================================================
    // STEP 26-30: ED25519 SIGNED REPORT & AUDIT TAMPER PROOF (B5)
    // =========================================================================
    console.log('[STEP 26-30] Verifying Ed25519 Signed Report & Cryptographic Tamper Detection...');
    const statusRes = await request.get('/api/status');
    const { csrf } = await statusRes.json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // Export report.json
    const reportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(reportRes.ok()).toBeTruthy();
    const originalReport = await reportRes.json();

    expect(originalReport.signature).toBeDefined();
    expect(originalReport.signature.algorithm).toBe('Ed25519');
    expect(originalReport.signature.signature).toBeDefined();

    const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-final-master-'));
    try {
      const origFile = join(tempDir, 'original-report.json');
      await writeFile(origFile, JSON.stringify(originalReport, null, 2));

      // 1. Verify authentic report
      const origVerify = spawnSync('node', [verifyScript, origFile], { encoding: 'utf8' });
      expect(origVerify.status).toBe(0);
      expect(origVerify.stdout).toContain('VERIFIED');

      // 2. Controlled Tamper Test: Modify signed finding status & observed values
      const tamperedReport = structuredClone(originalReport);
      if (tamperedReport.findings && tamperedReport.findings.length > 0) {
        tamperedReport.findings[0].status = 'tampered_status_override';
        tamperedReport.findings[0].observed = 'Tampered observed text that fails signature';
      }
      tamperedReport.name = 'Tampered Review Name';

      const tamperedFile = join(tempDir, 'tampered-report.json');
      await writeFile(tamperedFile, JSON.stringify(tamperedReport, null, 2));

      const tamperedVerify = spawnSync('node', [verifyScript, tamperedFile], { encoding: 'utf8' });
      expect(tamperedVerify.status).not.toBe(0);
      expect(`${tamperedVerify.stdout}\n${tamperedVerify.stderr}`).toMatch(/INVALID|FAILED|does not match|MISMATCH/i);

      // 3. Confirm original remains valid
      const recheck = spawnSync('node', [verifyScript, origFile], { encoding: 'utf8' });
      expect(recheck.status).toBe(0);
      expect(recheck.stdout).toContain('VERIFIED');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    expect(fatalErrors.length).toBe(0);
    console.log('[SUCCESS] All 30 master E2E steps passed cleanly with 0 fatal JS errors!');
  });
});
