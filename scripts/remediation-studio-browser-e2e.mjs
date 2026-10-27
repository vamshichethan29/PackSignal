import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';

async function runRemediationStudioE2E() {
  console.log(`[Remediation E2E] Connecting to ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1600, height: 1100 } });

  try {
    // 1. Fetch CSRF token and create sample review
    const statusRes = await page.request.get(`${BASE_URL}/api/status`);
    const statusData = await statusRes.json();
    const csrf = statusData.csrf;

    const createRes = await page.request.post(`${BASE_URL}/api/reviews`, {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'organizer', mode: 'local' },
    });
    assert.ok(createRes.ok(), `Review creation failed: ${createRes.status()}`);
    const reviewMeta = await createRes.json();
    const reviewId = reviewMeta.id;
    console.log(`[Remediation E2E] Review created: ${reviewId}`);

    for (let i = 0; i < 40; i++) {
      const poll = await (await page.request.get(`${BASE_URL}/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(200);
    }

    // 2. Open Review Workspace
    await page.goto(`${BASE_URL}/#review/${reviewId}`);
    await page.locator('.review-heading').waitFor({ timeout: 15000 });
    console.log(`[Remediation E2E] Loaded review workspace`);

    // 3. Select an actionable finding (Net Quantity or first finding with Auto-Fix)
    const autoFixBtn = page.locator('button[data-action="generate-suggested-fix"]').first();
    await autoFixBtn.waitFor({ timeout: 10000 });
    const findingId = await autoFixBtn.getAttribute('data-id');
    console.log(`[Remediation E2E] Found Auto-Fix button for finding: ${findingId}`);

    // 4. Click ✨ AI Auto-Fix
    await autoFixBtn.click();

    // 5. Verify Remediation Studio drawer mounts
    const studioCard = page.locator('[data-remediation-studio]').first();
    await studioCard.waitFor({ timeout: 10000 });
    console.log(`[Remediation E2E] Remediation Studio card mounted`);

    // Verify Title & Disclaimer
    const titleText = await studioCard.locator('.remediation-title').textContent();
    assert.ok(titleText.length > 0, 'Expected non-empty finding title in remediation studio');
    const disclaimer = await studioCard.locator('.remediation-legal-disclaimer').textContent();
    assert.ok(disclaimer.includes('Proposed Copy Only'), 'Disclaimer must warn that proposal is a human-reviewable suggestion');
    console.log(`[Remediation E2E] Verified title and statutory disclaimer`);

    // Verify Copy Diff (Original vs Proposed)
    const origBox = studioCard.locator('.diff-column.original').first();
    const propBox = studioCard.locator('.diff-column.proposed').first();
    if (await origBox.count() > 0 && await propBox.count() > 0) {
      const origText = await origBox.textContent();
      const propText = await propBox.textContent();
      assert.ok(origText.length > 0, 'Original text must be displayed');
      assert.ok(propText.length > 0, 'Proposed text must be displayed');
      console.log(`[Remediation E2E] Verified side-by-side copy diff: "${origText.trim().slice(0, 30)}…" -> "${propText.trim().slice(0, 30)}…"`);
    }

    // 6. Test One-Click Copy Action
    const copyBtn = studioCard.locator('[data-action="copy-proposed"]').first();
    if (await copyBtn.count() > 0) {
      await copyBtn.click();
      console.log(`[Remediation E2E] Copy to clipboard action executed`);
    }

    // 7. Test Hypothetical Validation
    const validateBtn = studioCard.locator('[data-action="validate-fix"]').first();
    if (await validateBtn.count() > 0) {
      await validateBtn.click();
      await page.waitForTimeout(500);
      const valBox = studioCard.locator('[data-validation-result]').first();
      assert.ok(await valBox.isVisible(), 'Validation result box must be visible after validate');
      console.log(`[Remediation E2E] Hypothetical revalidation verified`);
    }

    // 8. Test Edit Proposal
    const editBtn = studioCard.locator('[data-action="toggle-edit"]').first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      const editorBox = studioCard.locator('[data-editor-box]').first();
      assert.ok(await editorBox.isVisible(), 'Editor box must be visible');
      await studioCard.locator('[data-action="cancel-edit"]').first().click();
      console.log(`[Remediation E2E] Reviewer edit toggle verified`);
    }

    // 9. Test Designer Handoff Approval
    const approveBtn = studioCard.locator('[data-action="approve-proposal"]').first();
    if (await approveBtn.count() > 0) {
      page.once('dialog', async d => {
        await d.accept('Approved for Adobe Illustrator handoff');
      });
      await approveBtn.click();
      await page.waitForTimeout(500);
      const statusBadge = studioCard.locator('.remediation-status-badge').first();
      const badgeText = await statusBadge.textContent();
      assert.ok(badgeText.includes('APPROVED_FOR_DESIGN_HANDOFF'), `Status must reflect approval, got: ${badgeText}`);
      console.log(`[Remediation E2E] Human approval recorded: ${badgeText.trim()}`);
    }

    // 10. Test Export Endpoints (TXT and JSON)
    const exportTxt = await page.request.get(`${BASE_URL}/api/reviews/${reviewId}/findings/${findingId}/remediation/export?format=txt`);
    assert.equal(exportTxt.status(), 200);
    const txtBody = await exportTxt.text();
    assert.ok(txtBody.includes('PACKSIGNAL DESIGNER CORRECTION HANDOFF'));
    console.log(`[Remediation E2E] TXT export verified`);

    const exportJson = await page.request.get(`${BASE_URL}/api/reviews/${reviewId}/findings/${findingId}/remediation/export?format=json`);
    assert.equal(exportJson.status(), 200);
    const jsonBody = await exportJson.json();
    assert.equal(jsonBody.findingId, findingId);
    console.log(`[Remediation E2E] JSON export verified`);

    // 11. Test Create Correction Ticket on another finding
    const ticketBtn = page.locator('button[data-action="create-correction-ticket"]').first();
    if (await ticketBtn.count() > 0) {
      const ticketFindingId = await ticketBtn.getAttribute('data-id');
      await ticketBtn.click();
      await page.waitForTimeout(600);
      const ticketCard = page.locator(`[data-remediation-studio][data-finding-id="${ticketFindingId}"]`).first();
      if (await ticketCard.count() > 0) {
        const ticketBadge = await ticketCard.locator('.remediation-mode-badge').textContent();
        assert.ok(ticketBadge.includes('DESIGN_TICKET'), `Expected DESIGN_TICKET badge, got: ${ticketBadge}`);
        console.log(`[Remediation E2E] Verified Create Correction Ticket produces designer ticket view`);
      }
    }

    // 12. Verify Audit Trail Records
    const revAfter = await (await page.request.get(`${BASE_URL}/api/reviews/${reviewId}`)).json();
    assert.ok(revAfter.remediations?.[findingId], 'Remediation proposal must be persisted in review object');
    assert.ok((revAfter.audit || []).some(e => e.action.includes('proposal')), 'Audit trail must record proposal generation/decision');
    console.log(`[Remediation E2E] Verified persistence in review and audit trail`);

    console.log(`[Remediation E2E] ALL AI AUTO-FIX & REMEDIATION TESTS PASSED CLEANLY!`);
  } finally {
    await browser.close();
  }
}

runRemediationStudioE2E().catch(err => {
  console.error('[Remediation E2E] Failed:', err);
  process.exit(1);
});
