/**
 * PackSignal — External Regulatory & Food Database Client (lib/external-food-apis.mjs)
 * 
 * Provides integrations with:
 * 1. Open Food Facts (Open database for GTIN/barcode, ingredients, and nutrition facts)
 * 2. openFDA (FDA Enforcement & Recalls database)
 * 3. USDA FoodData Central (Official nutrient density & reference standards)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Automatically load .env.local / .env for standalone tools and tests
for (const file of ['.env.local', '.env']) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) {
    const lines = readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    }
  }
}

const OFF_BASE_URL = process.env.OPEN_FOOD_FACTS_BASE_URL || 'https://world.openfoodfacts.org';
const OFF_USER_AGENT = process.env.OPEN_FOOD_FACTS_USER_AGENT || 'PackSignal/1.0 (packsignal-review@aiforge.internal)';
const OPENFDA_API_KEY = process.env.OPENFDA_API_KEY || '';
const USDA_FDC_API_KEY = process.env.USDA_FDC_API_KEY || '';

// Lightweight in-memory caches to avoid redundant external network latency
const offCache = new Map();
const openFdaCache = new Map();
const usdaCache = new Map();

/**
 * 1. Open Food Facts Lookup by GTIN / Barcode
 * @param {string} gtin - 8, 12, 13, or 14-digit barcode
 * @returns {Promise<Object>} Product metadata or error descriptor
 */
export async function fetchOpenFoodFactsProduct(gtin) {
  const cleanGtin = String(gtin || '').replace(/\D/g, '');
  if (!cleanGtin || cleanGtin.length < 8) {
    return { found: false, error: 'Invalid GTIN format' };
  }

  if (offCache.has(cleanGtin)) {
    return offCache.get(cleanGtin);
  }

  try {
    const url = `${OFF_BASE_URL}/api/v3.6/product/${cleanGtin}.json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const result = { found: false, status: res.status, error: `Open Food Facts returned ${res.status}` };
      offCache.set(cleanGtin, result);
      return result;
    }

    const data = await res.json();
    if (data.status === 0 || !data.product) {
      const result = { found: false, gtin: cleanGtin, message: 'Product not found in Open Food Facts registry' };
      offCache.set(cleanGtin, result);
      return result;
    }

    const p = data.product;
    const result = {
      found: true,
      gtin: cleanGtin,
      productName: p.product_name || p.product_name_en || '',
      brands: p.brands || '',
      quantity: p.quantity || '',
      categories: p.categories || '',
      labels: p.labels || '',
      allergens: p.allergens || p.allergens_tags || [],
      ingredientsText: p.ingredients_text || p.ingredients_text_en || '',
      nutriments: {
        energyKcal: p.nutriments?.['energy-kcal_100g'] ?? p.nutriments?.['energy-kcal'] ?? null,
        fat: p.nutriments?.fat_100g ?? p.nutriments?.fat ?? null,
        saturatedFat: p.nutriments?.['saturated-fat_100g'] ?? null,
        carbohydrates: p.nutriments?.carbohydrates_100g ?? null,
        sugars: p.nutriments?.sugars_100g ?? null,
        proteins: p.nutriments?.proteins_100g ?? null,
        salt: p.nutriments?.salt_100g ?? null,
        sodium: p.nutriments?.sodium_100g ?? null,
      },
      ecoscore: p.ecoscore_grade || 'unknown',
      nutriscore: p.nutriscore_grade || 'unknown',
      source: 'Open Food Facts (Public Registry)',
    };

    offCache.set(cleanGtin, result);
    return result;
  } catch (err) {
    return { found: false, error: err.message };
  }
}

/**
 * 2. openFDA Enforcement & Recall Query
 * @param {string} query - Brand or manufacturer firm name
 * @returns {Promise<Object>} Active recall notices or clear status
 */
export async function queryOpenFdaRecalls(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return { totalRecalls: 0, results: [] };

  if (openFdaCache.has(cleanQuery)) {
    return openFdaCache.get(cleanQuery);
  }

  try {
    const keyParam = OPENFDA_API_KEY ? `&api_key=${encodeURIComponent(OPENFDA_API_KEY)}` : '';
    const safeSearch = encodeURIComponent(`recalling_firm:"${cleanQuery}"`);
    const url = `https://api.fda.gov/food/enforcement.json?search=${safeSearch}&limit=5${keyParam}`;

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        // 404 in openFDA means zero matches found (clean record)
        const cleanResult = { totalRecalls: 0, results: [], firm: cleanQuery, status: 'NO_ACTIVE_RECALLS' };
        openFdaCache.set(cleanQuery, cleanResult);
        return cleanResult;
      }
      return { totalRecalls: 0, results: [], error: `openFDA returned ${res.status}`, status: 'NO_ACTIVE_RECALLS' };
    }

    const data = await res.json();
    const results = (data.results || []).map(r => ({
      recallNumber: r.recall_number,
      reasonForRecall: r.reason_for_recall,
      classification: r.classification,
      status: r.status,
      distributionPattern: r.distribution_pattern,
      recallInitiationDate: r.recall_initiation_date,
      productDescription: r.product_description,
    }));

    const output = {
      totalRecalls: data.meta?.results?.total || results.length,
      firm: cleanQuery,
      status: results.length > 0 ? 'RECALL_ALERTS_FOUND' : 'NO_ACTIVE_RECALLS',
      results,
      source: 'US FDA Food Enforcement Reports',
    };

    openFdaCache.set(cleanQuery, output);
    return output;
  } catch (err) {
    return { totalRecalls: 0, results: [], error: err.message, status: 'NO_ACTIVE_RECALLS' };
  }
}

