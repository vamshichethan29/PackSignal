#!/usr/bin/env node
/**
 * PackSignal Reproducible Evaluation Runner CLI (scripts/run-trust-suite.mjs)
 * Phase 8: Executes test suite, computes precision/recall, and persists results.
 * Usage: node scripts/run-trust-suite.mjs [--category quantity] [--caseId tc-01] [--report]
 */

import fs from 'node:fs';
import path from 'node:path';
import { runEvaluationSuite } from '../lib/evaluation/runner.mjs';
import { persistEvaluationRun } from '../lib/evaluation/benchmark-store.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { category: 'all', caseId: null, seed: 42, report: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) opts.category = args[++i];
    if (args[i] === '--caseId' && args[i + 1]) opts.caseId = args[++i];
    if (args[i] === '--seed' && args[i + 1]) opts.seed = Number(args[++i]) || 42;
    if (args[i] === '--report') opts.report = true;
  }
  return opts;
}

const opts = parseArgs();
console.log(`[PackSignal Trust Runner] Starting evaluation (Seed: ${opts.seed}, Category: ${opts.category})...`);

const result = runEvaluationSuite(null, {
  seed: opts.seed,
  category: opts.category,
  caseId: opts.caseId,
  onProgress(evt) {
    process.stdout.write(`\r  Progress: ${evt.percent}% [${evt.current}/${evt.total}] - ${evt.caseId} (${evt.category})`);
  },
});

console.log('\n');
console.log('='.repeat(70));
console.log(` PACKSIGNAL TRUST SCOREBOARD — ${result.scoreboard.headline}`);
console.log('='.repeat(70));
console.log(`  Detection Rate:          ${result.scoreboard.detectionRate}%`);
console.log(`  Precision:               ${result.scoreboard.precision}`);
console.log(`  Recall:                  ${result.scoreboard.recall}`);
console.log(`  F1 Score:                ${result.scoreboard.f1Score}`);
console.log(`  False Positive Rate:     ${result.scoreboard.falsePositiveRate}`);
console.log(`  Clean Accuracy:          ${result.scoreboard.cleanAccuracy}`);
console.log(`  Safe Abstention Rate:    ${result.scoreboard.safeAbstentionRate}`);
console.log(`  Evidence Validity Rate:  ${result.scoreboard.evidenceValidityRate}`);
console.log(`  Average Latency:         ${result.scoreboard.avgLatencyMs || result.avgLatencyMs} ms`);
console.log('-'.repeat(70));

const artifactPath = persistEvaluationRun(result, { seed: opts.seed });
console.log(`[PackSignal Trust Runner] Results persisted to: ${artifactPath}`);

if (opts.report) {
  const reportPath = path.resolve('evaluation/reports/latest-trust-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`[PackSignal Trust Runner] Exported report to: ${reportPath}`);
}
