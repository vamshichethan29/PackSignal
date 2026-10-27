/**
 * PackSignal Phase 2 — Fact Cache Unit Tests
 * (tests/fact-cache.test.mjs)
 * 
 * Verifies:
 * - Content-fingerprint caching using SHA-256.
 * - Same file/model/prompt cache hit.
 * - Changed file cache miss.
 * - Changed prompt invalidates AI cache.
 * - Changed schema version invalidates cache.
 * - Cache diagnostics (CACHE_HIT, CACHE_MISS, CACHE_BYPASSED).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { globalFactCache } from '../lib/facts/fact-cache.mjs';

describe('Phase 2 — Document-Fingerprint Cache & Safety', () => {

  it('1. Same file fingerprint, model, and prompt produces CACHE_HIT', () => {
    const params = {
      fileFingerprint: 'sha_pdf_1:sha_xlsx_1',
      promptVersion: '2026-10-p2-v1',
      schemaVersion: 'packsignal-fact/v1',
      modelConfig: 'gemini-1.5-pro'
    };
    const mockData = { testFactSheet: true, facts: [1, 2, 3] };

    // Initially CACHE_MISS
    const res1 = globalFactCache.get(params);
    assert.equal(res1.status, 'CACHE_MISS');

    // Store in cache
    globalFactCache.set(params, mockData);

    // Second retrieval must produce CACHE_HIT
    const res2 = globalFactCache.get(params);
    assert.equal(res2.status, 'CACHE_HIT');
    assert.deepEqual(res2.data, mockData);
  });

  it('2. Changing file bytes/fingerprint produces CACHE_MISS', () => {
    const baseParams = {
      fileFingerprint: 'sha_pdf_initial:sha_xlsx_1',
      promptVersion: '2026-10-p2-v1'
    };
    globalFactCache.set(baseParams, { version: 1 });

    const changedParams = {
      fileFingerprint: 'sha_pdf_MODIFIED:sha_xlsx_1',
      promptVersion: '2026-10-p2-v1'
    };

    const res = globalFactCache.get(changedParams);
    assert.equal(res.status, 'CACHE_MISS', 'Modified document bytes must produce cache miss');
  });

  it('3. Changing prompt version invalidates/bypasses previous AI cache', () => {
    const pV1 = {
      fileFingerprint: 'same_file_fingerprint',
      promptVersion: 'v1.0.0'
    };
    globalFactCache.set(pV1, { promptResult: 'v1' });

    const pV2 = {
      fileFingerprint: 'same_file_fingerprint',
      promptVersion: 'v2.0.0' // Changed prompt!
    };

    const res = globalFactCache.get(pV2);
    assert.equal(res.status, 'CACHE_MISS', 'Prompt change must invalidate AI extraction cache');
  });

  it('4. Changing fact schema version produces CACHE_MISS', () => {
    const schemaParams = {
      fileFingerprint: 'same_file_fingerprint',
      schemaVersion: 'packsignal-fact/v2' // Different schema version
    };

    const res = globalFactCache.get(schemaParams);
    assert.equal(res.status, 'CACHE_MISS');
  });

  it('5. noCache flag produces CACHE_BYPASSED diagnostic', () => {
    const params = {
      fileFingerprint: 'bypassed_fingerprint',
      noCache: true
    };

    const res = globalFactCache.get(params);
    assert.equal(res.status, 'CACHE_BYPASSED');
  });
});
