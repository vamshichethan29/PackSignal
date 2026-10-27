#!/usr/bin/env node
/**
 * PackSignal Architecture Guard: Market Independence Check
 * (scripts/check-market-independence.mjs)
 * 
 * Verifies that jurisdiction-neutral engine files (lib/engine.mjs, lib/prepress.mjs,
 * and lib/rules/) do not embed hardcoded US FDA Daily Values or market-specific
 * statutory constants that belong in `markets/us/`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = resolve(__filename, '../..');

console.log('============================================================');
console.log('PACKSIGNAL ARCHITECTURE GUARD: MARKET INDEPENDENCE');
console.log('============================================================\n');

// 1. Verify markets/us/ data exists
const requiredUsPacks = [
  'markets/us/manifest.json',
  'markets/us/food-labelling.json',
  'markets/us/nutrition-daily-values.json',
  'markets/us/allergens.json',
  'markets/us/claims.json',
  'markets/us/calorie-methods.json'
];

let packErrors = 0;
for (const relPath of requiredUsPacks) {
  const full = join(root, relPath);
  if (!existsSync(full)) {
    console.error(`✖ Missing required market pack file: ${relPath}`);
    packErrors++;
  } else {
    console.log(`✔ Verified US market pack file: ${relPath}`);
  }
}

if (packErrors > 0) {
  console.error(`\n✖ Market independence check FAILED: Missing ${packErrors} US market pack files.`);
  process.exit(1);
}

// 2. Scan core engine files for prohibited hardcoded US regulatory constants
const filesToInspect = [
  'lib/engine.mjs',
  'lib/prepress.mjs',
  'lib/rules/rule-evaluator.mjs',
  'lib/rules/rule-applicability.mjs',
  'lib/rules/market-pack-loader.mjs'
];

// Patterns representing US-specific regulatory constants that MUST NOT be hardcoded in engine primitives:
// e.g., hardcoded Daily Value map in core engine rather than referencing pack data
const prohibitedSignatures = [
  {
    name: 'Hardcoded US FDA Daily Value map',
    regex: /const\s+FDA_\w+_DAILY_VALUES\s*=\s*\{[^}]*total_fat:\s*78/i
  },
  {
    name: 'Hardcoded Sodium 2300mg reference in core engine',
    regex: /referenceDv\s*=\s*2300/
  },
  {
    name: 'Hardcoded Saturated Fat 20g reference in core engine',
    regex: /referenceDv\s*=\s*20\b/
  }
];

let violations = 0;
for (const file of filesToInspect) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  const content = readFileSync(p, 'utf8');

  for (const sig of prohibitedSignatures) {
    if (sig.regex.test(content)) {
      console.error(`✖ Architecture Violation in ${file}: Found ${sig.name}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n✖ Market independence check FAILED: ${violations} hardcoded market values detected.`);
  process.exit(1);
}

console.log('\n✔ All jurisdiction-neutral modules are free of hardcoded US regulatory constants.');
console.log('✔ Architecture Guard Passed: Market independence confirmed.\n');
process.exit(0);