/**
 * 3. USDA FoodData Central Nutrient Search & Benchmark
 * @param {string} query - Ingredient or food term (e.g. "oats", "honey")
 * @returns {Promise<Object>} Foundation nutrient breakdown
 */
export async function searchUsdaFood(query) {
  const cleanTerm = String(query || '').trim();
  if (!cleanTerm) return { totalHits: 0, foods: [] };

  if (usdaCache.has(cleanTerm)) {
    return usdaCache.get(cleanTerm);
  }

  try {
    const key = USDA_FDC_API_KEY || 'DEMO_KEY';
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(cleanTerm)}&pageSize=5&dataType=Foundation,SR%20Legacy`;

    const res = await fetch(url);
    if (!res.ok) {
      return { totalHits: 0, error: `USDA FoodData Central returned ${res.status}` };
    }

    const data = await res.json();
    const foods = (data.foods || []).map(f => ({
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      foodCategory: f.foodCategory,
      nutrients: (f.foodNutrients || []).slice(0, 10).map(n => ({
        name: n.nutrientName,
        value: n.value,
        unit: n.unitName,
      })),
    }));

    const output = {
      totalHits: data.totalHits || foods.length,
      query: cleanTerm,
      foods,
      source: 'USDA Agricultural Research Service (FoodData Central)',
    };

    usdaCache.set(cleanTerm, output);
    return output;
  } catch (err) {
    return { totalHits: 0, error: err.message };
  }
}

/**
 * Returns configuration readiness status for all external regulatory databases.
 */
export function getRegulatoryApiStatus() {
  return {
    openFoodFacts: {
      enabled: true,
      baseUrl: OFF_BASE_URL,
      userAgent: OFF_USER_AGENT,
      authType: 'Public Registry (Open Source)',
    },
    openFda: {
      enabled: Boolean(OPENFDA_API_KEY),
      hasKey: Boolean(OPENFDA_API_KEY),
      provider: 'US Food and Drug Administration',
    },
    usdaFoodDataCentral: {
      enabled: Boolean(USDA_FDC_API_KEY),
      hasKey: Boolean(USDA_FDC_API_KEY),
      provider: 'USDA Agricultural Research Service',
    },
  };
}
