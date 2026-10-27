/**
 * PackSignal End-to-End Ambiguity Resolution Studio Browser Test
 * (scripts/ambiguity-browser-e2e.mjs)
 * Executes the complete 17-step Judge Demonstration in a real headless Chrome browser.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');

const PORT = 4175;
const base = `http://127.0.0.1:${PORT}`;

console.log(`[Ambiguity E2E] Spawning test server on port ${PORT}...`);
const serverProcess = spawn('node', ['server.mjs'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

serverProcess.stderr.on('data', d => {
  const msg = d.toString();
  if (!msg.includes('ExperimentalWarning')) {
    console.error('[Server Error]', msg);
  }
});

let serverStarted = false;
serverProcess.stdout.on('data', d => {
  const msg = d.toString();
  if (msg.includes('PackSignal listening') || msg.includes('http://')) {
    serverStarted = true;
  }
});

// Wait up to 5s for server to start
for (let i = 0; i < 25; i++) {
  if (serverStarted) break;
  await new Promise(r => setTimeout(r, 200));
}

let browser = null;

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.setDefaultTimeout(15000);

  const errors = [];
  page.on('pageerror', err => { console.error('PAGE ERROR:', err); errors.push(err.message); });
  page.on('response', res => { if (res.status() >= 400) console.log('HTTP RESP ERROR:', res.status(), res.url()); });

  // 1. Get status & CSRF token
  const statusRes = await page.request.get(`${base}/api/status`);
  const statusData = await statusRes.json();
  const csrf = statusData.csrf;

  // 2. Create review with organizer sample (contains multi-nutrition spreadsheet)
  console.log('[E2E Step 1] Creating organizer review with spreadsheet...');
  const createRes = await page.request.post(`${base}/api/reviews`, {
    headers: { 'x-packproof-token': csrf },
    data: { sample: 'organizer', mode: 'local' },
  });
  assert.ok(createRes.ok(), 'Failed to create review');
  const reviewMeta = await createRes.json();
  const reviewId = reviewMeta.id;
  console.log(`[E2E Step 1 Complete] Review ID: ${reviewId}`);

  // 3. Poll for review readiness
  let review = null;
  for (let i = 0; i < 40; i++) {
    const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
    if (poll.status === 'ready') {
      review = poll;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(review, 'Review processing did not complete');
  console.log('[E2E Step 2 Complete] Review ready with facts and findings');

  // 4. Navigate to review in browser
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-heading').waitFor();

  // 5. Verify the Source Questions summary pill on dashboard
  console.log('[E2E Step 3] Checking Source Questions dashboard summary badge...');
  const questionsBtn = page.locator('button[data-action="tab"][data-tab="ambiguity"]').first();
  await questionsBtn.waitFor({ state: 'visible' });
  const summaryText = await questionsBtn.innerText();
  console.log(`[E2E Step 3 Summary Badge] "${summaryText}"`);
  assert.ok(summaryText.includes('Resolve Ambiguity') || summaryText.includes('Resolve Questions'), 'Dashboard badge must display Resolve Ambiguity / Questions');

  // 6. Click to open RESOLVE SOURCE AMBIGUITY tab
  console.log('[E2E Step 4] Opening "Resolve Source Ambiguity" studio tab...');
  await questionsBtn.click();
  await page.locator('[data-ambiguity-studio]').waitFor({ state: 'visible' });
  console.log('[E2E Step 4 Complete] Ambiguity Studio workspace loaded');

  // 7. Inspect the question queue (Left column)
  const queueItems = page.locator('.ambiguity-item');
  const count = await queueItems.count();
  console.log(`[E2E Step 5] Queue items detected: ${count}`);
  assert.ok(count >= 1, 'At least one ambiguity question must be present');

  // 8. Inspect the first question (Nutrition Basis)
  const detailTitle = await page.locator('h3').first().innerText();
  console.log(`[E2E Step 6 Question Title] ${detailTitle}`);
  assert.ok(detailTitle.length > 0, 'Question title must be present');

  // 9. Inspect Candidate cards (Center column)
  const candidateCards = page.locator('.candidate-card');
  const candCount = await candidateCards.count();
  console.log(`[E2E Step 7] Candidate cards found: ${candCount}`);
  assert.ok(candCount >= 2, 'Candidate comparison must show at least 2 source options');

  // 10. Inspect Affected vs Unaffected Checks (Right column)
  const rightColumn = await page.locator('#ambiguity-impact-preview-container').locator('..').innerText();
  console.log('[E2E Step 8 Affected Checks Panel Content]:');
  console.log(rightColumn.slice(0, 300) + '...');
  assert.ok(rightColumn.includes('Checks Blocked / Affected') || rightColumn.includes('AFFECTED'), 'Must list affected checks');
  assert.ok(rightColumn.includes('Checks Unaffected') || rightColumn.includes('Barcode'), 'Must list unaffected checks');

  // 11. Select candidate option (e.g. Column B)
  console.log('[E2E Step 9] Selecting candidate option...');
  const selectCandBtn = page.locator('button[data-action="choose-candidate"]').first();
  await selectCandBtn.click();

  // 12. Fill in reviewer rationale
  console.log('[E2E Step 10] Entering reviewer rationale...');
  const rationaleInput = page.locator('#ambiguity-rationale');
  await rationaleInput.fill('Verified against Master Formulation DF-US-001 Section 4 approval register.');

  // 13. Click [Preview Impact]
  console.log('[E2E Step 11] Clicking [🔬 Preview Impact]...');
  const previewBtn = page.locator('button[data-action="preview-ambiguity-impact"]');
  await previewBtn.click();
  await page.waitForTimeout(500);

  const previewContent = await page.locator('#ambiguity-impact-preview-container').innerText();
  console.log('[E2E Step 11 Impact Preview Content]:\n', previewContent);
  assert.ok(previewContent.includes('Dry-Run') || previewContent.includes('Scheduled for Reevaluation') || previewContent.includes('Preserved Unaltered'), 'Must display dry run impact preview');

  // 14. Click [Confirm Resolution]
  console.log('[E2E Step 12] Clicking [✓ Confirm Resolution]...');
  const confirmBtn = page.locator('button[data-action="confirm-ambiguity-resolution"]');
  await confirmBtn.click();
  await page.waitForTimeout(1000);

  // 15. Verify Before / After Impact Summary Banner
  const studioText = await page.locator('[data-ambiguity-studio]').innerText();
  console.log('[E2E Step 13 Impact Banner Verification]');
  assert.ok(studioText.includes('Source Ambiguity Resolved') || studioText.includes('Approved Reference') || studioText.includes('RESOLVED'), 'Impact must confirm resolution');

  // 16. Verify question status changed to RESOLVED
  assert.ok(studioText.includes('RESOLVED'), 'Status badge must display RESOLVED');
  console.log('[E2E Step 14] Question marked as RESOLVED');

  // 17. Verify report export integration contains "SOURCE AMBIGUITY & FACT RESOLUTION QUEUE"
  console.log('[E2E Step 15] Verifying signed HTML report export integration...');
  const reportRes = await page.request.get(`${base}/api/reviews/${reviewId}/report.html`);
  assert.ok(reportRes.ok(), 'Failed to retrieve HTML report');
  const reportHtml = await reportRes.text();
  assert.ok(reportHtml.toLowerCase().includes('source ambiguity'), 'HTML report must include Ambiguity Resolution Queue section');
  assert.ok(reportHtml.includes('Verified against Master Formulation'), 'HTML report must contain recorded reviewer rationale');

  console.log('\n========================================================================');
  console.log('✅ ALL BROWSER E2E AMBIGUITY RESOLUTION CHECKS PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
} finally {
  if (browser) await browser.close();
  serverProcess.kill('SIGTERM');
}
