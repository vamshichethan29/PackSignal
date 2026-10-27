import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test.describe('E2E: Pack Quantity Consistency · Servings × Serving Size vs Declared Net Weight', () => {
  test('verifies pure math proof, metric cards, 2D navigation, Ask R&D integration, reviewer decision persistence, and report export', async ({ page, request }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 1. Get CSRF token and create review using real backend API
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'fieldday', mode: 'local' }
    });
    expect(createRes.ok()).toBeTruthy();
    const { id: reviewId } = await createRes.json();

    // 2. Poll until review is ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await page.waitForTimeout(300);
    }

    // 3. Inject controlled arithmetic fixture into this review's pack-quantity finding
    const reviewFilePath = join(process.cwd(), '.packproof-e2e-data', 'reviews', reviewId, 'review.json');
    const reviewData = JSON.parse(await readFile(reviewFilePath, 'utf8'));

    let pqFinding = reviewData.findings.find(f => f.id === 'pack-quantity:servings-net-mass');
    if (!pqFinding) {
      pqFinding = {
        id: 'pack-quantity:servings-net-mass',
        key: 'pack-quantity:servings-net-mass',
        title: 'Pack quantity consistency · servings vs net weight',
        category: 'nutrition',
        method: 'serving_net_weight_arithmetic'
      };
      reviewData.findings.push(pqFinding);
    }

    Object.assign(pqFinding, {
      status: 'issue',
      title: 'Pack quantity consistency · servings vs net weight',
      method: 'serving_net_weight_arithmetic',
      category: 'nutrition',
      expected: 'Serving size × servings per container equals declared net weight',
      observed: 'Implied mass 680.0 g; declared net weight 480.0 g (200.0 g / 41.7% difference)',
      explanation: 'Material quantity discrepancy: 8 servings × 85 g implies 680 g package mass, contradicting declared net weight of 480 g by 200 g (41.7%).',
      servingsCount: 8,
      servingSizeGrams: 85,
      expectedPackMassG: 680,
      declaredPackMassG: 480,
      differenceG: 200,
      absoluteDifferenceG: 200,
      percentDifference: 41.6667,
      percentDifferenceFormatted: '41.7%',
      basis: 'AS_PACKAGED',
      isApproximate: false,
      proof: '8 servings × 85 g = 680 g (Declared: 480 g, Diff: 200 g / 41.7%)',
      calculationSteps: [
        'Servings per container: 8 (EXACT)',
        'Serving size: 85 g = 85.00 g (AS_PACKAGED)',
        'Expected package mass: 8 servings × 85.00 g = 680 g',
        'Declared net weight: 480 g = 480.00 g',
        'Difference: 680 g - 480 g = +200 g (41.7%)'
      ],
      packQuantity: {
        status: 'issue',
        verdict: 'ISSUE',
        ruleEvaluationOutcome: 'ISSUE',
        screeningOutcome: 'ISSUE_DISCREPANCY',
        passes: false,
        servingsCount: 8,
        servingSizeGrams: 85,
        declaredNetWeightGrams: 480,
        expectedPackMassG: 680,
        declaredPackMassG: 480,
        differenceG: 200,
        absoluteDifferenceG: 200,
        percentDifference: 41.6667,
        percentDifferenceFormatted: '41.7%',
        formula: '8 servings × 85 g = 680 g (Declared: 480 g, Diff: 200 g / 41.7%)',
        inputs: {
          servings: { value: 8, qualifier: 'EXACT', isApproximate: false, originalText: '8 servings per container' },
          servingSize: { amount: 85, unit: 'g', grams: 85, basis: 'AS_PACKAGED', originalText: '85 g' },
          netWeight: { amount: 480, unit: 'g', grams: 480, originalText: '480 g' }
        },
        calculationSteps: [
          'Servings per container: 8 (EXACT)',
          'Serving size: 85 g = 85.00 g (AS_PACKAGED)',
          'Expected package mass: 8 servings × 85.00 g = 680 g',
          'Declared net weight: 480 g = 480.00 g',
          'Difference: 680 g - 480 g = +200 g (41.7%)'
        ],
        explanation: 'Material quantity discrepancy: 8 servings × 85 g implies 680 g package mass, contradicting declared net weight of 480 g by 200 g (41.7%).',
        limitations: [],
        assumptions: [],
        blockers: []
      },
      evidence: [
        {
          role: 'artwork',
          page: 1,
          name: 'Fieldday_OatDrink.pdf',
          location: 'Back Panel · Nutrition Facts',
          field: 'servings',
          quote: '8 servings per container',
          box: [0.05, 0.20, 0.35, 0.25]
        },
        {
          role: 'artwork',
          page: 1,
          name: 'Fieldday_OatDrink.pdf',
          location: 'Back Panel · Nutrition Facts',
          field: 'serving_size',
          quote: 'Serving size 85g',
          box: [0.05, 0.25, 0.35, 0.30]
        },
        {
          role: 'artwork',
          page: 1,
          name: 'Fieldday_OatDrink.pdf',
          location: 'Principal Display Panel',
          field: 'net_quantity',
          quote: 'Net Wt 480g',
          box: [0.45, 0.80, 0.75, 0.90]
        }
      ],
      rule: {
        field: 'pack_quantity',
        citation: 'Net Quantity Consistency'
      }
    });

    await writeFile(reviewFilePath, JSON.stringify(reviewData, null, 2), 'utf8');

    // 4. Navigate to review in browser
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible({ timeout: 25000 });

    // 5. Select the Pack Quantity Consistency finding
    const pqFindingItem = page.locator(
      '[data-action="select-finding"][data-id="pack-quantity:servings-net-mass"], ' +
      '[data-action="select-finding"]:has-text("servings vs net weight")'
    ).first();
    await expect(pqFindingItem).toBeVisible({ timeout: 10000 });
    await pqFindingItem.click();

    // 6. Verify the Pack Quantity Proof Card is rendered
    const card = page.locator('.pack-quantity-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    // 7. Verify the 3 Input Metric Cards
    // Servings: 8, Serving size: 85 g, Declared Net Wt: 480 g
    await expect(card.locator('.qty-metric-box.servings .metric-value')).toContainText('8');
    await expect(card.locator('.qty-metric-box.serving-size .metric-value')).toContainText('85');
    await expect(card.locator('.qty-metric-box.declared .metric-value')).toContainText('480');

    // 8. Verify the Mathematical Formula Proof Equation
    // 8 × 85 g = 680 g expected vs 480 g declared -> 200 g diff (41.7%)
    await expect(card.locator('.calc-term.highlight-expected b')).toContainText('680 g');
    await expect(card.locator('.calc-term.highlight-declared b')).toContainText('480 g');
    await expect(card.locator('.calc-difference .diff-val')).toContainText('200 g');
    await expect(card.locator('.calc-difference .diff-pct')).toContainText('41.7%');

    // 9. Test "Show Math Proof" expandable toggle
    const toggleProofBtn = card.locator('button[data-action="toggle-pack-qty-proof"]');
    await expect(toggleProofBtn).toBeVisible();
    await toggleProofBtn.click();
    const proofDetail = card.locator('#pack-qty-proof-detail');
    await expect(proofDetail).toBeVisible();
    const proofText = await proofDetail.innerText();
    expect(proofText).toContain('680 g');
    expect(proofText).toContain('200 g');
    expect(proofText).toContain('41.7%');

    // 10. Test interactive Evidence Navigation buttons
    const focusServingsBtn = card.locator('button[data-focus-qty="servings"]');
    if (await focusServingsBtn.isVisible()) {
      await focusServingsBtn.click();
    }
    const focusNetBtn = card.locator('button[data-focus-qty="net_weight"]');
    if (await focusNetBtn.isVisible()) {
      await focusNetBtn.click();
    }

    // 11. Test "Ask R&D" modal integration
    const askRdBtn = card.locator('button[data-action="ask-rd-qty"]');
    await expect(askRdBtn).toBeVisible();
    await askRdBtn.click();

    const askModal = page.locator('#ask-someone-modal, .ask-someone-modal, [data-ask-modal]').first();
    await expect(askModal).toBeVisible({ timeout: 5000 });

    // Verify R&D is selected and message contains exact numbers
    const messageEditor = askModal.locator('#ask-message-editor');
    const messageContent = await messageEditor.inputValue();
    expect(messageContent).toContain('Hi R&D');
    expect(messageContent).toMatch(/Servings per container:\*?\s*8/i);
    expect(messageContent).toMatch(/Serving size:\*?\s*85\s*g/i);
    expect(messageContent).toMatch(/Implied package weight:\*?\s*680\s*g/i);
    expect(messageContent).toMatch(/Declared net weight:\*?\s*480\s*g/i);
    expect(messageContent).toMatch(/Difference:\*?\s*200\s*g/i);
    expect(messageContent).toMatch(/Finding:\*?\s*pack-quantity:servings-net-mass/i);

    // Close the modal
    const closeBtn = askModal.locator('button[data-ask-action="close"]').first();
    await closeBtn.click();
    await expect(askModal).not.toBeVisible({ timeout: 5000 });

    // 12. Flag for Remedy / Record Reviewer Decision
    const proofBtn = page.locator('button[data-action="proof"]').first();
    await expect(proofBtn).toBeVisible();
    await proofBtn.click();

    const decisionForm = page.locator('form#decision-form');
    await expect(decisionForm).toBeVisible();
    await page.selectOption('select#disposition', 'needs_changes');
    const reviewerNote = 'Flagged for R&D review: 41.7% discrepancy between 8 x 85g and 480g net declaration.';
    await page.fill('textarea#decision-note', reviewerNote);
    await page.locator('form#decision-form button[type="submit"]').click();
    await expect(page.locator('#dialog[open]')).toHaveCount(0);

    // 13. Reload and confirm persistence across page reloads
    await page.reload();
    await expect(page.locator('.review-heading')).toBeVisible();

    // Re-select the Pack Quantity Consistency finding
    const pqFindingItemAfter = page.locator(
      '[data-action="select-finding"][data-id="pack-quantity:servings-net-mass"], ' +
      '[data-action="select-finding"]:has-text("servings vs net weight")'
    ).first();
    await expect(pqFindingItemAfter).toBeVisible({ timeout: 10000 });
    await pqFindingItemAfter.click();

    // Reopen decision dialog
    const proofBtnAfter = page.locator('button[data-action="proof"]').first();
    await expect(proofBtnAfter).toBeVisible();
    await proofBtnAfter.click();
    await expect(page.locator('select#disposition')).toHaveValue('needs_changes');
    const closeDecisionBtn = page.locator('#dialog button[data-action="close"], button[data-action="close"]').first();
    if (await closeDecisionBtn.isVisible()) {
      await closeDecisionBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // 14. Verify Signed Report Export includes PACK QUANTITY MATHEMATICAL PROOF
    const reportRes = await request.get(`/api/reviews/${reviewId}/report.html`);
    expect(reportRes.ok()).toBeTruthy();
    const reportHtml = await reportRes.text();
    expect(reportHtml).toContain('PACK QUANTITY MATHEMATICAL PROOF');
    expect(reportHtml).toContain('680 g');
    expect(reportHtml).toContain('480 g');
    expect(reportHtml).toContain('200 g');
    expect(reportHtml).toContain('41.7%');

    // 15. Ensure zero fatal client errors
    expect(pageErrors.filter(msg => !msg.includes('favicon'))).toHaveLength(0);
  });
});
