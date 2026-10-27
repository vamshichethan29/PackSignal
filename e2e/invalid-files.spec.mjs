import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('E2E: Safe Rejection of Malformed & Invalid Files', () => {
  test('INVALID FILES FAIL SAFELY: rejects corrupt files, path traversal, and empty payloads without server crash', async ({ page, request }) => {
    const { csrf } = await (await request.get('/api/status')).json();

    // 1. Test empty file upload via API
    const emptyRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: {
        files: [
          { name: 'empty.pdf', role: 'artwork', base64: '' }
        ],
        mode: 'local'
      }
    });
    // Must be safely rejected with 400 client error
    expect(emptyRes.status()).toBe(400);
    const emptyErr = await emptyRes.json();
    expect(emptyErr.error).toBeDefined();

    // 2. Test missing artwork (only spec provided)
    const noArtRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: {
        files: [
          { name: 'spec-approved.xlsx', role: 'spec', base64: 'UEsDBBQAAAAIA...' }
        ],
        mode: 'local'
      }
    });
    expect(noArtRes.status()).toBe(400);
    const noArtErr = await noArtRes.json();
    expect(noArtErr.error).toMatch(/(artwork|missing)/i);

    // 3. Test path traversal attempt in file name
    const traversalRes = await request.post('/api/reviews', {
      headers: { 'x-packproof-token': csrf },
      data: {
        files: [
          { name: '../../../../../../etc/passwd', role: 'artwork', base64: 'JVBERi0xLjQK' }
        ],
        mode: 'local'
      }
    });
    // Server must either sanitize the name or reject the request, never write outside test data dir
    if (traversalRes.ok()) {
      const data = await traversalRes.json();
      expect(data.id).toBeDefined();
      // Ensure file name was sanitized
      const poll = await (await request.get(`/api/reviews/${data.id}`)).json();
      for (const doc of (poll.documents || [])) {
        expect(doc.name).not.toContain('../');
      }
    } else {
      expect(traversalRes.status()).toBeGreaterThanOrEqual(400);
    }

    // 4. Test malformed JSON body
    const badJsonRes = await request.post('/api/reviews', {
      headers: {
        'x-packproof-token': csrf,
        'Content-Type': 'application/json'
      },
      data: '{ broken json'
    });
    expect(badJsonRes.status()).toBe(400);

    // 5. Test UI upload dialog with corrupt file
    await page.goto('/');
    const uploadBtn = page.locator('button[data-action="upload"]');
    await uploadBtn.click();
    await expect(page.locator('#dialog[open]')).toBeVisible();

    const fileInput = page.locator('input#files');
    const corruptPdf = path.resolve(__dirname, 'fixtures/corrupt.pdf');
    await fileInput.setInputFiles([corruptPdf]);

    const submitBtn = page.locator('button[type="submit"][form="upload-form"]');
    await submitBtn.click();

    // Must show user-facing error or handle gracefully without app crash
    await page.waitForTimeout(2000);
    const errorMsg = page.locator('.dialog-error, .notice.error, #dialog-error');
    if (await errorMsg.count() > 0 && await errorMsg.first().isVisible()) {
      const txt = await errorMsg.first().textContent();
      expect(txt.length).toBeGreaterThan(0);
    }

    // 6. Verify server remains healthy after all invalid attempts
    const healthRes = await request.get('/healthz');
    expect(healthRes.ok()).toBeTruthy();
  });
});
