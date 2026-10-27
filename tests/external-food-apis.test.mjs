/**
 * @file tests/external-food-apis.test.mjs
 * 
 * Verifies External Regulatory & Food Database Integrations:
 * 1. Open Food Facts API (Public Global Packaging Registry)
 * 2. openFDA Enforcement & Recalls API
 * 3. USDA FoodData Central Nutrient Benchmarking API
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOpenFoodFactsProduct,
  queryOpenFdaRecalls,
  searchUsdaFood,
  getRegulatoryApiStatus,
} from '../lib/external-food-apis.mjs';

test('1. getRegulatoryApiStatus reports all external services configured', () => {
  const status = getRegulatoryApiStatus();
  assert.equal(status.openFoodFacts.enabled, true);
  assert.equal(status.openFoodFacts.baseUrl, 'https://world.openfoodfacts.org');
  assert.ok(status.openFoodFacts.userAgent.includes('PackSignal'));

  assert.equal(status.openFda.enabled, true, 'openFDA must be enabled with API key');
  assert.equal(status.openFda.hasKey, true);

  assert.equal(status.usdaFoodDataCentral.enabled, true, 'USDA FDC must be enabled with API key');
  assert.equal(status.usdaFoodDataCentral.hasKey, true);
});

test('2. fetchOpenFoodFactsProduct validates barcode format before sending network request', async () => {
  const shortResult = await fetchOpenFoodFactsProduct('123');
  assert.equal(shortResult.found, false);
  assert.equal(shortResult.error, 'Invalid GTIN format');

  const emptyResult = await fetchOpenFoodFactsProduct('');
  assert.equal(emptyResult.found, false);
});

test('3. queryOpenFdaRecalls returns structured recall results or clean status', async () => {
  // Test with non-existent / clean firm name
  const res = await queryOpenFdaRecalls('FirmNonExistentCleanBrandXYZ987');
  assert.ok(typeof res.totalRecalls === 'number');
  assert.ok(Array.isArray(res.results));
  assert.equal(res.status, 'NO_ACTIVE_RECALLS');
});

test('4. searchUsdaFood handles empty or clean search terms gracefully', async () => {
  const emptyRes = await searchUsdaFood('');
  assert.equal(emptyRes.totalHits, 0);
  assert.deepEqual(emptyRes.foods, []);
});

test('5. Open Food Facts client respects user-agent policy', async () => {
  const originalFetch = globalThis.fetch;
  let sentUserAgent = '';

  globalThis.fetch = async (url, options = {}) => {
    sentUserAgent = options.headers?.['User-Agent'] || '';
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Dancing Fish Berry Crunch',
          brands: 'Dancing Fish',
          quantity: '283 g',
          nutriments: { 'energy-kcal': 380, fat: 8, sugars: 12 },
        },
      }),
    };
  };

  try {
    const res = await fetchOpenFoodFactsProduct('0123456789012');
    assert.equal(res.found, true);
    assert.equal(res.productName, 'Dancing Fish Berry Crunch');
    assert.equal(res.brands, 'Dancing Fish');
    assert.ok(sentUserAgent.includes('PackSignal/1.0'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
