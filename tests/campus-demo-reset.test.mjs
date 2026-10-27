import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resetCampusDemoState } from '../lib/campus/rehearsal-reset.mjs';

test('Campus Demo Reset — Non-destructive Idempotent Reset (< 50ms)', async () => {
  const testDataDir = join(process.cwd(), 'scratch', 'test-demo-reset-dir');
  await rm(testDataDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(testDataDir, { recursive: true });

  // Simulate production review files that must NEVER be touched
  const prodReviewsDir = join(testDataDir, 'production-reviews');
  await mkdir(prodReviewsDir, { recursive: true });
  const prodReviewFile = join(prodReviewsDir, 'review-prod-123.json');
  await writeFile(prodReviewFile, JSON.stringify({ id: 'review-prod-123', status: 'approved' }), 'utf8');

  // Simulate scratch demo sessions that SHOULD be purged
  const scratchDir = join(testDataDir, 'scratch-reviews');
  await mkdir(scratchDir, { recursive: true });
  const scratchFile = join(scratchDir, 'temp-session.json');
  await writeFile(scratchFile, JSON.stringify({ temp: true }), 'utf8');

  // First reset run
  const t0 = performance.now();
  const res1 = await resetCampusDemoState(testDataDir);
  const elapsed1 = performance.now() - t0;

  assert.equal(res1.ok, true, 'Reset 1 must succeed');
  assert.ok(elapsed1 < 100, `Reset execution must be fast (< 100ms), took ${elapsed1.toFixed(1)}ms`);
  assert.equal(existsSync(prodReviewFile), true, 'Production review file must remain intact!');
  assert.equal(existsSync(scratchFile), false, 'Scratch file must be purged');

  // Second reset run (idempotency check)
  const t1 = performance.now();
  const res2 = await resetCampusDemoState(testDataDir);
  const elapsed2 = performance.now() - t1;

  assert.equal(res2.ok, true, 'Reset 2 must succeed');
  assert.equal(existsSync(prodReviewFile), true, 'Production review file still remains intact after 2nd reset');

  // Third reset run
  const res3 = await resetCampusDemoState(testDataDir);
  assert.equal(res3.ok, true, 'Reset 3 must succeed without error');

  // Clean up test sandbox
  await rm(testDataDir, { recursive: true, force: true }).catch(() => {});
});
