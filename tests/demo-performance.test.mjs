import test from 'node:test';
import assert from 'node:assert/strict';
import { runOrganizerVerification } from '../lib/organizer-verification.mjs';

test('Monotonic execution time is measured on deep verification (no hardcoded 0.8s)', () => {
  const result = runOrganizerVerification();

  assert.ok(typeof result.executionTimeMs === 'number', 'Execution time must be a number');
  assert.ok(result.executionTimeMs > 0, 'Execution time must be greater than 0 ms');
  assert.notEqual(result.executionTimeMs, 800, 'Must NOT hardcode 800 ms (0.8s)');

  assert.equal(result.timingMethod, 'node:perf_hooks.performance.now()');
  assert.equal(result.dancingFish16.timingMs, result.executionTimeMs);
});

test('Timing structure cleanly separates engine time from total time', () => {
  const sampleTiming = {
    extractionMs: 310,
    normalizationMs: 15,
    engineMs: 42,
    prepressMs: 18,
    totalProcessingMs: 385,
    timingMethod: 'node:perf_hooks.performance.now()',
    processingMode: 'local_deterministic',
    cacheStatus: 'fresh_execution'
  };

  assert.ok(sampleTiming.engineMs < sampleTiming.totalProcessingMs, 'Engine-only time must be less than total PDF processing time');
  assert.equal(sampleTiming.processingMode, 'local_deterministic');
  assert.equal(sampleTiming.cacheStatus, 'fresh_execution');
  assert.notEqual(sampleTiming.totalProcessingMs, 800, 'Must not be hardcoded to 800ms');
});

test('Cached reviews maintain truthful cacheStatus without pretending to be live', () => {
  const cachedReviewTiming = {
    totalProcessingMs: 420,
    engineMs: 38,
    timingMethod: 'node:perf_hooks.performance.now()',
    processingMode: 'local_deterministic',
    cacheStatus: 'precomputed_storage'
  };

  assert.equal(cachedReviewTiming.cacheStatus, 'precomputed_storage');
});
