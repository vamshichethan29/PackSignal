#!/usr/bin/env node
/**
 * PackSignal Broken Test Case Generator CLI (scripts/generate-trust-cases.mjs)
 * Phase 8: Generates reproducible synthetic packaging defect cases with seeded PRNG.
 * Usage: node scripts/generate-trust-cases.mjs [--seed 42] [--count 21] [--split REGRESSION]
 */

import path from 'node:path';
import { generateEvaluationSuite } from '../lib/evaluation/fixture-generator.mjs';
import { validateFixtureIntegrity } from '../lib/evaluation/truth-validator.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { seed: 42, count: 21, split: 'REGRESSION', output: path.resolve('evaluation/generated') };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) opts.seed = Number(args[++i]) || 42;
    if (args[i] === '--count' && args[i + 1]) opts.count = Number(args[++i]) || 21;
    if (args[i] === '--split' && args[i + 1]) opts.split = args[++i].toUpperCase();
    if (args[i] === '--output' && args[i + 1]) opts.output = path.resolve(args[++i]);
  }
  return opts;
}

const opts = parseArgs();
console.log(`[PackSignal Generator] Synthesizing ${opts.count} cases (Seed: ${opts.seed}, Split: ${opts.split})...`);

const cases = generateEvaluationSuite({
  seed: opts.seed,
  count: opts.count,
  split: opts.split,
  outputDir: opts.output,
});

let validCount = 0;
let invalidCount = 0;

for (const c of cases) {
  const check = validateFixtureIntegrity(c);
  if (check.valid) {
    validCount++;
  } else {
    invalidCount++;
    console.warn(`  ⚠️ Fixture ${c.caseId} invalid: ${check.reasons.join('; ')}`);
  }
}

console.log(`[PackSignal Generator] Generated ${cases.length} cases: ${validCount} validated, ${invalidCount} invalid.`);
console.log(`[PackSignal Generator] Artifacts saved to: ${opts.output}`);
