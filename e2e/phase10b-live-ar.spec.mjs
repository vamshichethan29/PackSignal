/**
 * PackSignal — Phase 10B Live AR E2E Specification
 * 
 * Tests:
 * 1. Desktop hero entry points ([LIVE AR ON REAL BOX] & [AR QR CODE]).
 * 2. High-resolution AR QR Code dialog with direct reachable link.
 * 3. Mobile WebAR interface (/ar-review.html) in iPhone 14 viewport.
 * 4. Zero runtime AI calls (assert 0 AI endpoint requests during AR).
 * 5. Multi-panel physical tracking & rotation switching (Front -> Right -> Back -> Left).
 * 6. Interactive finding hotspots opening source-backed evidence drawer.
 * 7. Clean vs. Marked packaging toggle.
 * 8. Manual 4-corner alignment fallback.
 * 9. Multi-market switching (US FDA <-> India FSSAI).
 * 10. Competitor Snap stretch modal.
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 10B — Live AR on Real Box E2E Sequence', () => {

  test('Complete Live AR Flow: Desktop QR -> Mobile AR -> Hotspot Drawer -> Panel Switching -> Zero AI', async ({ page }) => {
    // Collect all network requests to verify ZERO AI calls during AR
    const interceptedRequests = [];
    page.on('request', req => {
      interceptedRequests.push(req.url());
    });

    // 1. Visit Desktop Home & verify AR entry buttons
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const liveArBtn = page.locator('#hero-live-ar');
    const arQrBtn = page.locator('#hero-ar-qr-btn');

    await expect(liveArBtn).toBeVisible({ timeout: 10000 });
    await expect(arQrBtn).toBeVisible();

    // 2. Click [AR QR CODE] on desktop & verify modal dialog
    await arQrBtn.click();
    const qrDialog = page.locator('dialog[open]');
    await expect(qrDialog).toBeVisible({ timeout: 5000 });
    await expect(qrDialog).toContainText('LIVE AR ON REAL CARTON');
    await expect(qrDialog).toContainText('140 × 210 × 60 mm');
    await expect(qrDialog.locator('svg')).toBeVisible(); // QR SVG
    await expect(qrDialog.locator('a[href*="/ar-review.html"]').first()).toBeVisible();

    // Close QR dialog
    await page.locator('dialog[open] button[data-action="close"]').first().click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    // 3. Switch to Mobile Viewport (iPhone 14) and load /ar-review.html
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar-review.html', { waitUntil: 'domcontentloaded' });

    // Verify HUD elements
    const trackingLabel = page.locator('#ar-tracking-label');
    const perfPill = page.locator('#ar-perf-pill');
    const reticleGuide = page.locator('#ar-reticle-guide');
    const overlaySvg = page.locator('#ar-annotation-layer');

    await expect(trackingLabel).toBeVisible({ timeout: 10000 });
    await expect(trackingLabel).toContainText('TRACKING LOCKED');
    await expect(perfPill).toContainText('0ms AI Latency');
    await expect(reticleGuide).toBeVisible();
    await expect(overlaySvg).toBeVisible();

    // 4. Verify Front PDP Annotations (Honey claim issue & missing net quantity ghost box)
    await page.waitForTimeout(600); // Allow SVG overlay fetch
    const frontMarkup = await overlaySvg.innerHTML();
    expect(frontMarkup).toContain('f-honey-claim');
    expect(frontMarkup).toContain('f-missing-net-fl-oz');
    expect(frontMarkup).toContain('Proposed placement / missing item');

    // 5. Click finding hotspot to open evidence drawer
    const honeyHotspot = page.locator('[data-finding-id="f-honey-claim"]').first();
    await expect(honeyHotspot).toBeVisible();
    await honeyHotspot.click({ force: true });

    // Verify Finding Evidence Drawer
    const drawer = page.locator('#ar-finding-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#drawer-finding-title')).toContainText('Honey Prominence');
    await expect(page.locator('#drawer-observed-text')).toContainText('Dancing Fish Honey Berry Crunch');
    await expect(page.locator('#drawer-rule-id')).toContainText('US_FDA_21CFR102_5');
    await expect(page.locator('#drawer-department')).toContainText('Legal & Regulatory');

    // Close drawer
    await page.locator('#drawer-close-btn').click();
    await expect(drawer).not.toBeVisible();

    // 6. Test Panel Switching (Simulating Rotating the Box)
    // Switch to Right (Nutrition Facts)
    await page.locator('button[data-face="right"]').click();
    await page.waitForTimeout(400);
    const rightMarkup = await overlaySvg.innerHTML();
    expect(rightMarkup).toContain('f-nutrition-facts-sugar');
    expect(rightMarkup).not.toContain('f-honey-claim'); // Front markups must disappear

    // Switch to Back (Info & Storage)
    await page.locator('button[data-face="back"]').click();
    await page.waitForTimeout(400);
    const backMarkup = await overlaySvg.innerHTML();
    expect(backMarkup).toContain('f-cooling-storage');
    expect(backMarkup).toContain('f-allergen-contains-wheat');

    // Switch to Left (Address)
    await page.locator('button[data-face="left"]').click();
    await page.waitForTimeout(400);
    const leftMarkup = await overlaySvg.innerHTML();
    expect(leftMarkup).toContain('f-manufacturer-address');

    // Return to Front PDP
    await page.locator('button[data-face="front"]').click();
    await page.waitForTimeout(400);

    // 7. Toggle Clean Box vs Marked
    const toggleBtn = page.locator('#toggle-redpen-btn');
    await toggleBtn.click();
    await expect(page.locator('#ar-toast')).toContainText('Clean Box View');
    const cleanMarkup = await overlaySvg.innerHTML();
    expect(cleanMarkup.trim()).toBe(''); // Overlay cleared

    // Re-enable annotations
    await toggleBtn.click();
    await expect(page.locator('#ar-toast')).toContainText('Live AR Red Pen Active');
    const restoredMarkup = await overlaySvg.innerHTML();
    expect(restoredMarkup).toContain('f-honey-claim');

    // 8. Manual Alignment Fallback Overlay
    const manualAlignBtn = page.locator('#manual-align-btn');
    await manualAlignBtn.click();
    const manualOverlay = page.locator('#ar-manual-align-overlay');
    await expect(manualOverlay).toBeVisible();
    await expect(page.locator('#handle-tl')).toBeVisible();

    // Toggle off manual alignment
    await manualAlignBtn.click();
    await expect(manualOverlay).not.toBeVisible();

    // 9. Multi-Market Switcher (US <-> India)
    const marketBtn = page.locator('#market-toggle-btn');
    await marketBtn.click();
    await expect(marketBtn).toContainText('India FSSAI');
    await page.waitForTimeout(400);
    const indiaMarkup = await overlaySvg.innerHTML();
    expect(indiaMarkup).toContain('f-fssai-veg-logo');

    // Toggle back to US
    await marketBtn.click();
    await expect(marketBtn).toContainText('US FDA');

    // 10. Competitor Snap Stretch Feature Modal
    const snapBtn = page.locator('#snap-competitor-btn');
    await snapBtn.click();
    const compModal = page.locator('#competitor-modal');
    await expect(compModal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#competitor-modal-content')).toContainText('claims');
    await page.locator('#close-competitor-modal-btn').click();
    await expect(compModal).not.toBeVisible();

    // 11. CRITICAL ASSERTION: ZERO AI CALLS during the entire AR execution
    const forbiddenAiCalls = interceptedRequests.filter(url => 
      /generativelanguage\.googleapis\.com|api\.openai\.com|anthropic|bedrock/i.test(url)
    );
    expect(forbiddenAiCalls.length).toBe(0);
  });

});
