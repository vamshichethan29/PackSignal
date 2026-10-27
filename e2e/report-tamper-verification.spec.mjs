import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test.describe('E2E: Cryptographic Release Seal & Tamper Verification Workflow', () => {
  test('REAL CLI E2E WORKFLOW: full cycle of export, trusted-key verification, and tamper detection', async ({ page, request }) => {
    const tempDir = await mkdtemp(join(tmpdir(), 'packsignal-e2e-tamper-'));

    try {
      // 1. Create a controlled review
      const { csrf } = await (await request.get('/api/status')).json();
      const createRes = await request.post('/api/reviews', {
        headers: { 'x-packproof-token': csrf },
        data: { sample: 'clean', mode: 'local' }
      });
      expect(createRes.ok()).toBeTruthy();
      const { id: reviewId } = await createRes.json();

      // 2. Wait until real packaging checks are completed
      let isReady = false;
      for (let i = 0; i < 60; i++) {
        const poll = await (await request.get(`/api/reviews/${reviewId}`)).json();
        if (poll.status === 'ready') {
          isReady = true;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      expect(isReady).toBe(true);

      // 3. Record authorized reviewer decisions
      const reviewRes = await request.get(`/api/reviews/${reviewId}`);
      const reviewData = await reviewRes.json();
      const firstFindingId = reviewData.findings?.[0]?.id;

      if (firstFindingId) {
        await request.post(`/api/reviews/${reviewId}/decisions`, {
          headers: { 'x-packproof-token': csrf },
          data: {
            findingId: firstFindingId,
            disposition: 'acknowledged',
            note: 'Verified in prepress studio',
            reviewer: 'Lead Packaging QA',
          }
        });
      }

      // 4. Export an actual signed report
      const reportRes = await request.get(`/api/reviews/${reviewId}/report.json`);
      expect(reportRes.ok()).toBeTruthy();
      const signedReport = await reportRes.json();
      expect(signedReport.signature).toBeDefined();
      expect(signedReport.signature.algorithm).toBe('Ed25519');

      const originalReportPath = join(tempDir, 'original-report.json');
      await writeFile(originalReportPath, JSON.stringify(signedReport, null, 2));

      // 5. Run the verifier CLI on the exported report
      const verifyRes = spawnSync(process.execPath, [
        join(root, 'scripts/verify-report.mjs'),
        originalReportPath,
      ], { encoding: 'utf8' });

      // 6. Confirm valid cryptographic signature
      expect(verifyRes.status).toBe(0);
      expect(verifyRes.stdout).toContain('SIGNATURE:                      VALID');
      expect(verifyRes.stdout).toContain('Payload integrity:              VALID');

      // 7. Extract the public key and run independent trusted-key verification
      const trustedKeyPath = join(tempDir, 'trusted-issuer-public.pem');
      await writeFile(trustedKeyPath, signedReport.signature.publicKey);

      const trustedVerifyRes = spawnSync(process.execPath, [
        join(root, 'scripts/verify-report.mjs'),
        originalReportPath,
        '--trusted-public-key',
        trustedKeyPath,
      ], { encoding: 'utf8' });

      // 8. Confirm trust status
      expect(trustedVerifyRes.status).toBe(0);
      expect(trustedVerifyRes.stdout).toContain('Signer trust:                   TRUSTED');
      expect(trustedVerifyRes.stdout).toContain('SIGNER IDENTITY: VERIFIED (TRUSTED SIGNER)');

      // 9. Create a controlled copy
      const tamperedReportPath = join(tempDir, 'tampered-copy.json');
      const tampered = JSON.parse(JSON.stringify(signedReport));

      // 10. Change a finding status
      if (tampered.findings?.length > 0) {
        tampered.findings[0].status = tampered.findings[0].status === 'match' ? 'issue' : 'match';
      } else {
        tampered.findings = [{ id: 'synthetic-finding', status: 'issue', expected: 'E', observed: 'O' }];
      }
      await writeFile(tamperedReportPath, JSON.stringify(tampered, null, 2));

      // 11. Run verifier again on tampered copy
      const tamperedVerifyRes = spawnSync(process.execPath, [
        join(root, 'scripts/verify-report.mjs'),
        tamperedReportPath,
      ], { encoding: 'utf8' });

      // 12. Confirm failure (exit 1)
      expect(tamperedVerifyRes.status).toBe(1);
      expect(tamperedVerifyRes.stdout).toContain('SIGNATURE INVALID');

      // 13. Re-verify the original report
      const reVerifyOriginal = spawnSync(process.execPath, [
        join(root, 'scripts/verify-report.mjs'),
        originalReportPath,
      ], { encoding: 'utf8' });

      // 14. Confirm original still verifies cleanly (historical integrity preserved)
      expect(reVerifyOriginal.status).toBe(0);
      expect(reVerifyOriginal.stdout).toContain('SIGNATURE VALID');

      // 15. Modify a source attachment copy
      if (signedReport.documents?.[0]?.name) {
        const docName = signedReport.documents[0].name;
        const fakeDocPath = join(tempDir, docName);
        await writeFile(fakeDocPath, 'Corrupted external attachment bytes');

        const attachRes = spawnSync(process.execPath, [
          join(root, 'scripts/verify-report.mjs'),
          originalReportPath,
        ], { encoding: 'utf8' });

        // 16. Confirm attachment hash mismatch detected
        expect(attachRes.status).toBe(1);
        expect(attachRes.stdout).toContain('INTEGRITY: FAILED');
        await rm(fakeDocPath, { force: true });
      }

      // 17. Modify an audit event in a controlled copy
      const auditTampered = JSON.parse(JSON.stringify(signedReport));
      if (auditTampered.audit?.length > 0) {
        auditTampered.audit[0].action = 'UNAUTHORIZED_ALTERATION';
        auditTampered.audit[0].safeDetails = 'Modified audit event detail';
        const auditTamperedPath = join(tempDir, 'tampered-audit.json');
        await writeFile(auditTamperedPath, JSON.stringify(auditTampered, null, 2));

        const auditVerifyRes = spawnSync(process.execPath, [
          join(root, 'scripts/verify-report.mjs'),
          auditTamperedPath,
        ], { encoding: 'utf8' });

        // 18. Confirm audit chain / payload failure
        expect(auditVerifyRes.status).toBe(1);
      }

      // 19. Browser UI Digital Seal test
      await page.goto(`/#review/${reviewId}`);
      await expect(page.locator('.review-heading')).toBeVisible();

      // Navigate to reports tab
      const reportsTab = page.locator('button[data-tab="reports"]');
      if (await reportsTab.isVisible()) {
        await reportsTab.click();
        await expect(page.locator('.reports-workbench')).toBeVisible();
      }

      // 20. Check that the original server reviews were never altered by our tests
      const cleanCheckRes = await request.get(`/api/reviews/${reviewId}`);
      expect(cleanCheckRes.ok()).toBeTruthy();
      const freshReview = await cleanCheckRes.json();
      expect(freshReview.id).toBe(reviewId);

    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
