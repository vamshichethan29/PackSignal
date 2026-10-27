import { test, expect } from '@playwright/test';
import { join } from 'node:path';

test.describe('E2E: Native Vector Font & Typography Inspector (Upgrade #47)', () => {
  test('Complete Native PDF Typography Inspector workflow: font resources, nominal pt vs glyph mm, FDA 101.2/101.105, side-by-side proof, and calculations', async ({ page }) => {
    const fatalErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Content Security Policy') && !text.includes('CSP') && !text.includes('404')) {
          fatalErrors.push(text);
        }
      }
    });

    test.setTimeout(120000);

    // 1. Open PackSignal
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 2. Open an existing completed review
    await page.waitForSelector('table tr:has-text("issues")', { timeout: 15000 });
    const readyRowBtn = page.locator('table tr:has-text("issues")').first().locator('button:has-text("Open →"), button[data-action="open-review"]');
    await readyRowBtn.click();

    await page.waitForSelector('.review-heading', { timeout: 30000 });
    await expect(page.locator('.review-heading')).toBeVisible();

    // 3. Open Print Readiness Radar
    const radarBtn = page.locator('#review-toggle-print-radar, button[data-action="toggle-print-radar"]').first();
    if (await radarBtn.isVisible()) {
      await radarBtn.click();
    }

    await page.waitForSelector('#print-readiness-radar', { timeout: 15000 });
    const radarPanel = page.locator('#print-readiness-radar');
    await expect(radarPanel).toBeVisible();

    // 4. Verify Native Typography card in the radar grid
    const typoCard = page.locator('.radar-card[data-radar-check="typography"]');
    await expect(typoCard).toBeVisible();
    await expect(typoCard).toContainText('Native Typography');
    await expect(typoCard).toContainText('Nominal size');
    await expect(typoCard).toContainText('Required minimum');
    await expect(typoCard).toContainText('21 CFR 101.105(h)');

    // 5. Open Native Typography Inspector via toolbar button
    const typoBtn = page.locator('#btn-inspect-typography-radar');
    await expect(typoBtn).toBeVisible();
    await typoBtn.click();

    // 6. Verify Typography Inspector Modal is displayed
    await page.waitForSelector('#typography-inspector-modal', { state: 'visible', timeout: 10000 });
    const typoModal = page.locator('#typography-inspector-modal');
    await expect(typoModal).toBeVisible();
    await expect(typoModal).toContainText('NATIVE PDF TYPOGRAPHY INSPECTOR');

    // Capture visual artifact of typography inspector
    const artifactDir = '/Users/vamshi/.gemini/antigravity-ide/brain/c667b068-fbda-4614-a813-a01db8c15247';
    await page.screenshot({ path: join(artifactDir, 'typography_inspector_modal.png'), fullPage: false });

    // 7. Verify Side-by-Side Proof (Phase 15 centerpiece)
    await expect(typoModal).toContainText('SIDE-BY-SIDE STATUTORY FONT PROOF');
    await expect(typoModal).toContainText('NOMINAL FONT SIZE');
    await expect(typoModal).toContainText('ACTUAL PRINTED LOWERCASE HEIGHT');
    await expect(typoModal).toContainText('Point size is the nominal font size. FDA checks the relevant printed letter height.');

    // 8. Verify Font Resource and Legal sections
    await expect(typoModal).toContainText('Font Resource Details');
    await expect(typoModal).toContainText('Physical Glyph Measurements');
    await expect(typoModal).toContainText('Legal Requirements');

    // 9. Verify Action Buttons
    const highlightBtn = page.locator('#btn-typo-highlight');
    const calcBtn = page.locator('#btn-typo-calc');
    const regBtn = page.locator('#btn-typo-regulation');
    const askBtn = page.locator('#btn-typo-ask-prepress');

    await expect(highlightBtn).toBeVisible();
    await expect(calcBtn).toBeVisible();
    await expect(regBtn).toBeVisible();
    await expect(askBtn).toBeVisible();

    // 10. Click View Calculation and verify calculation steps expand
    await calcBtn.click();
    const calcBox = page.locator('#typo-calc-proof-box');
    await expect(calcBox).toBeVisible();
    await expect(calcBox).toContainText('Detailed Calculation Steps');

    await page.screenshot({ path: join(artifactDir, 'typography_calculation_proof.png'), fullPage: false });

    // 11. Close Modal via Close button
    const doneBtn = page.locator('#btn-typo-done');
    await doneBtn.click();
    await expect(typoModal).not.toBeVisible();

    // 12. Also test opening via card button [Inspect Native Typography]
    const cardInspectBtn = page.locator('#btn-card-typo-inspect');
    await expect(cardInspectBtn).toBeVisible();
    await cardInspectBtn.click();
    await expect(typoModal).toBeVisible();

    // Close via (X)
    const closeX = page.locator('#btn-close-typo-inspector');
    await closeX.click();
    await expect(typoModal).not.toBeVisible();

    // Verify no fatal console errors occurred
    expect(fatalErrors).toHaveLength(0);
  });
});
