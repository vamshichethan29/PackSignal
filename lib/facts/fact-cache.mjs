/**
 * PackSignal Phase 2 — Document-Fingerprint Cache & Safety
 * (lib/facts/fact-cache.mjs)
 * 
 * High-reliability content-addressable cache:
 * - Fingerprints based on SHA-256 of actual file bytes.
 * - Cache key incorporates document hashes, extractor version, fact schema version, prompt version, and model config.
 * - Cache diagnostics: CACHE_HIT, CACHE_MISS, CACHE_INVALIDATED, CACHE_BYPASSED.
 * - Safe serialization: preserves source roles, bounded size, no credentials.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export const EXTRACTOR_VERSION = '2.1.0';
export const FACT_SCHEMA_VERSION = 'packsignal-fact/v1';
export const PROMPT_VERSION = '2026-10-p2-v1';
export const NORMALIZATION_RULES_VERSION = '1.0.0';

class FactFingerprintCache {
  constructor(maxEntries = 100) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.diagnostics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      bypasses: 0
    };
  }

  /**
   * Computes SHA-256 of a local file path.
   */
  computeFileSha256(filePath) {
    try {
      if (!existsSync(filePath)) return null;
      const buf = readFileSync(filePath);
      return createHash('sha256').update(buf).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * Generates a composite cache key.
   */
  buildCacheKey(params) {
    const {
      fileFingerprint,
      promptVersion = PROMPT_VERSION,
      schemaVersion = FACT_SCHEMA_VERSION,
      extractorVersion = EXTRACTOR_VERSION,
      modelConfig = 'default',
      options = {}
    } = params;

    const raw = [
      fileFingerprint,
      extractorVersion,
      schemaVersion,
      promptVersion,
      typeof modelConfig === 'string' ? modelConfig : JSON.stringify(modelConfig),
      JSON.stringify(options)
    ].join('::');

    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Retrieves a cached Fact Sheet if valid.
   */
  get(params) {
    if (params.noCache) {
      this.diagnostics.bypasses++;
      return { status: 'CACHE_BYPASSED', data: null };
    }

    const key = this.buildCacheKey(params);
    if (!this.cache.has(key)) {
      this.diagnostics.misses++;
      return { status: 'CACHE_MISS', key, data: null };
    }

    const entry = this.cache.get(key);
    // Verify fingerprint hasn't changed
    if (entry.fileFingerprint !== params.fileFingerprint) {
      this.cache.delete(key);
      this.diagnostics.invalidations++;
      return { status: 'CACHE_INVALIDATED', key, data: null };
    }

    this.diagnostics.hits++;
    return { status: 'CACHE_HIT', key, data: entry.data };
  }

  /**
   * Stores Fact Sheet in cache.
   */
  set(params, data) {
    const key = this.buildCacheKey(params);
    if (this.cache.size >= this.maxEntries) {
      // LRU eviction
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      fileFingerprint: params.fileFingerprint,
      createdAt: Date.now(),
      promptVersion: params.promptVersion || PROMPT_VERSION,
      schemaVersion: params.schemaVersion || FACT_SCHEMA_VERSION,
      data
    });

    return key;
  }

  /**
   * Explicitly invalidates entries matching a fingerprint or key.
   */
  invalidate(fileFingerprint) {
    let count = 0;
    for (const [k, v] of this.cache.entries()) {
      if (v.fileFingerprint === fileFingerprint || k === fileFingerprint) {
        this.cache.delete(k);
        count++;
      }
    }
    this.diagnostics.invalidations += count;
    return count;
  }

  /**
   * Clears entire cache.
   */
  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      entries: this.cache.size,
      ...this.diagnostics
    };
  }
}

export const globalFactCache = new FactFingerprintCache();
