#!/usr/bin/env node
/**
 * PackSignal Model Bake-Off CLI (scripts/run-model-bakeoff.mjs)
 * Phase 8: Executes standardized model comparison and updates winning config.
 */

import { executeModelBakeOff, persistWinningModelConfig } from '../lib/evaluation/model-bakeoff.mjs';

console.log('[PackSignal Bake-Off] Starting 3-Model Comparative Evaluation...');
const result = executeModelBakeOff({ seed: 42 });

console.log('='.repeat(78));
console.log(' PACKSIGNAL AI MODEL BAKE-OFF LEADERBOARD');
console.log('='.repeat(78));
console.log('| Model / Engine            | Caught | Recall | False Alarms | Latency  | Cost / 1k | Rank |');
console.log('|:--------------------------|:------:|:------:|:------------:|:--------:|:---------:|:----:|');
for (const m of result.leaderboard) {
  const name = m.displayName.padEnd(26).slice(0, 26);
  const caught = (m.caughtOfTotal || 'N/A').padEnd(6);
  const recall = (m.recall || 'N/A').padEnd(6);
  const fa = String(m.falseAlarms ?? '0').padEnd(12);
  const latency = `${m.avgLatencyMs}ms`.padEnd(8);
  const cost = (m.costPer1kPacks || '$0.00').padEnd(9);
  const rank = String(m.rank === 0 ? 'Base' : m.rank).padEnd(4);
  console.log(`| ${name} | ${caught} | ${recall} | ${fa} | ${latency} | ${cost} | ${rank} |`);
}
console.log('-'.repeat(78));
console.log(`Winning Model Selected: ${result.winningModel} (${result.winningModelName})`);
console.log(`Selection Policy:       ${result.selectionPolicy}`);

const configPath = persistWinningModelConfig(result);
console.log(`[PackSignal Bake-Off] Winning model config written to: ${configPath}`);
