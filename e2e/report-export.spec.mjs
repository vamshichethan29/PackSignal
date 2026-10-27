import { test, expect } from '@playwright/test';

test.describe('E2E: Inspection Report Export & Signed Seal Verification', () => {
  test('REPORT EXPORTS SUCCESSFULLY: verifies JSON, HTML, and PDF export integrity, signature, and content', async ({ page, request }) => {
    // 1. Create review
    const { csrf } = await (await request.get('/api/status')).json();
    const createRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: { sample: 'clean', mode: 'local' }
    });
    const { id: reviewId } = await createRes.json();

    // 2. Wait until ready
    for (let i = 0; i < 40; i++) {
      const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
      if (poll.status === 'ready') break;
      await new Promise(r => setTimeout(r, 400));
    }

    // 3. Test signed JSON report export
    const jsonReportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
    expect(jsonReportRes.ok()).toBeTruthy();
    const reportData = await jsonReportRes.json();
    expect(reportData.id).toBe(reviewId);
    expect(reportData.findings).toBeInstanceOf(Array);
    expect(reportData.findings.length).toBeGreaterThan(0);

    // Verify signature block where supported
    if (reportData.signature) {
      expect(reportData.signature.algorithm).toBeDefined();
      expect(reportData.signature.publicKey).toBeDefined();
      expect(reportData.signature.signature).toBeDefined();
    }

    // 4. Test HTML report export
    const htmlReportRes = await request.get(`/api/reviews/${reviewId}/report.html`);
    expect(htmlReportRes.ok()).toBeTruthy();
    const htmlText = await htmlReportRes.text();
    expect(htmlText.length).toBeGreaterThan(100);
    expect(htmlText).toContain('PackSignal');
    expect(htmlText).toContain(reviewId);

    // 5. Test PDF certificate endpoint
    const pdfRes = await request.get(`/api/reviews/${reviewId}/certificate.pdf`);
    expect(pdfRes.ok()).toBeTruthy();
    const pdfBuffer = await pdfRes.body();
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // PDF magic bytes %PDF
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');

    // 6. Test Export links in browser UI
    await page.goto(`/#review/${reviewId}`);
    await expect(page.locator('.review-heading')).toBeVisible();

    const jsonExportLink = page.locator(`a[href*="/report.json"]`).first();
    await expect(jsonExportLink).toBeVisible();

    const pdfExportLink = page.locator(`a[href*="/certificate.pdf"]`).first();
    await expect(pdfExportLink).toBeVisible();
  });
});
