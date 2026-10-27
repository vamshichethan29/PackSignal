import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifactsDir = '/Users/vamshi/.gemini/antigravity-ide/brain/c667b068-fbda-4614-a813-a01db8c15247';
await mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

console.log('Navigating directly to review hash URL...');
await page.goto('http://127.0.0.1:4173/#review/dd1d8e27-3c44-4d97-a99c-c7980b66e666');

await page.waitForSelector('.review-heading', { timeout: 30000 });
const findingsTab = page.locator('.tab[data-action="tab"][data-tab="findings"], button:has-text("Review Overview")').first();
if (await findingsTab.isVisible().catch(() => false)) {
  await findingsTab.click({ force: true });
}

await page.waitForSelector('#shelf-readability-workbench', { timeout: 15000 });
const panel = page.locator('#shelf-readability-workbench');
await panel.scrollIntoViewIfNeeded();

// 1. Screenshot 100 cm (default)
await page.screenshot({ path: resolve(artifactsDir, 'shelf_readability_100cm.png'), fullPage: false });
console.log('Captured 100cm screenshot');

// 2. Set to 30 cm
await page.locator('button[data-distance-preset="30"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(artifactsDir, 'shelf_readability_30cm.png'), fullPage: false });
console.log('Captured 30cm screenshot');

// 3. Set to 200 cm
await page.locator('button[data-distance-preset="200"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(artifactsDir, 'shelf_readability_200cm.png'), fullPage: false });
console.log('Captured 200cm screenshot');

// 4. Open Modal
const inspectBtn = page.locator('button[data-inspect-region="net_quantity"], button.btn-inspect-shelf').first();
await inspectBtn.click();
await page.waitForSelector('#shelf-inspect-modal', { timeout: 5000 });
await page.screenshot({ path: resolve(artifactsDir, 'shelf_readability_inspection_modal.png'), fullPage: false });
console.log('Captured modal screenshot');

await browser.close();
console.log('All screenshots captured successfully!');
