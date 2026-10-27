/**
 * @file tests/ar-no-ai-runtime.test.mjs
 * 
 * Verifies Phase 30 & 31: ZERO AI CALLS during live AR runtime.
 * Absolute acceptance condition:
 * - 0 Gemini calls
 * - 0 other LLM calls
 * - 0 image-to-image AI calls
 * - 0 OCR service calls
 * - 0 fact-extraction requests
 * - 0 regulatory model calls
 * - 0 generated-markup AI calls
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArManifest } from '../lib/ar/ar-manifest.mjs';
import {
  generatePanelOverlaySvg,
  getFindingDetailsForHotspot,
} from '../lib/ar/red-pen-assets.mjs';

test('1. AR manifest generation requires zero AI model or provider calls', () => {
  let aiCalls = 0;
  const originalFetch = globalThis.fetch;

  // Intercept fetch to assert no cloud AI endpoints are touched
  globalThis.fetch = async (url, ...args) => {
    const urlStr = String(url);
    if (/generativelanguage\.googleapis\.com|api\.openai\.com|anthropic|bedrock|ocr/i.test(urlStr)) {
      aiCalls++;
      throw new Error(`Forbidden AI network call detected: ${urlStr}`);
    }
    return originalFetch(url, ...args);
  };

  try {
    const manifestUs = buildArManifest({ market: 'us' });
    const manifestIndia = buildArManifest({ market: 'india' });

    assert.ok(manifestUs);
    assert.ok(manifestIndia);
    assert.equal(aiCalls, 0, 'Must make zero AI calls when building AR manifest');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('2. Panel red-pen overlay generation is 100% deterministic local SVG rendering with 0 AI calls', () => {
  let aiCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, ...args) => {
    aiCalls++;
    return originalFetch(url, ...args);
  };

  try {
    const panels = ['front', 'right', 'back', 'left'];
    for (const panel of panels) {
      const svg = generatePanelOverlaySvg(panel);
      assert.ok(svg.length > 100);
    }
    assert.equal(aiCalls, 0, 'Zero network/AI requests during per-panel overlay generation');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('3. Finding hotspot details retrieval accesses precomputed audit index with 0 AI latency', () => {
  let aiCalls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, ...args) => {
    aiCalls++;
    return originalFetch(url, ...args);
  };

  try {
    const findingIds = [
      'f-honey-claim',
      'f-missing-net-fl-oz',
      'f-nutrition-facts-sugar',
      'f-cooling-storage',
      'f-allergen-contains-wheat',
      'f-manufacturer-address',
    ];

    for (const id of findingIds) {
      const details = getFindingDetailsForHotspot(id);
      assert.ok(details, `Details must exist for ${id}`);
      assert.ok(details.observedText);
      assert.ok(details.expectedValue);
      assert.ok(details.ruleId);
    }

    assert.equal(aiCalls, 0, 'Zero AI calls when opening finding evidence drawers');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
