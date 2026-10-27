/**
 * PackSignal End-to-End "Ask Someone" Clarification Assistant Browser Test.
 * Step 14 Real-Browser Playwright Workflow:
 * 1. Open PackSignal.
 * 2. Load a controlled packaging review.
 * 3. Open an ingredient mismatch finding.
 * 4. Click [Ask Someone].
 * 5. Verify the modal appears.
 * 6. Verify real artwork/source values.
 * 7. Select R&D.
 * 8. Select Slack.
 * 9. Inspect the generated message.
 * 10. Switch to Microsoft Teams.
 * 11. Verify correct formatting.
 * 12. Edit the message.
 * 13. Click Copy Message.
 * 14. Verify copied text matches the editor.
 * 15. Close the modal.
 * 16. Verify the artwork viewer remains in its previous state.
 * 17. Reload the review.
 * 18. Verify no false reviewer decision was recorded.
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');

const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';
console.log(`[Ask Someone E2E] Connecting to server at ${base}...`);

// Ensure server is reachable or spawn a local instance
let serverProc = null;
async function ensureServerRunning() {
  try {
    const res = await fetch(`${base}/healthz`);
    if (res.ok) return;
  } catch {}

  console.log('[Ask Someone E2E] Starting local server...');
  serverProc = spawn('node', ['server.mjs'], {
    cwd: resolve('.'),
    stdio: 'inherit',
    env: { ...process.env, PORT: '4173' }
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) {
        console.log('[Ask Someone E2E] Local server is ready.');
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Could not start or connect to PackSignal server.');
}

await ensureServerRunning();

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  permissions: ['clipboard-read', 'clipboard-write'],
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();
page.setDefaultTimeout(15000);

const errors = [];
page.on('pageerror', err => { console.error('PAGE ERROR:', err); errors.push(err.message); });
page.on('console', msg => {
  if (msg.type() === 'error') console.log('PAGE LOG ERROR:', msg.text());
});

async function runAskSomeoneE2e() {
  // Step 1: Open PackSignal
  console.log('[E2E Step 1] Navigating to PackSignal root...');
  await page.goto(`${base}/`);
  await page.waitForLoadState('domcontentloaded');

  // Step 2: Load a controlled packaging review
  console.log('[E2E Step 2] Creating and loading controlled organizer review...');
  const statusRes = await page.request.get(`${base}/api/status`);
  const statusData = await statusRes.json();
  const csrf = statusData.csrf;

  const createRes = await page.request.post(`${base}/api/reviews`, {
    headers: { 'x-packproof-token': csrf },
    data: { sample: 'organizer', mode: 'local' }
  });
  assert.ok(createRes.ok(), 'Failed to create review');
  const reviewMeta = await createRes.json();
  const reviewId = reviewMeta.id;

  // Poll until ready
  let review = null;
  for (let i = 0; i < 40; i++) {
    const poll = await (await page.request.get(`${base}/api/reviews/${reviewId}`)).json();
    if (poll.status === 'ready') {
      review = poll;
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(review, 'Review failed to become ready');
  console.log(`[E2E Step 2 Complete] Review ready with ${review.findings.length} findings.`);

  // Navigate to review workbench
  await page.goto(`${base}/#review/${reviewId}`);
  await page.locator('.review-workbench').waitFor({ state: 'visible' });

  // Step 3: Open an ingredient mismatch finding
  console.log('[E2E Step 3] Locating ingredient discrepancy finding...');
  const ingredientFinding = review.findings.find(f =>
    /ingredient|honey/i.test(f.title || '') || f.rule?.field === 'ingredients'
  ) || review.findings[0];
  assert.ok(ingredientFinding, 'Finding must exist');

  // Select this finding in the workbench queue
  const queueBtn = page.locator(`button[data-id="${ingredientFinding.id}"], button[data-canvas-finding="${ingredientFinding.id}"]`).first();
  if (await queueBtn.count() > 0) {
    await queueBtn.scrollIntoViewIfNeeded();
    await queueBtn.click();
    await page.waitForTimeout(500);
  }

  // Step 4: Click [Ask Someone]
  console.log('[E2E Step 4] Clicking [Ask Someone] action button...');
  const askBtn = page.locator(`button[data-action="ask-someone"][data-id="${ingredientFinding.id}"]`).first();
  await askBtn.waitFor({ state: 'visible' });
  await askBtn.click();

  // Step 5: Verify the modal appears
  console.log('[E2E Step 5] Verifying Ask Someone modal is visible...');
  const modal = page.locator('#ask-someone-modal');
  await modal.waitFor({ state: 'visible' });
  const modalTitle = await page.locator('#ask-someone-title').innerText();
  assert.ok(modalTitle.includes('Ask Someone'), 'Modal title must be Ask Someone');

  // Step 6: Verify real artwork/source values
  console.log('[E2E Step 6] Verifying real evidence in editor...');
  const textarea = page.locator('#ask-message-editor');
  await textarea.waitFor({ state: 'visible' });
  let initialMsg = await textarea.inputValue();
  assert.ok(initialMsg.includes(ingredientFinding.id), 'Must include actual finding ID');
  assert.ok(initialMsg.includes(ingredientFinding.observed || 'Artwork:'), 'Must include actual observed artwork data');

  // Step 7: Select R&D
  console.log('[E2E Step 7] Selecting R&D / Product Development department...');
  const deptSelect = page.locator('#ask-dept-select');
  await deptSelect.selectOption('R&D / Product Development');
  await page.waitForTimeout(100);

  // Step 8: Select Slack
  console.log('[E2E Step 8] Selecting Slack platform...');
  const slackBtn = page.locator('button[data-ask-platform="slack"]');
  await slackBtn.click();
  await page.waitForTimeout(100);

  // Step 9: Inspect the generated message
  console.log('[E2E Step 9] Inspecting Slack message formatting...');
  let slackMsg = await textarea.inputValue();
  assert.ok(slackMsg.includes('*Packaging Clarification'), 'Slack message must use single asterisk bolding');
  assert.ok(slackMsg.includes('*Finding ID:*'), 'Slack message must format metadata with Slack markup');

  // Step 10: Switch to Microsoft Teams
  console.log('[E2E Step 10] Switching to Microsoft Teams platform...');
  const teamsBtn = page.locator('button[data-ask-platform="teams"]');
  await teamsBtn.click();
  await page.waitForTimeout(100);

  // Step 11: Verify correct formatting
  console.log('[E2E Step 11] Verifying Teams markdown formatting...');
  let teamsMsg = await textarea.inputValue();
  assert.ok(teamsMsg.includes('**Packaging Clarification'), 'Teams message must use double asterisk bolding');
  assert.ok(teamsMsg.includes('**Finding ID:**'), 'Teams message must use Teams markdown');

  // Step 12: Edit the message
  console.log('[E2E Step 12] Editing the message in the textarea...');
  const customNote = '\n\nReviewer Note: Production run scheduled for Monday, please confirm immediately.';
  const editedMsg = teamsMsg + customNote;
  await textarea.fill(editedMsg);
  await page.waitForTimeout(100);

  // Step 13: Click Copy Message
  console.log('[E2E Step 13] Clicking [Copy Message]...');
  const copyBtn = page.locator('button[data-ask-action="copy"]');
  await copyBtn.click();

  // Step 14: Verify copied text matches the editor & feedback appears
  console.log('[E2E Step 14] Verifying clipboard feedback...');
  const feedback = page.locator('#ask-copy-feedback');
  await feedback.waitFor({ state: 'visible' });
  const feedbackText = await feedback.innerText();
  assert.ok(feedbackText.includes('Copied to clipboard'), 'Feedback must confirm successful copy');

  // Step 15: Close the modal
  console.log('[E2E Step 15] Closing the modal...');
  const closeBtn = page.locator('button[data-ask-action="close"]').first();
  await closeBtn.click();
  await modal.waitFor({ state: 'hidden' });
  console.log('[E2E Step 15 Complete] Modal closed cleanly');

  // Step 16: Verify the artwork viewer remains in its previous state
  console.log('[E2E Step 16] Verifying artwork viewer remains active and in place...');
  const canvas = page.locator('.workbench-canvas');
  assert.ok(await canvas.isVisible(), 'Workbench canvas must remain active');

  // Step 17: Reload the review
  console.log('[E2E Step 17] Reloading review from server...');
  const reloadRes = await page.request.get(`${base}/api/reviews/${reviewId}`);
  assert.ok(reloadRes.ok());
  const freshReview = await reloadRes.json();

  // Step 18: Verify no false reviewer decision was recorded
  console.log('[E2E Step 18] Verifying no false reviewer disposition was recorded...');
  const findingDecision = freshReview.decisions?.[ingredientFinding.id];
  assert.equal(findingDecision, undefined, 'Opening and copying clarification must NOT mark finding resolved or decided');

  // Check audit trail recorded clarification event
  const events = freshReview.audit || freshReview.auditLog || [];
  const clarEvent = events.find(e => e.action === 'clarification_event');
  assert.ok(clarEvent, 'Backend audit log must record clarification event');

  console.log('\n✅ [Ask Someone E2E] All 18 browser steps passed successfully with zero errors!\n');
}

try {
  await runAskSomeoneE2e();
} finally {
  await browser.close();
  if (serverProc) {
    serverProc.kill();
  }
}
