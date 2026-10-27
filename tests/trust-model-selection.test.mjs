import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { executeModelBakeOff, persistWinningModelConfig, getWinningModelConfig } from '../lib/evaluation/model-bakeoff.mjs';

test('Winning model configuration is persisted with evaluation metadata and frozen status', () => {
  const result = executeModelBakeOff({ seed: 42 });
  const configPath = persistWinningModelConfig(result);

  assert.ok(fs.existsSync(configPath), 'Config file must exist');
  const cfg = getWinningModelConfig();

  assert.equal(cfg.defaultModel, 'gemini-3.8-flash');
  assert.equal(cfg.featureFreezeStatus, 'FROZEN');
  assert.ok(Array.isArray(cfg.fallbackModels));
  assert.ok(cfg.fallbackModels.includes('gemini-1.5-pro'));
  assert.ok(cfg.fallbackModels.includes('deterministic-local-engine'));
});
