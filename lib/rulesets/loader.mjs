/**
 * PackSignal Market Rule Pack Loader (lib/rulesets/loader.mjs)
 * Implements Phase 13: Strictly validates and loads versioned market rule packs.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_RULE_TYPES } from '../rules/rule-compiler.mjs';

const rootDir = resolve(fileURLToPath(new URL('../../', import.meta.url)));

/**
 * Validates an in-memory rule record against structural schema rules.
 */
export function validateRuleRecord(rule) {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Rule record must be a valid object');
  }

  const requiredFields = [
    'id',
    'version',
    'market',
    'regulator',
    'productScope',
    'sourceCitation',
    'checkType',
    'parameters',
  ];

  for (const f of requiredFields) {
    if (!rule[f]) {
      throw new Error(`Rule ${rule.id || 'unknown'} missing required field: ${f}`);
    }
  }

  if (!SUPPORTED_RULE_TYPES.includes(rule.checkType)) {
    throw new Error(`Rule ${rule.id} specifies unknown or unsupported checkType: ${rule.checkType}`);
  }

  return true;
}

/**
 * Loads all rules for a market from rulesets/<market>/
 */
export async function loadMarketRulePack(market = 'us') {
  const marketDir = join(rootDir, 'rulesets', market);
  let files;
  try {
    files = await readdir(marketDir);
  } catch (err) {
    throw new Error(`Market rule pack not found for market: ${market}`);
  }

  const rules = [];
  for (const file of files) {
    if (file === 'manifest.json' || !file.endsWith('.json')) continue;
    const content = JSON.parse(await readFile(join(marketDir, file), 'utf8'));
    validateRuleRecord(content);
    rules.push(content);
  }

  return {
    market,
    rulesCount: rules.length,
    rules,
  };
}
