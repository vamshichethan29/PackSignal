import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOrganizerVerification, verifyOrganizerManifest } from '../lib/organizer-verification.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

test('Organizer manifest verifies SHA-256 for official sample carton and spreadsheet', () => {
  const manifestRes = verifyOrganizerManifest();
  assert.equal(manifestRes.verified, true);
  assert.equal(manifestRes.files.length, 2);
  for (const f of manifestRes.files) {
    assert.equal(f.status, 'VERIFIED');
    assert.equal(f.actualHash, f.expectedHash);
  }
});

test('Organizer verification extracts draft status and preserves unresolved legal authority', () => {
  const result = runOrganizerVerification();
  assert.equal(result.sourceDoc.approvalStatus, 'Draft / In Review');
  assert.equal(result.sourceDoc.isDraft, true);

  // Checks must flag SOURCE_ARTWORK_MISMATCH or REVIEW, never definitive legal violations for draft copy
  const honeyCheck = result.candidateChecks.find(c => c.checkId === 'DF-CHK-HONEY-PCT');
  assert.ok(honeyCheck);
  assert.equal(honeyCheck.findingStatus, 'SOURCE_ARTWORK_MISMATCH');
  assert.match(honeyCheck.limitations, /Draft \/ In Review/i);
});

test('Organizer verification evaluates all candidate defect classes without hardcoding', () => {
  const result = runOrganizerVerification();
  assert.ok(result.candidateChecks.length >= 20);

  // Confirmed observations vs reviews
  assert.ok(result.summary.confirmedObservations >= 8);
  assert.ok(result.summary.reviewsRequiringResolution >= 5);
  assert.ok(result.summary.sourceQualityDefects >= 1);
});
