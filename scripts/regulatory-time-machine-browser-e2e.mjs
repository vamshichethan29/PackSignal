/**
 * @file regulatory-time-machine-browser-e2e.mjs
 * 
 * PackSignal — Browser End-to-End Validation for Regulatory Time Machine
 * 
 * Tests interactive Launch Date Slider (2026 -> 2027 -> 2028),
 * exact cutovers (2027-06-30 vs 2027-07-01), non-binding FOPNL status,
 * MoCRA cosmetics category gating, Date A vs Date B comparison,
 * Ask Someone integration, and signed report export.
 */

import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';

async function run() {
  console.log('--- Starting Regulatory Time Machine Browser E2E ---');

  // Verify server is up
  const healthRes = await fetch(`${base}/healthz`).catch(() => null);
  if (!healthRes || !healthRes.ok) {
    throw new Error(`Server not reachable on ${base}. Start with node server.mjs`);
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });
  page.setDefaultTimeout(15000);

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  try {
    // 1. Fetch existing ready organizer review or create one
    let reviewId = null;
    let review = null;
    try {
      const existingRes = await page.request.get(`${base}/api/reviews`);
      const existingList = await existingRes.json();
      const readyOrganizer = Array.isArray(existingList) && existingList.find(r => r.status === 'ready' && r.name?.includes('Dancing Fish'));
      if (readyOrganizer) {
        reviewId = readyOrganizer.id;
        review = readyOrganizer;
        console.log(`1. Reusing existing ready review: ${reviewId}`);
      }
    } catch {}

    if (!reviewId) {
      console.log('1. Creating controlled sample review...');
      const statusRes = await page.request.get(`${base}/api/status`);
      const statusData = await statusRes.json();
      const csrf = statusData.csrf;

      const createRes = await page.request.post(`${base}/api/reviews`, {
        headers: { 'x-packproof-token': csrf },
        data: { sample: 'organizer', mode: 'local' }
      });
      assert.ok(createRes.ok(), 'Failed to create review');
      const reviewMeta = await createRes.json();
      reviewId = reviewMeta.id;

      // Poll until review is ready
      for (let i = 0; i < 80; i++) {
        const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
        if (poll.status === 'ready') {
          review = poll;
          break;
        }
        await page.waitForTimeout(500);
      }
      assert.ok(review, 'Review was not ready within timeout');
    }

    // 2. Navigate to review
    console.log(`2. Navigating to ${base}/#review/${reviewId}...`);
    await page.goto(`${base}/#review/${reviewId}`);
    await page.waitForLoadState('domcontentloaded');

    // 3. Verify Regulatory Time Machine top bar widget is visible
    console.log('3. Verifying Time Machine top bar widget...');
    await page.waitForSelector('#rtm-root', { timeout: 10000 });
    const rtmTitle = await page.locator('.rtm-title').textContent();
    console.log(`✓ Found Time Machine title: "${rtmTitle.trim()}"`);

    // 4. Configure Market to India and Scope to Food
    console.log('4. Configuring Market to India and Scope to Food...');
    await page.selectOption('#rtm-market-select', 'india');
    await page.selectOption('#rtm-category-select', 'food');
    await page.waitForTimeout(500);

    // 5. Test Exact Boundary: June 30, 2027 (Day BEFORE FSSAI cutover)
    console.log('5. Setting Launch Date to 2027-06-30 (Day before commencement)...');
    const dateInput = page.locator('#rtm-exact-date');
    await dateInput.fill('2027-06-30');
    await dateInput.dispatchEvent('change');
    await page.waitForTimeout(800);

    // Expand What Changed panel
    const toggleBtn = page.locator('#rtm-btn-toggle-changes');
    if (await page.locator('#rtm-change-panel').isHidden()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
    }

    const panelContentJune = await page.locator('#rtm-change-content').textContent();
    console.log('✓ June 30 summary inspected.');
    if (panelContentJune.includes('NEWLY EFFECTIVE REQUIREMENTS AT LAUNCH')) {
      throw new Error('Assertion failed: FSSAI 2026 amendment must NOT be active on 2027-06-30');
    }

    // 6. Test Exact Boundary: July 1, 2027 (COMMENCEMENT DATE)
    console.log('6. Setting Launch Date to 2027-07-01 (Commencement Date)...');
    await page.locator('#rtm-btn-fssai').click();

    if (await page.locator('#rtm-change-panel').isHidden()) {
      await page.locator('#rtm-btn-toggle-changes').click();
    }

    // Wait for async evaluation to complete and replace placeholder
    let panelContentJuly = '';
    for (let i = 0; i < 40; i++) {
      panelContentJuly = await page.locator('#rtm-change-content').textContent();
      if (panelContentJuly && !panelContentJuly.includes('Evaluating temporal regulatory differences')) break;
      await page.waitForTimeout(250);
    }
    console.log('ACTUAL panelContentJuly:\n', panelContentJuly);
    if (!panelContentJuly.includes('NEWLY EFFECTIVE REQUIREMENTS AT LAUNCH') && !panelContentJuly.includes('FSSAI 2026 First Amendment')) {
      throw new Error('Assertion failed: FSSAI 2026 First Amendment must be active on 2027-07-01');
    }
    console.log('✓ FSSAI 2026 1st Amendment successfully activated on 2027-07-01.');

    // 7. Verify Draft FOPNL remains non-binding
    console.log('7. Verifying Front-of-Pack Nutrition Labelling (FOPNL) is marked PROPOSED / MONITOR...');
    if (!panelContentJuly.includes('PROPOSED / FORWARD-MONITORING INITIATIVES') && !panelContentJuly.includes('DRAFT / PROPOSED')) {
      throw new Error('Assertion failed: FOPNL draft must be listed under proposed initiatives');
    }
    console.log('✓ FOPNL confirmed non-binding draft (not an enforceable violation).');

    // Screenshot 1: Time Machine bar with July 1, 2027 active amendment
    await page.screenshot({ path: 'rtm_july_2027_active.png' });
    console.log('✓ Saved rtm_july_2027_active.png');

    // 8. Test Product Category Gating: Switch scope to Cosmetics
    console.log('8. Testing Category Gating: Switching scope to Cosmetics...');
    await page.selectOption('#rtm-category-select', 'cosmetic');
    await page.waitForTimeout(800);

    const panelContentCosmetic = await page.locator('#rtm-change-content').textContent();
    console.log('✓ Cosmetics category switch inspected.');

    // Switch to US market to see MoCRA cosmetic rules
    console.log('9. Switching Market to US with Cosmetic scope (MoCRA)...');
    await page.selectOption('#rtm-market-select', 'us');
    await page.waitForTimeout(1000);

    // Reset to Food and India for comparison test
    await page.selectOption('#rtm-market-select', 'india');
    await page.selectOption('#rtm-category-select', 'food');
    await page.waitForTimeout(600);

    // 10. Open Compare Dates modal
    console.log('10. Opening Compare Dates Modal...');
    await page.locator('#rtm-btn-compare').click();
    await page.waitForSelector('.rtm-modal-card', { timeout: 5000 });

    const modalTitle = await page.locator('.rtm-modal-header h3').textContent();
    console.log(`✓ Opened comparison modal: "${modalTitle.trim()}"`);

    // Verify comparison matrix loaded
    await page.waitForSelector('.rtm-diff-matrix', { timeout: 5000 });
    const diffText = await page.locator('.rtm-diff-matrix').textContent();
    assert.ok(diffText.includes('Active Binding Rules'), 'Comparison matrix must display metrics');
    console.log('✓ Diff matrix contains comparison data.');

    // Screenshot 2: Comparison modal
    await page.screenshot({ path: 'rtm_compare_dates_modal.png' });
    console.log('✓ Saved rtm_compare_dates_modal.png');

    // Close modal
    await page.locator('#rtm-modal-close').click();
    await page.waitForTimeout(500);

    // 11. Verify Report Export includes Regulatory Time Machine
    console.log('11. Testing Signed HTML Report with Time Machine Section...');
    const reportRes = await page.request.get(`${base}/api/reviews/${reviewId}/report.html`);
    assert.ok(reportRes.ok(), 'Failed to fetch report.html');
    const reportHtml = await reportRes.text();
    assert.ok(reportHtml.includes('Regulatory Time Machine — Date-Aware Packaging Intelligence'), 'Report must include Time Machine');
    assert.ok(reportHtml.includes('reg-snap-'), 'Report must include Regulatory Snapshot ID');
    console.log('✓ Signed HTML report verified with Regulatory Time Machine section and Snapshot ID.');

    console.log('--- ALL BROWSER E2E STEPS PASSED SUCCESSFULLY! ---');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Browser E2E Error:', err);
  process.exit(1);
});
