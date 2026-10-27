import test from 'node:test';
import assert from 'node:assert/strict';
import { executeModelBakeOff, CANDIDATE_MODELS } from '../lib/evaluation/model-bakeoff.mjs';

test('executeModelBakeOff compares at least 3 candidates under identical cases', () => {
  const result = executeModelBakeOff({ seed: 42 });

  assert.ok(result.leaderboard.length >= 3, 'Must evaluate at least 3 candidate engines');
  assert.equal(result.winningModel, 'gemini-3.8-flash');

  const winner = result.leaderboard.find(m => m.modelId === 'gemini-3.8-flash');
  assert.ok(winner, 'Winner entry must exist');
  assert.equal(winner.rank, 1);
  assert.equal(winner.passedSafetyGates, true);
  assert.ok(winner.costPer1kPacks.startsWith('$'));
});

test('Candidate models are uniquely identified without attribution leakage', () => {
  const modelIds = CANDIDATE_MODELS.map(m => m.id);
  const uniqueIds = new Set(modelIds);
  assert.equal(uniqueIds.size, modelIds.length, 'Model IDs must be unique');
});
